import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuiz, nextQuestion, answer, setRange, questionPool, MAX_HISTORY } from './quiz.js';
import { staffFor, midi } from './music.js';

const p = (name) => {
  const [, letter, accidental, octave] = name.match(/^([a-g])([#b]?)(\d)$/);
  return { letter, accidental, octave: Number(octave) };
};

// 依序回傳 values 裡的值的假亂數。
const sequence = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('高音譜只出高音譜的白鍵，低音譜只出低音譜的白鍵，全部兩行都出', () => {
  const treble = questionPool('treble');
  const bass = questionPool('bass');
  assert.ok(treble.every((pitch) => staffFor(pitch) === 'treble' && pitch.accidental === ''));
  assert.ok(bass.every((pitch) => staffFor(pitch) === 'bass' && pitch.accidental === ''));
  assert.equal(questionPool('both').length, treble.length + bass.length);
});

test('不會連續出同一個音', () => {
  const quiz = createQuiz('treble', sequence(0));
  for (let i = 0; i < 20; i++) {
    const previous = quiz.target;
    nextQuestion(quiz);
    assert.notEqual(midi(quiz.target), midi(previous));
  }
});

test('答錯不換題，要按到對為止；答對才換下一題', () => {
  const quiz = createQuiz('treble', sequence(0));
  const target = quiz.target;
  assert.equal(answer(quiz, p('c2')), false);
  assert.equal(quiz.target, target);
  assert.equal(answer(quiz, target), true);
  assert.notEqual(midi(quiz.target), midi(target));
});

test('一次就答對才加分；按錯過再答對只算完成一題', () => {
  const quiz = createQuiz('treble', sequence(0));
  answer(quiz, quiz.target);
  answer(quiz, p('c2'));
  answer(quiz, p('d2'));
  answer(quiz, quiz.target);
  assert.deepEqual([quiz.correct, quiz.total], [1, 2]);
});

test('答對的音依序留在譜上', () => {
  const quiz = createQuiz('treble', sequence(0, 0.5));
  const first = quiz.target;
  answer(quiz, first);
  const second = quiz.target;
  answer(quiz, p('c2'));
  answer(quiz, second);
  assert.deepEqual(quiz.history, [first, second]);
});

test('譜上留的音太多時，從最前面一次拿掉一個小節', () => {
  const quiz = createQuiz('treble', sequence(0, 0.5));
  for (let i = 0; i < MAX_HISTORY + 1; i++) answer(quiz, quiz.target);
  assert.equal(quiz.history.length, MAX_HISTORY - 3);
  assert.equal(quiz.total, MAX_HISTORY + 1);
});

test('黑鍵用同音的寫法也算對（例如題目是白鍵、按的是同一個鍵）', () => {
  const quiz = createQuiz('treble', sequence(0));
  quiz.target = p('f4');
  assert.equal(answer(quiz, p('e#4')), true);
});

test('換範圍：分數與譜上的音歸零，題目換成新範圍的音', () => {
  const quiz = createQuiz('treble', sequence(0.5));
  answer(quiz, quiz.target);
  answer(quiz, p('c2'));
  setRange(quiz, 'bass');
  assert.deepEqual([quiz.correct, quiz.total, quiz.history, quiz.missed], [0, 0, [], false]);
  assert.equal(staffFor(quiz.target), 'bass');
});
