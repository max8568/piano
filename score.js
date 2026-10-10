// 樂譜資料模型：一串「拍」，每一拍是一組同時按下的音（和弦），每拍都是四分音符。
import { staffFor } from './music.js';

export const BEATS_PER_MEASURE = 4; // 4/4

export function createScore() {
  return { beats: [] };
}

export function addBeat(score, pitches) {
  score.beats.push([...pitches]);
}

// 依 4/4 把拍分成小節；最後一個小節可能未滿。
export function measures(beats) {
  const result = [];
  for (let i = 0; i < beats.length; i += BEATS_PER_MEASURE) {
    result.push(beats.slice(i, i + BEATS_PER_MEASURE));
  }
  return result;
}

export function isComplete(measure) {
  return measure.length === BEATS_PER_MEASURE;
}

// 每個音在譜上要標的記號：'#'、'b'、'n'（還原記號）或 null（不用標）。
// 規則（C 大調）：記號從出現處延續到小節結束，只作用在同一行、同字母、同八度的音；
// 與目前狀態不同時才需要標。回傳的陣列與 measure 的形狀相同。
export function accidentalMarks(measure) {
  const state = new Map();
  return measure.map((beat) =>
    beat.map((pitch) => {
      const key = `${staffFor(pitch)}:${pitch.letter}${pitch.octave}`;
      const current = state.get(key) ?? '';
      state.set(key, pitch.accidental);
      if (pitch.accidental === current) return null;
      return pitch.accidental === '' ? 'n' : pitch.accidental;
    }),
  );
}
