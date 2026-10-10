import test from "node:test";
import assert from "node:assert/strict";

import { createTasksProvider } from "../custom_components/jamesui/frontend/modules/provider.tasks/provider.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function todo(entityId, { state = "0", name = entityId, supportedFeatures = 4 | 16 | 32 | 64 } = {}) {
  return { entity_id: entityId, state, attributes: { friendly_name: name, supported_features: supportedFeatures } };
}

function fakeCapabilities() {
  const history = [];
  let current = { status: "unavailable", value: null, reason: null };
  let unregistered = 0;
  return {
    history,
    get current() { return current; },
    get unregistered() { return unregistered; },
    register(moduleId, capability) {
      assert.equal(moduleId, "provider.tasks");
      assert.equal(capability, "tasks.items");
      const publish = (status, value, reason) => {
        current = { status, value, reason };
        history.push(current);
      };
      return {
        available(value) { publish("available", value, null); return true; },
        unavailable(reason = null) { publish("unavailable", null, reason); return true; },
        notConfigured(reason = null) { publish("not_configured", null, reason); return true; },
        unregister() { unregistered += 1; return true; },
      };
    },
  };
}

function context(capabilities, homeAssistant) {
  return {
    events: {}, overlays: {}, actions: {}, capabilities, homeAssistant,
    module: { id: "provider.tasks", type: "provider", version: "1.0.0" },
  };
}

test("publishes truthful top-level states for empty config disconnect and missing timezone", () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter();
  const provider = createTasksProvider(context(caps, ha), {});
  provider.mount(null);
  assert.deepEqual(caps.current, { status: "not_configured", value: null, reason: "no_task_sources" });
  provider.destroy();

  const disconnectedCaps = fakeCapabilities();
  const disconnectedHa = createFakeHomeAssistantAdapter({ connectionState: "disconnected", states: { "todo.home": todo("todo.home") } });
  const disconnected = createTasksProvider(context(disconnectedCaps, disconnectedHa), { source_entity_ids: ["todo.home"] });
  disconnected.mount(null);
  assert.equal(disconnectedCaps.current.reason, "home_assistant_disconnected");
  disconnected.destroy();

  const timezoneCaps = fakeCapabilities();
  const timezoneHa = createFakeHomeAssistantAdapter({ timeZone: null, states: { "todo.home": todo("todo.home") } });
  const timezone = createTasksProvider(context(timezoneCaps, timezoneHa), { source_entity_ids: ["todo.home"] });
  timezone.mount(null);
  assert.equal(timezoneCaps.current.reason, "timezone_unavailable");
  timezone.destroy();
});

test("waits for every configured source initial result then publishes immutable normalized snapshot", async () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({ states: {
    "todo.home": todo("todo.home", { name: "Haushalt" }),
    "todo.shop": todo("todo.shop", { name: "Einkauf", supportedFeatures: 4 | 16 }),
  } });
  const provider = createTasksProvider(context(caps, ha), { source_entity_ids: ["todo.home", "todo.shop"] });
  provider.mount(null);
  await flush();
  assert.deepEqual(ha.subscriptionCalls.map((entry) => entry.message), [
    { type: "todo/item/subscribe", entity_id: "todo.home" },
    { type: "todo/item/subscribe", entity_id: "todo.shop" },
  ]);
  assert.notEqual(caps.current.status, "available");

  ha.emitSubscription(0, { items: [{ uid: "a", summary: "Putzen", status: "needs_action", due: "2026-10-06" }] });
  assert.notEqual(caps.current.status, "available");
  ha.emitSubscription(1, { items: [{ uid: "b", summary: "Milch", status: "needs_action" }] });

  assert.equal(caps.current.status, "available");
  const value = caps.current.value;
  assert.equal(value.version, 1);
  assert.equal(value.time_zone, "Europe/Berlin");
  assert.equal(value.sources["todo.home"].name, "Haushalt");
  assert.equal(value.sources["todo.home"].items[0].title, "Putzen");
  assert.deepEqual(value.sources["todo.shop"].capabilities, {
    can_update: true, can_set_due_date: true, can_set_due_datetime: false, can_set_description: false,
  });
  assert.equal(Object.isFrozen(value), true);
  provider.destroy();
});

test("isolates missing unavailable subscription and malformed payload failures by source", async () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({ states: {
    "todo.bad": todo("todo.bad", { state: "unavailable", name: "Kaputt" }),
    "todo.good": todo("todo.good", { name: "Gut" }),
  } });
  const provider = createTasksProvider(context(caps, ha), { source_entity_ids: ["todo.missing", "todo.bad", "todo.good"] });
  provider.mount(null);
  await flush();
  assert.equal(ha.subscriptionCalls.length, 1);
  ha.emitSubscription(0, { items: [{ uid: "ok", summary: "OK", status: "needs_action" }] });
  assert.equal(caps.current.status, "available");
  assert.equal(caps.current.value.sources["todo.missing"].reason, "source_missing");
  assert.equal(caps.current.value.sources["todo.bad"].reason, "source_unavailable");
  assert.equal(caps.current.value.sources["todo.good"].status, "available");
  provider.destroy();

  const malformedCaps = fakeCapabilities();
  const malformedHa = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home") } });
  const malformed = createTasksProvider(context(malformedCaps, malformedHa), { source_entity_ids: ["todo.home"] });
  malformed.mount(null);
  await flush();
  malformedHa.emitSubscription(0, { wrong: [] });
  assert.equal(malformedCaps.current.value.sources["todo.home"].reason, "fetch_failed");
  malformed.destroy();

  const failedCaps = fakeCapabilities();
  const failedHa = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home") } });
  failedHa.setSubscriptionError(new Error("boom"));
  const failed = createTasksProvider(context(failedCaps, failedHa), { source_entity_ids: ["todo.home"] });
  failed.mount(null);
  await flush();
  assert.equal(failedCaps.current.value.sources["todo.home"].reason, "subscription_failed");
  failed.destroy();
});

test("replaces live items, filters malformed entries and suppresses semantic no-change publication", async () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home", { name: "Home" }) } });
  const provider = createTasksProvider(context(caps, ha), { source_entity_ids: ["todo.home"] });
  provider.mount(null);
  await flush();
  const firstPayload = { items: [
    { uid: "a", summary: "A", status: "needs_action" },
    { uid: "broken", summary: " ", status: "needs_action" },
  ] };
  ha.emitSubscription(0, firstPayload);
  const publications = caps.history.filter((entry) => entry.status === "available").length;
  assert.deepEqual(caps.current.value.sources["todo.home"].items.map((item) => item.uid), ["a"]);
  ha.emitSubscription(0, structuredClone(firstPayload));
  assert.equal(caps.history.filter((entry) => entry.status === "available").length, publications);
  ha.emitSubscription(0, { items: [{ uid: "b", summary: "B", status: "needs_action" }] });
  assert.deepEqual(caps.current.value.sources["todo.home"].items.map((item) => item.uid), ["b"]);

  ha.setState(todo("todo.home", { name: "Home Neu", supportedFeatures: 4 }));
  assert.equal(caps.current.value.sources["todo.home"].name, "Home Neu");
  assert.equal(caps.current.value.sources["todo.home"].capabilities.can_set_due_date, false);
  provider.destroy();
});

test("source loss clears items immediately and recovery waits for a fresh stream", async () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home") } });
  const provider = createTasksProvider(context(caps, ha), { source_entity_ids: ["todo.home"] });
  provider.mount(null);
  await flush();
  ha.emitSubscription(0, { items: [{ uid: "old", summary: "Alt", status: "needs_action" }] });
  assert.equal(caps.current.value.sources["todo.home"].items[0].uid, "old");
  ha.setState(todo("todo.home", { state: "unavailable" }));
  assert.deepEqual(caps.current.value.sources["todo.home"].items, []);
  assert.equal(caps.current.value.sources["todo.home"].reason, "source_unavailable");
  ha.setState(todo("todo.home"));
  await flush();
  assert.equal(ha.subscriptionCalls.length, 2);
  assert.notEqual(caps.current.value?.sources?.["todo.home"]?.items?.[0]?.uid, "old");
  ha.emitSubscription(1, { items: [{ uid: "new", summary: "Neu", status: "needs_action" }] });
  assert.equal(caps.current.value.sources["todo.home"].items[0].uid, "new");
  provider.destroy();
});

test("disconnect clears top-level values and reconnect rejects stale callbacks", async () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home") } });
  const provider = createTasksProvider(context(caps, ha), { source_entity_ids: ["todo.home"] });
  provider.mount(null);
  await flush();
  ha.emitSubscription(0, { items: [{ uid: "before", summary: "Vorher", status: "needs_action" }] });
  ha.setConnectionState("disconnected");
  assert.equal(caps.current.status, "unavailable");
  assert.equal(caps.current.value, null);
  ha.setConnectionState("connected");
  await flush();
  assert.equal(ha.subscriptionCalls.length, 2);
  assert.equal(ha.emitSubscription(0, { items: [{ uid: "stale", summary: "Stale", status: "needs_action" }] }), false);
  assert.notEqual(caps.current.status, "available");
  ha.emitSubscription(1, { items: [{ uid: "fresh", summary: "Frisch", status: "needs_action" }] });
  assert.equal(caps.current.value.sources["todo.home"].items[0].uid, "fresh");
  provider.destroy();
});

test("atomic update rebinds source set and destroy drains all subscriptions without polling", async () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({ states: {
    "todo.a": todo("todo.a"), "todo.b": todo("todo.b"),
  } });
  const ctx = context(caps, ha);
  const provider = createTasksProvider(ctx, { source_entity_ids: ["todo.a"] });
  provider.mount(null);
  await flush();
  assert.throws(() => provider.update(ctx, { source_entity_ids: ["calendar.bad"] }), TypeError);
  assert.equal(ha.activeEntitySubscriptions("todo.a"), 1);
  provider.update(ctx, { source_entity_ids: ["todo.b"] });
  await flush();
  assert.equal(ha.activeEntitySubscriptions("todo.a"), 0);
  assert.equal(ha.activeEntitySubscriptions("todo.b"), 1);
  assert.equal(ha.subscriptionCalls[0].unsubscribeCalls, 1);
  assert.equal(provider.destroy(), true);
  assert.equal(provider.destroy(), false);
  await flush();
  assert.equal(ha.activeConnectionSubscriptions(), 0);
  assert.equal(ha.activeEntitySubscriptions(), 0);
  assert.equal(caps.unregistered, 2);
});

test("failed source subscription during update rolls back the previous task runtime", async () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({
    states: {
      "todo.old": todo("todo.old"),
      "todo.new": todo("todo.new"),
    },
  });
  const ctx = context(caps, ha);
  const provider = createTasksProvider(ctx, { source_entity_ids: ["todo.old"] });
  assert.equal(provider.mount(null), true);
  await flush();
  const originalSubscribe = ha.subscribeEntity.bind(ha);
  let refuseOnce = true;
  ha.subscribeEntity = (id, ...args) => {
    if (id === "todo.new" && refuseOnce) {
      refuseOnce = false;
      throw new Error("new task subscription unavailable");
    }
    return originalSubscribe(id, ...args);
  };
  assert.throws(() => provider.update(ctx, { source_entity_ids: ["todo.new"] }),
    /new task subscription unavailable/);
  assert.equal(ha.activeEntitySubscriptions("todo.old"), 1);
  assert.equal(ha.activeEntitySubscriptions("todo.new"), 0);
  assert.equal(ha.activeConnectionSubscriptions(), 1);
  await flush();
  const latest = ha.subscriptionCalls.length - 1;
  assert.equal(ha.subscriptionCalls[latest].message.entity_id, "todo.old");
  ha.emitSubscription(latest, { items: [{
    uid: "restored", summary: "Wieder verfügbar", status: "needs_action",
  }] });
  assert.equal(caps.current.status, "available");
  assert.equal(caps.current.value.sources["todo.old"].items[0].uid, "restored");
  assert.equal(provider.destroy(), true);
  await flush();
  assert.equal(ha.activeEntitySubscriptions(), 0);
  assert.equal(ha.activeConnectionSubscriptions(), 0);
});
