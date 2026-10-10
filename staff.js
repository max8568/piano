// 用 VexFlow 畫大譜表與音符。VexFlow 由 index.html 以一般 script 載入（全域 Vex）。
import { staffFor, vexKey } from './music.js';

const { Renderer, Stave, StaveNote, GhostNote, Voice, Formatter, StaveConnector } = Vex.Flow;

// 以下為 VexFlow 的「虛擬座標」，實際畫面再依高度等比例縮放。
const VIRTUAL_HEIGHT = 260; // 足夠容納 C6（上加兩線）到 C2（下加兩線）
const TREBLE_Y = 10;
const BASS_Y = 120;
const STAVE_X = 10;
const NOTE_SPACING = 44; // 每個四分音符佔的寬度
const END_PADDING = 30;

export function createStaff(container) {
  const renderer = new Renderer(container, Renderer.Backends.SVG);

  function render(notes) {
    const scale = container.clientHeight / VIRTUAL_HEIGHT;
    const viewWidth = container.clientWidth / scale;

    // 先建一個暫時的 stave 算出音符起點（譜號＋拍號之後）。
    const probe = new Stave(STAVE_X, TREBLE_Y, 100).addClef('treble').addTimeSignature('4/4');
    const notesStartOffset = probe.getNoteStartX() - STAVE_X;

    const notesWidth = notes.length * NOTE_SPACING;
    const staveWidth = Math.max(viewWidth - STAVE_X * 2, notesStartOffset + notesWidth + END_PADDING);

    const virtualWidth = staveWidth + STAVE_X * 2;
    renderer.resize(virtualWidth * scale, VIRTUAL_HEIGHT * scale);
    const ctx = renderer.getContext();
    ctx.clear();
    // 不用 ctx.scale()：它會在每次重畫時累乘。直接設定 viewBox 達到等比例縮放。
    ctx.setViewBox(0, 0, virtualWidth, VIRTUAL_HEIGHT);

    const treble = new Stave(STAVE_X, TREBLE_Y, staveWidth).addClef('treble').addTimeSignature('4/4');
    const bass = new Stave(STAVE_X, BASS_Y, staveWidth).addClef('bass').addTimeSignature('4/4');
    treble.setContext(ctx).draw();
    bass.setContext(ctx).draw();
    new StaveConnector(treble, bass).setType('brace').setContext(ctx).draw();
    new StaveConnector(treble, bass).setType('singleLeft').setContext(ctx).draw();
    new StaveConnector(treble, bass).setType('singleRight').setContext(ctx).draw();

    if (notes.length === 0) return;

    // 每一拍兩行都要有東西：有音符的那行放 StaveNote，另一行放 GhostNote 佔位，讓上下對齊。
    const trebleNotes = [];
    const bassNotes = [];
    for (const pitch of notes) {
      const staff = staffFor(pitch);
      const note = new StaveNote({ clef: staff, keys: [vexKey(pitch)], duration: 'q', auto_stem: true });
      if (staff === 'treble') {
        trebleNotes.push(note);
        bassNotes.push(new GhostNote({ duration: 'q' }));
      } else {
        bassNotes.push(note);
        trebleNotes.push(new GhostNote({ duration: 'q' }));
      }
    }

    const trebleVoice = new Voice({ num_beats: notes.length, beat_value: 4 }).addTickables(trebleNotes);
    const bassVoice = new Voice({ num_beats: notes.length, beat_value: 4 }).addTickables(bassNotes);

    new Formatter().joinVoices([trebleVoice]).joinVoices([bassVoice]).format([trebleVoice, bassVoice], notesWidth);
    trebleVoice.draw(ctx, treble);
    bassVoice.draw(ctx, bass);
  }

  return { render };
}
