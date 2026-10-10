import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whiteKeys, staffFor, vexKey, pitchName, isMiddleC } from './music.js';

test('C2–C6 共 29 個白鍵，由 C2 開始、C6 結束', () => {
  const keys = whiteKeys();
  assert.equal(keys.length, 29);
  assert.deepEqual(keys[0], { letter: 'c', octave: 2 });
  assert.deepEqual(keys.at(-1), { letter: 'c', octave: 6 });
});

test('C4 以上記在高音譜，以下記在低音譜', () => {
  assert.equal(staffFor({ letter: 'c', octave: 4 }), 'treble');
  assert.equal(staffFor({ letter: 'c', octave: 6 }), 'treble');
  assert.equal(staffFor({ letter: 'b', octave: 3 }), 'bass');
  assert.equal(staffFor({ letter: 'c', octave: 2 }), 'bass');
});

test('名稱轉換', () => {
  assert.equal(vexKey({ letter: 'g', octave: 3 }), 'g/3');
  assert.equal(pitchName({ letter: 'c', octave: 5 }), 'C5');
  assert.ok(isMiddleC({ letter: 'c', octave: 4 }));
  assert.ok(!isMiddleC({ letter: 'c', octave: 5 }));
});
