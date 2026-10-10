import { createStaff } from './staff.js';
import { createKeyboard } from './keyboard.js';
import { createScore, press } from './score.js';
import { createPiano } from './sound.js';
import { VERSION } from './version.js';

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
const toggleButtons = document.querySelectorAll('.accidental-toggle button');
for (const button of toggleButtons) {
  button.addEventListener('click', () => {
    blackMode = button.dataset.mode;
    for (const b of toggleButtons) b.setAttribute('aria-pressed', String(b === button));
  });
}

// 重畫並捲到「最新音符停在畫面中間」，讓視線集中；音符還沒排到中間前不捲動。
// 使用者滑回去看舊音符時，一按新鍵也會跳回這裡。
function render() {
  const center = scroller.clientWidth / 2;
  const latestRight = staff.render(score.beats, center);
  scroller.scrollLeft = latestRight === null ? 0 : latestRight - center;
}

createKeyboard(document.getElementById('keyboard'), {
  blackMode: () => blackMode,
  onPress(pitch) {
    // 先發聲再重畫，讓重畫的時間不影響聲音的延遲。
    piano.noteOn(pitch);
    press(score, pitch, performance.now());
    render();
  },
  onRelease(pitch) {
    piano.noteOff(pitch);
  },
});

window.addEventListener('resize', render);
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
    if (hadController && score.beats.length === 0) location.reload();
  });
  navigator.serviceWorker.register('sw.js');
}
setTimeout(registerServiceWorker, 30000);
