import test from "node:test";
import assert from "node:assert/strict";
import { createJamesUI1Preview } from "../custom_components/jamesui/frontend/jamesui-1-preview.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("Block 14 preview registers widgets and matching providers but never mounts r11", () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const ids = preview.core.moduleRegistry.list().map((item) => item.manifest.id);
  assert.deepEqual(ids, [
    "widget.weather-today", "widget.calendar-agenda",
    "widget.house-quick", "widget.dynamic-buttons",
    "provider.weather", "provider.calendar", "provider.tasks",
    "provider.house-heating", "provider.house-lighting",
    "provider.house-devices", "provider.house-energy", "provider.control-state",
  ]);
  assert.equal(preview.core.config.snapshot(), null);
  preview.destroy();
});

test("Block 14 opt-in preview refuses empty schema without substituting fake data", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  // No Home Assistant transport or dashboard config supplied.
  // The preview should reject, not fall back to legacy markup.
  await assert.rejects(() => preview.mount(document.createElement("main")));
  preview.destroy();
});

test("Block 14 preview loads a configured weather provider without fabricated entity bindings", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const config = {
    schema_version: 1,
    pages: { home: { kind: "dashboard", layout_id: "main", elements: [] } },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: {}, dynamic_buttons: {},
    data_sources: { "provider.weather": { config: {} } }, module_settings: {},
  };
  preview.core.hass = {
    connected: true, states: {},
    callWS: async ({ type }) => {
      assert.equal(type, "jamesui/config/get");
      return { config };
    },
  };
  try {
    assert.equal(await preview.mount(document.createElement("div")), true);
    assert.equal(preview.core.moduleLoader.isLoaded("provider.weather"), true);
    assert.equal(preview.core.moduleLoader.isLoaded("provider.calendar"), false);
  } finally {
    preview.destroy();
  }
});

test("preview renders the four Start widgets from persisted instances", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const modules = [
    "widget.calendar-agenda", "widget.house-quick", "widget.dynamic-buttons",
  ];
  const elements = modules.map((moduleId, index) => ({
    id: "start-" + index, kind: "widget", ref_id: "instance-" + index,
    column: index * 4, row: 0, column_span: 4, row_span: 3,
  }));
  const config = {
    schema_version: 1,
    pages: {
      home: { kind: "dashboard", layout_id: "main", hero_widget_id: "weather", elements },
    },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: {
      weather: { module_id: "widget.weather-today", config: {} },
      ...Object.fromEntries(modules.map((moduleId, index) =>
        ["instance-" + index, { module_id: moduleId, config: {} }])),
    },
    dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  preview.core.hass = {
    connected: true, states: {},
    callWS: async () => ({ config }),
  };
  const target = document.createElement("div");
  try {
    assert.equal(await preview.mount(target), true);
    assert.ok(target.querySelector('[data-jui-layout="home-hero-deck"]'));
    assert.ok(target.querySelector('[data-role="bottom-navigation"]'));
    assert.equal(target.querySelectorAll("[data-jui-dashboard-item]").length, 3);
    assert.equal(preview.core.moduleLoader.isLoaded("dashboard:home:hero"), true);
  } finally {
    preview.destroy();
  }
});
