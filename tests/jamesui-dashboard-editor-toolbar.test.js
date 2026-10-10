import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardEditorToolbar } from "../custom_components/jamesui/frontend/core/dashboard-editor-toolbar.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("Block 14 editor toolbar opens, undoes, adds and saves through edit session", async () => {
  const events = [];
  let active = false;
  let canUndo = true;
  const session = {
    enter() { active = true; },
    get active() { return active; },
    get canUndo() { return canUndo; },
    snapshot() { return { elements: ["first"] }; },
    undo() { canUndo = false; return { elements: ["restored"] }; },
    async save() { events.push("save"); return { elements: ["saved"] }; },
    finish() { active = false; events.push("finish"); },
  };
  const document = createFakeDocument();
  const toolbar = createDashboardEditorToolbar({
    document, session,
    onChange: (page) => events.push(page.elements[0]),
    onAdd: () => events.push("add"),
  });
  assert.equal(toolbar.root.hidden, true);
  toolbar.open();
  assert.equal(toolbar.root.hidden, false);
  assert.equal(events[0], "first");
  const [add, undo, finish] = toolbar.root.children;
  add.dispatchEvent("click");
  undo.dispatchEvent("click");
  assert.equal(undo.disabled, true);
  finish.dispatchEvent("click");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ["first", "add", "restored", "save", "finish", "saved"]);
  assert.equal(toolbar.root.hidden, true);
});

test("Block 14 editor keeps unsaved state visible if save fails", async () => {
  const document = createFakeDocument();
  const session = {
    active: true,
    canUndo: false,
    enter() {},
    snapshot() { return {}; },
    undo() { return null; },
    async save() { throw new Error("offline"); },
    finish() { throw new Error("finish must not be called"); },
  };
  const toolbar = createDashboardEditorToolbar({
    document, session, onChange() {}, onAdd() {},
  });
  toolbar.open();
  toolbar.root.children[2].dispatchEvent("click");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(toolbar.root.hidden, false);
  assert.notEqual(toolbar.root.getAttribute("data-jui-editor-save-error"), null);
});
