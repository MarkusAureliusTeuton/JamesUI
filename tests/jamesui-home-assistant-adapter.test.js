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
