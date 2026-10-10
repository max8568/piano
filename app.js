import { createStaff } from './staff.js';
import { createKeyboard } from './keyboard.js';
import { createScore, addBeat } from './score.js';

const score = createScore();
const scroller = document.getElementById('staff-scroll');
const staff = createStaff(scroller, document.getElementById('staff-header'));

// 重畫並捲到「最新音符貼在右側」。使用者滑回去看舊音符時，一按新鍵也會跳回這裡。
function render() {
  const latestRight = staff.render(score.beats);
  scroller.scrollLeft = latestRight === null ? 0 : latestRight - scroller.clientWidth;
}

createKeyboard(document.getElementById('keyboard'), {
  onPress(pitch) {
    addBeat(score, [pitch]);
    render();
  },
});

window.addEventListener('resize', render);
render();
