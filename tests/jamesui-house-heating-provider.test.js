import test from "node:test";
import assert from "node:assert/strict";

import { createHouseHeatingProvider } from "../custom_components/jamesui/frontend/modules/provider.house-heating/provider.js";

function entity(entity_id, state, attributes = {}) { return { entity_id, state, attributes }; }

function zone(id, prefix = id) {
  return {
    id,
    name: id === "living" ? "Wohnen" : "Büro",
    current_temperature: { entity_id: `sensor.${prefix}_current` },
    target_temperature: { entity_id: `sensor.${prefix}_target` },
    heating_demand: { entity_id: `binary_sensor.${prefix}_demand` },
    auto_regulation_enabled: { entity_id: `binary_sensor.${prefix}_auto` },
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
      return () => {
        if (!active) return false;
        active = false;
        entityListeners.get(id)?.delete(listener);
        if (entityListeners.get(id)?.size === 0) entityListeners.delete(id);
        return true;
      };
    },
    subscribeConnection(listener, { emitCurrent = true } = {}) {
      connectionListeners.add(listener);
      if (emitCurrent) listener(connectionState);
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        connectionListeners.delete(listener);
        return true;
      };
    },
    setState(next) {
      currentStates.set(next.entity_id, next);
      for (const listener of [...(entityListeners.get(next.entity_id) ?? [])]) listener(next);
    },
    removeState(id) {
      currentStates.delete(id);
      for (const listener of [...(entityListeners.get(id) ?? [])]) listener(null);
    },
    setConnection(next) {
      connectionState = next;
      for (const listener of [...connectionListeners]) listener(next);
    },
    activeEntitySubscriptions(id = null) {
      if (id) return entityListeners.get(id)?.size ?? 0;
      return [...entityListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
    },
  };

  const capabilities = {
    register(moduleId, capability) {
      assert.equal(moduleId, "provider.house-heating");
      assert.equal(capability, "house.heatingZones");
      return {
        available(value) { publications.push({ status: "available", value, reason: null }); },
        unavailable(reason) { publications.push({ status: "unavailable", value: null, reason }); },
        notConfigured(reason) { publications.push({ status: "not_configured", value: null, reason }); },
        unregister() { unregisterCount += 1; return true; },
      };
    },
  };

  return {
    context: { capabilities, homeAssistant },
    homeAssistant,
    publications,
    get latest() { return publications.at(-1); },
    get unregisterCount() { return unregisterCount; },
  };
}

function healthyStates(prefix, current, target, demand, auto) {
  return {
    [`sensor.${prefix}_current`]: entity(`sensor.${prefix}_current`, String(current)),
    [`sensor.${prefix}_target`]: entity(`sensor.${prefix}_target`, String(target)),
    [`binary_sensor.${prefix}_demand`]: entity(`binary_sensor.${prefix}_demand`, demand ? "on" : "off"),
    [`binary_sensor.${prefix}_auto`]: entity(`binary_sensor.${prefix}_auto`, auto ? "on" : "off"),
  };
}

test("publishes not configured for an explicit empty zone list", () => {
  const h = makeHarness();
  const provider = createHouseHeatingProvider(h.context, { zones: [] });
  assert.equal(provider.mount(), true);
  assert.deepEqual(h.latest, { status: "not_configured", value: null, reason: "no_heating_zones" });
  provider.destroy();
});

test("publishes independent KNX-backed zones without deriving values", () => {
  const h = makeHarness({
    ...healthyStates("living", 21.4, 22, false, true),
    ...healthyStates("office", 20.1, 19.5, true, false),
  });
  const provider = createHouseHeatingProvider(h.context, { zones: [zone("living"), zone("office")] });
  provider.mount();
  assert.equal(h.latest.status, "available");
  assert.deepEqual(h.latest.value, {
    version: 1,
    zones: [
      {
        id: "living", name: "Wohnen", current_temperature_c: 21.4, target_temperature_c: 22,
        heating_demand: false, auto_regulation_enabled: true, availability: "available", reason: null,
      },
      {
        id: "office", name: "Büro", current_temperature_c: 20.1, target_temperature_c: 19.5,
        heating_demand: true, auto_regulation_enabled: false, availability: "available", reason: null,
      },
    ],
  });
  provider.destroy();
});

test("marks only the affected zone unavailable when one required signal is missing", () => {
  const h = makeHarness({
    ...healthyStates("living", 21.4, 22, false, true),
    ...healthyStates("office", 20.1, 20.5, false, true),
  });
  h.homeAssistant.removeState("sensor.living_target");
  const provider = createHouseHeatingProvider(h.context, { zones: [zone("living"), zone("office")] });
  provider.mount();
  const [living, office] = h.latest.value.zones;
  assert.equal(living.availability, "unavailable");
  assert.equal(living.reason, "target_temperature:source_missing");
  assert.equal(living.current_temperature_c, 21.4);
  assert.equal(living.target_temperature_c, null);
  assert.equal(office.availability, "available");
  provider.destroy();
});

test("subscribes once per physical entity even when bindings reuse it", () => {
  const shared = zone("living", "living");
  shared.target_temperature = { entity_id: "sensor.living_current", attribute: "target" };
  const h = makeHarness({
    "sensor.living_current": entity("sensor.living_current", "21.4", { target: 22 }),
    "binary_sensor.living_demand": entity("binary_sensor.living_demand", "off"),
    "binary_sensor.living_auto": entity("binary_sensor.living_auto", "on"),
  });
  const provider = createHouseHeatingProvider(h.context, { zones: [shared] });
  provider.mount();
  assert.equal(h.homeAssistant.activeEntitySubscriptions("sensor.living_current"), 1);
  assert.equal(h.homeAssistant.activeEntitySubscriptions(), 3);
  provider.destroy();
});

test("reacts to entity changes and connection lifecycle", () => {
  const h = makeHarness(healthyStates("living", 21, 22, false, true));
  const provider = createHouseHeatingProvider(h.context, { zones: [zone("living")] });
  provider.mount();
  h.homeAssistant.setState(entity("sensor.living_current", "21.8"));
  assert.equal(h.latest.value.zones[0].current_temperature_c, 21.8);
  h.homeAssistant.setConnection("disconnected");
  assert.deepEqual(h.latest, { status: "unavailable", value: null, reason: "home_assistant_disconnected" });
  h.homeAssistant.setConnection("connected");
  assert.equal(h.latest.status, "available");
  assert.equal(h.latest.value.zones[0].current_temperature_c, 21.8);
  provider.destroy();
});

test("validates update before replacing the mounted runtime and destroy cleans up", () => {
  const h = makeHarness(healthyStates("living", 21, 22, false, true));
  const provider = createHouseHeatingProvider(h.context, { zones: [zone("living")] });
  provider.mount();
  const beforeSubscriptions = h.homeAssistant.activeEntitySubscriptions();
  assert.throws(() => provider.update(h.context, { zones: [{ ...zone("living"), name: "" }] }), /name/);
  assert.equal(h.homeAssistant.activeEntitySubscriptions(), beforeSubscriptions);
  h.homeAssistant.setState(entity("sensor.living_current", "22.2"));
  assert.equal(h.latest.value.zones[0].current_temperature_c, 22.2);

  assert.equal(provider.destroy(), true);
  assert.equal(h.homeAssistant.activeEntitySubscriptions(), 0);
  assert.equal(h.unregisterCount, 1);
  assert.equal(provider.destroy(), false);
});
