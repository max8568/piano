// 樂譜資料模型：一串「拍」，每一拍是一組同時按下的音（和弦），每拍都是四分音符。

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
