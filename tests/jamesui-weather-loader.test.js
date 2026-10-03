import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { createHomeAssistantAdapter } from "../custom_components/jamesui/frontend/ha/home-assistant-adapter.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.weather/manifest.js";

const entryUrl = new URL(
  "../custom_components/jamesui/frontend/modules/provider.weather/index.js",
  import.meta.url,
).href;

function hass() {
  return {
    connected: true,
    config: { time_zone: "Europe/Berlin" },
    states: {
      "weather.home": {
        entity_id: "weather.home",
        state: "sunny",
        attributes: { supported_features: 0, temperature: 18, temperature_unit: "°C" },
      },
      "sun.sun": {
        entity_id: "sun.sun",
        state: "above_horizon",
        attributes: { elevation: 20, azimuth: 180 },
      },
    },
    connection: {
      async subscribeMessage() { return async () => {}; },
    },
  };
}

test("real weather provider runs through Registry and Loader without Core or production-entry changes", async () => {
  const registry = createModuleRegistry();
  const health = createHealthService();
  registry.register(MANIFEST, { entryUrl });
  const capabilities = createCapabilityRegistry({ moduleRegistry: registry });
  const homeAssistant = createHomeAssistantAdapter();
  homeAssistant.setHass(hass());
  const loader = createModuleLoader({
    registry,
    health,
    getContext: ({ id, manifest }) => Object.freeze({
      events: {}, overlays: {}, capabilities, actions: {}, homeAssistant,
      module: Object.freeze({ id, type: manifest.type, version: manifest.version }),
    }),
  });

  assert.equal(await loader.load(MANIFEST.id, { config: {} }), true);
  assert.equal(loader.mount(MANIFEST.id, null), true);
  assert.equal(capabilities.get("weather.current").status, "available");
  assert.equal(capabilities.get("weather.current").value.source_entity_id, "weather.home");
  assert.equal(capabilities.get("weather.sun").status, "available");
  assert.equal(capabilities.get("weather.moon").status, "available");
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  assert.equal(loader.update(MANIFEST.id, { entity_id: "weather.home" }), true);
  assert.equal(capabilities.get("weather.current").status, "available");
  assert.equal(await loader.reload(MANIFEST.id), true);
  assert.equal(capabilities.get("weather.current").status, "available");

  assert.equal(loader.destroy(MANIFEST.id), true);
  assert.equal(loader.isLoaded(MANIFEST.id), false);
  assert.equal(capabilities.get("weather.current").provider, null);
  homeAssistant.destroy();
  capabilities.destroy();
});
