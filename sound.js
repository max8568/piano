// 鋼琴音色：Tone.js Sampler + Salamander Grand Piano 取樣（每 3 個半音一個，其他音由 Tone 移調補足）。
// Tone.js 由 index.html 以一般 script 載入（全域 Tone）。
import { pitchName } from './music.js';

const SAMPLE_BASE_URL = 'audio/salamander/';
const SAMPLED_NOTES = ['C', 'D#', 'F#', 'A'];
const SAMPLE_FILE_NAME = { C: 'C', 'D#': 'Ds', 'F#': 'Fs', A: 'A' };

// 放開手指後聲音淡出的時間（秒）。
const RELEASE_SECONDS = 0.35;

export function sampleUrls() {
  const urls = {};
  for (let octave = 2; octave <= 5; octave++) {
    for (const note of SAMPLED_NOTES) urls[`${note}${octave}`] = `${SAMPLE_FILE_NAME[note]}${octave}.mp3`;
  }
  urls.C6 = 'C6.mp3';
  return urls;
}

// onStatus(status)：音訊狀態改變時呼叫。status = { context, loaded, error }
//   context：AudioContext 的狀態（'running' 才會有聲音；iOS 上可能是 'suspended' 或 'interrupted'）
export function createPiano({ onStatus = () => {} } = {}) {
  // 按鍵要立刻出聲，不要 Tone 預設的 0.1 秒排程緩衝。
  Tone.context.lookAhead = 0;
  const raw = Tone.context.rawContext;

  let loaded = false;
  let error = null;
  const status = () => ({ context: raw.state, loaded, error });
  const report = () => onStatus(status());

  const sampler = new Tone.Sampler({
    urls: sampleUrls(),
    baseUrl: SAMPLE_BASE_URL,
    release: RELEASE_SECONDS,
    onload: () => {
      loaded = true;
      report();
    },
    onerror: (e) => {
      error = `取樣載入失敗：${e?.message ?? e}`;
      report();
    },
  }).toDestination();

  raw.onstatechange = report;

  // iOS 預設把網頁音訊當成「環境音」，靜音模式時會被消音。
  // iOS 17+ 可以直接宣告為播放媒體；舊版則靠播放一段無聲的 <audio> 讓系統切到播放模式。
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
  const silence = new Audio('audio/silence.wav');
  silence.loop = true;
  silence.setAttribute('playsinline', '');

  // 啟動音訊。必須在使用者手勢（touchend / click）裡呼叫，iOS 與 Chrome 都不承認 touchstart / pointerdown。
  function unlock() {
    if (silence.paused) silence.play().catch(() => {});
    if (raw.state !== 'running') {
      raw.resume().then(report, report);
      // 舊版 iOS 需要在手勢中實際播放一個 buffer 才會真正解鎖。
      const source = raw.createBufferSource();
      source.buffer = raw.createBuffer(1, 1, raw.sampleRate);
      source.connect(raw.destination);
      source.start(0);
    }
  }

  // 取樣還沒載完或音訊未啟動時不發聲（但仍會記譜）。
  function noteOn(pitch) {
    if (loaded && raw.state === 'running') sampler.triggerAttack(pitchName(pitch));
  }

  function noteOff(pitch) {
    if (loaded && raw.state === 'running') sampler.triggerRelease(pitchName(pitch));
  }

  report();
  return { noteOn, noteOff, unlock, status };
}
