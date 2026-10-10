// 測驗模式的邏輯：在譜上出一個音，按對應的琴鍵作答。不碰 DOM，方便測試。
// 題目只出白鍵；range 決定出哪一行譜的音：'treble'（高音譜）、'bass'（低音譜）、'both'（兩行都出）。
// 答對就留在譜上（history），下一題接在右邊；答錯不換題，要按到對為止。
import { whiteKeys, staffFor, midi } from './music.js';

export const RANGES = ['treble', 'bass', 'both'];

// 譜上最多留幾題答過的音；超過時從最前面一次拿掉一個小節（4 題），小節的分法才不會變。
export const MAX_HISTORY = 40;

// 這個範圍可以出的題目。
export function questionPool(range) {
  return whiteKeys().filter((pitch) => range === 'both' || staffFor(pitch) === range);
}

// random()：回傳 0～1 的亂數（測試時可以換成固定的）。
// correct：一次就答對的題數；total：完成（最後答對）的題數；missed：目前這題是否按錯過。
export function createQuiz(range, random = Math.random) {
  const quiz = { range, random, target: null, history: [], missed: false, correct: 0, total: 0 };
  nextQuestion(quiz);
  return quiz;
}

// 出下一題：不會連續出同一個音。
export function nextQuestion(quiz) {
  const pool = questionPool(quiz.range).filter((pitch) => !quiz.target || midi(pitch) !== midi(quiz.target));
  quiz.target = pool[Math.floor(quiz.random() * pool.length)];
  quiz.missed = false;
}

// 用 pitch 作答，回傳是否答對。答對：這題記進 history、算分，換下一題。答錯：記下這題按錯過，題目不變。
export function answer(quiz, pitch) {
  if (midi(pitch) !== midi(quiz.target)) {
    quiz.missed = true;
    return false;
  }
  quiz.total += 1;
  if (!quiz.missed) quiz.correct += 1;
  quiz.history.push(quiz.target);
  if (quiz.history.length > MAX_HISTORY) quiz.history.splice(0, 4);
  nextQuestion(quiz);
  return true;
}

// 換範圍：難度不同，分數與譜上的音都重新開始，並馬上換一題。
export function setRange(quiz, range) {
  quiz.range = range;
  quiz.correct = 0;
  quiz.total = 0;
  quiz.history = [];
  quiz.target = null;
  nextQuestion(quiz);
}
