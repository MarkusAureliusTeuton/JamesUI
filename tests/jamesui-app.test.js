import test from "node:test";
import assert from "node:assert/strict";
import { createJamesUIApp } from "../custom_components/jamesui/frontend/jamesui-app.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("Block 14 app registers widgets and matching providers but never mounts r11", () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
  const ids = app.core.moduleRegistry.list().map((item) => item.manifest.id);
  assert.deepEqual(ids, [
    "widget.weather-today", "widget.calendar-agenda",
    "widget.house-quick", "widget.dynamic-buttons",
    "provider.weather", "provider.calendar", "provider.tasks",
    "provider.house-heating", "provider.house-lighting",
    "provider.house-devices", "provider.house-energy", "provider.control-state",
    "action.task-update",
  ]);
  assert.equal(app.core.config.snapshot(), null);
  app.destroy();
});

test("Block 14 opt-in app refuses empty schema without substituting fake data", async () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
  // No Home Assistant transport or dashboard config supplied.
  // The app should reject, not fall back to legacy markup.
  await assert.rejects(() => app.mount(document.createElement("main")));
  app.destroy();
});

test("Block 14 app loads a configured weather provider without fabricated entity bindings", async () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
  const config = {
    schema_version: 1,
    pages: { home: { kind: "dashboard", layout_id: "main", elements: [] } },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: {}, dynamic_buttons: {},
    data_sources: { "provider.weather": { config: {} } }, module_settings: {},
  };
  app.core.hass = {
    connected: true, states: {},
    callWS: async ({ type }) => {
      assert.equal(type, "jamesui/config/get");
      return { config };
    },
  };
  try {
    assert.equal(await app.mount(document.createElement("div")), true);
    assert.equal(app.core.moduleLoader.isLoaded("provider.weather"), true);
    assert.equal(app.core.moduleLoader.isLoaded("provider.calendar"), false);
  } finally {
    app.destroy();
  }
});

test("app renders the four Start widgets from persisted instances", async () => {
  const document = createFakeDocument();
  // Agenda measures its row probe during mount. Supply geometry in this
  // non-browser integration fixture; visual accuracy needs browser E2E tests.
  const createElement = document.createElement;
  document.createElement = (tag) => {
    const element = createElement(tag);
    element.getBoundingClientRect = () => ({ width: 120, height: 36, top: 0, left: 0, right: 120, bottom: 36 });
    return element;
  };
  const app = createJamesUIApp({ document });
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
  app.core.hass = {
    connected: true, states: {},
    callWS: async () => ({ config }),
  };
  const target = document.createElement("div");
  const moduleFailures = [];
  const unsubscribeHealth = app.core.health.subscribe(({ record }) => {
    if (record?.status === "error") moduleFailures.push({ id: record.id, message: record.error?.message });
  });
  try {
    try {
      assert.equal(await app.mount(target), true);
    } catch (error) {
      const health = app.core.health.list().map((record) => ({
        id: record.id, message: record.message,
        error: record.error?.message ?? null,
      }));
      assert.fail("Four-widget startup failed: " + error.message + " / " + JSON.stringify({ health, moduleFailures }));
    }
    assert.ok(target.querySelector('[data-jui-layout="home-hero-deck"]'));
    assert.ok(target.querySelector('[data-role="bottom-navigation"]'));
    assert.equal(target.querySelectorAll("[data-jui-dashboard-item]").length, 3);
    assert.equal(app.core.moduleLoader.isLoaded("dashboard:home:hero"), true);
    for (const element of elements) {
      assert.equal(app.core.moduleLoader.isLoaded("dashboard:" + element.id), true);
      assert.equal(target.querySelector('[data-jui-dashboard-item="' + element.id + '"]').getAttribute("data-jui-widget-error"), null);
    }
  } finally {
    unsubscribeHealth();
    app.destroy();
  }
});

test("configured invalid hero fails visibly instead of presenting a false successful dashboard", async () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
  const config = {
    schema_version: 1,
    pages: { home: { kind: "dashboard", layout_id: "main", hero_widget_id: "invalid", elements: [] } },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: { invalid: { module_id: "widget.not-registered", config: {} } },
    dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  app.core.hass = { connected: true, states: {}, callWS: async () => ({ config }) };
  try {
    await assert.rejects(
      () => app.mount(document.createElement("div")),
      /Failed to mount dashboard hero widget/,
    );
    assert.equal(app.core.moduleLoader.isLoaded("dashboard:home:hero"), false);
  } finally {
    app.destroy();
  }
});

test("failed provider startup leaves no provider runtimes behind", async () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
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
  app.core.hass = { connected: true, states: {}, callWS: async () => ({ config }) };
  try {
    await assert.rejects(
      () => app.mount(document.createElement("div")),
      /Unable to load configured provider: provider.house-lighting/,
    );
    assert.equal(app.core.moduleLoader.isLoaded("provider.weather"), false);
    assert.equal(app.core.moduleLoader.isLoaded("provider.house-lighting"), false);
  } finally {
    app.destroy();
  }
});

test("app reuses canonical weather entity mapping migrated from r11", async () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
  const config = {
    schema_version: 1,
    pages: { home: { kind: "dashboard", layout_id: "main", elements: [] } },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: {}, dynamic_buttons: {},
    data_sources: { weather: { entity_id: "weather.home" } }, module_settings: {},
  };
  app.core.hass = {
    connected: true, states: { "weather.home": { state: "sunny", attributes: {} } },
    callWS: async () => ({ config }),
  };
  try {
    assert.equal(await app.mount(document.createElement("div")), true);
    assert.equal(app.core.moduleLoader.isLoaded("provider.weather"), true);
  } finally {
    app.destroy();
  }
});

test("app initializes a missing home dashboard without losing migrated settings", async () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
  const config = {
    schema_version: 1, pages: {}, layouts: {}, widget_instances: {}, dynamic_buttons: {},
    data_sources: { weather: { entity_id: "weather.home" } },
    module_settings: { start: { background: "existing" } },
  };
  const writes = [];
  app.core.hass = {
    connected: true, states: { "weather.home": { state: "sunny", attributes: {} } },
    callWS: async ({ type, config: next }) => {
      if (type === "jamesui/config/get") return { config };
      assert.equal(type, "jamesui/config/replace");
      writes.push(next);
      return { config: next };
    },
  };
  try {
    assert.equal(await app.mount(document.createElement("div")), true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].pages.home.kind, "dashboard");
    assert.equal(writes[0].layouts["jamesui-next-home"].kind, "hero-deck");
    assert.deepEqual(writes[0].data_sources, config.data_sources);
    assert.deepEqual(writes[0].module_settings, config.module_settings);
    assert.equal(app.core.moduleLoader.isLoaded("provider.weather"), true);
  } finally {
    app.destroy();
  }
});

test("app never overwrites an existing incompatible home page", async () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
  const config = {
    schema_version: 1, pages: { home: { kind: "legacy" } }, layouts: {},
    widget_instances: {}, dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  app.core.hass = { connected: true, states: {}, callWS: async ({ type }) => {
    assert.equal(type, "jamesui/config/get");
    return { config };
  } };
  try {
    await assert.rejects(() => app.mount(document.createElement("div")), /not a dashboard/);
  } finally { app.destroy(); }
});

test("disconnect during pending config load cannot mount a detached app", async () => {
  const document = createFakeDocument();
  const app = createJamesUIApp({ document });
  let resolveLoad;
  const pendingLoad = new Promise((resolve) => { resolveLoad = resolve; });
  const config = {
    schema_version: 1, pages: {}, layouts: {}, widget_instances: {},
    dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  app.core.hass = {
    connected: true, states: {},
    callWS: async () => pendingLoad,
  };
  const target = document.createElement("div");
  const mounting = app.mount(target);
  app.destroy();
  resolveLoad({ config });
  await assert.rejects(mounting, /destroyed/i);
  assert.equal(target.querySelector('[data-jui-layout="home-hero-deck"]'), null);
});

test("saved provider sources activate and update without reopening Next", async () => {
  const document = createFakeDocument();
  let remote = {
    schema_version: 1,
    pages: { home: { kind: "dashboard", layout_id: "main", elements: [] } },
    layouts: { main: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: {}, dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
  const app = createJamesUIApp({ document });
  app.core.hass = {
    connected: true,
    config: { time_zone: "Europe/Berlin" },
    states: {},
    callWS: async (request) => {
      if (request.type === "jamesui/config/get") return { config: remote };
      if (request.type === "jamesui/config/replace") {
        remote = structuredClone(request.config);
        return { config: remote };
      }
      throw new Error("Unexpected HA request");
    },
  };
  const waitFor = async (predicate) => {
    for (let i = 0; i < 150; i++) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 3));
    }
    assert.fail("Timed out waiting for provider synchronization");
  };
  try {
    assert.equal(await app.mount(document.createElement("div")), true);
    assert.equal(app.core.moduleLoader.isLoaded("provider.calendar"), false);
    assert.equal(app.core.moduleLoader.isLoaded("provider.tasks"), false);

    const added = app.core.config.snapshot();
    added.data_sources["provider.calendar"] = { source_entity_ids: ["calendar.family"] };
    added.data_sources["provider.tasks"] = { source_entity_ids: ["todo.family"] };
    await app.core.config.replace(added);
    await waitFor(() => app.core.moduleLoader.isLoaded("provider.calendar") &&
      app.core.moduleLoader.isLoaded("provider.tasks"));
    assert.equal(app.core.capabilities.get("calendar.events")?.status, "available");
    assert.equal(app.core.capabilities.get("tasks.items")?.status, "available");

    const updated = app.core.config.snapshot();
    updated.data_sources["provider.calendar"].source_entity_ids.push("calendar.work");
    await app.core.config.replace(updated);
    await waitFor(() => app.core.capabilities.get("calendar.events")?.value
      ?.configured_sources?.length === 2);

    const removed = app.core.config.snapshot();
    delete removed.data_sources["provider.calendar"];
    await app.core.config.replace(removed);
    await waitFor(() => !app.core.moduleLoader.isLoaded("provider.calendar"));
    assert.equal(app.core.moduleLoader.isLoaded("provider.tasks"), true);
  } finally {
    app.destroy();
  }
});
