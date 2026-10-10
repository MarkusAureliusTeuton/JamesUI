import test from "node:test";
import assert from "node:assert/strict";
import { bindDashboardTouchEvents } from "../custom_components/jamesui/frontend/core/dashboard-touch-events.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("Block 14 pointer events route item and resize-handle touches correctly", () => {
  const document = createFakeDocument();
  const root = document.createElement("div");
  const item = document.createElement("div");
  item.setAttribute("data-jui-dashboard-item", "agenda");
  const child = document.createElement("span");
  const handle = document.createElement("span");
  handle.setAttribute("data-jui-editor-resize", "");
  item.appendChild(child);
  item.appendChild(handle);
  root.appendChild(item);
  const log = [];
  const editor = {
    pointerDown(value) { log.push(["down", value]); return true; },
    pointerMove(value) { log.push(["move", value]); },
    pointerUp(value) { log.push(["up", value]); },
    pointerCancel() { log.push(["cancel"]); },
  };
  const release = bindDashboardTouchEvents({
    gridRoot: root, editor,
    getMetrics: () => ({ columnPixels: 45, rowPixels: 36 }),
  });
  root.dispatchEvent({ type: "pointerdown", target: child, pointerId: 7, clientX: 5, clientY: 10, button: 0 });
  root.dispatchEvent({ type: "pointermove", target: child, pointerId: 7, clientX: 50, clientY: 46 });
  root.dispatchEvent({ type: "pointerup", target: child, pointerId: 7 });
  root.dispatchEvent({ type: "pointerdown", target: handle, pointerId: 9, clientX: 2, clientY: 4, button: 0 });
  assert.equal(log[0][1].elementId, "agenda");
  assert.equal(log[0][1].mode, "move");
  assert.equal(log[3][1].mode, "resize");
  release();
  assert.deepEqual(log.at(-1), ["cancel"]);
  const count = log.length;
  root.dispatchEvent({ type: "pointerdown", target: child, pointerId: 10, clientX: 0, clientY: 0, button: 0 });
  assert.equal(log.length, count);
});
