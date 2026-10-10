import { createStaff } from './staff.js';
import { createKeyboard } from './keyboard.js';
import { createScore, press, hold, release, removeNote, clearScore } from './score.js';
import { createQuiz, answer, setRange } from './quiz.js';
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
  noteAt: (x, y, radius) => (quiz ? null : staff.noteAt(x, y, radius)),
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
    // 先發聲再重畫，讓重畫的時間不影響聲音的延遲。
    piano.noteOn(pitch);
    if (quiz) {
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
    if (release(score, pitch, performance.now()) && !quiz) render();
  },
});

// 測驗模式：譜上出一個音，按對應的琴鍵作答。只出白鍵，可以選高音譜、低音譜或兩行都出。
// 答對：這題變綠留在譜上，下一題接在右邊（四分音符，每 4 題一個小節），譜跟著往右捲。
// 答錯：按錯的鍵和題目閃紅一下，不換題，要按到對為止；不提示正確的鍵。
// 測驗不會動到樂譜，結束後原本寫的音符都還在。
const QUIZ_MISS_MS = 500;
const quizToggle = document.getElementById('quiz-toggle');
const composeTools = document.querySelector('.compose-tools');
const quizTools = document.querySelector('.quiz-tools');
const quizScore = document.getElementById('quiz-score');
const rangeButtons = document.querySelectorAll('#quiz-range button');
let quiz = null;
let quizRange = 'treble';
let missTimer = null;

// 畫出答過的音（綠色）與目前的題目，題目停在畫面中間。
function drawQuiz() {
  showOnStaff([...quiz.history, quiz.target].map((pitch) => ({ pitches: [pitch], eighths: 2 })));
  quiz.history.forEach((_, i) => staff.markChord(i, 'quiz-done'));
}

function showQuestion() {
  clearMiss();
  quizScore.textContent = `答對 ${quiz.correct}／${quiz.total}`;
  drawQuiz();
}

function clearMiss() {
  clearTimeout(missTimer);
  keyboard.clearMarks();
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

function startQuiz() {
  disarmClear();
  quiz = createQuiz(quizRange);
  composeTools.hidden = true;
  quizTools.hidden = false;
  quizToggle.textContent = '結束';
  showQuestion();
}

function endQuiz() {
  clearMiss();
  quiz = null;
  composeTools.hidden = false;
  quizTools.hidden = true;
  quizToggle.textContent = '測驗';
  render();
}

quizToggle.addEventListener('click', () => (quiz ? endQuiz() : startQuiz()));
for (const button of rangeButtons) {
  button.addEventListener('click', () => {
    quizRange = button.dataset.range;
    for (const b of rangeButtons) b.setAttribute('aria-pressed', String(b === button));
    if (!quiz) return;
    setRange(quiz, quizRange);
    showQuestion();
  });
}

window.addEventListener('resize', () => (quiz ? drawQuiz() : render()));
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
    if (hadController && score.chords.length === 0 && !quiz) location.reload();
  });
  navigator.serviceWorker.register('sw.js');
}
setTimeout(registerServiceWorker, 30000);
