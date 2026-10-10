import { createStaff } from './staff.js';
import { createKeyboard } from './keyboard.js';

const notes = [];
const staffArea = document.getElementById('staff');
const staff = createStaff(staffArea);

function render() {
  staff.render(notes);
  staffArea.scrollLeft = staffArea.scrollWidth;
}

createKeyboard(document.getElementById('keyboard'), {
  onPress(pitch) {
    notes.push(pitch);
    render();
  },
});

window.addEventListener('resize', render);
render();
