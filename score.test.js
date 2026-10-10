import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScore, addBeat, measures, isComplete, accidentalMarks } from './score.js';

const p = (name) => {
  const [, letter, accidental, octave] = name.match(/^([a-g])([#b]?)(\d)$/);
  return { letter, accidental, octave: Number(octave) };
};

test('每 4 拍一個小節，最後一個小節可以未滿', () => {
  const score = createScore();
  for (let i = 0; i < 9; i++) addBeat(score, [p('c4')]);
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
