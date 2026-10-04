import test from "node:test";
import assert from "node:assert/strict";

import { validateModuleManifest } from "../custom_components/jamesui/frontend/core/module-manifest.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.weather/manifest.js";
import { validateWeatherProviderConfig } from "../custom_components/jamesui/frontend/modules/provider.weather/config.js";

const CAPABILITIES = [
  "weather.current",
  "weather.daily",
  "weather.hourly",
  "weather.sun",
  "weather.moon",
  "weather.atmosphere",
];

test("defines the canonical immutable Block 9 provider manifest", () => {
  assert.deepEqual(MANIFEST, {
    id: "provider.weather",
    type: "provider",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: CAPABILITIES,
    config_schema: "provider.weather/v1",
  });
  assert.equal(Object.isFrozen(MANIFEST), true);
  assert.equal(Object.isFrozen(MANIFEST.provides_capabilities), true);
  assert.deepEqual(validateModuleManifest(MANIFEST), MANIFEST);
});

test("accepts only the four V1 entity source fields and freezes a copy", () => {
  const input = {
    entity_id: "weather.home",
    outdoor_temperature_entity_id: "sensor.outdoor_temperature",
    moon_entity_id: "sensor.moon_phase",
    illuminance_entity_id: "sensor.outdoor_lux",
  };
  const result = validateWeatherProviderConfig(input);
  assert.deepEqual(result, input);
  assert.notEqual(result, input);
  assert.equal(Object.isFrozen(result), true);
  input.entity_id = "weather.changed";
  assert.equal(result.entity_id, "weather.home");
});

test("normalizes omitted config to an empty frozen object", () => {
  const result = validateWeatherProviderConfig(undefined);
  assert.deepEqual(result, {});
  assert.equal(Object.isFrozen(result), true);
});

test("rejects unknown blank malformed and non-weather primary source config", () => {
  assert.throws(() => validateWeatherProviderConfig({ extra: "x" }), TypeError);
  for (const value of ["", "   ", 12, null, "weather", "Weather.Home", "weather.home extra"]) {
    assert.throws(() => validateWeatherProviderConfig({ entity_id: value }), TypeError);
  }
  assert.throws(() => validateWeatherProviderConfig({ entity_id: "sensor.weather" }), TypeError);
  assert.throws(() => validateWeatherProviderConfig({ moon_entity_id: "not-an-entity" }), TypeError);
});
