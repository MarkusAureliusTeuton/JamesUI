import test from "node:test";
import assert from "node:assert/strict";

import { createHouseLightingProvider } from "../custom_components/jamesui/frontend/modules/provider.house-lighting/provider.js";

const entity = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const light = (id, entityId = `light.${id}`) => ({ id, name: id, state: { entity_id: entityId } });

function makeHarness(states = {}, connection = "connected") {
  let connectionState = connection;
  const currentStates = new Map(Object.entries(states));
  const entityListeners = new Map();
  const connectionListeners = new Set();
  const publications = new Map([["house.lights", []], ["house.ambientLights", []]]);
  const unregisters = new Map([["house.lights", 0], ["house.ambientLights", 0]]);

  const homeAssistant = {
    connectionState: () => connectionState,
    getState: (id) => connectionState === "connected" ? currentStates.get(id) ?? null : null,
    entities() { throw new Error("auto-discovery is forbidden"); },
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
      return () => { if (!active) return false; active = false; connectionListeners.delete(listener); return true; };
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
    activeEntitySubscriptions() { return [...entityListeners.values()].reduce((n, set) => n + set.size, 0); },
  };

  const capabilities = {
    register(moduleId, capability) {
      assert.equal(moduleId, "provider.house-lighting");
      const list = publications.get(capability);
      assert.ok(list, `unexpected capability ${capability}`);
      return {
        available(value) { list.push({ status: "available", value, reason: null }); },
        unavailable(reason) { list.push({ status: "unavailable", value: null, reason }); },
        notConfigured(reason) { list.push({ status: "not_configured", value: null, reason }); },
        unregister() { unregisters.set(capability, unregisters.get(capability) + 1); return true; },
      };
    },
  };

  return {
    context: { capabilities, homeAssistant }, homeAssistant,
    latest(capability) { return publications.get(capability).at(-1); },
    unregisters,
  };
}

test("publishes groups independently and never auto-discovers entities", () => {
  const h = makeHarness({ "light.ceiling": entity("light.ceiling", "on") });
  const provider = createHouseLightingProvider(h.context, { lights: [light("ceiling")], ambient_lights: [] });
  provider.mount();
  assert.equal(h.latest("house.lights").status, "available");
  assert.deepEqual(h.latest("house.lights").value, {
    version: 1,
    items: [{ id: "ceiling", name: "ceiling", on: true, availability: "available", reason: null }],
    on_count: 1,
    total_count: 1,
    unavailable_count: 0,
  });
  assert.deepEqual(h.latest("house.ambientLights"), { status: "not_configured", value: null, reason: "no_ambient_light_sources" });
  provider.destroy();
});

test("counts on, total and unavailable sources without hiding healthy siblings", () => {
  const lights = Array.from({ length: 8 }, (_, i) => light(`l${i + 1}`));
  const states = Object.fromEntries(lights.map((item, i) => [item.state.entity_id, entity(item.state.entity_id, i < 3 ? "on" : "off")]));
  delete states["light.l8"];
  const h = makeHarness(states);
  const provider = createHouseLightingProvider(h.context, { lights, ambient_lights: [light("ambient", "switch.ambient")] });
  provider.mount();
  const value = h.latest("house.lights").value;
  assert.equal(value.on_count, 3);
  assert.equal(value.total_count, 8);
  assert.equal(value.unavailable_count, 1);
  assert.equal(value.items[0].on, true);
  assert.equal(value.items[7].on, null);
  assert.equal(value.items[7].availability, "unavailable");
  assert.equal(h.latest("house.ambientLights").value.unavailable_count, 1);
  provider.destroy();
});

test("reacts to source and connection changes", () => {
  const h = makeHarness({ "light.a": entity("light.a", "off"), "switch.ambient": entity("switch.ambient", "on") });
  const provider = createHouseLightingProvider(h.context, { lights: [light("a")], ambient_lights: [light("ambient", "switch.ambient")] });
  provider.mount();
  h.homeAssistant.setState(entity("light.a", "on"));
  assert.equal(h.latest("house.lights").value.on_count, 1);
  h.homeAssistant.setConnection("disconnected");
  assert.equal(h.latest("house.lights").reason, "home_assistant_disconnected");
  assert.equal(h.latest("house.ambientLights").reason, "home_assistant_disconnected");
  h.homeAssistant.setConnection("connected");
  assert.equal(h.latest("house.lights").status, "available");
  provider.destroy();
});

test("validates updates before rebinding and cleans all subscriptions", () => {
  const h = makeHarness({ "light.a": entity("light.a", "off") });
  const provider = createHouseLightingProvider(h.context, { lights: [light("a")], ambient_lights: [] });
  provider.mount();
  const count = h.homeAssistant.activeEntitySubscriptions();
  assert.throws(() => provider.update(h.context, { lights: [light("a", "light.same")], ambient_lights: [light("b", "light.same")] }), /duplicate lighting source/);
  assert.equal(h.homeAssistant.activeEntitySubscriptions(), count);
  h.homeAssistant.setState(entity("light.a", "on"));
  assert.equal(h.latest("house.lights").value.on_count, 1);
  assert.equal(provider.destroy(), true);
  assert.equal(h.homeAssistant.activeEntitySubscriptions(), 0);
  assert.equal(h.unregisters.get("house.lights"), 1);
  assert.equal(h.unregisters.get("house.ambientLights"), 1);
});
