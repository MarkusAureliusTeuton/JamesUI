import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardTouchEditor } from "../custom_components/jamesui/frontend/core/dashboard-touch-editor.js";

function setup() {
  const callbacks = [];
  const moves = [];
  let active = false;
  let scheduled = null;
  const page = { elements: [{ id: "a", column: 2, row: 1, column_span: 3, row_span: 2 }] };
  const session = {
    get active() { return active; },
    enter() { active = true; return page; },
    snapshot() { return page; },
    move(id, changes) {
      moves.push([id, changes]);
      return { elements: [{ ...page.elements[0], ...changes }] };
    },
  };
  const editor = createDashboardTouchEditor({
    session, onPreview: (next) => callbacks.push(next),
    schedule: (fn) => { scheduled = fn; return 1; },
    cancel: () => { scheduled = null; },
  });
  const down = (extra = {}) => editor.pointerDown({
    pointerId: 1, x: 20, y: 20, elementId: "a", rowPixels: 40, columnPixels: 50, ...extra,
  });
  return { editor, down, moves, callbacks, fire: () => scheduled?.(), getActive: () => active };
}

test("long press enters edit mode, then pointer drag moves by grid cells", () => {
  const state = setup();
  assert.equal(state.down(), true);
  state.fire();
  assert.equal(state.getActive(), true);
  state.editor.pointerMove({ pointerId: 1, x: 120, y: 60 });
  assert.equal(state.editor.pointerUp({ pointerId: 1 }), true);
  assert.deepEqual(state.moves, [["a", { column: 4, row: 2 }]]);
  assert.equal(state.callbacks.length, 2);
});

test("ordinary scroll movement and cancelled press cannot activate editor", () => {
  const state = setup();
  state.down();
  state.editor.pointerMove({ pointerId: 1, x: 45, y: 20 });
  state.fire();
  assert.equal(state.getActive(), false);
  assert.equal(state.editor.pointerUp({ pointerId: 1 }), false);
  state.down();
  state.editor.pointerCancel();
  state.fire();
  assert.equal(state.getActive(), false);
});

test("resize gesture changes only size and clamps minimum dimensions", () => {
  const state = setup();
  state.down({ mode: "resize" });
  state.fire();
  state.editor.pointerMove({ pointerId: 1, x: -140, y: -100 });
  state.editor.pointerUp({ pointerId: 1 });
  assert.deepEqual(state.moves, [["a", { column_span: 1, row_span: 1 }]]);
});

test("wrong pointer cannot commit a gesture", () => {
  const state = setup();
  state.down();
  state.fire();
  assert.equal(state.editor.pointerMove({ pointerId: 2, x: 300, y: 300 }), false);
  assert.equal(state.editor.pointerUp({ pointerId: 2 }), false);
  state.editor.destroy();
  assert.deepEqual(state.moves, []);
});
