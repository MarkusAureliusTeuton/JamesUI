import test from "node:test";
import assert from "node:assert/strict";

import {
  FORECAST_FEATURE_DAILY,
  FORECAST_FEATURE_HOURLY,
  FORECAST_FEATURE_TWICE_DAILY,
  aggregateHourlyForecastToDaily,
  aggregateTwiceDailyForecast,
  findNextPrecipitation,
  isValidTimeZone,
  localDateKey,
  localDateParts,
  normalizeHourlyForecast,
  normalizeTrueDailyForecast,
} from "../custom_components/jamesui/frontend/modules/provider.weather/forecast.js";

const units = Object.freeze({
  temperature: "°C",
  pressure: "hPa",
  precipitation: "mm",
  wind_speed: "km/h",
  visibility: "km",
});

test("exports Home Assistant forecast feature bits", () => {
  assert.equal(FORECAST_FEATURE_DAILY, 1);
  assert.equal(FORECAST_FEATURE_HOURLY, 2);
  assert.equal(FORECAST_FEATURE_TWICE_DAILY, 4);
});

test("validates explicit IANA timezone and derives local date parts without process timezone", () => {
  assert.equal(isValidTimeZone("Europe/Berlin"), true);
  assert.equal(isValidTimeZone("America/Los_Angeles"), true);
  assert.equal(isValidTimeZone(null), false);
  assert.equal(isValidTimeZone(""), false);
  assert.equal(isValidTimeZone("Mars/Olympus"), false);

  const instant = "2026-10-03T23:30:00Z";
  assert.equal(localDateKey(instant, "Europe/Berlin"), "2026-10-04");
  assert.equal(localDateKey(instant, "America/Los_Angeles"), "2026-10-03");
  assert.deepEqual(localDateParts("2026-03-29T01:30:00Z", "Europe/Berlin"), {
    year: 2026, month: 3, day: 29, hour: 3, minute: 30,
  });
  assert.throws(() => localDateKey(instant, "Mars/Olympus"), RangeError);
});

test("normalizes genuine hourly forecast and filters malformed entries", () => {
  assert.deepEqual(normalizeHourlyForecast({ sourceEntityId: "weather.home", units, forecast: null }), {
    value: null, reason: "invalid_payload",
  });
  assert.deepEqual(normalizeHourlyForecast({ sourceEntityId: "weather.home", units, forecast: [] }), {
    value: null, reason: "empty_data",
  });

  const result = normalizeHourlyForecast({
    sourceEntityId: "weather.home",
    units,
    forecast: [
      { datetime: "bad", temperature: 99 },
      { datetime: "2026-10-03T13:00:00+02:00", condition: "rainy", temperature: "18", precipitation_probability: 120, humidity: "bad" },
      { datetime: "2026-10-03T12:00:00+02:00", condition: "cloudy", temperature: 17, precipitation: "0.2", cloud_coverage: -5 },
    ],
  });
  assert.equal(result.reason, null);
  assert.equal(result.value.source_entity_id, "weather.home");
  assert.deepEqual(result.value.units, units);
  assert.equal(result.value.items.length, 2);
  assert.equal(result.value.items[0].datetime, "2026-10-03T12:00:00+02:00");
  assert.equal(result.value.items[0].precipitation, 0.2);
  assert.equal(result.value.items[0].cloud_coverage, 0);
  assert.equal(result.value.items[1].precipitation_probability, 100);
  assert.equal(result.value.items[1].humidity, null);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.items), true);
});

test("true daily requires HA timezone and maps high low with seven day cap", () => {
  const missingZone = normalizeTrueDailyForecast({
    sourceEntityId: "weather.home", units, forecast: [{ datetime: "2026-10-03T12:00:00Z", temperature: 20 }], timeZone: null,
  });
  assert.deepEqual(missingZone, { value: null, reason: "timezone_unavailable" });

  const forecast = Array.from({ length: 8 }, (_, index) => ({
    datetime: `2026-10-${String(3 + index).padStart(2, "0")}T12:00:00Z`,
    condition: "sunny",
    temperature: 20 + index,
    templow: 10 + index,
    precipitation_probability: index * 10,
  }));
  const result = normalizeTrueDailyForecast({ sourceEntityId: "weather.home", units, forecast, timeZone: "Europe/Berlin" });
  assert.equal(result.reason, null);
  assert.equal(result.value.forecast_source, "daily");
  assert.equal(result.value.items.length, 7);
  assert.equal(result.value.items[0].date, "2026-10-03");
  assert.equal(result.value.items[0].temperature_high, 20);
  assert.equal(result.value.items[0].temperature_low, 10);
});

test("twice-daily aggregates exact numeric rules and prefers daytime representative", () => {
  const result = aggregateTwiceDailyForecast({
    sourceEntityId: "weather.home",
    units,
    timeZone: "Europe/Berlin",
    forecast: [
      { datetime: "2026-10-03T05:00:00Z", is_daytime: true, condition: "sunny", temperature: 20, templow: 10, precipitation: 1, precipitation_probability: 30, humidity: 60, pressure: 1010, cloud_coverage: 20, wind_speed: 10, wind_gust_speed: 20, wind_bearing: 180, uv_index: 3 },
      { datetime: "2026-10-03T17:00:00Z", is_daytime: false, condition: "rainy", temperature: 12, templow: 8, precipitation: 2, precipitation_probability: 70, humidity: 80, pressure: 1014, cloud_coverage: 80, wind_speed: 15, wind_gust_speed: 25, wind_bearing: 270, uv_index: 1 },
    ],
  });
  assert.equal(result.reason, null);
  assert.deepEqual(result.value.items[0], {
    date: "2026-10-03",
    datetime: "2026-10-03T05:00:00Z",
    condition: "sunny",
    temperature_high: 20,
    temperature_low: 8,
    precipitation: 3,
    precipitation_probability: 70,
    humidity: 70,
    pressure: 1012,
    wind_speed: 15,
    wind_gust_speed: 25,
    wind_bearing: 180,
    cloud_coverage: 50,
    uv_index: 3,
  });
});

test("hourly to daily groups by HA-local date and uses record nearest local noon", () => {
  const hourly = normalizeHourlyForecast({
    sourceEntityId: "weather.home",
    units,
    forecast: [
      { datetime: "2026-10-03T07:00:00Z", condition: "fog", temperature: 9, precipitation: 0, precipitation_probability: 5, humidity: 90, pressure: 1010, cloud_coverage: 90, wind_speed: 4, wind_gust_speed: 8, wind_bearing: 80, uv_index: 0 },
      { datetime: "2026-10-03T09:00:00Z", condition: "cloudy", temperature: 14, precipitation: 0.5, precipitation_probability: 45, humidity: 70, pressure: 1012, cloud_coverage: 60, wind_speed: 8, wind_gust_speed: 12, wind_bearing: 120, uv_index: 2 },
      { datetime: "2026-10-03T10:00:00Z", condition: "sunny", temperature: 16, precipitation: 0, precipitation_probability: 10, humidity: 60, pressure: 1014, cloud_coverage: 20, wind_speed: 10, wind_gust_speed: 14, wind_bearing: 160, uv_index: 4 },
      { datetime: "2026-10-03T21:00:00Z", condition: "clear-night", temperature: 7, precipitation: 0, precipitation_probability: 0, humidity: 80, pressure: 1016, cloud_coverage: 10, wind_speed: 3, wind_gust_speed: 5, wind_bearing: 200, uv_index: 0 },
    ],
  }).value;
  const result = aggregateHourlyForecastToDaily({ sourceEntityId: "weather.home", units, hourlyValue: hourly, timeZone: "Europe/Berlin" });
  assert.equal(result.reason, null);
  const day = result.value.items[0];
  assert.equal(day.condition, "sunny");
  assert.equal(day.datetime, "2026-10-03T10:00:00Z");
  assert.equal(day.temperature_high, 16);
  assert.equal(day.temperature_low, 7);
  assert.equal(day.precipitation, 0.5);
  assert.equal(day.precipitation_probability, 45);
  assert.equal(day.wind_bearing, 160);
});

test("daily helpers refuse missing or invalid timezone", () => {
  const args = { sourceEntityId: "weather.home", units, forecast: [{ datetime: "2026-10-03T12:00:00Z" }] };
  assert.equal(aggregateTwiceDailyForecast({ ...args, timeZone: null }).reason, "timezone_unavailable");
  assert.equal(aggregateTwiceDailyForecast({ ...args, timeZone: "Mars/Olympus" }).reason, "timezone_unavailable");
  assert.equal(aggregateHourlyForecastToDaily({ sourceEntityId: "weather.home", units, hourlyValue: { items: [] }, timeZone: null }).reason, "timezone_unavailable");
});

test("next precipitation uses only future true-hourly items on HA-local today", () => {
  const hourly = normalizeHourlyForecast({
    sourceEntityId: "weather.home",
    units,
    forecast: [
      { datetime: "2026-10-03T10:00:00+02:00", condition: "rainy", precipitation_probability: 90 },
      { datetime: "2026-10-03T14:00:00+02:00", condition: "cloudy", precipitation_probability: 40 },
      { datetime: "2026-10-03T15:00:00+02:00", condition: "cloudy", precipitation: 0.1 },
      { datetime: "2026-10-04T01:00:00+02:00", condition: "pouring", precipitation_probability: 100 },
    ],
  }).value;
  assert.deepEqual(findNextPrecipitation(hourly, { now: new Date("2026-10-03T11:00:00+02:00"), timeZone: "Europe/Berlin" }), {
    datetime: "2026-10-03T14:00:00+02:00", probability: 40,
  });
  assert.equal(findNextPrecipitation(hourly, { now: new Date("2026-10-03T16:00:00+02:00"), timeZone: "Europe/Berlin" }), null);
  assert.equal(findNextPrecipitation(hourly, { now: new Date("2026-10-03T11:00:00+02:00"), timeZone: null }), null);
  assert.equal(findNextPrecipitation({ items: "not-hourly" }, { now: new Date(), timeZone: "Europe/Berlin" }), null);
});
