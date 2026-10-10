import { createStaff } from './staff.js';
import { createKeyboard } from './keyboard.js';
import { createScore, press, hold, release, removeNote, clearScore } from './score.js';
import { createQuiz, answer, setRange, questionPool, rangeBetween, sameRange, MIN_POOL } from './quiz.js';
import { pitchName } from './music.js';
import { attachDeleteGesture } from './delete-gesture.js';
import { createPiano } from './sound.js';
import { VERSION } from './version.js';
import { playIntro } from './intro.js';

playIntro(document.getElementById('intro'));

const score = createScore();
document.getElementById('version').textContent = `v${VERSION}`;

// 音訊狀態顯示：
// - 音訊還沒啟動（或從背景回來被暫停）時，蓋一層「點一下開始」，讓那一下成為合法的手勢來啟動音訊。
// - 音色載入中或載入失敗時，在右上角顯示小標籤。
const audioGate = document.getElementById('audio-gate');
const audioChip = document.getElementById('audio-chip');
const debugPanel = new URLSearchParams(location.search).has('debug') ? document.getElementById('debug') : null;
function showAudioStatus({ context, loaded, error }) {
  if (loaded || error) registerServiceWorker();
  audioGate.hidden = context === 'running';
  audioChip.hidden = loaded && !error;
  audioChip.textContent = error ?? '音色載入中…';
  if (debugPanel) {
    debugPanel.hidden = false;
    debugPanel.textContent = JSON.stringify({
      context,
      loaded,
      error,
      audioSession: navigator.audioSession?.type ?? '不支援',
      standalone: navigator.standalone ?? matchMedia('(display-mode: standalone)').matches,
      sw: navigator.serviceWorker?.controller ? '有' : '無',
      ua: navigator.userAgent,
    }, null, 1);
  }
}
const piano = createPiano({ onStatus: showAudioStatus });
// iOS／Chrome 只在 touchend、click 這類「放開」的手勢裡允許啟動音訊。
for (const type of ['touchend', 'click']) document.addEventListener(type, piano.unlock);
const scroller = document.getElementById('staff-scroll');
const staff = createStaff(scroller, document.getElementById('staff-header'));

// 黑鍵記法：'sharp' 或 'flat'，只影響之後按下的鍵。
let blackMode = 'sharp';
const toggleButtons = document.querySelectorAll('#accidental-toggle button');
for (const button of toggleButtons) {
  button.addEventListener('click', () => {
    blackMode = button.dataset.mode;
    for (const b of toggleButtons) b.setAttribute('aria-pressed', String(b === button));
  });
}

// 清除所有音符；無法復原，所以要按兩下：第一下變成「確定清除？」，3 秒內再按一下才清除。
// 不用 confirm()：iOS 跳出系統對話框會打斷音訊，關掉後又要「點一下開始」。
const CLEAR_CONFIRM_MS = 3000;
const clearButton = document.getElementById('clear');
let clearArmed = null; // 等待第二下時的計時器
function disarmClear() {
  clearTimeout(clearArmed);
  clearArmed = null;
  clearButton.classList.remove('armed');
  clearButton.textContent = '清除';
}
clearButton.addEventListener('click', () => {
  if (!clearArmed) {
    clearButton.classList.add('armed');
    clearButton.textContent = '確定清除？';
    clearArmed = setTimeout(disarmClear, CLEAR_CONFIRM_MS);
    return;
  }
  disarmClear();
  clearScore(score);
  render();
});

// 重畫並捲到「最新音符停在畫面中間」，讓視線集中；音符還沒排到中間前不捲動。
// 使用者滑回去看舊音符時，一按新鍵也會跳回這裡。
function render() {
  clearButton.disabled = score.chords.length === 0;
  showOnStaff(score.chords);
}

function showOnStaff(chords) {
  const center = scroller.clientWidth / 2;
  const latestRight = staff.render(chords, center);
  scroller.scrollLeft = latestRight === null ? 0 : latestRight - center;
}

// 長按音符後它會跟著手指移動，往上拉再放開就刪掉它。刪除後停在原本看的位置，不跳回最新音符。
// 測驗模式時譜上是題目，不能刪。
attachDeleteGesture(scroller, {
  noteAt: (x, y, radius) => (quizMode ? null : staff.noteAt(x, y, radius)),
  onDelete({ chordIndex, pitch }) {
    removeNote(score, chordIndex, pitch);
    clearButton.disabled = score.chords.length === 0;
    const { scrollLeft } = scroller;
    staff.render(score.chords, scroller.clientWidth / 2);
    scroller.scrollLeft = scrollLeft;
  },
});

// 按住琴鍵時每一格畫面檢查一次按了多久，音符一變長（四分→二分→全音符）就重畫，
// 讓人看得到什麼時候該放開。鍵都放開後就停止檢查。
let watchingHold = false;
function watchHold() {
  if (!score.holding) {
    watchingHold = false;
    return;
  }
  if (hold(score, performance.now())) render();
  requestAnimationFrame(watchHold);
}

const keyboard = createKeyboard(document.getElementById('keyboard'), {
  blackMode: () => blackMode,
  onPress(pitch) {
    if (quizMode === 'picking') return; // 拖曳選範圍時不發聲
    // 先發聲再重畫，讓重畫的時間不影響聲音的延遲。
    piano.noteOn(pitch);
    if (quizMode === 'playing') {
      answerQuiz(pitch);
      return;
    }
    press(score, pitch, performance.now());
    render();
    if (!watchingHold) {
      watchingHold = true;
      requestAnimationFrame(watchHold);
    }
  },
  onRelease(pitch) {
    piano.noteOff(pitch);
    if (release(score, pitch, performance.now()) && !quizMode) render();
  },
});

// 測驗模式：譜上出一個音，按對應的琴鍵作答。
// 1. 選範圍（quizMode = 'picking'）：在鍵盤上拖曳，從按下的鍵拖到放開的鍵就是範圍，範圍內會出題的鍵變藍；
//    勾「含黑鍵」時黑鍵也出題。這時按鍵不發聲。範圍會記住，下次進測驗直接用。
// 2. 作答（quizMode = 'playing'）：只出範圍內的鍵。答對這題變綠留在譜上，下一題接在右邊
//    （四分音符，每 4 題一個小節），譜跟著往右捲；答錯時按錯的鍵和題目閃紅一下，不換題，要按到對為止。
// 測驗不會動到樂譜，結束後原本寫的音符都還在。
const QUIZ_MISS_MS = 500;
const QUIZ_RANGE_KEY = 'quiz-range'; // localStorage
const quizToggle = document.getElementById('quiz-toggle');
const composeTools = document.querySelector('.compose-tools');
const quizTools = document.querySelector('.quiz-tools');
const quizStatus = document.getElementById('quiz-status');
const quizRangeButton = document.getElementById('quiz-range');
const quizStartButton = document.getElementById('quiz-start');
const quizBlackLabel = document.querySelector('.quiz-black');
const quizBlackCheckbox = document.getElementById('quiz-black');
let quizMode = null; // null | 'picking' | 'playing'
let quiz = null;
let quizRange = loadQuizRange();
let missTimer = null;

function loadQuizRange() {
  try {
    const saved = JSON.parse(localStorage.getItem(QUIZ_RANGE_KEY));
    if (Number.isInteger(saved?.low) && Number.isInteger(saved?.high)) return { ...saved, black: saved.black === true };
  } catch {
    // 私密瀏覽等情況讀不到就用預設
  }
  return { low: 60, high: 72, black: false }; // C4～C5、只有白鍵
}

function saveQuizRange() {
  try {
    localStorage.setItem(QUIZ_RANGE_KEY, JSON.stringify(quizRange));
  } catch {
    // 存不了就算了，只是下次要重選
  }
}

// 範圍的文字，例如「E3–D4」（範圍內會出題的最低到最高的鍵）。
function rangeLabel() {
  const pool = questionPool(quizRange);
  return pool.length > 0 ? `${pitchName(pool[0])}–${pitchName(pool.at(-1))}` : '';
}

// ---- 選範圍 ----

function showPicking() {
  const pool = questionPool(quizRange);
  const enough = pool.length >= MIN_POOL;
  quizStatus.textContent = enough ? `拖曳琴鍵選範圍：${rangeLabel()}` : '拖曳琴鍵選範圍（至少兩個鍵）';
  quizStartButton.disabled = !enough;
  keyboard.clearMarks('quiz-range');
  for (const pitch of pool) keyboard.mark(pitch, 'quiz-range');
  // 譜上顯示範圍最低與最高的音
  showOnStaff(enough ? [pool[0], pool.at(-1)].map((pitch) => ({ pitches: [pitch], eighths: 4 })) : []);
}

function startPicking() {
  clearMiss();
  quizMode = 'picking';
  quizStatus.hidden = false;
  quizRangeButton.hidden = true;
  quizStartButton.hidden = false;
  quizBlackLabel.hidden = false;
  quizBlackCheckbox.checked = quizRange.black;
  showPicking();
}

quizBlackCheckbox.addEventListener('change', () => {
  quizRange = { ...quizRange, black: quizBlackCheckbox.checked };
  saveQuizRange();
  showPicking();
});

let dragFrom = null; // 拖曳選範圍時按下的那個鍵的音高
const keyboardElement = document.getElementById('keyboard');
keyboardElement.addEventListener('pointerdown', (event) => {
  if (quizMode !== 'picking') return;
  dragFrom = keyboard.pitchAt(event.clientX, event.clientY);
  if (!dragFrom) return;
  quizRange = rangeBetween(dragFrom, dragFrom, quizRange.black);
  showPicking();
});
keyboardElement.addEventListener('pointermove', (event) => {
  if (quizMode !== 'picking' || !dragFrom) return;
  const to = keyboard.pitchAt(event.clientX, event.clientY);
  if (!to) return;
  const range = rangeBetween(dragFrom, to, quizRange.black);
  if (sameRange(range, quizRange)) return;
  quizRange = range;
  showPicking();
});
for (const type of ['pointerup', 'pointercancel']) {
  keyboardElement.addEventListener(type, () => {
    if (!dragFrom) return;
    dragFrom = null;
    saveQuizRange();
  });
}

// ---- 作答 ----

// 畫出答過的音（綠色）與目前的題目，題目停在畫面中間。
function drawQuiz() {
  showOnStaff([...quiz.history, quiz.target].map((pitch) => ({ pitches: [pitch], eighths: 2 })));
  quiz.history.forEach((_, i) => staff.markChord(i, 'quiz-done'));
}

function showQuestion() {
  clearMiss();
  quizStatus.textContent = `答對 ${quiz.correct}／${quiz.total}`;
  drawQuiz();
}

function clearMiss() {
  clearTimeout(missTimer);
  keyboard.clearMarks('quiz-miss');
  for (const element of scroller.querySelectorAll('.quiz-miss')) element.classList.remove('quiz-miss');
}

function answerQuiz(pitch) {
  if (answer(quiz, pitch)) {
    showQuestion();
    return;
  }
  clearMiss();
  keyboard.mark(pitch, 'quiz-miss');
  staff.markChord(quiz.history.length, 'quiz-miss');
  missTimer = setTimeout(clearMiss, QUIZ_MISS_MS);
}

// 從選範圍回到作答：範圍有變才重新計分，沒變就接著原本的題目與分數。
function startPlaying() {
  if (!quiz) quiz = createQuiz(quizRange);
  else if (!sameRange(quiz.range, quizRange)) setRange(quiz, quizRange);
  quizMode = 'playing';
  keyboard.clearMarks('quiz-range');
  quizRangeButton.textContent = `範圍 ${rangeLabel()}${quizRange.black ? '（含黑鍵）' : ''}`;
  quizRangeButton.hidden = false;
  quizStartButton.hidden = true;
  quizBlackLabel.hidden = true;
  showQuestion();
}

// ---- 進出測驗 ----

function enterQuiz() {
  disarmClear();
  composeTools.hidden = true;
  quizTools.hidden = false;
  quizToggle.textContent = '結束';
  startPicking();
}

function endQuiz() {
  clearMiss();
  keyboard.clearMarks();
  quizMode = null;
  quiz = null;
  dragFrom = null;
  composeTools.hidden = false;
  quizTools.hidden = true;
  quizToggle.textContent = '測驗';
  render();
}

quizToggle.addEventListener('click', () => (quizMode ? endQuiz() : enterQuiz()));
quizStartButton.addEventListener('click', startPlaying);
quizRangeButton.addEventListener('click', startPicking);

window.addEventListener('resize', () => {
  if (quizMode === 'picking') showPicking();
  else if (quizMode === 'playing') drawQuiz();
  else render();
});
render();

// 離線使用：註冊 Service Worker（只在 http(s) 下可用）。
// 等鋼琴取樣載完才註冊：Service Worker 安裝時會預先下載同一批 mp3，第一次開啟時若兩邊同時下載，
// 頁面的取樣請求可能卡住、一直載不完（在 GitHub Pages 上實測過）。取樣載完後，安裝時就能直接用瀏覽器快取。
// 取樣一直載不完時，30 秒後仍會註冊，確保離線功能最後還是裝得上。
// 有新版 Service Worker 接手時，如果還沒彈任何音，就重新載入直接換成新版。
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || registerServiceWorker.done) return;
  registerServiceWorker.done = true;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && score.chords.length === 0 && !quizMode) location.reload();
  });
  navigator.serviceWorker.register('sw.js');
}
setTimeout(registerServiceWorker, 30000);
