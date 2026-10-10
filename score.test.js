import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScore, addBeat, measures, isComplete } from './score.js';

const c4 = { letter: 'c', octave: 4 };

test('每 4 拍一個小節，最後一個小節可以未滿', () => {
  const score = createScore();
  for (let i = 0; i < 9; i++) addBeat(score, [c4]);
  const ms = measures(score.beats);
  assert.deepEqual(ms.map((m) => m.length), [4, 4, 1]);
  assert.deepEqual(ms.map(isComplete), [true, true, false]);
});

test('沒有拍就沒有小節', () => {
  assert.deepEqual(measures([]), []);
});
