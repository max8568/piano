// 音高相關的純邏輯，不碰 DOM，方便測試。
// 音高（pitch）：{ letter: 'c'..'b', octave: 2..6, accidental: '' | '#' | 'b' }

export const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const SEMITONES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const ACCIDENTAL_SHIFT = { '': 0, '#': 1, b: -1 };

export const LOWEST_OCTAVE = 2; // C2
export const HIGHEST_OCTAVE = 6; // C6（只到 C，不含 D6 以上）

// 中央 Do（C4）以上記在高音譜，以下記在低音譜。
export const SPLIT_OCTAVE = 4;

function natural(letter, octave) {
  return { letter, octave, accidental: '' };
}

// C2–C6 的所有白鍵，由低到高。
export function whiteKeys() {
  const keys = [];
  for (let octave = LOWEST_OCTAVE; octave < HIGHEST_OCTAVE; octave++) {
    for (const letter of LETTERS) keys.push(natural(letter, octave));
  }
  keys.push(natural('c', HIGHEST_OCTAVE));
  return keys;
}

// C2–C6 的所有黑鍵。每個黑鍵記下它右邊的白鍵位置（afterWhite），以及升／降兩種寫法。
export function blackKeys() {
  const whites = whiteKeys();
  const keys = [];
  for (let i = 0; i < whites.length - 1; i++) {
    const below = whites[i];
    const above = whites[i + 1];
    // 相鄰白鍵差全音（不是 E–F、B–C）時中間才有黑鍵。
    if (SEMITONES[above.letter] - SEMITONES[below.letter] === 2) {
      keys.push({
        afterWhite: i,
        sharp: { ...below, accidental: '#' },
        flat: { ...above, accidental: 'b' },
      });
    }
  }
  return keys;
}

// 黑鍵依目前模式（'sharp' | 'flat'）決定寫法。
export function spell(blackKey, mode) {
  return mode === 'flat' ? blackKey.flat : blackKey.sharp;
}

export function midi(pitch) {
  return 12 * (pitch.octave + 1) + SEMITONES[pitch.letter] + ACCIDENTAL_SHIFT[pitch.accidental];
}

// 在五線譜上的高低位置（只看字母與八度，不看升降）。
export function staffPosition(pitch) {
  return pitch.octave * 7 + LETTERS.indexOf(pitch.letter);
}

export function staffFor(pitch) {
  return pitch.octave >= SPLIT_OCTAVE ? 'treble' : 'bass';
}

// VexFlow 的 key 字串，例如 "c/4"、"f#/3"。
export function vexKey(pitch) {
  return `${pitch.letter}${pitch.accidental}/${pitch.octave}`;
}

// 琴鍵上顯示的名稱，例如 "C4"。
export function pitchName(pitch) {
  return `${pitch.letter.toUpperCase()}${pitch.accidental}${pitch.octave}`;
}

export function isMiddleC(pitch) {
  return pitch.letter === 'c' && pitch.accidental === '' && pitch.octave === 4;
}
