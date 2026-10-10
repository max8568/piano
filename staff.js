// 用 VexFlow 畫大譜表與音符。VexFlow 由 index.html 以一般 script 載入（全域 Vex）。
import { staffFor, staffPosition, vexKey } from './music.js';
import { measures, isComplete, accidentalMarks, splitAtBeats, EIGHTHS_PER_BEAT, EIGHTHS_PER_MEASURE } from './score.js';

const { Renderer, Stave, StaveNote, GhostNote, Voice, Formatter, StaveConnector, Barline, Accidental, Beam, StaveTie } = Vex.Flow;

// 以下為 VexFlow 的「虛擬座標」，實際畫面再依高度等比例縮放。
const VIRTUAL_HEIGHT = 260; // 足夠容納 C6（上加兩線）到 C2（下加兩線）
const TREBLE_Y = 10;
const BASS_Y = 120;
const STAVE_X = 30; // 左邊留給大括號（畫在五線譜起點左側）
const EIGHTH_SPACING = 26; // 每個八分音符佔的寬度（一拍 52；音符越長佔越寬）
const MEASURE_PADDING = 24; // 小節線前後的留白
const MEASURE_WIDTH = EIGHTHS_PER_MEASURE * EIGHTH_SPACING + MEASURE_PADDING;
const END_PADDING = 30;
const NOTE_HEAD_WIDTH = 16;

// 譜號＋拍號佔的寬度（第一小節的音符起點）。
function headerWidth() {
  const probe = new Stave(STAVE_X, TREBLE_Y, 100).addClef('treble').addTimeSignature('4/4');
  return probe.getNoteStartX() - STAVE_X;
}

// 畫大譜表開頭：大括號、左邊直線、譜號、拍號。
function drawHeader(ctx, width) {
  const treble = new Stave(STAVE_X, TREBLE_Y, width).addClef('treble').addTimeSignature('4/4');
  const bass = new Stave(STAVE_X, BASS_Y, width).addClef('bass').addTimeSignature('4/4');
  for (const stave of [treble, bass]) stave.setEndBarType(Barline.type.NONE).setContext(ctx).draw();
  new StaveConnector(treble, bass).setType('brace').setContext(ctx).draw();
  new StaveConnector(treble, bass).setType('singleLeft').setContext(ctx).draw();
}

function prepare(renderer, virtualWidth, scale) {
  renderer.resize(virtualWidth * scale, VIRTUAL_HEIGHT * scale);
  const ctx = renderer.getContext();
  ctx.clear();
  // 不用 ctx.scale()：它會在每次重畫時累乘。直接設定 viewBox 達到等比例縮放。
  ctx.setViewBox(0, 0, virtualWidth, VIRTUAL_HEIGHT);
  return ctx;
}

// 長度（八分音符的個數）對應的 VexFlow 音符時值。
const DURATION = { 1: '8', 2: 'q', 4: 'h', 8: 'w' };

// 和弦拆開後的一段（piece，見 splitAtBeats）在某一行（高音或低音譜）的音符；
// 這行沒有音就用同樣長度的 GhostNote 佔位，讓上下對齊。
// marks：與 chord.pitches 對應的升降／還原記號（見 accidentalMarks），只標在第一段，連結線後面的不重複標。
function pieceNote(chord, piece, marks, staff, first) {
  const duration = DURATION[piece.eighths];
  const entries = chord.pitches
    .map((pitch, i) => ({ pitch, mark: marks[i] }))
    .filter(({ pitch }) => staffFor(pitch) === staff)
    .sort((a, b) => staffPosition(a.pitch) - staffPosition(b.pitch));
  const note = entries.length === 0
    ? new GhostNote({ duration })
    : new StaveNote({ clef: staff, keys: entries.map(({ pitch }) => vexKey(pitch)), duration, auto_stem: true });
  note.start = piece.start;
  if (entries.length === 0) return note;
  if (first) {
    entries.forEach(({ mark }, i) => {
      if (mark) note.addModifier(new Accidental(mark), i);
    });
  }
  note.pitches = entries.map(({ pitch }) => pitch); // 與 keys 同順序，畫完後用來記錄符頭位置
  note.chordIndex = chord.index;
  return note;
}

// 一個小節在某一行的音符、連結線與符槓。
function staffVoice(measure, marks, staff) {
  const notes = [];
  const ties = [];
  measure.forEach((chord, c) => {
    let previous = null;
    splitAtBeats(chord.start, chord.eighths).forEach((piece, k) => {
      const note = pieceNote(chord, piece, marks[c], staff, k === 0);
      if (previous?.pitches) {
        const indices = previous.pitches.map((_, i) => i);
        ties.push(new StaveTie({ first_note: previous, last_note: note, first_indices: indices, last_indices: indices }));
      }
      notes.push(note);
      previous = note;
    });
  });
  const length = measure.reduce((sum, chord) => sum + chord.eighths, 0);
  const voice = new Voice({ num_beats: length, beat_value: 8 }).addTickables(notes);
  return { voice, ties, beams: beamsOf(notes) };
}

// 同一拍裡相鄰的八分音符用符槓連起來（4/4 一般以拍為單位分組）；落單的八分音符保留符尾。
function beamsOf(notes) {
  const beams = [];
  let group = [];
  const flush = () => {
    if (group.length > 1) beams.push(new Beam(group));
    group = [];
  };
  for (const note of notes) {
    const beat = Math.floor(note.start / EIGHTHS_PER_BEAT);
    const eighth = note.pitches && note.getDuration() === '8';
    if (!eighth || (group.length > 0 && Math.floor(group[0].start / EIGHTHS_PER_BEAT) !== beat)) flush();
    if (eighth) group.push(note);
  }
  flush();
  return beams;
}

// scroller：可水平捲動的整份樂譜；header：固定在左側、蓋在樂譜上面的譜號與拍號。
export function createStaff(scroller, header) {
  const renderer = new Renderer(scroller, Renderer.Backends.SVG);
  const headerRenderer = new Renderer(header, Renderer.Backends.SVG);
  // 上次畫出的每個符頭：{ chordIndex, pitch, x, y, element, move }，chordIndex 是在 score.chords 裡的位置。
  // x、y 為符頭中心（畫面 px，相對於樂譜左上角）；element 是拖曳時要移動的 SVG 元素，
  // move(dx, dy) 把它移開 dx、dy（畫面 px），move(0, 0) 放回原位。
  let heads = [];

  // chords：score.chords。rightReserve：畫面右側要留空的寬度（px），確保最新音符能捲到它的左邊。
  // 回傳最新一個音符右緣的位置（畫面 px，相對於樂譜左端），沒有音符時為 null。
  function render(chords, rightReserve = 0) {
    const scale = scroller.clientHeight / VIRTUAL_HEIGHT;
    const viewWidth = scroller.clientWidth / scale;
    const head = headerWidth();

    const ms = measures(chords);
    const measureCount = Math.max(ms.length, 1);
    const contentWidth = head + measureCount * MEASURE_WIDTH + Math.max(END_PADDING, rightReserve / scale);
    const totalWidth = Math.max(viewWidth - STAVE_X * 2, contentWidth);
    const ctx = prepare(renderer, totalWidth + STAVE_X * 2, scale);

    drawHeader(prepare(headerRenderer, STAVE_X + head, scale), head);

    let x = STAVE_X;
    let latestX = null;
    heads = [];
    for (let i = 0; i < measureCount; i++) {
      const measure = ms[i] ?? [];
      const first = i === 0;
      const last = i === measureCount - 1;
      // 最後一個小節的五線延伸到畫面右邊。
      const width = last ? STAVE_X + totalWidth - x : (first ? head : 0) + MEASURE_WIDTH;

      const treble = new Stave(x, TREBLE_Y, width);
      const bass = new Stave(x, BASS_Y, width);
      for (const [stave, clef] of [[treble, 'treble'], [bass, 'bass']]) {
        if (first) stave.addClef(clef).addTimeSignature('4/4');
        else stave.setBegBarType(Barline.type.NONE);
        // 小節線另外畫成貫穿上下兩行的一條線（drawBarline）。
        stave.setEndBarType(Barline.type.NONE);
        stave.setContext(ctx).draw();
      }

      if (measure.length > 0) {
        const marks = accidentalMarks(measure);
        const top = staffVoice(measure, marks, 'treble');
        const bottom = staffVoice(measure, marks, 'bass');
        const length = measure.reduce((sum, chord) => sum + chord.eighths, 0);
        new Formatter()
          .joinVoices([top.voice])
          .joinVoices([bottom.voice])
          .format([top.voice, bottom.voice], length * EIGHTH_SPACING);
        top.voice.draw(ctx, treble);
        bottom.voice.draw(ctx, bass);
        for (const item of [...top.beams, ...bottom.beams, ...top.ties, ...bottom.ties]) item.setContext(ctx).draw();
        latestX = top.voice.getTickables().at(-1).getAbsoluteX();
        for (const voice of [top.voice, bottom.voice]) {
          voice.getTickables().forEach((note) => {
            if (!note.pitches) return;
            const ys = note.getYs();
            note.pitches.forEach((pitch, k) => {
              // 和弦裡相鄰二度的符頭會往旁邊錯開，所以 x 取各個符頭自己的位置。
              const headX = note.noteHeads?.[k]?.getAbsoluteX() ?? note.getAbsoluteX();
              // 單音就整個音符（含符幹、升降記號）一起移動；和弦只移動被按住的那顆符頭。
              const element = note.pitches.length === 1 ? note.getSVGElement() : note.noteHeads[k].getSVGElement();
              heads.push({
                chordIndex: note.chordIndex,
                pitch,
                x: (headX + NOTE_HEAD_WIDTH / 2) * scale,
                y: ys[k] * scale,
                element,
                move(dx, dy) {
                  if (dx === 0 && dy === 0) element.removeAttribute('transform');
                  else element.setAttribute('transform', `translate(${dx / scale} ${dy / scale})`);
                },
              });
            });
          });
        }
      }

      const barX = x + (first ? head : 0) + MEASURE_WIDTH;
      if (isComplete(measure)) drawBarline(ctx, barX);
      x = barX;
    }
    return latestX === null ? null : (latestX + NOTE_HEAD_WIDTH) * scale;
  }

  // 離 (x, y)（相對於樂譜左上角的 px）最近、且在 radius 內的符頭；沒有則回傳 null。
  function noteAt(x, y, radius) {
    let best = null;
    let bestDistance = radius;
    for (const head of heads) {
      const distance = Math.hypot(head.x - x, head.y - y);
      if (distance <= bestDistance) {
        best = head;
        bestDistance = distance;
      }
    }
    return best;
  }

  // 把第 chordIndex 個和弦畫出來的音符加上 className（測驗模式標出答過的音、按錯時閃紅）。
  function markChord(chordIndex, className) {
    for (const head of heads) if (head.chordIndex === chordIndex) head.element.classList.add(className);
  }

  return { render, noteAt, markChord };
}

// 貫穿高音譜頂線到低音譜底線的小節線。
function drawBarline(ctx, x) {
  const top = new Stave(0, TREBLE_Y, 10).getYForLine(0);
  const bottom = new Stave(0, BASS_Y, 10).getYForLine(4);
  ctx.fillRect(x - 1, top, 1, bottom - top);
}
