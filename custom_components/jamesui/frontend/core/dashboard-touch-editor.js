// Pointer-based editor gestures; no timers or DOM mutation inside the model.
// The UI provides a timer scheduler so long-press is testable and cancellable.
export function createDashboardTouchEditor({
  session, onPreview, longPressMs = 550,
  schedule = (fn, ms) => globalThis.setTimeout(fn, ms),
  cancel = (id) => globalThis.clearTimeout(id),
} = {}) {
  if (!session || typeof session.enter !== "function" || typeof session.move !== "function") {
    throw new TypeError("Touch editor requires an edit session");
  }
  if (typeof onPreview !== "function") throw new TypeError("onPreview must be a function");
  if (!Number.isFinite(longPressMs) || longPressMs <= 0) throw new TypeError("invalid longPressMs");
  const MOVE_TOLERANCE = 10;
  let press = null;
  let timer = null;
  function stopTimer() {
    if (timer !== null) cancel(timer);
    timer = null;
  }
  function reset() { stopTimer(); press = null; }
  function pointerDown({ pointerId, x, y, elementId, mode = "move", rowPixels, columnPixels }) {
    reset();
    if (typeof elementId !== "string" || !elementId ||
        !Number.isFinite(x) || !Number.isFinite(y) ||
        !Number.isFinite(rowPixels) || rowPixels <= 0 ||
        !Number.isFinite(columnPixels) || columnPixels <= 0 ||
        !["move", "resize"].includes(mode)) return false;
    press = { pointerId, startX: x, startY: y, x, y, elementId, mode, rowPixels, columnPixels, active: session.active };
    if (!session.active) {
      const expected = press;
      timer = schedule(() => {
        timer = null;
        if (press !== expected) return;
        session.enter();
        press.active = true;
        onPreview(session.snapshot());
      }, longPressMs);
    }
    return true;
  }
  function pointerMove({ pointerId, x, y }) {
    if (!press || press.pointerId !== pointerId) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    press.x = x; press.y = y;
    if (!press.active && Math.hypot(x - press.startX, y - press.startY) > MOVE_TOLERANCE) {
      reset(); // Ordinary scrolling never triggers edit mode.
      return false;
    }
    return press.active;
  }
  function pointerUp({ pointerId }) {
    if (!press || press.pointerId !== pointerId) return false;
    const gesture = press;
    reset();
    if (!gesture.active) return false;
    const page = session.snapshot();
    const item = page.elements.find((entry) => entry.id === gesture.elementId);
    if (!item) return false;
    const dx = Math.round((gesture.x - gesture.startX) / gesture.columnPixels);
    const dy = Math.round((gesture.y - gesture.startY) / gesture.rowPixels);
    if (dx === 0 && dy === 0) return true;
    const change = gesture.mode === "resize"
      ? { column_span: Math.max(1, item.column_span + dx), row_span: Math.max(1, item.row_span + dy) }
      : { column: Math.max(0, item.column + dx), row: Math.max(0, item.row + dy) };
    const next = session.move(gesture.elementId, change);
    if (next) onPreview(next);
    return next !== null;
  }
  return Object.freeze({ pointerDown, pointerMove, pointerUp, pointerCancel: reset, destroy: reset });
}
