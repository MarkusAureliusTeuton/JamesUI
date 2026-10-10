import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardPageComposer } from "../custom_components/jamesui/frontend/core/dashboard-page-composer.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

function config(kind = "hero-deck") {
  return {
    schema_version: 1,
    pages: { start: { kind: "dashboard", layout_id: "main",
      ...(kind === "hero-deck" ? { hero_widget_id: "weather" } : {}),
      elements: [
        { id: "agenda", kind: "widget", ref_id: "agenda", column: 0, row: 0, column_span: 6, row_span: 5 },
        { id: "house", kind: "widget", ref_id: "house", column: 6, row: 0, column_span: 6, row_span: 3 },
      ],
    } },
    layouts: { main: { kind, scroll: "fixed", ...(kind === "hero-deck" ? { hero_ratio: 0.42 } : {}) } },
    widget_instances: {
      weather: { module_id: "widget.weather-today", config: {} },
      agenda: { module_id: "widget.calendar-agenda", config: {} },
      house: { module_id: "widget.house-quick", config: {} },
    },
    dynamic_buttons: {}, data_sources: {}, module_settings: {},
  };
}

test("Block 14 composes real hero and distinct grid-widget lifecycles", async () => {
  const document = createFakeDocument();
  const target = document.createElement("main");
  const calls = [];
  const loader = {
    async load(id, settings) { calls.push(["load", id, settings.instanceId]); return true; },
    mount(id) { calls.push(["mount", id]); return true; },
    destroy(id) { calls.push(["destroy", id]); return true; },
  };
  const page = createDashboardPageComposer({ document, moduleLoader: loader, getConfig: () => config() });
  await page.mount(target, "start");
  await Promise.resolve();
  assert.ok(target.querySelector('[data-jui-layout="home-hero-deck"]'));
  assert.ok(target.querySelector('[data-jui-dashboard-item="agenda"]'));
  assert.ok(target.querySelector('[data-jui-dashboard-item="house"]'));
  assert.ok(calls.some((entry) => entry[0] === "mount" && entry[1] === "dashboard:start:hero"));
  assert.ok(calls.some((entry) => entry[0] === "load" && entry[1] === "widget.calendar-agenda"));
  assert.ok(calls.some((entry) => entry[0] === "load" && entry[1] === "widget.house-quick"));
  page.destroy();
  assert.ok(calls.some((entry) => entry[0] === "destroy" && entry[1] === "dashboard:start:hero"));
});

test("Block 14 fullscreen uses entire content region and no hero", async () => {
  const document = createFakeDocument();
  const target = document.createElement("main");
  const calls = [];
  const loader = {
    async load(id, settings) { calls.push(["load", id, settings.instanceId]); return true; },
    mount() { return true; },
    destroy() { return true; },
  };
  const page = createDashboardPageComposer({
    document, moduleLoader: loader, getConfig: () => config("fullscreen"),
  });
  await page.mount(target, "start");
  assert.ok(target.querySelector('[data-jui-layout="fullscreen"]'));
  assert.ok(target.querySelector('[data-jui-dashboard-item="agenda"]'));
  assert.equal(calls.some((entry) => entry[1] === "widget.weather-today"), false);
  page.destroy();
  assert.equal(target.querySelector('[data-jui-layout="fullscreen"]'), null);
});

test("dashboard startup remains pending until every widget finishes loading", async () => {
  const document = createFakeDocument();
  const target = document.createElement("main");
  const pending = [];
  const loader = {
    load(moduleId, { instanceId }) {
      if (instanceId.endsWith(":hero")) return Promise.resolve(true);
      return new Promise((resolve) => pending.push({ moduleId, resolve }));
    },
    mount() { return true; },
    destroy() { return true; },
  };
  const page = createDashboardPageComposer({ document, moduleLoader: loader, getConfig: () => config() });
  const started = page.mount(target, "start");
  let settled = false;
  void started.then(() => { settled = true; }, () => { settled = true; });
  // The hero imports first; the two dashboard widgets load in parallel.
  for (let i = 0; i < 5 && pending.length < 2; i++) await Promise.resolve();
  assert.equal(pending.length, 2);
  await Promise.resolve();
  assert.equal(settled, false);
  pending[0].resolve(true);
  await Promise.resolve();
  assert.equal(settled, false);
  pending[1].resolve(true);
  assert.equal(await started, true);
  page.destroy();
});

test("dashboard reports failure when a configured widget cannot load", async () => {
  const document = createFakeDocument();
  const target = document.createElement("main");
  const destroyed = [];
  const loader = {
    async load(_moduleId, { instanceId }) { return instanceId !== "dashboard:agenda"; },
    mount() { return true; },
    destroy(id) { destroyed.push(id); return true; },
  };
  const page = createDashboardPageComposer({ document, moduleLoader: loader, getConfig: () => config() });
  try {
    await assert.rejects(() => page.mount(target, "start"), /Failed to mount one or more dashboard widgets/);
    assert.ok(target.querySelector('[data-jui-dashboard-item="agenda"]'));
    assert.equal(target.querySelector('[data-jui-dashboard-item="agenda"]').getAttribute("data-jui-widget-error"), "");
  } finally {
    page.destroy();
  }
  assert.ok(destroyed.includes("dashboard:house"));
  assert.ok(destroyed.includes("dashboard:start:hero"));
});
