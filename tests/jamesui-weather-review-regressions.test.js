import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSun, resolveAtmosphere } from "../custom_components/jamesui/frontend/modules/provider.weather/atmosphere.js";
import { normalizeHourlyForecast } from "../custom_components/jamesui/frontend/modules/provider.weather/forecast.js";
import { resolveMoon } from "../custom_components/jamesui/frontend/modules/provider.weather/moon.js";
import { createWeatherProvider } from "../custom_components/jamesui/frontend/modules/provider.weather/provider.js";

function entity(entityId, state, attributes = {}) {
  return { entity_id: entityId, state, attributes };
}

test("fog scene remains semantically resolvable when sun period is unavailable", () => {
  assert.deepEqual(resolveAtmosphere({ condition: "fog", period: null, ambientLux: null }), {
    weather_class: "fog",
    period: null,
    scene_key: "fog",
    ambient_lux: null,
  });
});

test("sun timestamps accept ISO instants only and otherwise normalize to null", () => {
  const value = normalizeSun(entity("sun.sun", "above_horizon", {
    elevation: 20,
    next_rising: "October 4, 2026 07:15:00 GMT+0200",
    next_setting: "2026-10-03T18:42:00+02:00",
  }));
  assert.equal(value.next_rising, null);
  assert.equal(value.next_setting, "2026-10-03T18:42:00+02:00");
});

test("forecast rejects parseable non-ISO datetimes instead of publishing ambiguous timestamps", () => {
  const result = normalizeHourlyForecast({
    sourceEntityId: "weather.home",
    units: {},
    forecast: [
      { datetime: "October 3, 2026 14:00:00 GMT+0200", temperature: 18 },
      { datetime: "2026-10-03T15:00:00+02:00", temperature: 17 },
    ],
  });
  assert.equal(result.reason, null);
  assert.equal(result.value.items.length, 1);
  assert.equal(result.value.items[0].datetime, "2026-10-03T15:00:00+02:00");
});

test("explicit configured moon entity may use any domain when its phase state is canonical", () => {
  const value = resolveMoon({
    now: new Date("2026-01-22T12:00:00Z"),
    configuredEntityId: "input_select.moon_phase",
    sensorEntities: [entity("input_select.moon_phase", "first_quarter")],
  });
  assert.equal(value.phase, "first_quarter");
  assert.equal(value.phase_source, "home_assistant");
  assert.equal(value.source_entity_id, "input_select.moon_phase");
  assert.equal(value.source_issue, null);
});

test("provider fetches an explicit non-sensor moon entity instead of ignoring it", () => {
  const snapshots = new Map();
  const capabilities = {
    register(_moduleId, capability) {
      return {
        available(value) { snapshots.set(capability, { status: "available", value, reason: null }); },
        unavailable(reason = null) { snapshots.set(capability, { status: "unavailable", value: null, reason }); },
        notConfigured(reason = null) { snapshots.set(capability, { status: "not_configured", value: null, reason }); },
        unregister() { snapshots.delete(capability); },
      };
    },
  };
  const states = {
    "weather.home": entity("weather.home", "sunny", { supported_features: 0, temperature: 18, temperature_unit: "°C" }),
    "input_select.moon_phase": entity("input_select.moon_phase", "first_quarter"),
  };
  const homeAssistant = {
    connectionState: () => "connected",
    timeZone: () => "Europe/Berlin",
    getState: (entityId) => states[entityId] ?? null,
    entities(domain = null) {
      const values = Object.values(states);
      return domain === null ? values : values.filter((item) => item.entity_id.startsWith(`${domain}.`));
    },
    subscribeConnection(listener) { listener("connected"); return () => true; },
    subscribeDomain(domain, listener) { listener(this.entities(domain)); return () => true; },
    subscribeEntity(entityId, listener) { listener(this.getState(entityId)); return () => true; },
    async subscribeMessage() { return async () => true; },
  };
  const runtime = {
    now: () => new Date("2026-01-22T12:00:00Z"),
    setInterval: () => 1,
    clearInterval: () => {},
  };
  const context = Object.freeze({
    events: {}, overlays: {}, capabilities, actions: {}, homeAssistant,
    module: Object.freeze({ id: "provider.weather", type: "provider", version: "1.0.0" }),
  });

  const provider = createWeatherProvider(context, { moon_entity_id: "input_select.moon_phase" }, runtime);
  provider.mount(null);
  assert.equal(snapshots.get("weather.moon").value.phase, "first_quarter");
  assert.equal(snapshots.get("weather.moon").value.phase_source, "home_assistant");
  assert.equal(snapshots.get("weather.moon").value.source_entity_id, "input_select.moon_phase");
  provider.destroy();
});
