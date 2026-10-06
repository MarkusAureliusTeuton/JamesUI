import test from "node:test";
import assert from "node:assert/strict";
import { createHouseEnergyProvider } from "../custom_components/jamesui/frontend/modules/provider.house-energy/provider.js";

const entity = (entity_id, state, unit = "W") => ({ entity_id, state: String(state), attributes: { unit_of_measurement: unit } });
const source = (id = "house") => ({ id, name: id, power: { entity_id: `sensor.${id}_power` } });
const flush = () => new Promise((resolve) => setImmediate(resolve));

function makeHarness(states = {}, connection = "connected") {
  let connectionState = connection;
  const currentStates = new Map(Object.entries(states));
  const entityListeners = new Map();
  const connectionListeners = new Set();
  const publications = [];
  const wsCalls = [];
  let wsHandler = (message) => ({ [message.entity_ids[0]]: [{ s: "1000", lu: Date.parse(message.start_time) / 1000 }] });
  let unregisterCount = 0;
  const homeAssistant = {
    connectionState: () => connectionState,
    getState: (id) => connectionState === "connected" ? currentStates.get(id) ?? null : null,
    subscribeEntity(id, listener, { emitCurrent = true } = {}) {
      if (!entityListeners.has(id)) entityListeners.set(id, new Set());
      entityListeners.get(id).add(listener);
      if (emitCurrent) listener(this.getState(id));
      let active = true;
      return () => { if (!active) return false; active = false; entityListeners.get(id)?.delete(listener); if (entityListeners.get(id)?.size === 0) entityListeners.delete(id); return true; };
    },
    subscribeConnection(listener, { emitCurrent = true } = {}) {
      connectionListeners.add(listener);
      if (emitCurrent) listener(connectionState);
      let active = true;
      return () => { if (!active) return false; active = false; connectionListeners.delete(listener); return true; };
    },
    async callWS(message) { wsCalls.push(message); return wsHandler(message); },
    setWSHandler(handler) { wsHandler = handler; },
    setState(next) { currentStates.set(next.entity_id, next); for (const listener of [...(entityListeners.get(next.entity_id) ?? [])]) listener(next); },
    setConnection(next) { connectionState = next; for (const listener of [...connectionListeners]) listener(next); },
    activeEntitySubscriptions() { return [...entityListeners.values()].reduce((n, set) => n + set.size, 0); },
  };
  const capabilities = { register(moduleId, capability) {
    assert.equal(moduleId, "provider.house-energy"); assert.equal(capability, "house.energy");
    return {
      available(value) { publications.push({ status: "available", value, reason: null }); },
      unavailable(reason) { publications.push({ status: "unavailable", value: null, reason }); },
      notConfigured(reason) { publications.push({ status: "not_configured", value: null, reason }); },
      unregister() { unregisterCount += 1; return true; },
    };
  } };
  return { context: { capabilities, homeAssistant }, homeAssistant, publications, wsCalls, get latest() { return publications.at(-1); }, get unregisterCount() { return unregisterCount; } };
}

test("publishes not configured when no energy sources exist", () => {
  const h = makeHarness();
  const provider = createHouseEnergyProvider(h.context, { sources: [] });
  provider.mount();
  assert.deepEqual(h.latest, { status: "not_configured", value: null, reason: "no_energy_sources" });
  provider.destroy();
});

test("queries HA history and returns current plus trailing average in watts", async () => {
  const now = Date.now();
  const h = makeHarness({ "sensor.house_power": entity("sensor.house_power", 1.84, "kW") });
  h.homeAssistant.setWSHandler((message) => ({
    "sensor.house_power": [
      { s: "1", lu: Date.parse(message.start_time) / 1000 },
      { s: "2", lu: (Date.parse(message.start_time) + 5 * 60_000) / 1000 },
    ],
  }));
  const provider = createHouseEnergyProvider(h.context, { sources: [source()] });
  provider.mount();
  const service = h.latest.value;
  assert.deepEqual(service.configured_sources, [{ id: "house", name: "house" }]);
  const updates = [];
  const unsubscribe = service.subscribe_windows({ windows: [{ request_id: "main", source_id: "house", window_minutes: 10 }] }, (value) => updates.push(value));
  await flush();
  const result = updates.at(-1).results[0];
  assert.equal(result.current_power_w, 1840);
  assert.equal(result.average_power_w, 1500);
  assert.equal(result.quality, "full");
  assert.equal(result.reason, null);
  const call = h.wsCalls[0];
  assert.equal(call.type, "history/history_during_period");
  assert.deepEqual(call.entity_ids, ["sensor.house_power"]);
  assert.equal(call.include_start_time_state, true);
  assert.equal(call.significant_changes_only, false);
  assert.equal(call.minimal_response, true);
  assert.equal(call.no_attributes, true);
  assert.ok(Date.parse(call.end_time) >= now);
  unsubscribe();
  provider.destroy();
});

test("shares identical source/window work while keeping different windows independent", async () => {
  const h = makeHarness({ "sensor.house_power": entity("sensor.house_power", 1000) });
  const provider = createHouseEnergyProvider(h.context, { sources: [source()] });
  provider.mount();
  const service = h.latest.value;
  const a = [], b = [];
  const stopA = service.subscribe_windows({ windows: [
    { request_id: "a15", source_id: "house", window_minutes: 15 },
    { request_id: "a60", source_id: "house", window_minutes: 60 },
  ] }, (value) => a.push(value));
  const stopB = service.subscribe_windows({ windows: [
    { request_id: "b15", source_id: "house", window_minutes: 15 },
  ] }, (value) => b.push(value));
  await flush();
  assert.equal(h.wsCalls.length, 2);
  assert.equal(a.at(-1).results.length, 2);
  assert.equal(b.at(-1).results[0].request_id, "b15");
  stopA(); stopB(); provider.destroy();
});

test("keeps current power when history fails and reports unsupported units as unavailable", async () => {
  const h = makeHarness({ "sensor.house_power": entity("sensor.house_power", 900) });
  h.homeAssistant.setWSHandler(() => { throw new Error("recorder failed"); });
  const provider = createHouseEnergyProvider(h.context, { sources: [source()] });
  provider.mount();
  const values = [];
  h.latest.value.subscribe_windows({ windows: [{ request_id: "x", source_id: "house", window_minutes: 15 }] }, (value) => values.push(value));
  await flush();
  assert.equal(values.at(-1).results[0].current_power_w, 900);
  assert.equal(values.at(-1).results[0].average_power_w, null);
  assert.equal(values.at(-1).results[0].quality, "insufficient");
  assert.equal(values.at(-1).results[0].reason, "history_fetch_failed");
  provider.destroy();

  const bad = makeHarness({ "sensor.house_power": entity("sensor.house_power", 1, "MW") });
  const badProvider = createHouseEnergyProvider(bad.context, { sources: [source()] });
  badProvider.mount();
  const badValues = [];
  bad.latest.value.subscribe_windows({ windows: [{ request_id: "bad", source_id: "house", window_minutes: 15 }] }, (value) => badValues.push(value));
  await flush();
  assert.equal(badValues.at(-1).results[0].quality, "unavailable");
  assert.equal(badValues.at(-1).results[0].reason, "unit_unsupported");
  assert.equal(bad.wsCalls.length, 0);
  badProvider.destroy();
});

test("ignores late history from a stale service after provider update or destroy", async () => {
  const h = makeHarness({ "sensor.house_power": entity("sensor.house_power", 1000) });
  let resolveHistory;
  h.homeAssistant.setWSHandler(() => new Promise((resolve) => { resolveHistory = resolve; }));
  const config = { sources: [source()] };
  const provider = createHouseEnergyProvider(h.context, config);
  provider.mount();
  const oldService = h.latest.value;
  const values = [];
  oldService.subscribe_windows({ windows: [{ request_id: "old", source_id: "house", window_minutes: 15 }] }, (value) => values.push(value));
  assert.equal(values.length, 1);
  await Promise.resolve();
  assert.equal(typeof resolveHistory, "function");
  provider.update(h.context, config);
  const beforeLate = values.length;
  resolveHistory({ "sensor.house_power": [{ s: "1000", lu: 0 }] });
  await flush();
  assert.equal(values.length, beforeLate);
  assert.throws(() => oldService.subscribe_windows({ windows: [{ request_id: "x", source_id: "house", window_minutes: 5 }] }, () => {}), /stale/);
  const newService = h.latest.value;
  provider.destroy();
  assert.throws(() => newService.subscribe_windows({ windows: [{ request_id: "x", source_id: "house", window_minutes: 5 }] }, () => {}), /stale/);
});

test("refreshes a sliding window on the 60 second timer without a source state change", async (t) => {
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  const realNow = Date.now;
  const timers = [];
  let now = 1_800_000;
  globalThis.setInterval = (fn, ms) => { const timer = { fn, ms, active: true }; timers.push(timer); return timer; };
  globalThis.clearInterval = (timer) => { timer.active = false; };
  Date.now = () => now;
  t.after(() => { globalThis.setInterval = realSetInterval; globalThis.clearInterval = realClearInterval; Date.now = realNow; });

  const h = makeHarness({ "sensor.house_power": entity("sensor.house_power", 1000) });
  let historyValue = 1000;
  h.homeAssistant.setWSHandler((message) => ({ "sensor.house_power": [{ s: String(historyValue), lu: Date.parse(message.start_time) / 1000 }] }));
  const provider = createHouseEnergyProvider(h.context, { sources: [source()] });
  provider.mount();
  const values = [];
  const stop = h.latest.value.subscribe_windows({ windows: [{ request_id: "slide", source_id: "house", window_minutes: 15 }] }, (value) => values.push(value));
  await flush();
  assert.equal(values.at(-1).results[0].average_power_w, 1000);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 60_000);

  historyValue = 2000;
  now += 60_000;
  timers[0].fn();
  await flush();
  assert.equal(values.at(-1).results[0].average_power_w, 2000);
  stop();
  assert.equal(timers[0].active, false);
  provider.destroy();
});
