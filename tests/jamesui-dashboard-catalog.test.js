import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardCatalog, createDashboardCatalogView } from "../custom_components/jamesui/frontend/modules/dashboard-catalog.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("Block 14 catalog shows registered widget modules only", () => {
  const registry = { get(id) {
    if (id === "widget.calendar-agenda" || id === "widget.house-quick") return { manifest: { type: "widget" } };
    return null;
  } };
  const catalog = createDashboardCatalog({ moduleRegistry: registry });
  assert.deepEqual(catalog.entries().map((item) => item.module_id), [
    "widget.calendar-agenda", "widget.house-quick",
  ]);
});

test("Block 14 catalog selection emits module identity and closes", () => {
  const document = createFakeDocument();
  const selected = [];
  const catalog = createDashboardCatalog({ moduleRegistry: {
    get: (id) => id === "widget.calendar-agenda" ? { manifest: { type: "widget" } } : null,
  } });
  const view = createDashboardCatalogView({ document, catalog, onSelect: (id) => selected.push(id) });
  assert.equal(view.root.hidden, true);
  view.open();
  assert.equal(view.root.hidden, false);
  view.root.querySelector('[data-jui-catalog-module="widget.calendar-agenda"]').dispatchEvent("click");
  assert.deepEqual(selected, ["widget.calendar-agenda"]);
  assert.equal(view.root.hidden, true);
});

test("catalog pre-fills existing Agenda widget and preserves advanced options while editing sources", () => {
  const document = createFakeDocument();
  const prior = {
    instance_id: "agenda", calendar_enabled: true, tasks_enabled: false,
    lookahead_days: 45, show_location: true,
    calendars: [{ entity_id: "calendar.family", accent: "#336699" }], task_lists: [],
  };
  const config = {
    data_sources: { "provider.calendar": { source_entity_ids: ["calendar.family"] } },
    dynamic_buttons: {},
  };
  const received = [];
  const view = createDashboardCatalogView({
    document,
    catalog: createDashboardCatalog({ moduleRegistry: {
      get: (id) => id === "widget.calendar-agenda" ? { manifest: { type: "widget" } } : null,
    } }),
    getConfig: () => config,
    onSelect() { throw Error("Edit must not add a new widget"); },
    onEdit: (...args) => { received.push(args); return true; },
  });
  view.edit("agenda-tile", { module_id: "widget.calendar-agenda", config: prior });
  assert.equal(view.root.hidden, false);
  assert.equal(view.root.querySelector('[data-jui-catalog-field="calendars"]').value, "calendar.family");
  const calendars = view.root.querySelector('[data-jui-catalog-field="calendars"]');
  calendars.value = "calendar.family, calendar.extra";
  view.root.querySelector('[data-jui-catalog-confirm]').dispatchEvent("click");
  assert.equal(view.root.hidden, true);
  assert.equal(received.length, 1);
  assert.equal(received[0][0], "agenda-tile");
  assert.equal(received[0][1], "widget.calendar-agenda");
  const plan = received[0][2];
  assert.equal(plan.config.lookahead_days, 45);
  assert.equal(plan.config.show_location, true);
  assert.equal(plan.config.calendars[0].accent, "#336699");
  assert.deepEqual(plan.config.calendars.map((entry) => entry.entity_id),
    ["calendar.family", "calendar.extra"]);
  assert.deepEqual(plan.dataSources["provider.calendar"].source_entity_ids,
    ["calendar.family", "calendar.extra"]);
  assert.equal(plan.instanceIdConfigKey, "instance_id");
});
