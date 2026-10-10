import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuiz, nextQuestion, answer, setRange, questionPool, rangeBetween, sameRange, MAX_HISTORY } from './quiz.js';
import { midi } from './music.js';

const p = (name) => {
  const [, letter, accidental, octave] = name.match(/^([a-g])([#b]?)(\d)$/);
  return { letter, accidental, octave: Number(octave) };
};

// 依序回傳 values 裡的值的假亂數。
// C4～C5（一個八度，8 個白鍵）。
const OCTAVE = rangeBetween(p('c4'), p('c5'));

const sequence = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('範圍內的白鍵才會出題，兩端都包含', () => {
  const names = questionPool(rangeBetween(p('e3'), p('d4'))).map((pitch) => pitch.letter + pitch.octave);
  assert.deepEqual(names, ['e3', 'f3', 'g3', 'a3', 'b3', 'c4', 'd4']);
});

test('從高往低拖也一樣；端點是黑鍵時只出它旁邊範圍內的白鍵', () => {
  assert.deepEqual(rangeBetween(p('c5'), p('c4')), OCTAVE);
  const names = questionPool(rangeBetween(p('c#4'), p('f#4'))).map((pitch) => pitch.letter + pitch.octave);
  assert.deepEqual(names, ['d4', 'e4', 'f4']);
});

test('勾選黑鍵時也出範圍內的黑鍵，由低到高', () => {
  const names = questionPool(rangeBetween(p('c4'), p('e4'), true)).map((pitch) => pitch.letter + pitch.accidental + pitch.octave);
  assert.deepEqual(names, ['c4', 'c#4', 'd4', 'd#4', 'e4']);
});

test('黑鍵題目隨機寫成升記號或降記號，按同一個鍵都算對', () => {
  const range = rangeBetween(p('c#4'), p('c#4'), true);
  range.low -= 1; // 讓範圍裡有 C4 與 C♯4 兩個鍵，才能輪流出題
  const sharp = createQuiz(range, sequence(0.99, 0.9)); // 選到 C♯4、不改寫
  assert.equal(sharp.target.accidental, '#');
  const flat = createQuiz(range, sequence(0.99, 0.1)); // 選到 C♯4、改寫成 D♭4
  assert.deepEqual(flat.target, p('db4'));
  assert.equal(answer(flat, p('c#4')), true);
});

test('範圍相同才算同一個範圍（包含是否含黑鍵）', () => {
  assert.equal(sameRange(rangeBetween(p('c4'), p('c5')), rangeBetween(p('c5'), p('c4'))), true);
  assert.equal(sameRange(rangeBetween(p('c4'), p('c5')), rangeBetween(p('c4'), p('c5'), true)), false);
});

test('不會連續出同一個音', () => {
  const quiz = createQuiz(OCTAVE, sequence(0));
  for (let i = 0; i < 20; i++) {
    const previous = quiz.target;
    nextQuestion(quiz);
    assert.notEqual(midi(quiz.target), midi(previous));
  }
});

test('答錯不換題，要按到對為止；答對才換下一題', () => {
  const quiz = createQuiz(OCTAVE, sequence(0));
  const target = quiz.target;
  assert.equal(answer(quiz, p('c2')), false);
  assert.equal(quiz.target, target);
  assert.equal(answer(quiz, target), true);
  assert.notEqual(midi(quiz.target), midi(target));
});

test('一次就答對才加分；按錯過再答對只算完成一題', () => {
  const quiz = createQuiz(OCTAVE, sequence(0));
  answer(quiz, quiz.target);
  answer(quiz, p('c2'));
  answer(quiz, p('d2'));
  answer(quiz, quiz.target);
  assert.deepEqual([quiz.correct, quiz.total], [1, 2]);
});

test('答對的音依序留在譜上', () => {
  const quiz = createQuiz(OCTAVE, sequence(0, 0.5));
  const first = quiz.target;
  answer(quiz, first);
  const second = quiz.target;
  answer(quiz, p('c2'));
  answer(quiz, second);
  assert.deepEqual(quiz.history, [first, second]);
});

test('譜上留的音太多時，從最前面一次拿掉一個小節', () => {
  const quiz = createQuiz(OCTAVE, sequence(0, 0.5));
  for (let i = 0; i < MAX_HISTORY + 1; i++) answer(quiz, quiz.target);
  assert.equal(quiz.history.length, MAX_HISTORY - 3);
  assert.equal(quiz.total, MAX_HISTORY + 1);
});

test('黑鍵用同音的寫法也算對（例如題目是白鍵、按的是同一個鍵）', () => {
  const quiz = createQuiz(OCTAVE, sequence(0));
  quiz.target = p('f4');
  assert.equal(answer(quiz, p('e#4')), true);
});

test('換範圍：分數與譜上的音歸零，題目換成新範圍的音', () => {
  const quiz = createQuiz(OCTAVE, sequence(0.5));
  answer(quiz, quiz.target);
  answer(quiz, p('c2'));
  const bass = rangeBetween(p('c2'), p('b2'));
  setRange(quiz, bass);
  assert.deepEqual([quiz.correct, quiz.total, quiz.history, quiz.missed], [0, 0, [], false]);
  assert.ok(midi(quiz.target) >= bass.low && midi(quiz.target) <= bass.high);
});
