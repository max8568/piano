// 測驗模式的邏輯：在譜上出一個音，按對應的琴鍵作答。不碰 DOM，方便測試。
// 範圍（range）：{ low, high, black }，low／high 是最低與最高那個鍵的 MIDI 編號（含）；
// 題目出範圍內的白鍵，black 為 true 時也出範圍內的黑鍵（每次隨機寫成升記號或降記號）。
// 答對就留在譜上（history），下一題接在右邊；答錯不換題，要按到對為止。
import { whiteKeys, blackKeys, midi } from './music.js';

// 範圍裡至少要有幾個鍵才能開始（不連續出同一個音，至少要兩個可以輪流）。
export const MIN_POOL = 2;

// 譜上最多留幾題答過的音；超過時從最前面一次拿掉一個小節（4 題），小節的分法才不會變。
export const MAX_HISTORY = 40;

// 從 a 拖到 b（兩個音高，順序不拘）選出的範圍；black：是否包含黑鍵。
export function rangeBetween(a, b, black = false) {
  return { low: Math.min(midi(a), midi(b)), high: Math.max(midi(a), midi(b)), black };
}

export function sameRange(a, b) {
  return a.low === b.low && a.high === b.high && a.black === b.black;
}

// 這個範圍可以出的題目，由低到高；黑鍵用升記號的寫法代表（出題時才決定寫成升或降）。
export function questionPool(range) {
  const keys = whiteKeys();
  if (range.black) keys.push(...blackKeys().map((key) => key.sharp));
  return keys.filter((pitch) => midi(pitch) >= range.low && midi(pitch) <= range.high).sort((a, b) => midi(a) - midi(b));
}

// 黑鍵的降記號寫法，例如 C♯4 → D♭4。
function flatSpelling(pitch) {
  return blackKeys().find((key) => midi(key.sharp) === midi(pitch)).flat;
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
  const target = pool[Math.floor(quiz.random() * pool.length)];
  quiz.target = target.accidental && quiz.random() < 0.5 ? flatSpelling(target) : target;
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
