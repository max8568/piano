import { createStaff } from './staff.js';
import { createKeyboard } from './keyboard.js';
import { createScore, press } from './score.js';

const score = createScore();
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

// 重畫並捲到「最新音符貼在右側」，右邊留出切換按鈕的寬度，避免音符被擋住。
// 使用者滑回去看舊音符時，一按新鍵也會跳回這裡。
const toggle = document.querySelector('.accidental-toggle');
function render() {
  const reserved = toggle.offsetWidth + 32;
  const latestRight = staff.render(score.beats, reserved);
  scroller.scrollLeft = latestRight === null ? 0 : latestRight - (scroller.clientWidth - reserved);
}

createKeyboard(document.getElementById('keyboard'), {
  blackMode: () => blackMode,
  onPress(pitch) {
    press(score, pitch, performance.now());
    render();
  },
});

window.addEventListener('resize', render);
render();
