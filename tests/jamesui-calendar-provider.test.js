import test from "node:test";
import assert from "node:assert/strict";

import { createCalendarProvider } from "../custom_components/jamesui/frontend/modules/provider.calendar/provider.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function calendar(entityId, state = "off", name = entityId) {
  return { entity_id: entityId, state, attributes: { friendly_name: name } };
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
      assert.equal(moduleId, "provider.calendar");
      assert.equal(capability, "calendar.events");
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
    module: { id: "provider.calendar", type: "provider", version: "1.0.0" },
  };
}

function range(entityId = "calendar.family", startDate = "2026-03-29", endDate = "2026-03-30") {
  return { entity_id: entityId, start_date: startDate, end_date: endDate };
}

test("publishes truthful top-level states for empty config disconnect and missing timezone", () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter();
  const provider = createCalendarProvider(context(capabilities, ha), {});
  provider.mount(null);
  assert.deepEqual(capabilities.current, { status: "not_configured", value: null, reason: "no_calendar_sources" });
  provider.destroy();

  const disconnectedCaps = fakeCapabilities();
  const disconnectedHa = createFakeHomeAssistantAdapter({
    connectionState: "disconnected",
    states: { "calendar.family": calendar("calendar.family") },
  });
  const disconnected = createCalendarProvider(context(disconnectedCaps, disconnectedHa), {
    source_entity_ids: ["calendar.family"],
  });
  disconnected.mount(null);
  assert.equal(disconnectedCaps.current.status, "unavailable");
  assert.equal(disconnectedCaps.current.reason, "home_assistant_disconnected");
  disconnected.destroy();

  const timezoneCaps = fakeCapabilities();
  const timezoneHa = createFakeHomeAssistantAdapter({
    timeZone: null,
    states: { "calendar.family": calendar("calendar.family") },
  });
  const timezone = createCalendarProvider(context(timezoneCaps, timezoneHa), {
    source_entity_ids: ["calendar.family"],
  });
  timezone.mount(null);
  assert.equal(timezoneCaps.current.status, "unavailable");
  assert.equal(timezoneCaps.current.reason, "timezone_unavailable");
  timezone.destroy();
});

test("publishes immutable range service with configured source names and validates requests", () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({
    states: { "calendar.family": calendar("calendar.family", "off", "Familie") },
  });
  const provider = createCalendarProvider(context(capabilities, ha), {
    source_entity_ids: ["calendar.family"],
  });
  provider.mount(null);
  const service = capabilities.current.value;
  assert.equal(capabilities.current.status, "available");
  assert.equal(service.version, 1);
  assert.equal(service.time_zone, "Europe/Berlin");
  assert.deepEqual(service.configured_sources, [{ entity_id: "calendar.family", name: "Familie" }]);
  assert.equal(Object.isFrozen(service), true);
  assert.throws(() => service.subscribe_ranges({ ranges: [range("calendar.other")] }, () => {}), TypeError);
  assert.throws(() => service.subscribe_ranges({ ranges: [range(), range()] }, () => {}), TypeError);
  assert.throws(() => service.subscribe_ranges({ ranges: [range("calendar.family", "bad", "2026-03-30")] }, () => {}), TypeError);
  assert.throws(() => service.subscribe_ranges({ ranges: [range("calendar.family", "2026-03-30", "2026-03-30")] }, () => {}), RangeError);
  provider.destroy();
});

test("subscribes exact DST-aware HA range and waits for initial payload before first success snapshot", async () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({
    states: { "calendar.family": calendar("calendar.family", "off", "Familie") },
  });
  const provider = createCalendarProvider(context(capabilities, ha), {
    source_entity_ids: ["calendar.family"],
  });
  provider.mount(null);
  const seen = [];
  const unsubscribe = capabilities.current.value.subscribe_ranges({ ranges: [range()] }, (snapshot) => seen.push(snapshot));
  assert.equal(typeof unsubscribe, "function");
  assert.equal(seen.length, 0);
  await flush();
  assert.deepEqual(ha.subscriptionCalls[0].message, {
    type: "calendar/event/subscribe",
    entity_id: "calendar.family",
    start: "2026-03-28T23:00:00.000Z",
    end: "2026-03-29T22:00:00.000Z",
  });

  ha.emitSubscription(0, { events: [{
    start: "2026-03-29T10:00:00+02:00",
    end: "2026-03-29T11:00:00+02:00",
    summary: "Brunch",
  }] });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].time_zone, "Europe/Berlin");
  assert.equal(seen[0].sources["calendar.family"].status, "available");
  assert.equal(seen[0].sources["calendar.family"].events[0].title, "Brunch");
  unsubscribe();
  provider.destroy();
});

test("maps fetch and subscription failures per source while healthy siblings continue", async () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({
    states: {
      "calendar.family": calendar("calendar.family", "off", "Familie"),
      "calendar.waste": calendar("calendar.waste", "off", "Abfall"),
    },
  });
  const provider = createCalendarProvider(context(capabilities, ha), {
    source_entity_ids: ["calendar.family", "calendar.waste"],
  });
  provider.mount(null);
  const seen = [];
  capabilities.current.value.subscribe_ranges({ ranges: [
    range("calendar.family"), range("calendar.waste"),
  ] }, (snapshot) => seen.push(snapshot));
  await flush();
  ha.emitSubscription(0, { events: null });
  assert.equal(seen.length, 0);
  ha.emitSubscription(1, { events: [{ start: "2026-03-29", end: "2026-03-30", summary: "Papier" }] });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].sources["calendar.family"].status, "unavailable");
  assert.equal(seen[0].sources["calendar.family"].reason, "fetch_failed");
  assert.deepEqual(seen[0].sources["calendar.family"].events, []);
  assert.equal(seen[0].sources["calendar.waste"].events[0].title, "Papier");
  provider.destroy();

  const failedCaps = fakeCapabilities();
  const failedHa = createFakeHomeAssistantAdapter({
    states: { "calendar.family": calendar("calendar.family") },
  });
  failedHa.setSubscriptionError(new Error("subscribe boom"));
  const failed = createCalendarProvider(context(failedCaps, failedHa), { source_entity_ids: ["calendar.family"] });
  failed.mount(null);
  const failures = [];
  failedCaps.current.value.subscribe_ranges({ ranges: [range()] }, (snapshot) => failures.push(snapshot));
  await flush();
  assert.equal(failures.length, 1);
  assert.equal(failures[0].sources["calendar.family"].reason, "subscription_failed");
  failed.destroy();
});

test("reports missing/unavailable sources immediately without fabricating empty success", () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({ states: {
    "calendar.unavailable": calendar("calendar.unavailable", "unavailable", "Kaputt"),
  } });
  const provider = createCalendarProvider(context(capabilities, ha), {
    source_entity_ids: ["calendar.missing", "calendar.unavailable"],
  });
  provider.mount(null);
  const seen = [];
  capabilities.current.value.subscribe_ranges({ ranges: [
    range("calendar.missing"), range("calendar.unavailable"),
  ] }, (snapshot) => seen.push(snapshot));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].sources["calendar.missing"].reason, "source_missing");
  assert.equal(seen[0].sources["calendar.unavailable"].reason, "source_unavailable");
  assert.equal(ha.subscriptionCalls.length, 0);
  provider.destroy();
});

test("source loss clears prior events immediately and recovery requires a fresh payload", async () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({
    states: { "calendar.family": calendar("calendar.family", "off", "Familie") },
  });
  const provider = createCalendarProvider(context(capabilities, ha), { source_entity_ids: ["calendar.family"] });
  provider.mount(null);
  const seen = [];
  capabilities.current.value.subscribe_ranges({ ranges: [range()] }, (snapshot) => seen.push(snapshot));
  await flush();
  ha.emitSubscription(0, { events: [{ start: "2026-03-29", end: "2026-03-30", summary: "Alt" }] });
  assert.equal(seen.at(-1).sources["calendar.family"].events[0].title, "Alt");

  ha.setState(calendar("calendar.family", "unavailable", "Familie"));
  assert.equal(seen.at(-1).sources["calendar.family"].reason, "source_unavailable");
  assert.deepEqual(seen.at(-1).sources["calendar.family"].events, []);

  ha.setState(calendar("calendar.family", "off", "Familie"));
  await flush();
  assert.equal(ha.subscriptionCalls.length, 2);
  assert.deepEqual(seen.at(-1).sources["calendar.family"].events, []);
  ha.emitSubscription(1, { events: [{ start: "2026-03-29", end: "2026-03-30", summary: "Neu" }] });
  assert.equal(seen.at(-1).sources["calendar.family"].events[0].title, "Neu");
  provider.destroy();
});

test("shares identical ranges by ref-count and handles unsubscribe-before-setup resolution", async () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({
    states: { "calendar.family": calendar("calendar.family") },
  });
  const provider = createCalendarProvider(context(capabilities, ha), { source_entity_ids: ["calendar.family"] });
  provider.mount(null);
  const service = capabilities.current.value;
  const first = service.subscribe_ranges({ ranges: [range()] }, () => {});
  const second = service.subscribe_ranges({ ranges: [range()] }, () => {});
  await flush();
  assert.equal(ha.subscriptionCalls.length, 1);
  first();
  await flush();
  assert.equal(ha.subscriptionCalls[0].unsubscribeCalls, 0);
  second();
  await flush();
  assert.equal(ha.subscriptionCalls[0].unsubscribeCalls, 1);

  const control = ha.deferNextSubscription();
  const early = service.subscribe_ranges({ ranges: [range("calendar.family", "2026-04-01", "2026-04-02")] }, () => {});
  assert.equal(ha.subscriptionCalls.length, 2);
  early();
  control.resolve();
  await flush();
  assert.equal(ha.subscriptionCalls[1].unsubscribeCalls, 1);
  provider.destroy();
});

test("disconnect invalidates old generation and reconnect publishes a fresh range service", async () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({
    states: { "calendar.family": calendar("calendar.family") },
  });
  const provider = createCalendarProvider(context(capabilities, ha), { source_entity_ids: ["calendar.family"] });
  provider.mount(null);
  const firstService = capabilities.current.value;
  const oldSeen = [];
  firstService.subscribe_ranges({ ranges: [range()] }, (snapshot) => oldSeen.push(snapshot));
  await flush();
  ha.emitSubscription(0, { events: [{ start: "2026-03-29", end: "2026-03-30", summary: "Vorher" }] });
  assert.equal(oldSeen.length, 1);

  ha.setConnectionState("disconnected");
  assert.equal(capabilities.current.reason, "home_assistant_disconnected");
  ha.setConnectionState("connected");
  const secondService = capabilities.current.value;
  assert.notEqual(secondService, firstService);
  const freshSeen = [];
  secondService.subscribe_ranges({ ranges: [range()] }, (snapshot) => freshSeen.push(snapshot));
  await flush();
  assert.equal(ha.subscriptionCalls.length, 2);
  assert.equal(ha.emitSubscription(0, { events: [{ start: "2026-03-29", end: "2026-03-30", summary: "Stale" }] }), false);
  assert.equal(freshSeen.length, 0);
  ha.emitSubscription(1, { events: [{ start: "2026-03-29", end: "2026-03-30", summary: "Frisch" }] });
  assert.equal(freshSeen.at(-1).sources["calendar.family"].events[0].title, "Frisch");
  provider.destroy();
});

test("destroy is idempotent and drains local and remote subscriptions without polling", async () => {
  const capabilities = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({ states: { "calendar.family": calendar("calendar.family") } });
  const provider = createCalendarProvider(context(capabilities, ha), { source_entity_ids: ["calendar.family"] });
  provider.mount(null);
  capabilities.current.value.subscribe_ranges({ ranges: [range()] }, () => {});
  await flush();
  assert.equal(ha.activeConnectionSubscriptions(), 1);
  assert.equal(ha.activeEntitySubscriptions("calendar.family"), 1);
  assert.equal(provider.destroy(), true);
  assert.equal(provider.destroy(), false);
  await flush();
  assert.equal(ha.activeConnectionSubscriptions(), 0);
  assert.equal(ha.activeEntitySubscriptions(), 0);
  assert.equal(ha.subscriptionCalls[0].unsubscribeCalls, 1);
  assert.equal(capabilities.unregistered, 1);
});

test("failed source subscription during update restores the previous calendar runtime", () => {
  const caps = fakeCapabilities();
  const ha = createFakeHomeAssistantAdapter({
    states: {
      "calendar.old": calendar("calendar.old"),
      "calendar.new": calendar("calendar.new"),
    },
  });
  const ctx = context(caps, ha);
  const provider = createCalendarProvider(ctx, { source_entity_ids: ["calendar.old"] });
  assert.equal(provider.mount(null), true);
  const originalSubscribe = ha.subscribeEntity.bind(ha);
  let refuseOnce = true;
  ha.subscribeEntity = (id, ...args) => {
    if (id === "calendar.new" && refuseOnce) {
      refuseOnce = false;
      throw new Error("new calendar subscription unavailable");
    }
    return originalSubscribe(id, ...args);
  };
  assert.throws(() => provider.update(ctx, { source_entity_ids: ["calendar.new"] }),
    /new calendar subscription unavailable/);
  assert.equal(caps.current.status, "available");
  assert.deepEqual(caps.current.value.configured_sources.map((entry) => entry.entity_id),
    ["calendar.old"]);
  assert.equal(ha.activeEntitySubscriptions("calendar.old"), 1);
  assert.equal(ha.activeEntitySubscriptions("calendar.new"), 0);
  assert.equal(ha.activeConnectionSubscriptions(), 1);
  assert.equal(provider.destroy(), true);
  assert.equal(ha.activeEntitySubscriptions(), 0);
  assert.equal(ha.activeConnectionSubscriptions(), 0);
});
