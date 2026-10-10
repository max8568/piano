// 樂譜資料模型：一串和弦（同時按下的一組音，單音也算），每個和弦是八分、四分、二分或全音符。
// 長度看按住多久：按下時先記成八分音符，按住越久變得越長，放開（或按下一個和弦）時定案。
// 長度與位置都以「八分音符」為單位：八分 1、四分 2、二分 4、全音符 8，4/4 拍一小節 8 個單位。
import { staffFor, midi } from './music.js';

export const BEATS_PER_MEASURE = 4; // 4/4
export const EIGHTHS_PER_BEAT = 2;
export const EIGHTHS_PER_MEASURE = BEATS_PER_MEASURE * EIGHTHS_PER_BEAT;

// 在這段時間（毫秒）內按下的鍵，算成同一個和弦。
export const CHORD_WINDOW_MS = 80;

// 按住多久算哪種音符：未滿 QUARTER_MS 八分（半拍）、未滿 HALF_MS 四分（一拍）、未滿 WHOLE_MS 二分（兩拍），更久全音符。
export const QUARTER_MS = 200;
export const HALF_MS = 500;
export const WHOLE_MS = 1200;

const LENGTHS = [8, 4, 2, 1];

// chords：[{ pitches, eighths }]，eighths 是長度（八分音符的個數）。
// lastChordAt：最新和弦第一個鍵按下的時間。holding：最新和弦還有鍵按著時是那些鍵的 MIDI 編號，否則為 null。
export function createScore() {
  return { chords: [], lastChordAt: -Infinity, holding: null };
}

// 按住 ms 毫秒想要的長度（八分音符的個數）。
export function eighthsFor(ms) {
  if (ms < QUARTER_MS) return 1;
  if (ms < HALF_MS) return 2;
  if (ms < WHOLE_MS) return 4;
  return 8;
}

// 不超過 wanted 也不超過 room（小節剩下的長度）的最長音符；沒有附點，例如剩 3 拍時最長是二分音符。
function fitLength(wanted, room) {
  return LENGTHS.find((length) => length <= wanted && length <= room);
}

// 在時間 time（毫秒）按下 pitch：距離最新和弦第一個鍵不到 CHORD_WINDOW_MS 就加進和弦，
// 否則開始新的和弦。同一個和弦裡重複的音（同一個琴鍵）忽略。
export function press(score, pitch, time) {
  const current = score.chords.at(-1);
  if (current && time - score.lastChordAt <= CHORD_WINDOW_MS) {
    if (!current.pitches.some((p) => midi(p) === midi(pitch))) current.pitches.push(pitch);
    (score.holding ??= new Set()).add(midi(pitch));
    return;
  }
  hold(score, time); // 上一個和弦如果還按著，長度算到現在為止
  score.chords.push({ pitches: [pitch], eighths: 1 });
  score.lastChordAt = time;
  score.holding = new Set([midi(pitch)]);
}

// 最新和弦還按著時，依按住的時間把它變長（只會變長）；不能超過它所在小節剩下的長度。
// 長度有變時回傳 true（畫面要重畫）。
export function hold(score, time) {
  if (!score.holding) return false;
  const chord = score.chords.at(-1);
  const eighths = fitLength(eighthsFor(time - score.lastChordAt), roomBefore(score.chords.length - 1, score.chords));
  if (eighths <= chord.eighths) return false;
  chord.eighths = eighths;
  return true;
}

// 在時間 time 放開 pitch。最新和弦的鍵全部放開後，它的長度就定案。長度有變時回傳 true。
export function release(score, pitch, time) {
  if (!score.holding) return false;
  const changed = hold(score, time);
  score.holding.delete(midi(pitch));
  if (score.holding.size === 0) score.holding = null;
  return changed;
}

// 第 index 個和弦所在小節，在它之前還剩多少長度。
function roomBefore(index, chords) {
  const last = measures(chords.slice(0, index)).at(-1);
  return last && !isComplete(last) ? EIGHTHS_PER_MEASURE - lengthOf(last) : EIGHTHS_PER_MEASURE;
}

// 刪掉第 chordIndex 個和弦裡的 pitch（同一個琴鍵）；那個和弦刪空了就整個移除，後面的往前補。
// 刪除後下一個按鍵一定開始新的和弦，不會併進被改過的和弦。
export function removeNote(score, chordIndex, pitch) {
  const chord = score.chords[chordIndex];
  if (!chord) return;
  const i = chord.pitches.findIndex((p) => midi(p) === midi(pitch));
  if (i === -1) return;
  chord.pitches.splice(i, 1);
  if (chord.pitches.length === 0) score.chords.splice(chordIndex, 1);
  score.lastChordAt = -Infinity;
  score.holding = null;
}

// 清除所有音符。
export function clearScore(score) {
  score.chords.length = 0;
  score.lastChordAt = -Infinity;
  score.holding = null;
}

// 依 4/4 把和弦分成小節：[[{ pitches, eighths, start, index }]]，start 是在小節裡的起點、
// index 是在 chords 裡的位置；最後一個小節可能未滿。
// 錄的時候長度就不會超過小節，但刪掉前面的音符後，後面的會往前移、可能跨過小節線，
// 這時只在排版上縮短成放得下的長度（資料裡的長度不變）。
export function measures(chords) {
  const result = [];
  let current = [];
  let used = 0;
  chords.forEach((chord, index) => {
    const eighths = fitLength(chord.eighths, EIGHTHS_PER_MEASURE - used);
    current.push({ pitches: chord.pitches, eighths, start: used, index });
    used += eighths;
    if (used === EIGHTHS_PER_MEASURE) {
      result.push(current);
      current = [];
      used = 0;
    }
  });
  if (current.length > 0) result.push(current);
  return result;
}

function lengthOf(measure) {
  return measure.reduce((sum, entry) => sum + entry.eighths, 0);
}

export function isComplete(measure) {
  return lengthOf(measure) === EIGHTHS_PER_MEASURE;
}

// 一個音符在譜上要寫成哪幾個（用連結線連起來的）音符，讓每一拍從哪裡開始都看得出來：
// 每一段都從自己長度的整數倍位置開始——全音符只在第 1 拍、二分音符只在第 1 或第 3 拍、
// 四分音符在拍點上、八分音符哪裡都可以。不合的就拆短，例如：
// 反拍上的四分音符 → 八分＋八分；第 2 拍開始的二分音符 → 四分＋四分（看得到小節中間的第 3 拍）。
// 回傳 [{ start, eighths }]。
export function splitAtBeats(start, eighths) {
  const pieces = [];
  let position = start;
  let left = eighths;
  while (left > 0) {
    const piece = LENGTHS.find((length) => length <= left && position % length === 0);
    pieces.push({ start: position, eighths: piece });
    position += piece;
    left -= piece;
  }
  return pieces;
}

// 每個音在譜上要標的記號：'#'、'b'、'n'（還原記號）或 null（不用標）。
// 規則（C 大調）：記號從出現處延續到小節結束，只作用在同一行、同字母、同八度的音；
// 與目前狀態不同時才需要標。回傳 [[記號]]，外層對應 measure 的每個和弦、內層對應它的 pitches。
export function accidentalMarks(measure) {
  const state = new Map();
  return measure.map(({ pitches }) =>
    pitches.map((pitch) => {
      const key = `${staffFor(pitch)}:${pitch.letter}${pitch.octave}`;
      const current = state.get(key) ?? '';
      state.set(key, pitch.accidental);
      if (pitch.accidental === current) return null;
      return pitch.accidental === '' ? 'n' : pitch.accidental;
    }),
  );
}
