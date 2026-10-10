import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whiteKeys, blackKeys, spell, midi, staffFor, vexKey, pitchName, isMiddleC } from './music.js';

test('C2–C6 共 29 個白鍵，由 C2 開始、C6 結束', () => {
  const keys = whiteKeys();
  assert.equal(keys.length, 29);
  assert.deepEqual(keys[0], { letter: 'c', octave: 2, accidental: '' });
  assert.deepEqual(keys.at(-1), { letter: 'c', octave: 6, accidental: '' });
});

test('C4 以上記在高音譜，以下記在低音譜', () => {
  assert.equal(staffFor({ letter: 'c', octave: 4 }), 'treble');
  assert.equal(staffFor({ letter: 'c', octave: 6 }), 'treble');
  assert.equal(staffFor({ letter: 'b', octave: 3 }), 'bass');
  assert.equal(staffFor({ letter: 'c', octave: 2 }), 'bass');
});

test('名稱轉換', () => {
  assert.equal(vexKey({ letter: 'g', octave: 3, accidental: '#' }), 'g#/3');
  assert.equal(pitchName({ letter: 'c', octave: 5, accidental: '' }), 'C5');
  assert.ok(isMiddleC({ letter: 'c', octave: 4, accidental: '' }));
  assert.ok(!isMiddleC({ letter: 'c', octave: 5, accidental: '' }));
});

test('C2–C6 共 20 個黑鍵，升降寫法正確', () => {
  const keys = blackKeys();
  assert.equal(keys.length, 20);
  assert.deepEqual(spell(keys[0], 'sharp'), { letter: 'c', octave: 2, accidental: '#' });
  assert.deepEqual(spell(keys[0], 'flat'), { letter: 'd', octave: 2, accidental: 'b' });
  assert.equal(keys[0].afterWhite, 0);
  for (const k of keys) assert.equal(midi(spell(k, 'sharp')), midi(spell(k, 'flat')));
  assert.deepEqual(spell(keys.at(-1), 'sharp'), { letter: 'a', octave: 5, accidental: '#' });
});

test('midi 編號', () => {
  assert.equal(midi({ letter: 'c', octave: 4, accidental: '' }), 60);
  assert.equal(midi({ letter: 'b', octave: 3, accidental: '#' }), 60);
  assert.equal(midi({ letter: 'c', octave: 2, accidental: '' }), 36);
});

test('Tone 用的音名：升降都能表示', () => {
  assert.equal(pitchName({ letter: 'c', octave: 4, accidental: '#' }), 'C#4');
  assert.equal(pitchName({ letter: 'd', octave: 4, accidental: 'b' }), 'Db4');
});
