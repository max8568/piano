import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScore, press, hold, release, measures, isComplete, accidentalMarks, removeNote, clearScore, splitAtBeats } from './score.js';

const p = (name) => {
  const [, letter, accidental, octave] = name.match(/^([a-g])([#b]?)(\d)$/);
  return { letter, accidental, octave: Number(octave) };
};

// 每個和弦的音（測試和弦怎麼組成時用）與每個和弦的長度（八分音符的個數：八分 1、四分 2、二分 4、全音符 8）。
const pitchesOf = (score) => score.chords.map((chord) => chord.pitches);
const lengthsOf = (score) => score.chords.map((chord) => chord.eighths);

// 在 time 按下 name，按住 ms 毫秒後放開（預設 0.3 秒，是四分音符）。
function tap(score, name, time, ms = 300) {
  press(score, p(name), time);
  release(score, p(name), time + ms);
}

// 只有音高的和弦清單（accidentalMarks 用），每個和弦都是四分音符。
const chordsOf = (...names) => names.map((group) => ({ pitches: group.map(p), eighths: 2 }));

test('每 4 拍一個小節，最後一個小節可以未滿', () => {
  const score = createScore();
  for (let i = 0; i < 9; i++) tap(score, 'c4', i * 1000);
  const ms = measures(score.chords);
  assert.deepEqual(ms.map((m) => m.length), [4, 4, 1]);
  assert.deepEqual(ms.map(isComplete), [true, true, false]);
});

test('按不到 0.2 秒是八分、0.2～0.5 秒四分、0.5～1.2 秒二分、1.2 秒以上全音符', () => {
  const score = createScore();
  tap(score, 'c4', 0, 199);
  tap(score, 'c4', 1000, 200);
  tap(score, 'c4', 2000, 500); // 小節從第 1.5 拍開始還剩 2.5 拍：二分音符放得下
  tap(score, 'c4', 4000, 1200); // 只剩半拍
  tap(score, 'c4', 6000, 1200); // 新小節
  assert.deepEqual(lengthsOf(score), [1, 2, 4, 1, 8]);
});

test('按住期間隨時間變長，放開就定案', () => {
  const score = createScore();
  press(score, p('c4'), 0);
  assert.deepEqual(lengthsOf(score), [1]);
  assert.equal(hold(score, 150), false);
  assert.equal(hold(score, 300), true);
  assert.equal(hold(score, 600), true);
  assert.deepEqual(lengthsOf(score), [4]);
  assert.equal(release(score, p('c4'), 700), false);
  assert.equal(hold(score, 5000), false);
  assert.deepEqual(lengthsOf(score), [4]);
});

test('長度不會超過小節剩下的長度', () => {
  const score = createScore();
  tap(score, 'c4', 0);
  tap(score, 'c4', 1000);
  tap(score, 'c4', 2000);
  tap(score, 'c4', 3000, 2000); // 第 4 拍只剩一拍
  tap(score, 'c4', 6000, 2000); // 新小節，可以是全音符
  assert.deepEqual(lengthsOf(score), [2, 2, 2, 2, 8]);
  tap(score, 'c4', 9000);
  tap(score, 'c4', 10000, 2000); // 小節剩 3 拍，沒有附點，最長二分音符
  assert.deepEqual(lengthsOf(score).slice(5), [2, 4]);
});

test('和弦裡最後一個鍵放開時才定案', () => {
  const score = createScore();
  press(score, p('c4'), 0);
  press(score, p('e4'), 20);
  release(score, p('c4'), 100);
  release(score, p('e4'), 1300);
  assert.deepEqual(lengthsOf(score), [8]);
});

test('還按著上一個鍵就按下一個：上一個的長度算到按下一個為止', () => {
  const score = createScore();
  press(score, p('c4'), 0);
  press(score, p('d4'), 600); // c4 還沒放開
  release(score, p('d4'), 700);
  release(score, p('c4'), 3000);
  assert.deepEqual(lengthsOf(score), [4, 1]);
});

test('刪掉前面的音符後跨過小節線的長音，排版時縮短成放得下的長度', () => {
  const score = createScore();
  tap(score, 'c4', 0);
  tap(score, 'd4', 1000);
  tap(score, 'e4', 2000, 600); // 第 3～4 拍的二分音符
  removeNote(score, 0, p('c4')); // 往前移到第 2 拍，還放得下
  assert.deepEqual(measures(score.chords)[0].map((entry) => entry.eighths), [2, 4]);
  tap(score, 'f4', 5000); // 第 4 拍
  tap(score, 'g4', 6000, 1500); // 新小節的全音符
  removeNote(score, 1, p('e4')); // g4 往前移到第 3 拍，只放得下二分音符
  assert.deepEqual(measures(score.chords)[0].map((entry) => entry.eighths), [2, 2, 4]);
  assert.deepEqual(lengthsOf(score), [2, 2, 8]); // 資料裡的長度不變
});

test('小節裡每個音符記錄自己的起點', () => {
  const score = createScore();
  tap(score, 'c4', 0, 100);
  tap(score, 'd4', 1000);
  tap(score, 'e4', 2000, 600);
  assert.deepEqual(measures(score.chords)[0].map((entry) => entry.start), [0, 1, 3]);
});

test('在拍點上、長度放得下的音符不用拆', () => {
  assert.deepEqual(splitAtBeats(0, 8), [{ start: 0, eighths: 8 }]);
  assert.deepEqual(splitAtBeats(4, 4), [{ start: 4, eighths: 4 }]);
  assert.deepEqual(splitAtBeats(2, 2), [{ start: 2, eighths: 2 }]);
  assert.deepEqual(splitAtBeats(3, 1), [{ start: 3, eighths: 1 }]);
});

test('反拍上的四分音符拆成兩個八分音符', () => {
  assert.deepEqual(splitAtBeats(1, 2), [
    { start: 1, eighths: 1 },
    { start: 2, eighths: 1 },
  ]);
});

test('第 2 拍開始的二分音符拆成兩個四分音符，看得到小節中間的第 3 拍', () => {
  assert.deepEqual(splitAtBeats(2, 4), [
    { start: 2, eighths: 2 },
    { start: 4, eighths: 2 },
  ]);
});

test('反拍開始的二分音符：八分＋四分＋八分', () => {
  assert.deepEqual(splitAtBeats(1, 4), [
    { start: 1, eighths: 1 },
    { start: 2, eighths: 2 },
    { start: 4, eighths: 1 },
  ]);
});

test('同小節先 F♯ 後 F：後面的 F 要加還原記號', () => {
  assert.deepEqual(accidentalMarks(chordsOf(['f#4'], ['f4'])), [['#'], ['n']]);
});

test('同小節重複相同升降音只標第一次', () => {
  assert.deepEqual(accidentalMarks(chordsOf(['f#4'], ['f#4'], ['g4'])), [['#'], [null], [null]]);
});

test('記號只作用在同一個八度', () => {
  assert.deepEqual(accidentalMarks(chordsOf(['f#4'], ['f5'])), [['#'], [null]]);
});

test('記號只作用在同一行譜表', () => {
  assert.deepEqual(accidentalMarks(chordsOf(['b3'], ['bb3'], ['bb4'])), [[null], ['b'], ['b']]);
});

test('新小節重置（每個小節各自計算）', () => {
  const [first, second] = measures(chordsOf(['f#4'], ['c4'], ['c4'], ['c4'], ['f#4']));
  assert.deepEqual(accidentalMarks(first)[0], ['#']);
  assert.deepEqual(accidentalMarks(second)[0], ['#']);
});

test('和弦裡每個音各自判斷', () => {
  assert.deepEqual(accidentalMarks(chordsOf(['c#4', 'e4'], ['c4', 'eb4'])), [['#', null], ['n', 'b']]);
});

test('80ms 內按下的鍵合併成同一個和弦', () => {
  const score = createScore();
  press(score, p('c4'), 1000);
  press(score, p('e4'), 1030);
  press(score, p('g3'), 1080);
  assert.deepEqual(pitchesOf(score), [[p('c4'), p('e4'), p('g3')]]);
});

test('超過 80ms 就是新的和弦（從這個和弦第一個鍵起算）', () => {
  const score = createScore();
  press(score, p('c4'), 1000);
  press(score, p('e4'), 1050);
  press(score, p('g4'), 1081);
  assert.deepEqual(pitchesOf(score), [[p('c4'), p('e4')], [p('g4')]]);
});

test('同一個和弦裡重複的琴鍵只算一次', () => {
  const score = createScore();
  press(score, p('f#4'), 0);
  press(score, p('gb4'), 10);
  press(score, p('f#4'), 20);
  assert.deepEqual(pitchesOf(score), [[p('f#4')]]);
});

test('刪掉和弦裡的一個音，其他音留著', () => {
  const score = createScore();
  press(score, p('c4'), 0);
  press(score, p('e4'), 10);
  press(score, p('g4'), 1000);
  removeNote(score, 0, p('e4'));
  assert.deepEqual(pitchesOf(score), [[p('c4')], [p('g4')]]);
});

test('刪掉單音的和弦就整個移除，後面的往前補', () => {
  const score = createScore();
  for (const [i, name] of ['c4', 'd4', 'e4'].entries()) press(score, p(name), i * 1000);
  removeNote(score, 1, p('d4'));
  assert.deepEqual(pitchesOf(score), [[p('c4')], [p('e4')]]);
});

test('刪除後馬上按鍵也是新的和弦', () => {
  const score = createScore();
  press(score, p('c4'), 1000);
  press(score, p('e4'), 1010);
  removeNote(score, 0, p('e4'));
  press(score, p('g4'), 1020);
  assert.deepEqual(pitchesOf(score), [[p('c4')], [p('g4')]]);
});

test('找不到的音不動', () => {
  const score = createScore();
  press(score, p('c4'), 0);
  removeNote(score, 0, p('d4'));
  removeNote(score, 5, p('c4'));
  assert.deepEqual(pitchesOf(score), [[p('c4')]]);
});

test('清除後沒有任何音符，下一個按鍵從新的和弦開始', () => {
  const score = createScore();
  press(score, p('c4'), 1000);
  clearScore(score);
  assert.deepEqual(pitchesOf(score), []);
  press(score, p('e4'), 1010);
  assert.deepEqual(pitchesOf(score), [[p('e4')]]);
});
