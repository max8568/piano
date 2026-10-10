// 鋼琴鍵盤：產生琴鍵 DOM、處理觸控。
import { whiteKeys, pitchName, isMiddleC } from './music.js';

export function createKeyboard(container, { onPress }) {
  const keys = whiteKeys();

  for (const [index, pitch] of keys.entries()) {
    const key = document.createElement('div');
    key.className = 'key white';
    key.dataset.index = index;
    if (isMiddleC(pitch)) key.classList.add('middle-c');
    if (pitch.letter === 'c') {
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = pitchName(pitch);
      key.append(label);
    }
    container.append(key);
  }

  // 以 pointerId 追蹤每根手指按住的鍵，支援多指。
  const pressed = new Map();

  function release(pointerId) {
    const key = pressed.get(pointerId);
    if (!key) return;
    pressed.delete(pointerId);
    if (![...pressed.values()].includes(key)) key.classList.remove('pressed');
  }

  container.addEventListener('pointerdown', (event) => {
    const key = event.target.closest('.key');
    if (!key) return;
    event.preventDefault();
    pressed.set(event.pointerId, key);
    key.classList.add('pressed');
    onPress(keys[key.dataset.index]);
  });
  for (const type of ['pointerup', 'pointercancel']) {
    container.addEventListener(type, (event) => release(event.pointerId));
  }
}
