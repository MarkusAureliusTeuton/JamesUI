import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { MANIFEST as HEATING_MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.house-heating/manifest.js";
import { MANIFEST as LIGHTING_MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.house-lighting/manifest.js";
import { MANIFEST as DEVICES_MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.house-devices/manifest.js";
import { MANIFEST as ENERGY_MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.house-energy/manifest.js";
import { MANIFEST as HOUSE_QUICK_MANIFEST } from "../custom_components/jamesui/frontend/modules/widget.house-quick/manifest.js";
import { createHouseQuickWidget } from "../custom_components/jamesui/frontend/modules/widget.house-quick/widget.js";

const entries = new Map([
  [HEATING_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/provider.house-heating/index.js", import.meta.url).href],
  [LIGHTING_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/provider.house-lighting/index.js", import.meta.url).href],
  [DEVICES_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/provider.house-devices/index.js", import.meta.url).href],
  [ENERGY_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/provider.house-energy/index.js", import.meta.url).href],
  [HOUSE_QUICK_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/widget.house-quick/index.js", import.meta.url).href],
]);

const flush = () => new Promise((resolve) => setImmediate(resolve));

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    for (const child of children) this.appendChild(child);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
}

class FakeDocument {
  createElement(tagName) { return new FakeElement(tagName, this); }
  createElementNS(_namespace, tagName) { return new FakeElement(tagName, this); }
}

function host() {
  const document = new FakeDocument();
  return new FakeElement("host", document);
}

function find(root, attribute, value) {
  if (root.getAttribute?.(attribute) === value) return root;
  for (const child of root.children ?? []) {
    const found = find(child, attribute, value);
    if (found) return found;
  }
  return null;
}

function entity(entity_id, state, attributes = {}) {
  return { entity_id, state: String(state), attributes };
}

function fakeHomeAssistant() {
  const states = new Map(Object.entries({
    "sensor.living_current": entity("sensor.living_current", 21.4),
    "sensor.living_target": entity("sensor.living_target", 22),
    "binary_sensor.living_demand": entity("binary_sensor.living_demand", "off"),
    "binary_sensor.living_auto": entity("binary_sensor.living_auto", "on"),
    "light.ceiling": entity("light.ceiling", "on"),
    "light.ambient": entity("light.ambient", "off"),
    "sensor.washer_status": entity("sensor.washer_status", "ready"),
    "binary_sensor.washer_active": entity("binary_sensor.washer_active", "on"),
    "sensor.house_power": entity("sensor.house_power", 1800, { unit_of_measurement: "W" }),
  }));
  const entityListeners = new Map();
  const connectionListeners = new Set();

  return {
    connectionState: () => "connected",
    getState: (id) => states.get(id) ?? null,
    subscribeEntity(id, listener, { emitCurrent = true } = {}) {
      if (!entityListeners.has(id)) entityListeners.set(id, new Set());
      entityListeners.get(id).add(listener);
      if (emitCurrent) listener(states.get(id) ?? null);
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        entityListeners.get(id)?.delete(listener);
        if (entityListeners.get(id)?.size === 0) entityListeners.delete(id);
        return true;
      };
    },
    subscribeConnection(listener, { emitCurrent = true } = {}) {
      connectionListeners.add(listener);
      if (emitCurrent) listener("connected");
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        connectionListeners.delete(listener);
        return true;
      };
    },
    async callWS(message) {
      const start = Date.parse(message.start_time) / 1000;
      return { [message.entity_ids[0]]: [{ s: "1800", lu: start }] };
    },
    activeEntitySubscriptions() {
      return [...entityListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
    },
  };
}

const heatingConfig = {
  zones: [{
    id: "living",
    name: "Wohnen",
    current_temperature: { entity_id: "sensor.living_current" },
    target_temperature: { entity_id: "sensor.living_target" },
    heating_demand: { entity_id: "binary_sensor.living_demand" },
    auto_regulation_enabled: { entity_id: "binary_sensor.living_auto" },
  }],
};

const lightingConfig = {
  lights: [{ id: "ceiling", name: "Decke", state: { entity_id: "light.ceiling" } }],
  ambient_lights: [{ id: "ambient", name: "Ambient", state: { entity_id: "light.ambient" } }],
};

const devicesConfig = {
  devices: [{
    id: "washer",
    name: "Waschmaschine",
    primary_entity_id: "sensor.washer_status",
    active: { entity_id: "binary_sensor.washer_active" },
  }],
};

const energyConfig = {
  sources: [{ id: "house", name: "Haus gesamt", power: { entity_id: "sensor.house_power" } }],
};

const widgetConfig = {
  buttons: [
    { id: "living", type: "heating_zone", source_id: "living" },
    { id: "lights", type: "lights" },
    { id: "devices", type: "devices" },
    {
      id: "energy",
      type: "energy",
      source_id: "house",
      average_window_minutes: 15,
      warning_threshold_w: 3000,
      critical_threshold_w: 5000,
    },
  ],
};

test("Block 12 modules integrate through the real module and capability registries without generic instance orchestration", async () => {
  const registry = createModuleRegistry();
  for (const manifest of [HEATING_MANIFEST, LIGHTING_MANIFEST, DEVICES_MANIFEST, ENERGY_MANIFEST, HOUSE_QUICK_MANIFEST]) {
    registry.register(manifest, { entryUrl: entries.get(manifest.id) });
  }

  assert.equal(registry.getCapabilityProvider("house.heatingZones"), HEATING_MANIFEST.id);
  assert.equal(registry.getCapabilityProvider("house.lights"), LIGHTING_MANIFEST.id);
  assert.equal(registry.getCapabilityProvider("house.ambientLights"), LIGHTING_MANIFEST.id);
  assert.equal(registry.getCapabilityProvider("house.devices"), DEVICES_MANIFEST.id);
  assert.equal(registry.getCapabilityProvider("house.energy"), ENERGY_MANIFEST.id);

  const health = createHealthService();
  const capabilities = createCapabilityRegistry({ moduleRegistry: registry });
  const homeAssistant = fakeHomeAssistant();
  const actionCalls = [];
  const actions = {
    execute(action) {
      actionCalls.push(action);
      return { status: "success" };
    },
  };

  const loader = createModuleLoader({
    registry,
    health,
    getContext: ({ id, manifest }) => {
      const common = {
        events: {},
        overlays: {},
        capabilities,
        actions,
        module: Object.freeze({ id, type: manifest.type, version: manifest.version }),
      };
      return Object.freeze(manifest.type === "provider" ? { ...common, homeAssistant } : common);
    },
  });

  for (const [manifest, config] of [
    [HEATING_MANIFEST, heatingConfig],
    [LIGHTING_MANIFEST, lightingConfig],
    [DEVICES_MANIFEST, devicesConfig],
    [ENERGY_MANIFEST, energyConfig],
  ]) {
    assert.equal(await loader.load(manifest.id, { config }), true, `load ${manifest.id}`);
    assert.equal(loader.mount(manifest.id, { kind: "provider" }), true, `mount ${manifest.id}`);
  }

  assert.equal(capabilities.get("house.heatingZones").status, "available");
  assert.equal(capabilities.get("house.lights").value.on_count, 1);
  assert.equal(capabilities.get("house.devices").value.active_count, 1);
  assert.equal(capabilities.get("house.energy").status, "available");

  const target = host();
  assert.equal(await loader.load(HOUSE_QUICK_MANIFEST.id, { config: widgetConfig }), true);
  assert.equal(loader.mount(HOUSE_QUICK_MANIFEST.id, target), true);
  await flush();
  assert.ok(find(target, "data-jui-widget", "house-quick"));
  assert.ok(find(target, "data-jui-house-quick-id", "living"));
  assert.ok(find(target, "data-jui-house-quick-id", "energy"));

  const directContext = Object.freeze({
    events: {},
    overlays: {},
    capabilities,
    actions,
    module: Object.freeze({ id: HOUSE_QUICK_MANIFEST.id, type: "widget", version: "1.0.0" }),
  });
  const directA = createHouseQuickWidget(directContext, { buttons: [{ id: "a", type: "lights" }] });
  const directB = createHouseQuickWidget(directContext, { buttons: [{ id: "b", type: "devices" }] });
  const hostA = host();
  const hostB = host();
  assert.equal(directA.mount(hostA), true);
  assert.equal(directB.mount(hostB), true);
  assert.ok(find(hostA, "data-jui-house-quick-id", "a"));
  assert.ok(find(hostB, "data-jui-house-quick-id", "b"));
  directA.destroy();
  directB.destroy();

  assert.equal(loader.destroy(HOUSE_QUICK_MANIFEST.id), true);
  for (const manifest of [ENERGY_MANIFEST, DEVICES_MANIFEST, LIGHTING_MANIFEST, HEATING_MANIFEST]) {
    assert.equal(loader.destroy(manifest.id), true);
  }

  assert.equal(capabilities.get("house.heatingZones").provider, null);
  assert.equal(capabilities.get("house.lights").provider, null);
  assert.equal(capabilities.get("house.devices").provider, null);
  assert.equal(capabilities.get("house.energy").provider, null);
  assert.equal(homeAssistant.activeEntitySubscriptions(), 0);
  assert.equal(find(target, "data-jui-widget", "house-quick"), null);
  capabilities.destroy();
});
