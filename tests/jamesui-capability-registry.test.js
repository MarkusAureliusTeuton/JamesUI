import test from "node:test";
import assert from "node:assert/strict";

import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";

function manifest(id, provides = [], requires = []) {
  return {
    id,
    type: "provider",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: requires,
    provides_capabilities: provides,
    config_schema: `${id}.schema.json`,
  };
}

function declaredRegistry() {
  const modules = createModuleRegistry();
  modules.register(manifest("provider.weather", ["weather.current"]), { entryUrl: "/weather.js" });
  modules.register(manifest("consumer.home", [], ["weather.current", "calendar.events"]), { entryUrl: "/home.js" });
  return modules;
}

test("declared provider registers unavailable and publishes immutable states", () => {
  const capabilities = createCapabilityRegistry({ moduleRegistry: declaredRegistry() });
  const provider = capabilities.register("provider.weather", "weather.current");

  assert.deepEqual(capabilities.get("weather.current"), {
    capability: "weather.current", status: "unavailable", value: null, reason: null, provider: "provider.weather",
  });
  assert.ok(Object.isFrozen(capabilities.get("weather.current")));

  assert.equal(provider.available({ temperature: 12 }), true);
  const available = capabilities.get("weather.current");
  assert.equal(available.status, "available");
  assert.deepEqual(available.value, { temperature: 12 });
  assert.ok(Object.isFrozen(available));

  assert.equal(provider.unavailable("offline"), true);
  assert.deepEqual(capabilities.get("weather.current"), {
    capability: "weather.current", status: "unavailable", value: null, reason: "offline", provider: "provider.weather",
  });

  assert.equal(provider.notConfigured("missing entity"), true);
  assert.deepEqual(capabilities.get("weather.current"), {
    capability: "weather.current", status: "not_configured", value: null, reason: "missing entity", provider: "provider.weather",
  });
});

test("rejects ownership mismatch and duplicate active provider atomically", () => {
  const capabilities = createCapabilityRegistry({ moduleRegistry: declaredRegistry() });
  assert.throws(() => capabilities.register("consumer.home", "weather.current"), /declaration owner/i);
  assert.equal(capabilities.get("weather.current").provider, null);

  capabilities.register("provider.weather", "weather.current");
  assert.throws(() => capabilities.register("provider.weather", "weather.current"), /already active/i);
  assert.equal(capabilities.get("weather.current").provider, "provider.weather");
});

test("unresolved required capabilities do not block runtime consumers", () => {
  const capabilities = createCapabilityRegistry({ moduleRegistry: declaredRegistry() });
  const seen = [];
  const stop = capabilities.subscribe("calendar.events", (snapshot) => seen.push(snapshot));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].status, "unavailable");
  assert.equal(seen[0].provider, null);
  stop();
});

test("subscription emits current state and unsubscribe is idempotent", () => {
  const capabilities = createCapabilityRegistry({ moduleRegistry: declaredRegistry() });
  const provider = capabilities.register("provider.weather", "weather.current");
  const seen = [];
  const stop = capabilities.subscribe("weather.current", (snapshot) => seen.push(snapshot.status));
  provider.available(1);
  stop();
  stop();
  provider.unavailable();
  assert.deepEqual(seen, ["unavailable", "available"]);
});

test("throwing subscriber is isolated and reported", () => {
  const errors = [];
  const capabilities = createCapabilityRegistry({
    moduleRegistry: declaredRegistry(),
    onSubscriberError: (entry) => errors.push(entry),
  });
  const provider = capabilities.register("provider.weather", "weather.current");
  let delivered = 0;
  capabilities.subscribe("weather.current", () => { throw new Error("listener boom"); }, { emitCurrent: false });
  capabilities.subscribe("weather.current", () => { delivered += 1; }, { emitCurrent: false });

  provider.available(2);
  assert.equal(delivered, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].capability, "weather.current");
  assert.match(errors[0].error.message, /listener boom/);
});

test("unregister publishes synthetic unavailable and invalidates stale handle", () => {
  const capabilities = createCapabilityRegistry({ moduleRegistry: declaredRegistry() });
  const provider = capabilities.register("provider.weather", "weather.current");
  const seen = [];
  capabilities.subscribe("weather.current", (snapshot) => seen.push(snapshot), { emitCurrent: false });
  provider.available({ temperature: 19 });
  assert.equal(provider.unregister(), true);

  const current = capabilities.get("weather.current");
  assert.deepEqual(current, {
    capability: "weather.current", status: "unavailable", value: null, reason: null, provider: null,
  });
  assert.equal(seen.at(-1).provider, null);
  assert.equal(seen.at(-1).value, null);
  assert.equal(provider.available(99), false);
  assert.equal(provider.unregister(), false);
});

test("destroy invalidates providers and clears runtime state", () => {
  const capabilities = createCapabilityRegistry({ moduleRegistry: declaredRegistry() });
  const provider = capabilities.register("provider.weather", "weather.current");
  provider.available(7);
  capabilities.destroy();
  assert.equal(provider.available(8), false);
  assert.deepEqual(capabilities.get("weather.current"), {
    capability: "weather.current", status: "unavailable", value: null, reason: null, provider: null,
  });
});
