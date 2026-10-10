import { createStaff } from './staff.js';
import { createKeyboard } from './keyboard.js';
import { createScore, addBeat } from './score.js';

const score = createScore();
const staffArea = document.getElementById('staff');
const staff = createStaff(staffArea);

function render() {
  staff.render(score.beats);
  staffArea.scrollLeft = staffArea.scrollWidth;
}

createKeyboard(document.getElementById('keyboard'), {
  onPress(pitch) {
    addBeat(score, [pitch]);
    render();
  },
});

window.addEventListener('resize', render);
render();
