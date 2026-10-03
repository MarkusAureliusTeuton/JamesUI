import test from "node:test";
import assert from "node:assert/strict";

import {
  deepFreeze,
  finiteOrNull,
  normalizeCurrentWeather,
  percentOrNull,
  selectWeatherSource,
  weatherUnits,
} from "../custom_components/jamesui/frontend/modules/provider.weather/normalize.js";

function entity(entityId, state, attributes = {}) {
  return { entity_id: entityId, state, attributes };
}

test("numeric helpers keep finite values and reject malformed values", () => {
  assert.equal(finiteOrNull(12.5), 12.5);
  assert.equal(finiteOrNull("12.5"), 12.5);
  assert.equal(finiteOrNull(""), null);
  assert.equal(finiteOrNull("abc"), null);
  assert.equal(finiteOrNull(Infinity), null);
  assert.equal(percentOrNull(120), 100);
  assert.equal(percentOrNull(-4), 0);
  assert.equal(percentOrNull("45"), 45);
  assert.equal(percentOrNull("bad"), null);
});

test("deepFreeze recursively freezes plain weather values", () => {
  const value = deepFreeze({ units: { temperature: "°C" }, items: [{ x: 1 }] });
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.units), true);
  assert.equal(Object.isFrozen(value.items), true);
  assert.equal(Object.isFrozen(value.items[0]), true);
});

test("explicit weather source never silently falls back", () => {
  const healthy = entity("weather.a", "sunny");
  const explicit = selectWeatherSource("weather.missing", [healthy]);
  assert.deepEqual(explicit, {
    mode: "explicit",
    entityId: "weather.missing",
    status: "unavailable",
    reason: "source_missing",
  });

  const unavailable = selectWeatherSource("weather.target", [
    healthy,
    entity("weather.target", "unavailable"),
  ]);
  assert.equal(unavailable.entityId, "weather.target");
  assert.equal(unavailable.reason, "source_unavailable");
});

test("automatic weather source is deterministic and distinguishes no source from unavailable sources", () => {
  const selected = selectWeatherSource(null, [
    entity("weather.z", "cloudy"),
    entity("weather.a", "sunny"),
    entity("weather.m", "unavailable"),
  ]);
  assert.deepEqual(selected, {
    mode: "automatic",
    entityId: "weather.a",
    status: "available",
    reason: null,
  });
  assert.deepEqual(selectWeatherSource(null, []), {
    mode: "automatic", entityId: null, status: "not_configured", reason: "no_weather_source",
  });
  assert.deepEqual(selectWeatherSource(null, [entity("weather.a", "unknown")]), {
    mode: "automatic", entityId: null, status: "unavailable", reason: "sources_unavailable",
  });
});

test("weatherUnits reads source units without display formatting", () => {
  const units = weatherUnits(entity("weather.home", "sunny", {
    temperature_unit: "°C",
    pressure_unit: "hPa",
    precipitation_unit: "mm",
    wind_speed_unit: "km/h",
    visibility_unit: "km",
  }));
  assert.deepEqual(units, {
    temperature: "°C",
    pressure: "hPa",
    precipitation: "mm",
    wind_speed: "km/h",
    visibility: "km",
  });
});

test("normalizes exact current schema and explicit outdoor-temperature override", () => {
  const weather = entity("weather.home", "partlycloudy", {
    temperature: 18.2,
    temperature_unit: "°C",
    apparent_temperature: "17.1",
    humidity: 74,
    dew_point: 12.7,
    pressure: 1014,
    pressure_unit: "hPa",
    cloud_coverage: 61,
    visibility: 9.5,
    visibility_unit: "km",
    wind_speed: 13,
    wind_gust_speed: 24,
    wind_speed_unit: "km/h",
    wind_bearing: 220,
    uv_index: 2.1,
  });
  const override = entity("sensor.outdoor_temperature", "16.8", { unit_of_measurement: "°C" });
  const value = normalizeCurrentWeather({
    weatherEntity: weather,
    overrideEntity: override,
    nextPrecipitation: { datetime: "2026-10-03T14:00:00+02:00", probability: 55 },
  });
  assert.deepEqual(value, {
    source_entity_id: "weather.home",
    condition: "partlycloudy",
    temperature: 16.8,
    temperature_unit: "°C",
    temperature_source_entity_id: "sensor.outdoor_temperature",
    apparent_temperature: 17.1,
    humidity: 74,
    dew_point: 12.7,
    pressure: 1014,
    pressure_unit: "hPa",
    cloud_coverage: 61,
    visibility: 9.5,
    visibility_unit: "km",
    wind_speed: 13,
    wind_gust_speed: 24,
    wind_speed_unit: "km/h",
    wind_bearing: 220,
    uv_index: 2.1,
    next_precipitation_at: "2026-10-03T14:00:00+02:00",
    next_precipitation_probability: 55,
  });
  assert.equal(Object.isFrozen(value), true);
});

test("bad optional override and malformed measurements do not invent values", () => {
  const weather = entity("weather.home", "sunny", {
    temperature: "20",
    temperature_unit: "°C",
    humidity: "bad",
    cloud_coverage: 140,
  });
  const override = entity("sensor.outdoor_temperature", "unavailable", { unit_of_measurement: "°C" });
  const value = normalizeCurrentWeather({ weatherEntity: weather, overrideEntity: override, nextPrecipitation: null });
  assert.equal(value.temperature, 20);
  assert.equal(value.temperature_source_entity_id, "weather.home");
  assert.equal(value.humidity, null);
  assert.equal(value.cloud_coverage, 100);
  assert.equal(value.next_precipitation_at, null);
  assert.equal(value.next_precipitation_probability, null);
});
