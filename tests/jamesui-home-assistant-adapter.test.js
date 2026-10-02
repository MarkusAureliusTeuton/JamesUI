import test from "node:test";
import assert from "node:assert/strict";

import {
  HomeAssistantUnavailableError,
  createHomeAssistantAdapter,
} from "../custom_components/jamesui/frontend/ha/home-assistant-adapter.js";

function state(entityId, value) {
  return Object.freeze({ entity_id: entityId, state: value, attributes: {} });
}

function hass(states = {}, { connected = true, connection = {} } = {}) {
  return { states, connected, connection };
}

test("starts unavailable and exposes empty state queries", () => {
  const adapter = createHomeAssistantAdapter();
  assert.equal(adapter.connectionState(), "unavailable");
  assert.equal(adapter.getState("light.kitchen"), null);
  assert.deepEqual(adapter.entities(), []);
  assert.deepEqual(adapter.entities("light"), []);
});

test("setHass exposes state by id and exact domain", () => {
  const kitchen = state("light.kitchen", "on");
  const socket = state("switch.coffee", "off");
  const adapter = createHomeAssistantAdapter();
  adapter.setHass(hass({ [kitchen.entity_id]: kitchen, [socket.entity_id]: socket }));

  assert.equal(adapter.connectionState(), "connected");
  assert.equal(adapter.getState("light.kitchen"), kitchen);
  assert.deepEqual(adapter.entities("light"), [kitchen]);
  assert.deepEqual(adapter.entities("switch"), [socket]);
});

test("legacy hass with connection but no connected flag is treated as connected", () => {
  const adapter = createHomeAssistantAdapter();
  adapter.setHass({ states: {}, connection: {} });
  assert.equal(adapter.connectionState(), "connected");
});

test("entity subscription emits current replacement and removal only for its entity", () => {
  const initial = state("light.kitchen", "off");
  const unrelated = state("switch.coffee", "off");
  const changed = state("light.kitchen", "on");
  const seen = [];
  const adapter = createHomeAssistantAdapter();
  adapter.setHass(hass({ [initial.entity_id]: initial, [unrelated.entity_id]: unrelated }));

  const unsubscribe = adapter.subscribeEntity("light.kitchen", (value) => seen.push(value));
  adapter.setHass(hass({ [initial.entity_id]: initial, [unrelated.entity_id]: state("switch.coffee", "on") }));
  adapter.setHass(hass({ [changed.entity_id]: changed, [unrelated.entity_id]: unrelated }));
  adapter.setHass(hass({ [unrelated.entity_id]: unrelated }));

  assert.deepEqual(seen, [initial, changed, null]);
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
});

test("domain subscription reacts to members only", () => {
  const lightA = state("light.a", "off");
  const lightB = state("light.b", "on");
  const seen = [];
  const adapter = createHomeAssistantAdapter();
  adapter.setHass(hass({ [lightA.entity_id]: lightA }));

  adapter.subscribeDomain("light", (members) => seen.push(members.map((item) => item.entity_id)));
  adapter.setHass(hass({ [lightA.entity_id]: lightA, "switch.x": state("switch.x", "on") }));
  adapter.setHass(hass({ [lightA.entity_id]: lightA, [lightB.entity_id]: lightB }));
  adapter.setHass(hass({ [lightB.entity_id]: lightB }));

  assert.deepEqual(seen, [["light.a"], ["light.a", "light.b"], ["light.b"]]);
});

test("connection subscription emits only real state transitions", () => {
  const seen = [];
  const adapter = createHomeAssistantAdapter();
  adapter.subscribeConnection((value) => seen.push(value));
  adapter.setHass(hass({}, { connected: true }));
  adapter.setHass(hass({}, { connected: true }));
  adapter.setHass(hass({}, { connected: false }));
  adapter.setHass(null);

  assert.deepEqual(seen, ["unavailable", "connected", "disconnected", "unavailable"]);
});

test("subscriber failures are isolated and reported", () => {
  const errors = [];
  const adapter = createHomeAssistantAdapter({ onSubscriberError: (entry) => errors.push(entry) });
  const first = state("light.kitchen", "off");
  const second = state("light.kitchen", "on");
  adapter.setHass(hass({ [first.entity_id]: first }));
  let siblingCalls = 0;

  adapter.subscribeEntity("light.kitchen", () => { throw new Error("listener boom"); }, { emitCurrent: false });
  adapter.subscribeEntity("light.kitchen", () => { siblingCalls += 1; }, { emitCurrent: false });
  adapter.setHass(hass({ [second.entity_id]: second }));

  assert.equal(siblingCalls, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, "entity");
  assert.equal(errors[0].key, "light.kitchen");
  assert.match(errors[0].error.message, /listener boom/);
});

test("destroy and local unsubscriptions are idempotent", () => {
  const adapter = createHomeAssistantAdapter();
  const unsubscribeEntity = adapter.subscribeEntity("light.kitchen", () => {}, { emitCurrent: false });
  const unsubscribeDomain = adapter.subscribeDomain("light", () => {}, { emitCurrent: false });
  const unsubscribeConnection = adapter.subscribeConnection(() => {}, { emitCurrent: false });

  assert.equal(unsubscribeEntity(), true);
  assert.equal(unsubscribeEntity(), false);
  assert.equal(unsubscribeDomain(), true);
  assert.equal(unsubscribeDomain(), false);
  assert.equal(unsubscribeConnection(), true);
  assert.equal(unsubscribeConnection(), false);
  assert.equal(adapter.destroy(), true);
  assert.equal(adapter.destroy(), false);
});

test("exports the unavailable error type for command tasks", () => {
  const error = new HomeAssistantUnavailableError();
  assert.equal(error.name, "HomeAssistantUnavailableError");
});

test("commands reject with HomeAssistantUnavailableError while unavailable or disconnected", async () => {
  const adapter = createHomeAssistantAdapter();
  for (const operation of [
    () => adapter.callService("light", "turn_on"),
    () => adapter.callWS({ type: "test" }),
    () => adapter.subscribeMessage(() => {}, { type: "test/subscribe" }),
  ]) {
    await assert.rejects(operation, HomeAssistantUnavailableError);
  }

  adapter.setHass(hass({}, { connected: false }));
  await assert.rejects(() => adapter.callWS({ type: "test" }), HomeAssistantUnavailableError);
});

test("service and websocket commands delegate exactly through current hass", async () => {
  const calls = [];
  const current = hass();
  current.callService = async (...args) => { calls.push(["service", ...args]); return "service-result"; };
  current.callWS = async (message) => { calls.push(["ws", message]); return { ok: true }; };
  const adapter = createHomeAssistantAdapter();
  adapter.setHass(current);

  const data = { brightness: 120 };
  const target = { entity_id: "light.kitchen" };
  assert.equal(await adapter.callService("light", "turn_on", data, target), "service-result");
  assert.deepEqual(await adapter.callWS({ type: "test/command", value: 1 }), { ok: true });
  assert.deepEqual(calls, [
    ["service", "light", "turn_on", data, target],
    ["ws", { type: "test/command", value: 1 }],
  ]);
});

test("registry helpers use canonical websocket commands", async () => {
  const messages = [];
  const current = hass();
  current.callWS = async (message) => { messages.push(message); return [message.type]; };
  const adapter = createHomeAssistantAdapter();
  adapter.setHass(current);

  assert.deepEqual(await adapter.listAreas(), ["config/area_registry/list"]);
  assert.deepEqual(await adapter.listDevices(), ["config/device_registry/list"]);
  assert.deepEqual(await adapter.listEntities(), ["config/entity_registry/list"]);
  assert.deepEqual(messages, [
    { type: "config/area_registry/list" },
    { type: "config/device_registry/list" },
    { type: "config/entity_registry/list" },
  ]);
});

test("subscribeMessage forwards arguments and returns idempotent async unsubscribe", async () => {
  const calls = [];
  let rawUnsubscribes = 0;
  const current = hass();
  current.connection.subscribeMessage = async (...args) => {
    calls.push(args);
    return async () => { rawUnsubscribes += 1; };
  };
  const adapter = createHomeAssistantAdapter();
  adapter.setHass(current);
  const listener = () => {};
  const message = { type: "weather/subscribe_forecast", entity_id: "weather.home" };
  const options = { resubscribe: true };

  const unsubscribe = await adapter.subscribeMessage(listener, message, options);
  assert.deepEqual(calls, [[listener, message, options]]);
  assert.equal(await unsubscribe(), true);
  assert.equal(await unsubscribe(), false);
  assert.equal(rawUnsubscribes, 1);
});

test("destroy drains all remote subscriptions despite one unsubscribe rejection", async () => {
  const attempts = [];
  const current = hass();
  let index = 0;
  current.connection.subscribeMessage = async () => {
    const id = index++;
    return async () => {
      attempts.push(id);
      if (id === 0) throw new Error("unsubscribe boom");
    };
  };
  const adapter = createHomeAssistantAdapter();
  adapter.setHass(current);
  await adapter.subscribeMessage(() => {}, { type: "sub/one" });
  await adapter.subscribeMessage(() => {}, { type: "sub/two" });

  assert.equal(adapter.destroy(), true);
  assert.equal(adapter.destroy(), false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(attempts.sort(), [0, 1]);
});

test("disconnected host hides cached states and publishes removals", () => {
  const kitchen = state("light.kitchen", "on");
  const entitySeen = [];
  const domainSeen = [];
  const adapter = createHomeAssistantAdapter();
  adapter.setHass(hass({ [kitchen.entity_id]: kitchen }, { connected: true }));
  adapter.subscribeEntity("light.kitchen", (value) => entitySeen.push(value));
  adapter.subscribeDomain("light", (members) => domainSeen.push(members));

  adapter.setHass(hass({ [kitchen.entity_id]: kitchen }, { connected: false }));

  assert.equal(adapter.getState("light.kitchen"), null);
  assert.deepEqual(adapter.entities(), []);
  assert.deepEqual(adapter.entities("light"), []);
  assert.deepEqual(entitySeen, [kitchen, null]);
  assert.deepEqual(domainSeen, [[kitchen], []]);
});
