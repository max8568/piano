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

export function createPiano() {
  // 按鍵要立刻出聲，不要 Tone 預設的 0.1 秒排程緩衝。
  Tone.context.lookAhead = 0;
  const sampler = new Tone.Sampler({
    urls: sampleUrls(),
    baseUrl: SAMPLE_BASE_URL,
    release: RELEASE_SECONDS,
  }).toDestination();

  // iOS 要在使用者觸碰時才允許啟動音訊；每次觸碰都試一次，啟動後就不再做事。
  function unlock() {
    if (Tone.context.state !== 'running') Tone.start();
  }

  // 取樣還沒載完時不發聲（但仍會記譜）。
  function noteOn(pitch) {
    unlock();
    if (sampler.loaded) sampler.triggerAttack(pitchName(pitch));
  }

  function noteOff(pitch) {
    if (sampler.loaded) sampler.triggerRelease(pitchName(pitch));
  }

  return { noteOn, noteOff, unlock };
}
