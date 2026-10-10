// 刪除音符的手勢：手指按住樂譜上的音符一段時間（音符被紅圈圈起），再往上滑就刪掉它。
// 按住期間手指一移動就取消，讓一般的左右捲動不受影響。

const HOLD_MS = 450; // 按住多久才選中音符
const MOVE_TOLERANCE = 10; // 選中前手指可以晃動的距離（px），超過就當成捲動
const SWIPE_UP = 60; // 選中後往上滑多少（px）就刪除
const HIT_RADIUS = 28; // 手指離符頭中心多遠以內算按到（px）

// scroller：樂譜捲動區；marker：選中時圈住音符的元素（與 scroller 同一個定位容器）。
// noteAt(x, y, radius)：找出樂譜座標上的符頭（見 staff.js）；onDelete(head)：刪除該音符。
export function attachDeleteGesture(scroller, marker, { noteAt, onDelete }) {
  let gesture = null; // { id, startX, startY, head, timer, selected }

  function hideMarker() {
    marker.hidden = true;
    marker.classList.remove('deleting');
    marker.style.transform = '';
  }

  function end() {
    if (!gesture) return;
    clearTimeout(gesture.timer);
    gesture = null;
  }

  function touchOf(event) {
    return gesture && [...event.changedTouches].find((t) => t.identifier === gesture.id);
  }

  scroller.addEventListener('touchstart', (event) => {
    if (gesture || event.touches.length !== 1) return end();
    const touch = event.changedTouches[0];
    const rect = scroller.getBoundingClientRect();
    const head = noteAt(touch.clientX - rect.left + scroller.scrollLeft, touch.clientY - rect.top, HIT_RADIUS);
    if (!head) return;
    gesture = { id: touch.identifier, startX: touch.clientX, startY: touch.clientY, head, selected: false };
    gesture.timer = setTimeout(() => {
      gesture.selected = true;
      marker.style.left = `${head.x - scroller.scrollLeft}px`;
      marker.style.top = `${head.y}px`;
      marker.hidden = false;
    }, HOLD_MS);
  });

  // 不能是 passive：選中後要擋掉捲動，讓手指專心上滑。
  scroller.addEventListener('touchmove', (event) => {
    const touch = touchOf(event);
    if (!touch) return;
    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;
    if (!gesture.selected) {
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) end();
      return;
    }
    event.preventDefault();
    const up = Math.max(0, -dy);
    marker.style.transform = `translateY(${-up}px)`;
    marker.classList.toggle('deleting', up >= SWIPE_UP);
  }, { passive: false });

  scroller.addEventListener('touchend', (event) => {
    const touch = touchOf(event);
    if (!touch) return;
    if (gesture.selected && gesture.startY - touch.clientY >= SWIPE_UP) onDelete(gesture.head);
    hideMarker();
    end();
  });

  scroller.addEventListener('touchcancel', (event) => {
    if (!touchOf(event)) return;
    hideMarker();
    end();
  });
}
