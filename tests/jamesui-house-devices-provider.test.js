import test from "node:test";
import assert from "node:assert/strict";
import { createHouseDevicesProvider } from "../custom_components/jamesui/frontend/modules/provider.house-devices/provider.js";

const entity = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

function device(id, extras = {}) {
  return {
    id,
    name: id,
    primary_entity_id: `sensor.${id}_status`,
    active: { entity_id: `binary_sensor.${id}_active` },
    ...extras,
  };
}

function makeHarness(states = {}, connection = "connected") {
  let connectionState = connection;
  const currentStates = new Map(Object.entries(states));
  const entityListeners = new Map();
  const connectionListeners = new Set();
  const publications = [];
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
    setState(next) { currentStates.set(next.entity_id, next); for (const listener of [...(entityListeners.get(next.entity_id) ?? [])]) listener(next); },
    setConnection(next) { connectionState = next; for (const listener of [...connectionListeners]) listener(next); },
    activeEntitySubscriptions(id = null) { if (id) return entityListeners.get(id)?.size ?? 0; return [...entityListeners.values()].reduce((n, set) => n + set.size, 0); },
  };
  const capabilities = { register(moduleId, capability) {
    assert.equal(moduleId, "provider.house-devices"); assert.equal(capability, "house.devices");
    return {
      available(value) { publications.push({ status: "available", value, reason: null }); },
      unavailable(reason) { publications.push({ status: "unavailable", value: null, reason }); },
      notConfigured(reason) { publications.push({ status: "not_configured", value: null, reason }); },
      unregister() { unregisterCount += 1; return true; },
    };
  } };
  return { context: { capabilities, homeAssistant }, homeAssistant, publications, get latest() { return publications.at(-1); }, get unregisterCount() { return unregisterCount; } };
}

test("publishes not configured for an empty device list", () => {
  const h = makeHarness();
  const provider = createHouseDevicesProvider(h.context, { devices: [] });
  provider.mount();
  assert.deepEqual(h.latest, { status: "not_configured", value: null, reason: "no_devices" });
  provider.destroy();
});

test("aggregates active updates warnings and faults while preserving nullable optional signals", () => {
  const washer = device("washer", {
    update_available: { entity_id: "update.washer" }, warning: { entity_id: "binary_sensor.washer_warning" }, fault: { entity_id: "binary_sensor.washer_fault" },
  });
  const robot = device("robot");
  const h = makeHarness({
    "sensor.washer_status": entity("sensor.washer_status", "ready"),
    "binary_sensor.washer_active": entity("binary_sensor.washer_active", "on"),
    "update.washer": entity("update.washer", "on"),
    "binary_sensor.washer_warning": entity("binary_sensor.washer_warning", "off"),
    "binary_sensor.washer_fault": entity("binary_sensor.washer_fault", "on"),
    "sensor.robot_status": entity("sensor.robot_status", "docked"),
    "binary_sensor.robot_active": entity("binary_sensor.robot_active", "off"),
  });
  const provider = createHouseDevicesProvider(h.context, { devices: [washer, robot] });
  provider.mount();
  const value = h.latest.value;
  assert.equal(value.active_count, 1);
  assert.equal(value.update_count, 1);
  assert.equal(value.warning_count, 0);
  assert.equal(value.fault_count, 1);
  assert.equal(value.unreachable_count, 0);
  assert.equal(value.items[0].active, true);
  assert.equal(value.items[0].fault, true);
  assert.equal(value.items[1].update_available, null);
  assert.equal(value.items[1].warning, null);
  assert.equal(value.items[1].fault, null);
  provider.destroy();
});

test("marks a missing or unavailable primary entity unreachable without blanking siblings", () => {
  const h = makeHarness({
    "binary_sensor.washer_active": entity("binary_sensor.washer_active", "off"),
    "sensor.robot_status": entity("sensor.robot_status", "unavailable"),
    "binary_sensor.robot_active": entity("binary_sensor.robot_active", "on"),
    "sensor.dryer_status": entity("sensor.dryer_status", "ready"),
    "binary_sensor.dryer_active": entity("binary_sensor.dryer_active", "on"),
  });
  const provider = createHouseDevicesProvider(h.context, { devices: [device("washer"), device("robot"), device("dryer")] });
  provider.mount();
  const value = h.latest.value;
  assert.equal(value.unreachable_count, 2);
  assert.equal(value.items[0].reachable, false);
  assert.equal(value.items[0].reason, "source_missing");
  assert.equal(value.items[1].reachable, false);
  assert.equal(value.items[1].reason, "source_unavailable");
  assert.equal(value.items[2].reachable, true);
  assert.equal(value.active_count, 2);
  provider.destroy();
});

test("shares physical subscriptions across primary and optional bindings", () => {
  const combined = device("washer", {
    active: { entity_id: "sensor.washer_status", attribute: "active" },
    fault: { entity_id: "sensor.washer_status", attribute: "fault" },
  });
  const h = makeHarness({ "sensor.washer_status": entity("sensor.washer_status", "ready", { active: "on", fault: "off" }) });
  const provider = createHouseDevicesProvider(h.context, { devices: [combined] });
  provider.mount();
  assert.equal(h.homeAssistant.activeEntitySubscriptions("sensor.washer_status"), 1);
  provider.destroy();
});

test("reconnects, validates updates before rebind and destroys cleanly", () => {
  const h = makeHarness({ "sensor.washer_status": entity("sensor.washer_status", "ready"), "binary_sensor.washer_active": entity("binary_sensor.washer_active", "off") });
  const provider = createHouseDevicesProvider(h.context, { devices: [device("washer")] });
  provider.mount();
  h.homeAssistant.setConnection("disconnected");
  assert.equal(h.latest.reason, "home_assistant_disconnected");
  h.homeAssistant.setConnection("connected");
  assert.equal(h.latest.status, "available");
  const before = h.homeAssistant.activeEntitySubscriptions();
  assert.throws(() => provider.update(h.context, { devices: [{ id: "x", name: "X", primary_entity_id: "sensor.x" }] }), /at least one/);
  assert.equal(h.homeAssistant.activeEntitySubscriptions(), before);
  assert.equal(provider.destroy(), true);
  assert.equal(h.homeAssistant.activeEntitySubscriptions(), 0);
  assert.equal(h.unregisterCount, 1);
});


test("restores the old devices runtime when a new capability registry rejects rebind", () => {
  const h = makeHarness({ "sensor.washer_status": entity("sensor.washer_status", "ready"), "binary_sensor.washer_active": entity("binary_sensor.washer_active", "off") });
  const provider = createHouseDevicesProvider(h.context, { devices: [device("washer")] });
  provider.mount();
  const before = h.homeAssistant.activeEntitySubscriptions();
  const rejecting = { ...h.context, capabilities: { register() { throw new Error("registry rejected binding"); } } };
  assert.throws(() => provider.update(rejecting, { devices: [device("washer")] }), /registry rejected binding/);
  assert.equal(h.homeAssistant.activeEntitySubscriptions(), before);
  h.homeAssistant.setState(entity("binary_sensor.washer_active", "on"));
  assert.equal(h.latest.value.active_count, 1);
  provider.destroy();
});
