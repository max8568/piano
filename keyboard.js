// 鋼琴鍵盤：產生琴鍵 DOM、處理觸控。
import { whiteKeys, blackKeys, spell, pitchName, isMiddleC, midi } from './music.js';

// blackMode()：目前黑鍵要記成 'sharp' 還是 'flat'。
// onPress(pitch)／onRelease(pitch)：手指按下／放開某個鍵。
// 回傳 { mark(pitch, className), clearMarks() }：把某個音的琴鍵加上顏色（測驗模式標出正確／按錯的鍵）。
export function createKeyboard(container, { blackMode, onPress, onRelease = () => {} }) {
  const whites = whiteKeys();
  const blacks = blackKeys();
  const pitchOf = new Map(); // 琴鍵元素 → 取得音高的函式

  for (const pitch of whites) {
    const key = document.createElement('div');
    key.className = 'key white';
    if (isMiddleC(pitch)) key.classList.add('middle-c');
    if (pitch.letter === 'c') {
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = pitchName(pitch);
      key.append(label);
    }
    pitchOf.set(key, () => pitch);
    container.append(key);
  }

  for (const blackKey of blacks) {
    const key = document.createElement('div');
    key.className = 'key black';
    // 黑鍵中心落在 afterWhite 與下一個白鍵的交界。
    key.style.setProperty('--boundary', (blackKey.afterWhite + 1) / whites.length);
    pitchOf.set(key, () => spell(blackKey, blackMode()));
    container.append(key);
  }

  // 以 pointerId 追蹤每根手指按住的鍵與音高，支援多指。
  const pressed = new Map();

  function release(pointerId) {
    const entry = pressed.get(pointerId);
    if (!entry) return;
    pressed.delete(pointerId);
    if (![...pressed.values()].some((other) => other.key === entry.key)) entry.key.classList.remove('pressed');
    onRelease(entry.pitch);
  }

  container.addEventListener('pointerdown', (event) => {
    const key = event.target.closest('.key');
    if (!key) return;
    event.preventDefault();
    const pitch = pitchOf.get(key)();
    pressed.set(event.pointerId, { key, pitch });
    key.classList.add('pressed');
    onPress(pitch);
  });
  for (const type of ['pointerup', 'pointercancel']) {
    container.addEventListener(type, (event) => release(event.pointerId));
  }

  const marked = new Map(); // 琴鍵元素 → 加上的 class
  return {
    mark(pitch, className) {
      for (const [key, pitchOfKey] of pitchOf) {
        if (midi(pitchOfKey()) !== midi(pitch)) continue;
        key.classList.add(className);
        marked.set(key, className);
      }
    },
    clearMarks() {
      for (const [key, className] of marked) key.classList.remove(className);
      marked.clear();
    },
  };
}
