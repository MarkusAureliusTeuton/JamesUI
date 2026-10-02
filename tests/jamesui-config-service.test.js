import test from "node:test";
import assert from "node:assert/strict";

import { createConfigService } from "../custom_components/jamesui/frontend/core/config-service.js";

function config(label = null) {
  return {
    schema_version: 1,
    pages: label ? { home: { label } } : {},
    layouts: {},
    widget_instances: {},
    dynamic_buttons: {},
    data_sources: {},
    module_settings: {},
  };
}

function fakeHomeAssistant() {
  const calls = [];
  let handler = async () => ({ config: config() });
  return {
    calls,
    setHandler(next) { handler = next; },
    async callWS(message) {
      calls.push(message);
      return handler(message);
    },
  };
}

test("starts unloaded and load fetches a detached canonical snapshot", async () => {
  const homeAssistant = fakeHomeAssistant();
  const source = config("loaded");
  homeAssistant.setHandler(async () => ({ config: source }));
  const service = createConfigService({ homeAssistant });

  assert.equal(service.snapshot(), null);
  const loaded = await service.load();
  assert.deepEqual(homeAssistant.calls, [{ type: "jamesui/config/get" }]);
  assert.deepEqual(loaded, source);
  assert.notEqual(loaded, source);

  source.pages.home.label = "mutated-source";
  loaded.pages.home.label = "mutated-return";
  assert.equal(service.snapshot().pages.home.label, "loaded");
});

test("replace posts full config and trusts only a valid config response shape", async () => {
  const homeAssistant = fakeHomeAssistant();
  const service = createConfigService({ homeAssistant });
  const replacement = config("replacement");
  homeAssistant.setHandler(async (message) => ({ config: message.config }));

  const result = await service.replace(replacement);
  assert.deepEqual(homeAssistant.calls, [{ type: "jamesui/config/replace", config: replacement }]);
  assert.deepEqual(result, replacement);
  replacement.pages.home.label = "outside";
  assert.equal(service.snapshot().pages.home.label, "replacement");
});

test("malformed load or replace responses reject without corrupting the previous snapshot", async () => {
  const homeAssistant = fakeHomeAssistant();
  const service = createConfigService({ homeAssistant });
  homeAssistant.setHandler(async () => ({ config: config("good") }));
  await service.load();

  for (const response of [null, {}, { config: null }, { config: [] }]) {
    homeAssistant.setHandler(async () => response);
    await assert.rejects(() => service.load(), /config response/i);
    assert.equal(service.snapshot().pages.home.label, "good");
  }

  homeAssistant.setHandler(async () => ({ nope: true }));
  await assert.rejects(() => service.replace(config("bad")), /config response/i);
  assert.equal(service.snapshot().pages.home.label, "good");
});

test("subscriptions emit current state, isolate failures and unsubscribe idempotently", async () => {
  const homeAssistant = fakeHomeAssistant();
  const service = createConfigService({ homeAssistant });
  homeAssistant.setHandler(async () => ({ config: config("first") }));
  await service.load();

  const seen = [];
  let siblingCalls = 0;
  const unsubscribe = service.subscribe((value) => seen.push(value.pages.home.label));
  service.subscribe(() => { throw new Error("subscriber boom"); });
  service.subscribe(() => { siblingCalls += 1; });

  homeAssistant.setHandler(async () => ({ config: config("second") }));
  await service.load();
  assert.deepEqual(seen, ["first", "second"]);
  assert.equal(siblingCalls, 2);
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
});

test("destroy clears subscribers and prevents future remote operations", async () => {
  const homeAssistant = fakeHomeAssistant();
  const service = createConfigService({ homeAssistant });
  homeAssistant.setHandler(async () => ({ config: config("loaded") }));
  await service.load();
  let calls = 0;
  service.subscribe(() => { calls += 1; });
  assert.equal(calls, 1);

  assert.equal(service.destroy(), true);
  assert.equal(service.destroy(), false);
  await assert.rejects(() => service.load(), /destroyed/i);
  await assert.rejects(() => service.replace(config("later")), /destroyed/i);
  assert.equal(homeAssistant.calls.length, 1);
});
