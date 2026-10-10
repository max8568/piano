import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScore, press, measures, isComplete, accidentalMarks, removeNote } from './score.js';

const p = (name) => {
  const [, letter, accidental, octave] = name.match(/^([a-g])([#b]?)(\d)$/);
  return { letter, accidental, octave: Number(octave) };
};

test('每 4 拍一個小節，最後一個小節可以未滿', () => {
  const score = createScore();
  for (let i = 0; i < 9; i++) press(score, p('c4'), i * 1000);
  const ms = measures(score.beats);
  assert.deepEqual(ms.map((m) => m.length), [4, 4, 1]);
  assert.deepEqual(ms.map(isComplete), [true, true, false]);
});

test('沒有拍就沒有小節', () => {
  assert.deepEqual(measures([]), []);
});

test('同小節先 F♯ 後 F：後面的 F 要加還原記號', () => {
  assert.deepEqual(accidentalMarks([[p('f#4')], [p('f4')]]), [['#'], ['n']]);
});

test('同小節重複相同升降音只標第一次', () => {
  assert.deepEqual(accidentalMarks([[p('f#4')], [p('f#4')], [p('g4')]]), [['#'], [null], [null]]);
});

test('記號只作用在同一個八度', () => {
  assert.deepEqual(accidentalMarks([[p('f#4')], [p('f5')]]), [['#'], [null]]);
});

test('記號只作用在同一行譜表', () => {
  assert.deepEqual(accidentalMarks([[p('b3')], [p('bb3')], [p('bb4')]]), [[null], ['b'], ['b']]);
});

test('新小節重置（每個小節各自計算）', () => {
  const [first, second] = measures([[p('f#4')], [p('c4')], [p('c4')], [p('c4')], [p('f#4')]]);
  assert.deepEqual(accidentalMarks(first)[0], ['#']);
  assert.deepEqual(accidentalMarks(second)[0], ['#']);
});

test('和弦裡每個音各自判斷', () => {
  assert.deepEqual(accidentalMarks([[p('c#4'), p('e4')], [p('c4'), p('eb4')]]), [['#', null], ['n', 'b']]);
});

test('80ms 內按下的鍵合併成同一拍的和弦', () => {
  const score = createScore();
  press(score, p('c4'), 1000);
  press(score, p('e4'), 1030);
  press(score, p('g3'), 1080);
  assert.deepEqual(score.beats, [[p('c4'), p('e4'), p('g3')]]);
});

test('超過 80ms 就是新的一拍（從這拍第一個鍵起算）', () => {
  const score = createScore();
  press(score, p('c4'), 1000);
  press(score, p('e4'), 1050);
  press(score, p('g4'), 1081);
  assert.deepEqual(score.beats, [[p('c4'), p('e4')], [p('g4')]]);
});

test('同一拍裡重複的琴鍵只算一次', () => {
  const score = createScore();
  press(score, p('f#4'), 0);
  press(score, p('gb4'), 10);
  press(score, p('f#4'), 20);
  assert.deepEqual(score.beats, [[p('f#4')]]);
});

test('刪掉和弦裡的一個音，其他音留著', () => {
  const score = createScore();
  press(score, p('c4'), 0);
  press(score, p('e4'), 10);
  press(score, p('g4'), 1000);
  removeNote(score, 0, p('e4'));
  assert.deepEqual(score.beats, [[p('c4')], [p('g4')]]);
});

test('刪掉單音那拍就整拍移除，後面的拍往前補', () => {
  const score = createScore();
  for (const [i, name] of ['c4', 'd4', 'e4'].entries()) press(score, p(name), i * 1000);
  removeNote(score, 1, p('d4'));
  assert.deepEqual(score.beats, [[p('c4')], [p('e4')]]);
});

test('刪除後馬上按鍵也是新的一拍', () => {
  const score = createScore();
  press(score, p('c4'), 1000);
  press(score, p('e4'), 1010);
  removeNote(score, 0, p('e4'));
  press(score, p('g4'), 1020);
  assert.deepEqual(score.beats, [[p('c4')], [p('g4')]]);
});

test('找不到的音不動', () => {
  const score = createScore();
  press(score, p('c4'), 0);
  removeNote(score, 0, p('d4'));
  removeNote(score, 5, p('c4'));
  assert.deepEqual(score.beats, [[p('c4')]]);
});
