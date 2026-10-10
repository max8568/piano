// 用 VexFlow 畫大譜表與音符。VexFlow 由 index.html 以一般 script 載入（全域 Vex）。
import { staffFor, vexKey } from './music.js';
import { measures, isComplete, BEATS_PER_MEASURE } from './score.js';

const { Renderer, Stave, StaveNote, GhostNote, Voice, Formatter, StaveConnector, Barline } = Vex.Flow;

// 以下為 VexFlow 的「虛擬座標」，實際畫面再依高度等比例縮放。
const VIRTUAL_HEIGHT = 260; // 足夠容納 C6（上加兩線）到 C2（下加兩線）
const TREBLE_Y = 10;
const BASS_Y = 120;
const STAVE_X = 10;
const NOTE_SPACING = 44; // 每一拍佔的寬度
const MEASURE_PADDING = 24; // 小節線前後的留白
const MEASURE_WIDTH = BEATS_PER_MEASURE * NOTE_SPACING + MEASURE_PADDING;
const END_PADDING = 30;

// 一拍在某一行（高音或低音譜）的音符；這行沒有音就用 GhostNote 佔位，讓上下對齊。
function beatNote(beat, staff) {
  const pitches = beat.filter((p) => staffFor(p) === staff);
  if (pitches.length === 0) return new GhostNote({ duration: 'q' });
  return new StaveNote({ clef: staff, keys: pitches.map(vexKey), duration: 'q', auto_stem: true });
}

function voiceOf(tickables) {
  return new Voice({ num_beats: tickables.length, beat_value: 4 }).addTickables(tickables);
}

export function createStaff(container) {
  const renderer = new Renderer(container, Renderer.Backends.SVG);

  function render(beats) {
    const scale = container.clientHeight / VIRTUAL_HEIGHT;
    const viewWidth = container.clientWidth / scale;

    // 第一小節前面多了譜號＋拍號，先用暫時的 stave 算出寬度。
    const probe = new Stave(STAVE_X, TREBLE_Y, 100).addClef('treble').addTimeSignature('4/4');
    const headerWidth = probe.getNoteStartX() - STAVE_X;

    const ms = measures(beats);
    const measureCount = Math.max(ms.length, 1);
    const contentWidth = headerWidth + measureCount * MEASURE_WIDTH + END_PADDING;
    const totalWidth = Math.max(viewWidth - STAVE_X * 2, contentWidth);

    const virtualWidth = totalWidth + STAVE_X * 2;
    renderer.resize(virtualWidth * scale, VIRTUAL_HEIGHT * scale);
    const ctx = renderer.getContext();
    ctx.clear();
    // 不用 ctx.scale()：它會在每次重畫時累乘。直接設定 viewBox 達到等比例縮放。
    ctx.setViewBox(0, 0, virtualWidth, VIRTUAL_HEIGHT);

    let x = STAVE_X;
    for (let i = 0; i < measureCount; i++) {
      const measure = ms[i] ?? [];
      const first = i === 0;
      const last = i === measureCount - 1;
      // 最後一個小節的五線延伸到畫面右邊。
      const width = last ? STAVE_X + totalWidth - x : (first ? headerWidth : 0) + MEASURE_WIDTH;

      const treble = new Stave(x, TREBLE_Y, width);
      const bass = new Stave(x, BASS_Y, width);
      for (const [stave, clef] of [[treble, 'treble'], [bass, 'bass']]) {
        if (first) stave.addClef(clef).addTimeSignature('4/4');
        else stave.setBegBarType(Barline.type.NONE);
        // 小節線另外畫成貫穿上下兩行的一條線（drawBarline）。
        stave.setEndBarType(Barline.type.NONE);
        stave.setContext(ctx).draw();
      }
      if (first) {
        new StaveConnector(treble, bass).setType('brace').setContext(ctx).draw();
        new StaveConnector(treble, bass).setType('singleLeft').setContext(ctx).draw();
      }

      if (measure.length > 0) {
        const trebleVoice = voiceOf(measure.map((beat) => beatNote(beat, 'treble')));
        const bassVoice = voiceOf(measure.map((beat) => beatNote(beat, 'bass')));
        new Formatter()
          .joinVoices([trebleVoice])
          .joinVoices([bassVoice])
          .format([trebleVoice, bassVoice], measure.length * NOTE_SPACING);
        trebleVoice.draw(ctx, treble);
        bassVoice.draw(ctx, bass);
      }

      const barX = x + (first ? headerWidth : 0) + MEASURE_WIDTH;
      if (isComplete(measure)) drawBarline(ctx, barX);
      x = barX;
    }
  }

  return { render };
}

// 貫穿高音譜頂線到低音譜底線的小節線。
function drawBarline(ctx, x) {
  const top = new Stave(0, TREBLE_Y, 10).getYForLine(0);
  const bottom = new Stave(0, BASS_Y, 10).getYForLine(4);
  ctx.fillRect(x - 1, top, 1, bottom - top);
}
