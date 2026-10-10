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


test("Block 14 catalog widgets are independent, undoable and saved atomically", async () => {
  const { configService, editor, getWrites } = setup();
  await configService.load();
  editor.enter();
  const added = editor.addWidget("widget.calendar-agenda", { config: { calendar: "work" } });
  assert.equal(added.elements.length, 3);
  assert.equal(getWrites(), 0);
  editor.undo();
  assert.equal(editor.snapshot().elements.length, 2);
  const again = editor.addWidget("widget.calendar-agenda", { config: { calendar: "family" } });
  assert.equal(again.elements.length, 3);
  await editor.save();
  const saved = configService.snapshot();
  const ref = saved.pages.start.elements[2].ref_id;
  assert.equal(saved.widget_instances[ref].module_id, "widget.calendar-agenda");
  assert.equal(saved.widget_instances[ref].config.calendar, "family");
  assert.equal(getWrites(), 1);
});

test("configured widget plus real source bindings save together, and undo removes all changes", async () => {
  const { configService, editor, getWrites } = setup();
  await configService.load();
  const unchanged = configService.snapshot();
  editor.enter();
  const plan = {
    instanceIdConfigKey: "instance_id",
    config: {
      instance_id: "pending", calendar_enabled: true, tasks_enabled: false,
      calendars: [{ entity_id: "calendar.family" }], task_lists: [],
    },
    dataSources: { "provider.calendar": { source_entity_ids: ["calendar.family"] } },
  };
  let next = editor.addWidget("widget.calendar-agenda", plan);
  const id = next.elements.at(-1).ref_id;
  assert.equal(editor.workingConfig().widget_instances[id].config.instance_id, id);
  assert.deepEqual(editor.workingConfig().data_sources["provider.calendar"].source_entity_ids, ["calendar.family"]);
  assert.equal(getWrites(), 0);
  editor.undo();
  assert.deepEqual(configService.snapshot(), unchanged);
  assert.equal(editor.workingConfig().widget_instances[id], undefined);
  assert.equal(editor.workingConfig().data_sources["provider.calendar"], undefined);
  next = editor.addWidget("widget.calendar-agenda", plan);
  assert.equal(next.elements.at(-1).ref_id, id);
  await editor.save();
  assert.equal(getWrites(), 1);
  const saved = configService.snapshot();
  assert.deepEqual(saved.data_sources["provider.calendar"].source_entity_ids, ["calendar.family"]);
  assert.equal(saved.widget_instances[id].config.instance_id, id);
  assert.equal(saved.pages.start.elements.at(-1).ref_id, id);
  assert.equal(editor.canUndo, false);
  editor.finish();
});

test("concurrent provider change rejects dashboard save without discarding local draft", async () => {
  const { configService, editor } = setup();
  await configService.load();
  editor.enter();
  editor.addWidget("widget.calendar-agenda", {
    instanceIdConfigKey: "instance_id",
    config: { instance_id: "pending", calendar_enabled: true, tasks_enabled: false,
      calendars: [{ entity_id: "calendar.family" }], task_lists: [] },
    dataSources: { "provider.calendar": { source_entity_ids: ["calendar.family"] } },
  });
  const external = configService.snapshot();
  external.data_sources["provider.calendar"] = { source_entity_ids: ["calendar.other"] };
  await configService.replace(external);
  await assert.rejects(() => editor.save(), /Datenquelle wurde extern geändert/);
  assert.equal(editor.active, true);
  assert.deepEqual(configService.snapshot().data_sources["provider.calendar"].source_entity_ids, ["calendar.other"]);
  assert.deepEqual(editor.workingConfig().data_sources["provider.calendar"].source_entity_ids, ["calendar.family"]);
});

test("new dynamic definitions are included atomically with configured button widget", async () => {
  const { configService, editor } = setup();
  await configService.load();
  editor.enter();
  editor.addWidget("widget.dynamic-buttons", {
    config: { buttons: [{ id: "link", button_id: "dashboard-link-1", size: "normal" }] },
    dynamicButtons: { "dashboard-link-1": {
      name: "Website", mode: "trigger", action: { type: "url.open", url: "https://example.org" },
    } },
  });
  await editor.save();
  const saved = configService.snapshot();
  assert.ok(saved.dynamic_buttons["dashboard-link-1"]);
  const ref = saved.pages.start.elements.at(-1).ref_id;
  assert.equal(saved.widget_instances[ref].config.buttons[0].button_id, "dashboard-link-1");
});

test("new widgets fill free 12-column grid horizontally before starting another row", async () => {
  const { configService, editor } = setup();
  await configService.load();
  const empty = configService.snapshot();
  empty.pages.start.elements = [];
  await configService.replace(empty);
  editor.enter();
  const placements = [];
  for (let index = 0; index < 4; index++) {
    const next = editor.addWidget("widget.weather-today", { config: {}, columnSpan: 4, rowSpan: 3 });
    placements.push([next.elements.at(-1).column, next.elements.at(-1).row]);
  }
  assert.deepEqual(placements, [[0, 0], [4, 0], [8, 0], [0, 3]]);
  assert.equal(new Set(editor.snapshot().elements.map((entry) => entry.id)).size, 4);
  await editor.save();
  const saved = configService.snapshot();
  assert.deepEqual(saved.pages.start.elements.map((entry) => [entry.column, entry.row]), placements);
});

test("existing widget configuration edits are undoable, saved once and preserve unrelated settings", async () => {
  const { configService, editor, getWrites } = setup();
  await configService.load();
  const original = configService.snapshot();
  editor.enter();
  const after = editor.updateWidget("a", { config: { lookahead_days: 14 } });
  assert.equal(after.elements.length, 2);
  assert.deepEqual(editor.workingConfig().widget_instances.agenda.config, { lookahead_days: 14 });
  assert.equal(getWrites(), 0);
  editor.undo();
  assert.deepEqual(editor.workingConfig(), original);
  editor.updateWidget("a", { config: { lookahead_days: 21 } });
  await editor.save();
  assert.equal(getWrites(), 1);
  assert.deepEqual(configService.snapshot().widget_instances.agenda.config, { lookahead_days: 21 });
  assert.deepEqual(configService.snapshot().dynamic_buttons, original.dynamic_buttons);
  assert.equal(configService.snapshot().pages.start.elements.length, 2);
  editor.finish();
});

test("removing a dashboard tile leaves shared sources and buttons intact", async () => {
  const { configService, editor, getWrites } = setup();
  await configService.load();
  const original = configService.snapshot();
  editor.enter();
  editor.removeElement("a");
  assert.equal(editor.snapshot().elements.length, 1);
  assert.equal(editor.workingConfig().widget_instances.agenda, undefined);
  assert.equal(getWrites(), 0);
  editor.undo();
  assert.ok(editor.workingConfig().widget_instances.agenda);
  editor.removeElement("a");
  await editor.save();
  assert.equal(getWrites(), 1);
  assert.equal(configService.snapshot().widget_instances.agenda, undefined);
  assert.equal(configService.snapshot().pages.start.elements.length, 1);
  assert.deepEqual(configService.snapshot().dynamic_buttons, original.dynamic_buttons);
  editor.enter();
  editor.removeElement("b");
  await editor.save();
  assert.equal(configService.snapshot().pages.start.elements.length, 0);
  assert.ok(configService.snapshot().dynamic_buttons.scene,
    "Central definitions are not implicitly deleted with a tile");
});

test("a shared widget instance cannot be modified globally by one page; removing local tile preserves it", async () => {
  const { configService, editor } = setup();
  await configService.load();
  const shared = configService.snapshot();
  shared.pages.other = {
    kind: "dashboard", layout_id: "main",
    elements: [{ ...shared.pages.start.elements[0], id: "other-agenda" }],
  };
  await configService.replace(shared);
  editor.enter();
  assert.throws(() => editor.updateWidget("a", { config: { changed: true } }), /Gemeinsam genutzte/);
  editor.removeElement("a");
  assert.ok(editor.workingConfig().widget_instances.agenda);
  await editor.save();
  assert.equal(configService.snapshot().pages.start.elements.length, 1);
  assert.equal(configService.snapshot().pages.other.elements[0].ref_id, "agenda");
  assert.ok(configService.snapshot().widget_instances.agenda);
});

test("concurrent widget instance update rejects save and keeps the user's unsaved changes", async () => {
  const { configService, editor } = setup();
  await configService.load();
  editor.enter();
  editor.updateWidget("a", { config: { lookahead_days: 14 } });
  const external = configService.snapshot();
  external.widget_instances.agenda.config = { lookahead_days: 30 };
  await configService.replace(external);
  await assert.rejects(() => editor.save(), /Widget-Instanz wurde extern geändert/);
  assert.equal(editor.active, true);
  assert.equal(configService.snapshot().widget_instances.agenda.config.lookahead_days, 30);
  assert.equal(editor.workingConfig().widget_instances.agenda.config.lookahead_days, 14);
});

test("editing can update central sources and widget atomically without touching unrelated definitions", async () => {
  const { configService, editor } = setup();
  await configService.load();
  editor.enter();
  editor.updateWidget("a", {
    config: { instance_id: "agenda", calendar_enabled: true, tasks_enabled: false,
      calendars: [{ entity_id: "calendar.family" }], task_lists: [] },
    instanceIdConfigKey: "instance_id",
    dataSources: { "provider.calendar": { source_entity_ids: ["calendar.family"] } },
  });
  await editor.save();
  const saved = configService.snapshot();
  assert.deepEqual(saved.data_sources["provider.calendar"].source_entity_ids, ["calendar.family"]);
  assert.equal(saved.widget_instances.agenda.config.instance_id, "agenda");
  assert.ok(saved.dynamic_buttons.scene);
});

test("Cancel discards widget edits, removal, new sources and definitions without any write", async () => {
  const { configService, editor, getWrites } = setup();
  await configService.load();
  const initialSnapshot = configService.snapshot();
  editor.enter();
  editor.updateWidget("a", {
    config: { instance_id: "agenda", calendar_enabled: true, tasks_enabled: false,
      calendars: [{ entity_id: "calendar.family" }], task_lists: [] },
    dataSources: { "provider.calendar": { source_entity_ids: ["calendar.family"] } },
  });
  editor.addWidget("widget.dynamic-buttons", {
    config: { buttons: [{ id: "light", button_id: "new-light", size: "normal" }] },
    dynamicButtons: { "new-light": {
      name: "Licht", mode: "trigger", action: { type: "navigate", route: "home" },
    } },
  });
  editor.removeElement("b");
  assert.equal(editor.canUndo, true);
  const restored = editor.cancel();
  assert.equal(editor.active, false);
  assert.deepEqual(restored.elements, initialSnapshot.pages.start.elements);
  assert.deepEqual(configService.snapshot(), initialSnapshot);
  assert.equal(getWrites(), 0);
  editor.enter();
  assert.deepEqual(editor.workingConfig(), initialSnapshot);
  editor.finish();
});
