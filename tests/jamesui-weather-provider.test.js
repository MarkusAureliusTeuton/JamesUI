import test from "node:test";
import assert from "node:assert/strict";

import { createWeatherProvider } from "../custom_components/jamesui/frontend/modules/provider.weather/provider.js";

const CAPABILITIES = [
  "weather.current", "weather.daily", "weather.hourly", "weather.sun", "weather.moon", "weather.atmosphere",
];

function entity(entityId, state, attributes = {}) {
  return { entity_id: entityId, state, attributes };
}

function fakeCapabilities() {
  const snapshots = new Map();
  const registrations = [];
  const unregisters = [];
  return {
    snapshots,
    registrations,
    unregisters,
    register(moduleId, capability) {
      registrations.push([moduleId, capability]);
      const publish = (status, value, reason) => snapshots.set(capability, { status, value, reason });
      publish("unavailable", null, null);
      return {
        available(value) { publish("available", value, null); return true; },
        unavailable(reason = null) { publish("unavailable", null, reason); return true; },
        notConfigured(reason = null) { publish("not_configured", null, reason); return true; },
        unregister() { unregisters.push(capability); snapshots.delete(capability); return true; },
      };
    },
  };
}

function fakeHomeAssistant(initialStates = {}, { timeZone = "Europe/Berlin", connected = true, failForecastTypes = [] } = {}) {
  let states = { ...initialStates };
  let connection = connected ? "connected" : "disconnected";
  const entityListeners = new Map();
  const domainListeners = new Map();
  const connectionListeners = new Set();
  const forecastListeners = new Map();
  const forecastHistory = [];
  const subscriptionMessages = [];
  const remoteUnsubscribes = [];
  const calls = { getState: 0, entities: 0, subscribeMessage: 0, timeZone: 0 };

  const api = {
    calls,
    subscriptionMessages,
    forecastHistory,
    remoteUnsubscribes,
    connectionState: () => connection,
    timeZone() { calls.timeZone += 1; return connection === "connected" ? timeZone : null; },
    getState(entityId) { calls.getState += 1; return connection === "connected" ? states[entityId] ?? null : null; },
    entities(domain = null) {
      calls.entities += 1;
      if (connection !== "connected") return [];
      const values = Object.values(states).sort((a, b) => a.entity_id.localeCompare(b.entity_id));
      return domain === null ? values : values.filter((item) => item.entity_id.startsWith(`${domain}.`));
    },
    subscribeConnection(listener) { connectionListeners.add(listener); listener(connection); return () => connectionListeners.delete(listener); },
    subscribeEntity(entityId, listener) {
      if (!entityListeners.has(entityId)) entityListeners.set(entityId, new Set());
      entityListeners.get(entityId).add(listener);
      listener(api.getState(entityId));
      return () => entityListeners.get(entityId)?.delete(listener);
    },
    subscribeDomain(domain, listener) {
      if (!domainListeners.has(domain)) domainListeners.set(domain, new Set());
      domainListeners.get(domain).add(listener);
      listener(api.entities(domain));
      return () => domainListeners.get(domain)?.delete(listener);
    },
    async subscribeMessage(listener, message) {
      calls.subscribeMessage += 1;
      subscriptionMessages.push(message);
      if (failForecastTypes.includes(message.forecast_type)) throw new Error(`failed ${message.forecast_type}`);
      forecastListeners.set(message.forecast_type, listener);
      forecastHistory.push({ type: message.forecast_type, listener, entityId: message.entity_id });
      let active = true;
      return async () => {
        if (!active) return false;
        active = false;
        remoteUnsubscribes.push(message.forecast_type);
        if (forecastListeners.get(message.forecast_type) === listener) forecastListeners.delete(message.forecast_type);
        return true;
      };
    },
    setEntity(next) {
      states[next.entity_id] = next;
      for (const listener of entityListeners.get(next.entity_id) ?? []) listener(next);
      const domain = next.entity_id.split(".")[0];
      for (const listener of domainListeners.get(domain) ?? []) listener(api.entities(domain));
    },
    removeEntity(entityId) {
      delete states[entityId];
      for (const listener of entityListeners.get(entityId) ?? []) listener(null);
      const domain = entityId.split(".")[0];
      for (const listener of domainListeners.get(domain) ?? []) listener(api.entities(domain));
    },
    setConnection(next) { connection = next; for (const listener of connectionListeners) listener(next); },
    emitForecast(type, forecast) { forecastListeners.get(type)?.({ forecast }); },
    emitHistorical(index, forecast) { forecastHistory[index]?.listener({ forecast }); },
  };
  return api;
}

function fakeRuntime(now = "2026-10-03T11:00:00+02:00") {
  let current = new Date(now);
  const intervals = [];
  const cleared = [];
  return {
    intervals,
    cleared,
    now: () => new Date(current),
    setNow(value) { current = new Date(value); },
    setInterval(callback, ms) { const handle = { callback, ms }; intervals.push(handle); return handle; },
    clearInterval(handle) { cleared.push(handle); },
  };
}

function context(capabilities, homeAssistant) {
  return Object.freeze({
    events: {}, overlays: {}, capabilities, actions: {}, homeAssistant,
    module: Object.freeze({ id: "provider.weather", type: "provider", version: "1.0.0" }),
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function weather(id = "weather.home", supportedFeatures = 0, state = "sunny") {
  return entity(id, state, {
    supported_features: supportedFeatures,
    temperature: 18,
    temperature_unit: "°C",
    humidity: 60,
    precipitation_unit: "mm",
    pressure_unit: "hPa",
    wind_speed_unit: "km/h",
    visibility_unit: "km",
  });
}

test("mount owns exactly six capability handles and one timer while destroy is idempotent", () => {
  const capabilities = fakeCapabilities();
  const ha = fakeHomeAssistant({ "weather.home": weather(), "sun.sun": entity("sun.sun", "above_horizon", { elevation: 20 }) });
  const runtime = fakeRuntime();
  const provider = createWeatherProvider(context(capabilities, ha), {}, runtime);
  assert.equal(capabilities.registrations.length, 0);
  provider.mount(null);
  provider.mount(null);
  assert.deepEqual(capabilities.registrations.map((entry) => entry[1]), CAPABILITIES);
  assert.equal(runtime.intervals.length, 1);
  assert.equal(runtime.intervals[0].ms, 300000);
  assert.equal(provider.destroy(), true);
  assert.equal(provider.destroy(), false);
  assert.deepEqual(capabilities.unregisters.sort(), [...CAPABILITIES].sort());
  assert.equal(runtime.cleared.length, 1);
});

test("invalid update is atomic and explicit weather source never switches", () => {
  const capabilities = fakeCapabilities();
  const ha = fakeHomeAssistant({
    "weather.a": weather("weather.a"),
    "weather.target": weather("weather.target", 0, "unavailable"),
  });
  const runtime = fakeRuntime();
  const ctx = context(capabilities, ha);
  const provider = createWeatherProvider(ctx, { entity_id: "weather.target" }, runtime);
  provider.mount(null);
  assert.equal(capabilities.snapshots.get("weather.current").status, "unavailable");
  assert.equal(capabilities.snapshots.get("weather.current").reason, "source_unavailable");
  assert.throws(() => provider.update(ctx, { entity_id: "sensor.bad" }), TypeError);
  ha.setEntity(weather("weather.target"));
  assert.equal(capabilities.snapshots.get("weather.current").value.source_entity_id, "weather.target");
  provider.destroy();
});

test("automatic source reselects deterministically and no-source statuses stay distinct", () => {
  const capabilities = fakeCapabilities();
  const ha = fakeHomeAssistant({});
  const provider = createWeatherProvider(context(capabilities, ha), {}, fakeRuntime());
  provider.mount(null);
  assert.deepEqual(capabilities.snapshots.get("weather.current"), { status: "not_configured", value: null, reason: "no_weather_source" });
  ha.setEntity(weather("weather.z"));
  ha.setEntity(weather("weather.a"));
  assert.equal(capabilities.snapshots.get("weather.current").value.source_entity_id, "weather.a");
  ha.setEntity(weather("weather.a", 0, "unavailable"));
  assert.equal(capabilities.snapshots.get("weather.current").value.source_entity_id, "weather.z");
  ha.setEntity(weather("weather.z", 0, "unknown"));
  assert.equal(capabilities.snapshots.get("weather.current").reason, "sources_unavailable");
  provider.destroy();
});

test("publishes independent current sun moon and atmosphere states", () => {
  const capabilities = fakeCapabilities();
  const ha = fakeHomeAssistant({
    "weather.home": weather(),
    "sun.sun": entity("sun.sun", "above_horizon", { elevation: 8, azimuth: 200 }),
    "sensor.outdoor_lux": entity("sensor.outdoor_lux", "250"),
    "sensor.moon": entity("sensor.moon", "waxing_crescent"),
  });
  const provider = createWeatherProvider(context(capabilities, ha), { illuminance_entity_id: "sensor.outdoor_lux", moon_entity_id: "sensor.moon" }, fakeRuntime());
  provider.mount(null);
  assert.equal(capabilities.snapshots.get("weather.current").status, "available");
  assert.equal(capabilities.snapshots.get("weather.sun").value.period, "golden");
  assert.equal(capabilities.snapshots.get("weather.moon").value.phase, "waxing_crescent");
  assert.equal(capabilities.snapshots.get("weather.atmosphere").value.scene_key, "dusk");
  ha.removeEntity("sun.sun");
  assert.equal(capabilities.snapshots.get("weather.sun").reason, "sun_unavailable");
  assert.equal(capabilities.snapshots.get("weather.current").status, "available");
  provider.destroy();
});

test("subscribes exact supported forecast types and uses highest-priority usable daily source", async () => {
  const capabilities = fakeCapabilities();
  const ha = fakeHomeAssistant({ "weather.home": weather("weather.home", 1 | 2 | 4), "sun.sun": entity("sun.sun", "above_horizon", { elevation: 20 }) });
  const provider = createWeatherProvider(context(capabilities, ha), {}, fakeRuntime());
  provider.mount(null);
  await flush();
  assert.deepEqual(ha.subscriptionMessages.map((m) => m.forecast_type).sort(), ["daily", "hourly", "twice_daily"]);
  for (const message of ha.subscriptionMessages) assert.deepEqual({ type: message.type, entity_id: message.entity_id }, { type: "weather/subscribe_forecast", entity_id: "weather.home" });

  ha.emitForecast("daily", []);
  ha.emitForecast("twice_daily", [
    { datetime: "2026-10-03T06:00:00Z", is_daytime: true, condition: "cloudy", temperature: 18, templow: 9 },
    { datetime: "2026-10-03T18:00:00Z", is_daytime: false, condition: "rainy", temperature: 12, templow: 8 },
  ]);
  assert.equal(capabilities.snapshots.get("weather.daily").status, "available");
  assert.equal(capabilities.snapshots.get("weather.daily").value.forecast_source, "twice_daily");

  ha.emitForecast("hourly", [{ datetime: "2026-10-03T14:00:00+02:00", condition: "rainy", temperature: 17, precipitation_probability: 60 }]);
  assert.equal(capabilities.snapshots.get("weather.hourly").status, "available");
  assert.equal(capabilities.snapshots.get("weather.current").value.next_precipitation_at, "2026-10-03T14:00:00+02:00");
  provider.destroy();
});

test("missing HA timezone leaves hourly truthful but daily and rain clock unavailable", async () => {
  const capabilities = fakeCapabilities();
  const ha = fakeHomeAssistant({ "weather.home": weather("weather.home", 2) }, { timeZone: null });
  const provider = createWeatherProvider(context(capabilities, ha), {}, fakeRuntime());
  provider.mount(null);
  await flush();
  ha.emitForecast("hourly", [{ datetime: "2026-10-03T14:00:00+02:00", condition: "rainy", temperature: 17, precipitation_probability: 60 }]);
  assert.equal(capabilities.snapshots.get("weather.hourly").status, "available");
  assert.equal(capabilities.snapshots.get("weather.daily").reason, "timezone_unavailable");
  assert.equal(capabilities.snapshots.get("weather.current").value.next_precipitation_at, null);
  provider.destroy();
});

test("stale forecast callbacks from old source generation cannot publish", async () => {
  const capabilities = fakeCapabilities();
  const ha = fakeHomeAssistant({ "weather.a": weather("weather.a", 2), "weather.b": weather("weather.b", 2) });
  const runtime = fakeRuntime();
  const ctx = context(capabilities, ha);
  const provider = createWeatherProvider(ctx, { entity_id: "weather.a" }, runtime);
  provider.mount(null);
  await flush();
  const oldHistoryIndex = ha.forecastHistory.findIndex((entry) => entry.type === "hourly" && entry.entityId === "weather.a");
  provider.update(ctx, { entity_id: "weather.b" });
  await flush();
  ha.emitHistorical(oldHistoryIndex, [{ datetime: "2026-10-03T13:00:00+02:00", condition: "rainy", temperature: 99 }]);
  assert.notEqual(capabilities.snapshots.get("weather.hourly").value?.source_entity_id, "weather.a");
  provider.destroy();
});

test("five-minute timer recalculates cached time-derived values without HA polling and cannot publish after destroy", async () => {
  const capabilities = fakeCapabilities();
  const ha = fakeHomeAssistant({ "weather.home": weather("weather.home", 2) });
  const runtime = fakeRuntime("2026-10-03T11:00:00+02:00");
  const provider = createWeatherProvider(context(capabilities, ha), {}, runtime);
  provider.mount(null);
  await flush();
  ha.emitForecast("hourly", [
    { datetime: "2026-10-03T12:00:00+02:00", condition: "rainy", precipitation_probability: 60 },
    { datetime: "2026-10-03T15:00:00+02:00", condition: "rainy", precipitation_probability: 70 },
  ]);
  assert.equal(capabilities.snapshots.get("weather.current").value.next_precipitation_at, "2026-10-03T12:00:00+02:00");
  const before = { ...ha.calls };
  runtime.setNow("2026-10-03T13:00:00+02:00");
  const retainedTimer = runtime.intervals[0].callback;
  retainedTimer();
  assert.equal(capabilities.snapshots.get("weather.current").value.next_precipitation_at, "2026-10-03T15:00:00+02:00");
  assert.deepEqual(ha.calls, before);
  const snapshotBeforeDestroy = capabilities.snapshots.get("weather.current");
  provider.destroy();
  retainedTimer();
  assert.equal(capabilities.snapshots.get("weather.current"), undefined);
  assert.notEqual(snapshotBeforeDestroy, undefined);
});
