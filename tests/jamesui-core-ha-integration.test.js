import test from "node:test";
import assert from "node:assert/strict";

import { createJamesUICore } from "../custom_components/jamesui/frontend/core/index.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

function manifest(id, type, version = "1.0.0") {
  return {
    id,
    type,
    version,
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: [],
    config_schema: `${id}.schema.json`,
  };
}

function dataModuleUrl(source) {
  return `data:text/javascript,${encodeURIComponent(source)}%0A//`;
}

test("Core exposes a read-only Home Assistant adapter and hass setter feeds it", () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  const adapter = core.homeAssistant;
  assert.ok(adapter);
  assert.throws(() => { core.homeAssistant = null; }, TypeError);

  const entity = { entity_id: "light.kitchen", state: "on", attributes: {} };
  core.hass = { connected: true, connection: {}, states: { "light.kitchen": entity } };
  assert.equal(core.homeAssistant.connectionState(), "connected");
  assert.equal(core.homeAssistant.getState("light.kitchen"), entity);
  assert.equal(core.getHostContext().hass.states["light.kitchen"], entity);
});

test("Core registers the three HA actions against the adapter", async () => {
  const calls = [];
  const core = createJamesUICore({ document: createFakeDocument() });
  core.hass = {
    connected: true,
    states: {},
    connection: {},
    callService: async (...args) => { calls.push(args); },
  };

  assert.equal((await core.actions.execute({ type: "entity.toggle", entity_id: "light.kitchen" })).status, "success");
  assert.equal((await core.actions.execute({ type: "ha.service", domain: "light", service: "turn_on" })).status, "success");
  assert.equal((await core.actions.execute({ type: "scene.activate", entity_id: "scene.evening" })).status, "success");
  assert.deepEqual(calls, [
    ["homeassistant", "toggle", {}, { entity_id: "light.kitchen" }],
    ["light", "turn_on", {}, undefined],
    ["scene", "turn_on", {}, { entity_id: "scene.evening" }],
  ]);
});

test("provider and action modules receive adapter while layout and widget remain HA-free", async () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  core.hass = { connected: true, states: {}, connection: {}, callService: async () => {} };
  const source = `
    export function create(context) {
      return {
        mount(target) {
          target.keys = Object.keys(context).sort();
          target.hasHomeAssistant = "homeAssistant" in context;
          target.hasHass = "hass" in context;
          target.hasRouter = "router" in context;
          target.module = context.module;
        },
        update() {},
        destroy() {}
      };
    }
  `;

  for (const type of ["provider", "action", "layout", "widget"]) {
    const id = `${type}.context`;
    core.moduleRegistry.register(manifest(id, type), { entryUrl: dataModuleUrl(source) });
    assert.equal(await core.moduleLoader.load(id), true);
    const target = {};
    assert.equal(core.moduleLoader.mount(id, target), true);
    const expected = type === "provider" || type === "action"
      ? ["actions", "capabilities", "events", "homeAssistant", "module", "overlays"]
      : ["actions", "capabilities", "events", "module", "overlays"];
    assert.deepEqual(target.keys, expected);
    assert.equal(target.hasHomeAssistant, type === "provider" || type === "action");
    assert.equal(target.hasHass, false);
    assert.equal(target.hasRouter, false);
    assert.deepEqual(target.module, { id, type, version: "1.0.0" });
  }
});

test("loaded provider cleanup runs before Home Assistant adapter teardown", async () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  core.hass = { connected: true, states: {}, connection: {}, callService: async () => {} };
  const source = `
    export function create(context) {
      let target;
      let stop;
      return {
        mount(nextTarget) {
          target = nextTarget;
          stop = context.homeAssistant.subscribeConnection(() => {}, { emitCurrent: false });
        },
        update() {},
        destroy() { target.stopResult = stop(); }
      };
    }
  `;
  core.moduleRegistry.register(manifest("provider.cleanup", "provider"), { entryUrl: dataModuleUrl(source) });
  assert.equal(await core.moduleLoader.load("provider.cleanup"), true);
  const target = {};
  core.moduleLoader.mount("provider.cleanup", target);

  core.destroy();
  core.destroy();
  assert.equal(target.stopResult, true);
  assert.equal(core.homeAssistant.connectionState(), "unavailable");
  for (const type of ["entity.toggle", "ha.service", "scene.activate", "navigate", "url.open"]) {
    assert.equal((await core.actions.execute({ type })).status, "unavailable");
  }
});
