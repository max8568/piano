// 刪除音符的手勢：手指按住樂譜上的音符一段時間，音符變色並跟著手指移動；往上拉夠遠再放開就刪掉它，
// 沒拉夠就放開則回到原位。按住期間手指一移動就取消，讓一般的左右捲動不受影響。
//
// 用 pointer events 而不是 touch events：iPad 的 Safari 預設以「桌面版網站」模式開啟，
// 這時不會送 touch events 給網頁（鍵盤能用也是因為走 pointer events）。

const HOLD_MS = 450; // 按住多久才選中音符
const MOVE_TOLERANCE = 10; // 選中前手指可以晃動的距離（px），超過就當成捲動
const SWIPE_UP = 60; // 選中後往上拉多少（px）就刪除
const HIT_RADIUS = 28; // 手指離符頭中心多遠以內算按到（px）

// scroller：樂譜捲動區。
// noteAt(x, y, radius)：找出樂譜座標上的符頭（見 staff.js）；onDelete(head)：刪除該音符。
export function attachDeleteGesture(scroller, { noteAt, onDelete }) {
  let gesture = null; // { id, startX, startY, head, timer, selected }

  function end() {
    if (!gesture) return;
    clearTimeout(gesture.timer);
    const { head } = gesture;
    gesture = null;
    head.move(0, 0);
    head.element.classList.remove('dragging', 'deleting');
    scroller.classList.remove('locked');
  }

  const ours = (event) => gesture && event.pointerId === gesture.id;

  scroller.addEventListener('pointerdown', (event) => {
    if (gesture) return end(); // 第二根手指：取消
    const rect = scroller.getBoundingClientRect();
    const head = noteAt(event.clientX - rect.left + scroller.scrollLeft, event.clientY - rect.top, HIT_RADIUS);
    if (!head) return;
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, head, selected: false };
    gesture.timer = setTimeout(() => {
      gesture.selected = true;
      // 選中後鎖住捲動，音符跟著手指走時譜不會被捲走。
      scroller.classList.add('locked');
      head.element.classList.add('dragging');
    }, HOLD_MS);
  });

  scroller.addEventListener('pointermove', (event) => {
    if (!ours(event)) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.selected) {
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) end();
      return;
    }
    gesture.head.move(dx, dy);
    gesture.head.element.classList.toggle('deleting', -dy >= SWIPE_UP);
  });

  // 有 touch events 的瀏覽器：選中後擋掉觸控捲動（pointer events 無法用 preventDefault 擋捲動）。
  scroller.addEventListener('touchmove', (event) => {
    if (gesture?.selected) event.preventDefault();
  }, { passive: false });

  scroller.addEventListener('pointerup', (event) => {
    if (!ours(event)) return;
    const { head, selected, startY } = gesture;
    end();
    if (selected && startY - event.clientY >= SWIPE_UP) onDelete(head);
  });

  scroller.addEventListener('pointercancel', (event) => {
    if (ours(event)) end();
  });
}
