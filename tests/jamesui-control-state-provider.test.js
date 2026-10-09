import test from "node:test";
import assert from "node:assert/strict";
import { createControlStateProvider } from "../custom_components/jamesui/frontend/modules/provider.control-state/provider.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function config() {
  return { sources: [
    { id: "garage", entity_id: "cover.garage", attribute: "position", active_values: [100], inactive_values: [0], intermediate: [{ id: "moving", values: [50] }] },
    { id: "mode", entity_id: "cover.garage", attribute: "mode", active_values: ["on"], inactive_values: ["off"], intermediate: [] },
  ] };
}

function capabilitiesHarness() {
  let snapshot = null;
  const listeners = [];
  return {
    register(_id, capability) {
      assert.equal(capability, "control.states");
      return {
        available(value) { snapshot = { status: "available", value }; listeners.forEach((fn) => fn(snapshot)); },
        unavailable(reason) { snapshot = { status: "unavailable", value: null, reason }; listeners.forEach((fn) => fn(snapshot)); },
        notConfigured(reason) { snapshot = { status: "not_configured", value: null, reason }; listeners.forEach((fn) => fn(snapshot)); },
        unregister() { snapshot = null; return true; },
      };
    },
    get snapshot() { return snapshot; },
  };
}

function fakeHomeAssistant() {
  const states = new Map([["cover.garage", { state: "open", attributes: { position: 0, mode: "off", unrelated: 1 } }]]);
  const entityListeners = new Map();
  const connectionListeners = new Set();
  let connection = "connected";
  let subscribeCalls = 0;
  return {
    connectionState: () => connection,
    getState: (id) => states.get(id) ?? null,
    subscribeEntity(id, listener, { emitCurrent = true } = {}) {
      subscribeCalls += 1;
      if (!entityListeners.has(id)) entityListeners.set(id, new Set());
      entityListeners.get(id).add(listener);
      if (emitCurrent) listener(states.get(id) ?? null);
      let active = true;
      return () => { if (!active) return false; active = false; entityListeners.get(id)?.delete(listener); return true; };
    },
    subscribeConnection(listener, { emitCurrent = true } = {}) {
      connectionListeners.add(listener);
      if (emitCurrent) listener(connection);
      let active = true;
      return () => { if (!active) return false; active = false; connectionListeners.delete(listener); return true; };
    },
    setEntity(id, next) { states.set(id, next); for (const fn of [...(entityListeners.get(id) ?? [])]) fn(next); },
    setConnection(next) { connection = next; for (const fn of [...connectionListeners]) fn(next); },
    activeEntitySubscriptions() { return [...entityListeners.values()].reduce((n, s) => n + s.size, 0); },
    get subscribeCalls() { return subscribeCalls; },
  };
}

function context(caps, ha) { return { capabilities: caps, homeAssistant: ha }; }

test("shares entity subscription and advances revisions only on relevant normalized changes", () => {
  const caps = capabilitiesHarness(); const ha = fakeHomeAssistant();
  const provider = createControlStateProvider(context(caps, ha), config());
  assert.equal(provider.mount({ kind: "provider" }), true);
  const service = caps.snapshot.value;
  const emissions = [];
  const release = service.subscribe({ source_ids: ["garage", "mode"] }, (payload) => emissions.push(payload));
  assert.equal(ha.activeEntitySubscriptions(), 1);
  assert.equal(ha.subscribeCalls, 1);
  assert.deepEqual(emissions.at(-1).states.map((s) => [s.source_id, s.status, s.revision]), [["garage", "inactive", 0], ["mode", "inactive", 0]]);

  ha.setEntity("cover.garage", { state: "open", attributes: { position: 0, mode: "off", unrelated: 2 } });
  assert.equal(emissions.length, 1, "unrelated attribute change is not fresh feedback");
  ha.setEntity("cover.garage", { state: "open", attributes: { position: 50, mode: "off", unrelated: 2 } });
  assert.equal(emissions.at(-1).states[0].revision, 1);
  assert.equal(emissions.at(-1).states[0].status, "intermediate");
  const beforeBothChange = emissions.length;
  ha.setEntity("cover.garage", { state: "open", attributes: { position: 100, mode: "on", unrelated: 2 } });
  assert.equal(emissions.length, beforeBothChange + 1, "one HA event emits one coherent consumer snapshot");
  assert.deepEqual(emissions.at(-1).states.map((s) => [s.status, s.revision]), [["active", 2], ["active", 1]]);
  release();
  assert.equal(ha.activeEntitySubscriptions(), 0);
  provider.destroy();
});

test("shares source records across consumers and isolates listener errors", () => {
  const caps = capabilitiesHarness(); const ha = fakeHomeAssistant();
  const provider = createControlStateProvider(context(caps, ha), config()); provider.mount({});
  const service = caps.snapshot.value;
  let healthy = 0;
  const a = service.subscribe({ source_ids: ["garage"] }, () => { throw new Error("consumer"); });
  const b = service.subscribe({ source_ids: ["garage"] }, () => { healthy += 1; });
  assert.equal(ha.activeEntitySubscriptions(), 1);
  ha.setEntity("cover.garage", { state: "open", attributes: { position: 100, mode: "off" } });
  assert.equal(healthy, 2);
  a(); b(); provider.destroy();
});

test("replaces generation on connection change and makes old service stale", () => {
  const caps = capabilitiesHarness(); const ha = fakeHomeAssistant();
  const provider = createControlStateProvider(context(caps, ha), config()); provider.mount({});
  const oldService = caps.snapshot.value;
  const release = oldService.subscribe({ source_ids: ["garage"] }, () => {});
  ha.setConnection("disconnected");
  assert.equal(caps.snapshot.status, "unavailable");
  assert.throws(() => oldService.subscribe({ source_ids: ["garage"] }, () => {}), /stale/);
  ha.setConnection("connected");
  assert.equal(caps.snapshot.status, "available");
  assert.notEqual(caps.snapshot.value, oldService);
  release(); provider.destroy();
});

test("publishes not configured and validates subscriptions", () => {
  const caps = capabilitiesHarness(); const ha = fakeHomeAssistant();
  const provider = createControlStateProvider(context(caps, ha), { sources: [] }); provider.mount({});
  assert.equal(caps.snapshot.status, "not_configured"); provider.destroy();

  const caps2 = capabilitiesHarness(); const p2 = createControlStateProvider(context(caps2, ha), config()); p2.mount({});
  const service = caps2.snapshot.value;
  assert.throws(() => service.subscribe({ source_ids: [] }, () => {}), /source_ids/);
  assert.throws(() => service.subscribe({ source_ids: ["missing"] }, () => {}), /not configured/);
  p2.destroy();
});

test("mounted update validates before rebind and destroy releases runtime", async () => {
  const caps = capabilitiesHarness(); const ha = fakeHomeAssistant();
  const provider = createControlStateProvider(context(caps, ha), config()); provider.mount({});
  const service = caps.snapshot.value;
  service.subscribe({ source_ids: ["garage"] }, () => {});
  assert.equal(ha.activeEntitySubscriptions(), 1);
  assert.throws(() => provider.update(context(caps, ha), { sources: [{ id: "bad", entity_id: "", active_values: [1], inactive_values: [0] }] }), /entity_id/);
  assert.equal(caps.snapshot.value, service);
  assert.equal(provider.destroy(), true);
  assert.equal(ha.activeEntitySubscriptions(), 0);
  assert.equal(provider.destroy(), false);
  await flush();
});
