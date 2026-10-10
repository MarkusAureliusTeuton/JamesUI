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


test("Block 14 update serializes dashboard edits and preserves other sections", async () => {
  const ha = fakeHomeAssistant();
  ha.setHandler(async (message) => ({ config: message.config ?? config("initial") }));
  const service = createConfigService({ homeAssistant: ha });
  await service.load();
  const first = service.update((value) => {
    value.pages.start = { kind: "dashboard", elements: [] };
    return value;
  });
  const second = service.update((value) => {
    assert.ok(value.pages.start);
    value.layouts.start = { kind: "hero-deck" };
    return value;
  });
  await Promise.all([first, second]);
  assert.deepEqual(service.snapshot().pages.start, { kind: "dashboard", elements: [] });
  assert.deepEqual(service.snapshot().layouts.start, { kind: "hero-deck" });
  assert.equal(ha.calls.filter((call) => call.type === "jamesui/config/replace").length, 2);
});

test("Block 14 rejected update leaves last snapshot intact and queue operational", async () => {
  const ha = fakeHomeAssistant();
  ha.setHandler(async (msg) => msg.type === "jamesui/config/get"
    ? { config: config("safe") }
    : Promise.reject(new Error("backend refused")));
  const service = createConfigService({ homeAssistant: ha });
  await service.load();
  await assert.rejects(service.update((value) => {
    value.pages.home.label = "not-saved";
    return value;
  }), /backend refused/);
  assert.equal(service.snapshot().pages.home.label, "safe");
  assert.equal(await service.update(() => null), null);
  assert.equal(service.snapshot().pages.home.label, "safe");
});

test("Block 14 stale remote load cannot overwrite a newer replacement", async () => {
  const ha = fakeHomeAssistant();
  let finishLoad;
  ha.setHandler((message) => message.type === "jamesui/config/get"
    ? new Promise((resolve) => { finishLoad = resolve; })
    : Promise.resolve({ config: message.config }));
  const service = createConfigService({ homeAssistant: ha });
  const older = service.load();
  await service.replace(config("newer"));
  finishLoad({ config: config("stale") });
  await older;
  assert.equal(service.snapshot().pages.home.label, "newer");
});

test("cross-client stale config replacement is rejected and the earlier snapshot survives", async () => {
  let remote = config("initial");
  let sequence = 1;
  const revision = () => sequence.toString(16).padStart(64, "0");
  const messages = [];
  const ha = {
    async callWS(message) {
      messages.push(message);
      if (message.type === "jamesui/config/get") {
        return { config: structuredClone(remote), revision: revision() };
      }
      if (message.type !== "jamesui/config/replace") throw Error("unsupported");
      if (message.expected_revision !== revision()) throw Error("config_conflict");
      remote = structuredClone(message.config);
      sequence += 1;
      return { config: structuredClone(remote), revision: revision() };
    },
  };
  const a = createConfigService({ homeAssistant: ha });
  const b = createConfigService({ homeAssistant: ha });
  await a.load();
  await b.load();
  const first = a.snapshot();
  first.pages.home.label = "first-client";
  await a.replace(first);
  assert.equal(a.revision, revision());
  assert.match(messages.find((entry) => entry.type === "jamesui/config/replace").expected_revision,
    /^[a-f0-9]{64}$/);
  const stale = b.snapshot();
  stale.pages.home.label = "stale-second-client";
  await assert.rejects(() => b.replace(stale), /config_conflict/);
  assert.equal(remote.pages.home.label, "first-client");
  assert.equal(b.snapshot().pages.home.label, "initial");
  await b.load();
  const retry = b.snapshot();
  retry.pages.home.label = "reloaded-second-client";
  await b.replace(retry);
  assert.equal(remote.pages.home.label, "reloaded-second-client");
});

test("invalid backend revisions do not change the active snapshot", async () => {
  const ha = fakeHomeAssistant();
  const service = createConfigService({ homeAssistant: ha });
  ha.setHandler(async () => ({ config: config("good"), revision: "a".repeat(64) }));
  await service.load();
  ha.setHandler(async () => ({ config: config("bad"), revision: "not-a-hash" }));
  await assert.rejects(() => service.load(), /revision/);
  assert.equal(service.snapshot().pages.home.label, "good");
  assert.equal(service.revision, "a".repeat(64));
});
