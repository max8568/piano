// 音高相關的純邏輯，不碰 DOM，方便測試。

export const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

export const LOWEST_OCTAVE = 2; // C2
export const HIGHEST_OCTAVE = 6; // C6（只到 C，不含 D6 以上）

// 中央 Do（C4）以上記在高音譜，以下記在低音譜。
export const SPLIT_OCTAVE = 4;

// C2–C6 的所有白鍵，由低到高。
export function whiteKeys() {
  const keys = [];
  for (let octave = LOWEST_OCTAVE; octave < HIGHEST_OCTAVE; octave++) {
    for (const letter of LETTERS) keys.push({ letter, octave });
  }
  keys.push({ letter: 'c', octave: HIGHEST_OCTAVE });
  return keys;
}

export function staffFor(pitch) {
  return pitch.octave >= SPLIT_OCTAVE ? 'treble' : 'bass';
}

// VexFlow 的 key 字串，例如 "c/4"。
export function vexKey(pitch) {
  return `${pitch.letter}/${pitch.octave}`;
}

// 琴鍵上顯示的名稱，例如 "C4"。
export function pitchName(pitch) {
  return `${pitch.letter.toUpperCase()}${pitch.octave}`;
}

export function isMiddleC(pitch) {
  return pitch.letter === 'c' && pitch.octave === 4;
}
