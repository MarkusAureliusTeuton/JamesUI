import test from "node:test";
import assert from "node:assert/strict";
import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { MANIFEST as HEATING } from "../custom_components/jamesui/frontend/modules/provider.house-heating/manifest.js";
import { MANIFEST as LIGHTING } from "../custom_components/jamesui/frontend/modules/provider.house-lighting/manifest.js";
import { MANIFEST as DEVICES } from "../custom_components/jamesui/frontend/modules/provider.house-devices/manifest.js";
import { MANIFEST as ENERGY } from "../custom_components/jamesui/frontend/modules/provider.house-energy/manifest.js";
import { MANIFEST as QUICK } from "../custom_components/jamesui/frontend/modules/widget.house-quick/manifest.js";
import { createHouseQuickWidget } from "../custom_components/jamesui/frontend/modules/widget.house-quick/widget.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const manifests = [HEATING, LIGHTING, DEVICES, ENERGY, QUICK];
const entries = new Map(manifests.map((manifest) => [
  manifest.id,
  new URL(`../custom_components/jamesui/frontend/modules/${manifest.id}/index.js`, import.meta.url).href,
]));

function createFakeHomeAssistant() {
  const entityListeners = new Map();
  const connectionListeners = new Set();
  return {
    connectionState: () => "connected",
    getState: () => null,
    subscribeEntity(entityId, listener) {
      if (!entityListeners.has(entityId)) entityListeners.set(entityId, new Set());
      entityListeners.get(entityId).add(listener);
      return () => entityListeners.get(entityId)?.delete(listener);
    },
    subscribeConnection(listener) {
      connectionListeners.add(listener);
      return () => connectionListeners.delete(listener);
    },
    async callWS() { return {}; },
    activeSubscriptions() {
      return [...entityListeners.values()].reduce((count, listeners) => count + listeners.size, 0) + connectionListeners.size;
    },
  };
}

test("all Block 12 modules load through real registry/loader and clean capability ownership", async () => {
  const registry = createModuleRegistry();
  for (const manifest of manifests) registry.register(manifest, { entryUrl: entries.get(manifest.id) });
  assert.equal(registry.getCapabilityProvider("house.heatingZones"), HEATING.id);
  assert.equal(registry.getCapabilityProvider("house.lights"), LIGHTING.id);
  assert.equal(registry.getCapabilityProvider("house.ambientLights"), LIGHTING.id);
  assert.equal(registry.getCapabilityProvider("house.devices"), DEVICES.id);
  assert.equal(registry.getCapabilityProvider("house.energy"), ENERGY.id);

  const health = createHealthService();
  const capabilities = createCapabilityRegistry({ moduleRegistry: registry });
  const homeAssistant = createFakeHomeAssistant();
  const actions = { execute: async () => ({ status: "rejected" }) };
  const loader = createModuleLoader({
    registry,
    health,
    getContext: ({ id, manifest }) => Object.freeze(
      manifest.type === "provider"
        ? { capabilities, homeAssistant, module: { id, type: manifest.type, version: manifest.version } }
        : { capabilities, actions, module: { id, type: manifest.type, version: manifest.version } },
    ),
  });
  const configs = new Map([
    [HEATING.id, { zones: [] }],
    [LIGHTING.id, { lights: [], ambient_lights: [] }],
    [DEVICES.id, { devices: [] }],
    [ENERGY.id, { sources: [] }],
    [QUICK.id, { buttons: [] }],
  ]);

  for (const manifest of manifests) {
    assert.equal(await loader.load(manifest.id, { config: configs.get(manifest.id) }), true, `${manifest.id} loads`);
    const target = manifest.type === "provider" ? { kind: "provider" } : createFakeDocument().createElement("section");
    assert.equal(loader.mount(manifest.id, target), true, `${manifest.id} mounts`);
  }

  assert.equal(capabilities.get("house.heatingZones").status, "not_configured");
  assert.equal(capabilities.get("house.energy").status, "not_configured");
  for (const manifest of [...manifests].reverse()) assert.equal(loader.destroy(manifest.id), true);
  assert.equal(capabilities.get("house.heatingZones").provider, null);
  assert.equal(capabilities.get("house.energy").provider, null);
  assert.equal(homeAssistant.activeSubscriptions(), 0);
});

test("direct House Quick instances remain independent without generic orchestration", () => {
  const document = createFakeDocument();
  const firstTarget = document.createElement("section");
  const secondTarget = document.createElement("section");
  const capabilities = {
    subscribe(capability, listener) {
      listener({ capability, status: "unavailable", value: null, reason: null, provider: null });
      return () => true;
    },
  };
  const actions = { execute: async () => ({ status: "rejected" }) };
  const context = { capabilities, actions, module: { id: QUICK.id } };
  const first = createHouseQuickWidget(context, { buttons: [{ id: "l", type: "lights" }] });
  const second = createHouseQuickWidget(context, { buttons: [{ id: "d", type: "devices" }] });
  first.mount(firstTarget);
  second.mount(secondTarget);
  assert.ok(firstTarget.querySelector('[data-jui-house-quick-button-id="l"]'));
  assert.ok(secondTarget.querySelector('[data-jui-house-quick-button-id="d"]'));
  first.destroy();
  assert.ok(secondTarget.querySelector('[data-jui-house-quick-button-id="d"]'));
  second.destroy();
});
