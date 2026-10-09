import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardEditSession } from "../custom_components/jamesui/frontend/core/dashboard-edit-session.js";
import { createDashboardController } from "../custom_components/jamesui/frontend/core/dashboard-controller.js";
import { createConfigService } from "../custom_components/jamesui/frontend/core/config-service.js";

const initial = () => ({
  schema_version: 1,
  pages: { start: { kind: "dashboard", layout_id: "main", elements: [
    { id: "a", kind: "widget", ref_id: "agenda", column: 0, row: 0, column_span: 6, row_span: 3 },
    { id: "b", kind: "button", ref_id: "scene", column: 6, row: 0, column_span: 3, row_span: 2 },
  ] } },
  layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
  widget_instances: { agenda: { module_id: "widget.calendar-agenda" } },
  dynamic_buttons: { scene: { name: "Scene", mode: "trigger" } },
  data_sources: {}, module_settings: {},
});

function setup() {
  let remote = initial();
  let writes = 0;
  const configService = createConfigService({ homeAssistant: {
    async callWS(request) {
      if (request.type === "jamesui/config/get") return { config: structuredClone(remote) };
      if (request.type === "jamesui/config/replace") {
        writes += 1;
        remote = structuredClone(request.config);
        return { config: structuredClone(remote) };
      }
    },
  } });
  const controller = createDashboardController({ configService });
  const editor = createDashboardEditSession({ controller, configService, pageId: "start", maxRows: 12 });
  return { configService, editor, getWrites: () => writes };
}

test("Block 14 editing previews locally, undo restores and save commits once", async () => {
  const { configService, editor, getWrites } = setup();
  await configService.load();
  editor.enter();
  const moved = editor.move("a", { column: 6 });
  assert.deepEqual(moved.elements.map((e) => [e.id, e.column, e.row]), [["a", 6, 0], ["b", 6, 3]]);
  assert.equal(getWrites(), 0);
  assert.equal(editor.canUndo, true);
  editor.undo();
  assert.equal(editor.snapshot().elements[0].column, 0);
  editor.move("a", { column: 6 });
  await editor.save();
  assert.equal(getWrites(), 1);
  assert.equal(configService.snapshot().pages.start.elements[0].column, 6);
  assert.equal(editor.canUndo, false);
  editor.finish();
  assert.equal(editor.active, false);
});

test("Block 14 impossible move leaves session untouched", async () => {
  const { configService, editor } = setup();
  await configService.load();
  editor.enter();
  assert.equal(editor.move("a", { column: 6, row: 11 }), null);
  assert.equal(editor.canUndo, false);
  assert.equal(editor.snapshot().elements[0].column, 0);
});

test("Block 14 detects external element changes instead of overwriting them", async () => {
  const { configService, editor } = setup();
  await configService.load();
  editor.enter();
  editor.move("a", { row: 5 });
  const external = configService.snapshot();
  external.pages.start.elements.pop();
  await configService.replace(external);
  await assert.rejects(() => editor.save(), /externally/);
  assert.equal(configService.snapshot().pages.start.elements.length, 1);
});
