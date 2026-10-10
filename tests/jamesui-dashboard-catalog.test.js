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

test("device editor selects an explicit source instead of silently preselecting first of many", () => {
  const document = createFakeDocument();
  const data = {
    data_sources: { "provider.house-devices": { devices: [
      { id: "device-a", name: "Pumpe", primary_entity_id: "switch.pump",
        active: { entity_id: "binary_sensor.pump_active" } },
      { id: "device-b", name: "Lüftung", primary_entity_id: "switch.fan",
        active: { entity_id: "binary_sensor.fan_active" },
        warning: { entity_id: "binary_sensor.fan_warning" } },
    ] } },
    dynamic_buttons: {},
  };
  const edits = [];
  const catalog = createDashboardCatalog({
    moduleRegistry: {
      get: (id) => id === "widget.house-quick" ? { manifest: { type: "widget" } } : null,
    },
  });
  const view = createDashboardCatalogView({
    document, catalog, getConfig: () => data,
    onSelect: () => { throw Error("Unexpected new widget"); },
    onEdit: (...args) => { edits.push(args); return true; },
  });
  view.edit("house-tile", {
    module_id: "widget.house-quick",
    config: { buttons: [{ id: "devices", type: "devices" }] },
  });
  const select = view.root.querySelector('[data-jui-catalog-field="deviceId"]');
  assert.equal(select.value, "", "No implicit first-device selection");
  assert.equal(view.root.querySelector('[data-jui-catalog-field="deviceName"]').value ?? "", "");
  select.value = "device-b";
  select.dispatchEvent(new Event("change"));
  assert.equal(view.root.querySelector('[data-jui-catalog-field="deviceName"]').value, "Lüftung");
  assert.equal(view.root.querySelector('[data-jui-catalog-field="warningEntity"]').value,
    "binary_sensor.fan_warning");
  view.root.querySelector('[data-jui-catalog-field="deviceName"]').value = "Lüftungsanlage";
  view.root.querySelector('[data-jui-catalog-confirm]').dispatchEvent("click");
  assert.equal(view.root.hidden, true);
  assert.equal(edits.length, 1);
  const sources = edits[0][2].dataSources["provider.house-devices"].devices;
  assert.equal(sources[0].name, "Pumpe");
  assert.equal(sources[1].id, "device-b");
  assert.equal(sources[1].name, "Lüftungsanlage");
});


test("weather editor clears persisted optional sensor bindings through the visible catalog", () => {
  const document = createFakeDocument();
  const current = {
    data_sources: { "provider.weather": {
      entity_id: "weather.home", moon_entity_id: "sensor.old_moon",
    } }, dynamic_buttons: {},
  };
  const plans = [];
  const view = createDashboardCatalogView({
    document,
    catalog: createDashboardCatalog({ moduleRegistry: {
      get: (id) => id === "widget.weather-today" ? { manifest: { type: "widget" } } : null,
    } }),
    getConfig: () => current,
    onSelect() { throw Error("Should edit existing instance"); },
    onEdit: (...args) => { plans.push(args[2]); return true; },
  });
  view.edit("weather-1", { module_id: "widget.weather-today", config: {} });
  const field = view.root.querySelector('[data-jui-catalog-field="moonEntityId"]');
  assert.equal(field.value, "sensor.old_moon");
  field.value = "";
  view.root.querySelector("[data-jui-catalog-confirm]").dispatchEvent("click");
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].dataSources["provider.weather"], { entity_id: "weather.home" });
});

test("energy editor offers and pre-fills power attributes and can remove the attribute", () => {
  const document = createFakeDocument();
  const current = {
    data_sources: { "provider.house-energy": { sources: [{
      id: "source-1", name: "Haus",
      power: { entity_id: "sensor.inverter", attribute: "active_power" },
    }] } },
    widget_instances: { energy: {
      module_id: "widget.house-quick",
      config: { buttons: [{ id: "energy", type: "energy", source_id: "source-1",
        average_window_minutes: 15, warning_threshold_w: 3000, critical_threshold_w: 5000 }] },
    } }, dynamic_buttons: {},
  };
  const plans = [];
  const view = createDashboardCatalogView({
    document,
    catalog: createDashboardCatalog({ moduleRegistry: {
      get: (id) => id === "widget.house-quick" ? { manifest: { type: "widget" } } : null,
    } }),
    getConfig: () => current,
    onSelect() { throw Error("Should edit existing instance"); },
    onEdit: (...args) => { plans.push(args[2]); return true; },
  });
  view.edit("energy", current.widget_instances.energy);
  const field = view.root.querySelector('[data-jui-catalog-field="powerAttribute"]');
  assert.equal(field.value, "active_power");
  field.value = "";
  view.root.querySelector("[data-jui-catalog-confirm]").dispatchEvent("click");
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].dataSources["provider.house-energy"].sources[0].power,
    { entity_id: "sensor.inverter" });
});


test("catalog edits a single button occurrence size without changing its shared definition", () => {
  const document = createFakeDocument();
  const current = { data_sources: {}, dynamic_buttons: {
    existing: { name: "Taster", mode: "trigger", action: { type: "navigate", route: "home" } },
  } };
  const plans = [];
  const view = createDashboardCatalogView({
    document,
    catalog: createDashboardCatalog({ moduleRegistry: {
      get: (id) => id === "widget.dynamic-buttons" ? { manifest: { type: "widget" } } : null,
    } }),
    getConfig: () => current,
    onSelect() { throw Error("Expected edit"); },
    onEdit: (...args) => { plans.push(args[2]); return true; },
  });
  view.edit("button-tile", { module_id: "widget.dynamic-buttons",
    config: { buttons: [{ id: "use-1", button_id: "existing", size: "compact" }] } });
  const field = view.root.querySelector('[data-jui-catalog-field="buttonSize"]');
  assert.equal(field.value, "compact");
  field.value = "wide";
  view.root.querySelector("[data-jui-catalog-confirm]").dispatchEvent("click");
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].config.buttons,
    [{ id: "use-1", button_id: "existing", size: "wide" }]);
  assert.deepEqual(plans[0].dynamicButtons, {});
});
