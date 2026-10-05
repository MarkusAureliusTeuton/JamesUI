export const SWIPE_LOCK_PX = 12;
export const SWIPE_COMMIT_PX = 48;
export const SWIPE_DOMINANCE_RATIO = 1.25;

function point(event) {
  const x = Number(event?.clientX);
  const y = Number(event?.clientY);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function createDaySwipeTracker({ onPrevious, onNext } = {}) {
  if (typeof onPrevious !== "function" || typeof onNext !== "function") {
    throw new TypeError("day swipe tracker requires onPrevious and onNext");
  }
  let startPoint = null;
  let lock = null;
  let active = false;

  const reset = () => {
    startPoint = null;
    lock = null;
    active = false;
  };

  return Object.freeze({
    start(event) {
      const next = point(event);
      if (!next) return false;
      startPoint = next;
      lock = null;
      active = true;
      return true;
    },

    move(event) {
      if (!active || !startPoint) return null;
      if (lock) return lock;
      const next = point(event);
      if (!next) return null;
      const dx = Math.abs(next.x - startPoint.x);
      const dy = Math.abs(next.y - startPoint.y);
      if (Math.max(dx, dy) < SWIPE_LOCK_PX) return null;
      if (dx >= dy * SWIPE_DOMINANCE_RATIO) lock = "horizontal";
      else if (dy >= dx * SWIPE_DOMINANCE_RATIO) lock = "vertical";
      return lock;
    },

    end(event) {
      if (!active || !startPoint) return null;
      const next = point(event);
      const currentLock = lock;
      const origin = startPoint;
      reset();
      if (!next || currentLock !== "horizontal") return null;
      const dx = next.x - origin.x;
      if (Math.abs(dx) < SWIPE_COMMIT_PX) return null;
      if (dx > 0) {
        onPrevious();
        return "previous";
      }
      onNext();
      return "next";
    },

    cancel() {
      const wasActive = active;
      reset();
      return wasActive;
    },
  });
}
