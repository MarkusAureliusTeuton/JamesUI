import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCurrentWeather } from "../custom_components/jamesui/frontend/modules/provider.weather/normalize.js";
import { normalizeHourlyForecast, normalizeTrueDailyForecast } from "../custom_components/jamesui/frontend/modules/provider.weather/forecast.js";
import { normalizeSun } from "../custom_components/jamesui/frontend/modules/provider.weather/atmosphere.js";
import { createWeatherProvider } from "../custom_components/jamesui/frontend/modules/provider.weather/provider.js";

const units = Object.freeze({ temperature: "°C", pressure: "hPa", precipitation: "mm", wind_speed: "km/h", visibility: "km" });
const weather = { entity_id: "weather.home", state: "sunny", attributes: { temperature: 18, temperature_unit: "°C", supported_features: 0 } };
const sun = { entity_id: "sun.sun", state: "above_horizon", attributes: { elevation: 20, next_rising: "2026-10-05T05:10:00Z", next_setting: "2026-10-04T16:45:00Z" } };

test("normalizers expose validated timezone metadata without changing availability semantics", () => {
  assert.equal(normalizeCurrentWeather({ weatherEntity: weather, timeZone: " Europe/Berlin " }).time_zone, "Europe/Berlin");
  assert.equal(normalizeCurrentWeather({ weatherEntity: weather, timeZone: "Mars/Olympus" }).time_zone, null);

  const hourly = normalizeHourlyForecast({
    sourceEntityId: "weather.home",
    units,
    timeZone: "Europe/Berlin",
    forecast: [{ datetime: "2026-10-04T10:00:00Z", temperature: 17 }],
  });
  assert.equal(hourly.reason, null);
  assert.equal(hourly.value.time_zone, "Europe/Berlin");

  const hourlyUnknownZone = normalizeHourlyForecast({
    sourceEntityId: "weather.home",
    units,
    timeZone: "Mars/Olympus",
    forecast: [{ datetime: "2026-10-04T10:00:00Z", temperature: 17 }],
  });
  assert.equal(hourlyUnknownZone.reason, null);
  assert.equal(hourlyUnknownZone.value.time_zone, null);

  const daily = normalizeTrueDailyForecast({
    sourceEntityId: "weather.home",
    units,
    timeZone: "Europe/Berlin",
    forecast: [{ datetime: "2026-10-04T12:00:00Z", temperature: 18, templow: 8 }],
  });
  assert.equal(daily.reason, null);
  assert.equal(daily.value.time_zone, "Europe/Berlin");
  assert.equal(normalizeTrueDailyForecast({
    sourceEntityId: "weather.home",
    units,
    timeZone: null,
    forecast: [{ datetime: "2026-10-04T12:00:00Z", temperature: 18 }],
  }).reason, "timezone_unavailable");

  assert.equal(normalizeSun(sun, "Europe/Berlin").time_zone, "Europe/Berlin");
  assert.equal(normalizeSun(sun, "Mars/Olympus").time_zone, null);
});

function fakeCapabilities() {
  const snapshots = new Map();
  return {
    snapshots,
    register(_moduleId, capability) {
      return {
        available(value) { snapshots.set(capability, { status: "available", value }); },
        unavailable(reason = null) { snapshots.set(capability, { status: "unavailable", value: null, reason }); },
        notConfigured(reason = null) { snapshots.set(capability, { status: "not_configured", value: null, reason }); },
        unregister() { snapshots.delete(capability); return true; },
      };
    },
  };
}

test("provider passes HA timezone into current and sun capability values", () => {
  const capabilities = fakeCapabilities();
  const states = { "weather.home": weather, "sun.sun": sun };
  const ha = {
    connectionState: () => "connected",
    timeZone: () => "Europe/Berlin",
    getState: (id) => states[id] ?? null,
    entities: (domain) => Object.values(states).filter((item) => item.entity_id.startsWith(`${domain}.`)),
    subscribeConnection: () => () => {},
    subscribeDomain: () => () => {},
    subscribeEntity: () => () => {},
    subscribeMessage: async () => () => {},
  };
  const runtime = { now: () => new Date("2026-10-04T10:00:00+02:00"), setInterval: () => 1, clearInterval: () => {} };
  const context = {
    events: {}, overlays: {}, actions: {}, capabilities, homeAssistant: ha,
    module: { id: "provider.weather", type: "provider", version: "1.0.0" },
  };
  const provider = createWeatherProvider(context, {}, runtime);
  provider.mount(null);
  assert.equal(capabilities.snapshots.get("weather.current").value.time_zone, "Europe/Berlin");
  assert.equal(capabilities.snapshots.get("weather.sun").value.time_zone, "Europe/Berlin");
  provider.destroy();
});
