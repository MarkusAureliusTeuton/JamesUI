import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSun,
  resolveAtmosphere,
  sunPeriod,
  weatherClass,
} from "../custom_components/jamesui/frontend/modules/provider.weather/atmosphere.js";

function sun(state, attributes = {}) {
  return { entity_id: "sun.sun", state, attributes };
}

test("derives exact sun period boundaries", () => {
  assert.equal(sunPeriod(-6.01, "below_horizon"), "night");
  assert.equal(sunPeriod(-6, "below_horizon"), "twilight");
  assert.equal(sunPeriod(0.99, "above_horizon"), "twilight");
  assert.equal(sunPeriod(1, "above_horizon"), "golden");
  assert.equal(sunPeriod(11.99, "above_horizon"), "golden");
  assert.equal(sunPeriod(12, "above_horizon"), "day");
  assert.equal(sunPeriod(null, "above_horizon"), "day");
  assert.equal(sunPeriod(null, "below_horizon"), "night");
  assert.equal(sunPeriod(null, "unknown"), null);
});

test("normalizes complete sun value and malformed optional fields", () => {
  assert.equal(normalizeSun(null), null);
  assert.equal(normalizeSun(sun("unavailable")), null);
  const value = normalizeSun(sun("above_horizon", {
    elevation: "8.5",
    azimuth: 210,
    next_rising: "2026-10-04T05:12:00+00:00",
    next_setting: "2026-10-03T16:47:00+00:00",
  }));
  assert.deepEqual(value, {
    source_entity_id: "sun.sun",
    is_up: true,
    elevation: 8.5,
    azimuth: 210,
    period: "golden",
    next_rising: "2026-10-04T05:12:00+00:00",
    next_setting: "2026-10-03T16:47:00+00:00",
  });
  assert.equal(Object.isFrozen(value), true);

  const fallback = normalizeSun(sun("below_horizon", { elevation: "bad", azimuth: "bad", next_rising: 42 }));
  assert.equal(fallback.is_up, false);
  assert.equal(fallback.period, "night");
  assert.equal(fallback.elevation, null);
  assert.equal(fallback.azimuth, null);
  assert.equal(fallback.next_rising, null);
});

test("maps all canonical Home Assistant conditions to semantic weather classes", () => {
  for (const condition of ["sunny", "clear-night"]) assert.equal(weatherClass(condition), "clear");
  for (const condition of ["partlycloudy", "cloudy", "windy", "windy-variant", "exceptional"]) assert.equal(weatherClass(condition), "cloudy");
  for (const condition of ["rainy", "pouring", "lightning", "lightning-rainy", "hail", "snowy-rainy"]) assert.equal(weatherClass(condition), "rain");
  assert.equal(weatherClass("snowy"), "snow");
  assert.equal(weatherClass("fog"), "fog");
  assert.equal(weatherClass("totally-new-condition"), null);
  assert.equal(weatherClass(null), null);
});

test("resolves semantic scene keys without asset paths", () => {
  const cases = [
    ["fog", "day", "fog"],
    ["sunny", "golden", "dusk"],
    ["rainy", "twilight", "dusk"],
    ["clear-night", "night", "clear-night"],
    ["rainy", "night", "cloudy-night"],
    ["sunny", "day", "clear-day"],
    ["cloudy", "day", "cloudy-day"],
    ["rainy", "day", "rain-day"],
    ["snowy", "day", "snow-day"],
  ];
  for (const [condition, period, sceneKey] of cases) {
    const result = resolveAtmosphere({ condition, period, ambientLux: "123.4" });
    assert.deepEqual(result, {
      weather_class: weatherClass(condition),
      period,
      scene_key: sceneKey,
      ambient_lux: 123.4,
    });
    assert.equal(JSON.stringify(result).includes("/assets/"), false);
    assert.equal(Object.isFrozen(result), true);
  }
});

test("unknown weather or missing period never fabricates a scene and illuminance is nullable", () => {
  assert.deepEqual(resolveAtmosphere({ condition: "unknown-new", period: "day", ambientLux: "bad" }), {
    weather_class: null,
    period: "day",
    scene_key: null,
    ambient_lux: null,
  });
  assert.equal(resolveAtmosphere({ condition: "sunny", period: null, ambientLux: null }).scene_key, null);
});
