import test from "node:test";
import assert from "node:assert/strict";

import {
  computeExpandedNoticeHeight,
  computeVisibleCapacity,
  visibleRowWindow,
} from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/sizing.js";
import {
  SWIPE_COMMIT_PX,
  SWIPE_DOMINANCE_RATIO,
  SWIPE_LOCK_PX,
  createDaySwipeTracker,
} from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/gesture.js";

test("exports the approved fixed swipe constants", () => {
  assert.equal(SWIPE_LOCK_PX, 12);
  assert.equal(SWIPE_COMMIT_PX, 48);
  assert.equal(SWIPE_DOMINANCE_RATIO, 1.25);
});

test("computeVisibleCapacity floors complete rows only and never returns partial capacity", () => {
  assert.equal(computeVisibleCapacity({ hostHeight: 420, chromeHeight: 120, rowHeight: 60 }), 5);
  assert.equal(computeVisibleCapacity({ hostHeight: 419, chromeHeight: 120, rowHeight: 60 }), 4);
  assert.equal(computeVisibleCapacity({ hostHeight: 150, chromeHeight: 120, rowHeight: 60 }), 0);
  assert.equal(computeVisibleCapacity({ hostHeight: 120, chromeHeight: 120, rowHeight: 60 }), 0);
  assert.throws(() => computeVisibleCapacity({ hostHeight: 100, chromeHeight: 10, rowHeight: 0 }), RangeError);
});

test("visibleRowWindow returns deterministic indices and continuation flags", () => {
  assert.deepEqual(visibleRowWindow({ scrollTop: 0, viewportHeight: 180, rowHeight: 60, totalRows: 8 }), {
    first_index: 0,
    last_index: 2,
    has_before: false,
    has_after: true,
  });
  assert.deepEqual(visibleRowWindow({ scrollTop: 120, viewportHeight: 180, rowHeight: 60, totalRows: 8 }), {
    first_index: 2,
    last_index: 4,
    has_before: true,
    has_after: true,
  });
  assert.deepEqual(visibleRowWindow({ scrollTop: 420, viewportHeight: 180, rowHeight: 60, totalRows: 8 }), {
    first_index: 7,
    last_index: 7,
    has_before: true,
    has_after: false,
  });
  assert.deepEqual(visibleRowWindow({ scrollTop: 0, viewportHeight: 180, rowHeight: 60, totalRows: 0 }), {
    first_index: -1,
    last_index: -1,
    has_before: false,
    has_after: false,
  });
});

test("expanded notice height never steals the final complete Agenda row", () => {
  assert.equal(computeExpandedNoticeHeight({ hostHeight: 500, baseChromeHeight: 100, rowHeight: 60, desiredNoticeHeight: 300 }), 300);
  assert.equal(computeExpandedNoticeHeight({ hostHeight: 500, baseChromeHeight: 100, rowHeight: 60, desiredNoticeHeight: 400 }), 340);
  assert.equal(computeExpandedNoticeHeight({ hostHeight: 150, baseChromeHeight: 100, rowHeight: 60, desiredNoticeHeight: 80 }), 0);
});

test("horizontal gesture locks after threshold and commits at most one adjacent day", () => {
  const moves = [];
  const swipe = createDaySwipeTracker({
    onPrevious: () => moves.push("previous"),
    onNext: () => moves.push("next"),
  });
  swipe.start({ clientX: 100, clientY: 100 });
  assert.equal(swipe.move({ clientX: 90, clientY: 98 }), null);
  assert.equal(swipe.move({ clientX: 70, clientY: 98 }), "horizontal");
  assert.equal(swipe.end({ clientX: 51, clientY: 98 }), "next");
  assert.deepEqual(moves, ["next"]);
  assert.equal(swipe.end({ clientX: 0, clientY: 98 }), null);
});

test("right swipe goes to previous day, sub-threshold and vertical gestures do nothing", () => {
  const moves = [];
  const swipe = createDaySwipeTracker({
    onPrevious: () => moves.push("previous"),
    onNext: () => moves.push("next"),
  });
  swipe.start({ clientX: 50, clientY: 50 });
  assert.equal(swipe.move({ clientX: 70, clientY: 51 }), "horizontal");
  assert.equal(swipe.end({ clientX: 98, clientY: 51 }), "previous");

  swipe.start({ clientX: 50, clientY: 50 });
  swipe.move({ clientX: 80, clientY: 51 });
  assert.equal(swipe.end({ clientX: 97, clientY: 51 }), null);

  swipe.start({ clientX: 50, clientY: 50 });
  assert.equal(swipe.move({ clientX: 52, clientY: 90 }), "vertical");
  assert.equal(swipe.end({ clientX: 52, clientY: 120 }), null);
  assert.deepEqual(moves, ["previous"]);
});

test("ambiguous diagonal movement does not steal scrolling until one direction dominates", () => {
  const swipe = createDaySwipeTracker({ onPrevious: () => {}, onNext: () => {} });
  swipe.start({ clientX: 0, clientY: 0 });
  assert.equal(swipe.move({ clientX: 20, clientY: 18 }), null);
  assert.equal(swipe.move({ clientX: 40, clientY: 20 }), "horizontal");
  swipe.cancel();
  assert.equal(swipe.end({ clientX: 100, clientY: 20 }), null);
});
