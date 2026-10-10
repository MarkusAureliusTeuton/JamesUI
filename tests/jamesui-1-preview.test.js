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
      "instance-0": { module_id: "widget.calendar-agenda", config: {
        instance_id: "agenda-fixture", calendar_enabled: true, tasks_enabled: false,
        calendars: [{ entity_id: "calendar.fixture" }],
      } },
      "instance-1": { module_id: "widget.house-quick", config: { buttons: [] } },
      "instance-2": { module_id: "widget.dynamic-buttons", config: { buttons: [] } },
    },
    dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  preview.core.hass = {
    connected: true, states: {},
    callWS: async () => ({ config }),
  };
  const target = document.createElement("div");
  const moduleFailures = [];
  const unsubscribeHealth = preview.core.health.subscribe(({ record }) => {
    if (record?.status === "error") moduleFailures.push({ id: record.id, message: record.error?.message });
  });
  try {
    try {
      assert.equal(await preview.mount(target), true);
    } catch (error) {
      const health = preview.core.health.list().map((record) => ({
        id: record.id, message: record.message,
        error: record.error?.message ?? null,
      }));
      assert.fail("Four-widget startup failed: " + error.message + " / " + JSON.stringify({ health, moduleFailures }));
    }
    assert.ok(target.querySelector('[data-jui-layout="home-hero-deck"]'));
    assert.ok(target.querySelector('[data-role="bottom-navigation"]'));
    assert.equal(target.querySelectorAll("[data-jui-dashboard-item]").length, 3);
    assert.equal(preview.core.moduleLoader.isLoaded("dashboard:home:hero"), true);
    for (const element of elements) {
      assert.equal(preview.core.moduleLoader.isLoaded("dashboard:" + element.id), true);
      assert.equal(target.querySelector('[data-jui-dashboard-item="' + element.id + '"]').getAttribute("data-jui-widget-error"), null);
    }
  } finally {
    unsubscribeHealth();
    preview.destroy();
  }
});

test("configured invalid hero fails visibly instead of presenting a false successful dashboard", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const config = {
    schema_version: 1,
    pages: { home: { kind: "dashboard", layout_id: "main", hero_widget_id: "invalid", elements: [] } },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: { invalid: { module_id: "widget.not-registered", config: {} } },
    dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  preview.core.hass = { connected: true, states: {}, callWS: async () => ({ config }) };
  try {
    await assert.rejects(
      () => preview.mount(document.createElement("div")),
      /Failed to mount dashboard hero widget/,
    );
    assert.equal(preview.core.moduleLoader.isLoaded("dashboard:home:hero"), false);
  } finally {
    preview.destroy();
  }
});

test("failed provider startup leaves no provider runtimes behind", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const config = {
    schema_version: 1,
    pages: { home: { kind: "dashboard", layout_id: "main", elements: [] } },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: {}, dynamic_buttons: {},
    data_sources: {
      "provider.weather": { config: {} },
      "provider.house-lighting": { config: {} },
    },
    module_settings: {},
  };
  preview.core.hass = { connected: true, states: {}, callWS: async () => ({ config }) };
  try {
    await assert.rejects(
      () => preview.mount(document.createElement("div")),
      /Unable to load configured provider: provider.house-lighting/,
    );
    assert.equal(preview.core.moduleLoader.isLoaded("provider.weather"), false);
    assert.equal(preview.core.moduleLoader.isLoaded("provider.house-lighting"), false);
  } finally {
    preview.destroy();
  }
});

test("preview reuses canonical weather entity mapping migrated from r11", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const config = {
    schema_version: 1,
    pages: { home: { kind: "dashboard", layout_id: "main", elements: [] } },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: {}, dynamic_buttons: {},
    data_sources: { weather: { entity_id: "weather.home" } }, module_settings: {},
  };
  preview.core.hass = {
    connected: true, states: { "weather.home": { state: "sunny", attributes: {} } },
    callWS: async () => ({ config }),
  };
  try {
    assert.equal(await preview.mount(document.createElement("div")), true);
    assert.equal(preview.core.moduleLoader.isLoaded("provider.weather"), true);
  } finally {
    preview.destroy();
  }
});

test("preview initializes a missing home dashboard without losing migrated settings", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const config = {
    schema_version: 1, pages: {}, layouts: {}, widget_instances: {}, dynamic_buttons: {},
    data_sources: { weather: { entity_id: "weather.home" } },
    module_settings: { start: { background: "existing" } },
  };
  const writes = [];
  preview.core.hass = {
    connected: true, states: { "weather.home": { state: "sunny", attributes: {} } },
    callWS: async ({ type, config: next }) => {
      if (type === "jamesui/config/get") return { config };
      assert.equal(type, "jamesui/config/replace");
      writes.push(next);
      return { config: next };
    },
  };
  try {
    assert.equal(await preview.mount(document.createElement("div")), true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].pages.home.kind, "dashboard");
    assert.equal(writes[0].layouts["jamesui-next-home"].kind, "hero-deck");
    assert.deepEqual(writes[0].data_sources, config.data_sources);
    assert.deepEqual(writes[0].module_settings, config.module_settings);
    assert.equal(preview.core.moduleLoader.isLoaded("provider.weather"), true);
  } finally {
    preview.destroy();
  }
});

test("preview never overwrites an existing incompatible home page", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const config = {
    schema_version: 1, pages: { home: { kind: "legacy" } }, layouts: {},
    widget_instances: {}, dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  preview.core.hass = { connected: true, states: {}, callWS: async ({ type }) => {
    assert.equal(type, "jamesui/config/get");
    return { config };
  } };
  try {
    await assert.rejects(() => preview.mount(document.createElement("div")), /not a dashboard/);
  } finally { preview.destroy(); }
});

test("disconnect during pending config load cannot mount a detached preview", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  let resolveLoad;
  const pendingLoad = new Promise((resolve) => { resolveLoad = resolve; });
  const config = {
    schema_version: 1, pages: {}, layouts: {}, widget_instances: {},
    dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  preview.core.hass = {
    connected: true, states: {},
    callWS: async () => pendingLoad,
  };
  const target = document.createElement("div");
  const mounting = preview.mount(target);
  preview.destroy();
  resolveLoad({ config });
  await assert.rejects(mounting, /destroyed/i);
  assert.equal(target.querySelector('[data-jui-layout="home-hero-deck"]'), null);
});
