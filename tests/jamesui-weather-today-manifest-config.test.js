import test from "node:test";
import assert from "node:assert/strict";

import { MANIFEST } from "../custom_components/jamesui/frontend/modules/widget.weather-today/manifest.js";
import { validateWeatherTodayConfig } from "../custom_components/jamesui/frontend/modules/widget.weather-today/config.js";

const REQUIRED = [
  "weather.current",
  "weather.daily",
  "weather.hourly",
  "weather.sun",
  "weather.moon",
  "weather.atmosphere",
];

test("defines the canonical immutable Weather Today widget manifest", () => {
  assert.deepEqual(MANIFEST, {
    id: "widget.weather-today",
    type: "widget",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: REQUIRED,
    provides_capabilities: [],
    config_schema: "widget.weather-today/v1",
  });
  assert.equal(Object.isFrozen(MANIFEST), true);
  assert.equal(Object.isFrozen(MANIFEST.depends_on), true);
  assert.equal(Object.isFrozen(MANIFEST.requires_capabilities), true);
  assert.equal(Object.isFrozen(MANIFEST.provides_capabilities), true);
});

test("Weather Today V1 config is strictly empty and immutable", () => {
  const omitted = validateWeatherTodayConfig();
  const empty = validateWeatherTodayConfig({});
  assert.deepEqual(omitted, {});
  assert.deepEqual(empty, {});
  assert.equal(Object.isFrozen(omitted), true);
  assert.equal(Object.isFrozen(empty), true);

  for (const bad of [null, [], new Date(), "", 42, { background: "clear-day" }, { hero_ratio: 0.42 }]) {
    assert.throws(() => validateWeatherTodayConfig(bad), TypeError);
  }
});
