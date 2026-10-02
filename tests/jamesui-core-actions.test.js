import test from "node:test";
import assert from "node:assert/strict";

import { createActionRegistry } from "../custom_components/jamesui/frontend/core/action-registry.js";
import { createRouter } from "../custom_components/jamesui/frontend/core/router.js";
import { registerCoreActionProviders } from "../custom_components/jamesui/frontend/core/core-action-providers.js";

test("registers only the two HA-independent Core action providers", async () => {
  const actions = createActionRegistry();
  const router = createRouter();
  const cleanup = registerCoreActionProviders({ actions, router, openUrl: () => true });

  assert.equal(actions.has("navigate"), true);
  assert.equal(actions.has("url.open"), true);
  for (const type of ["entity.toggle", "ha.service", "scene.activate"]) {
    assert.equal(actions.has(type), false);
    assert.equal((await actions.execute({ type })).status, "unavailable");
  }

  cleanup();
});

test("navigate changes the real Core Router and rejects unknown routes", async () => {
  const actions = createActionRegistry();
  const router = createRouter();
  registerCoreActionProviders({ actions, router, openUrl: () => true });

  const moved = await actions.execute({ type: "navigate", route: "house" });
  assert.equal(moved.status, "success");
  assert.equal(router.currentRouteId, "house");

  const invalid = await actions.execute({ type: "navigate", route: "missing" });
  assert.equal(invalid.status, "rejected");
  assert.equal(router.currentRouteId, "house");

  const malformed = await actions.execute({ type: "navigate", route: "" });
  assert.equal(malformed.status, "rejected");
  assert.equal(router.currentRouteId, "house");
});

test("url.open accepts absolute HTTP(S) URLs and uses only the injected opener", async () => {
  const actions = createActionRegistry();
  const router = createRouter();
  const opened = [];
  registerCoreActionProviders({ actions, router, openUrl: (url) => { opened.push(url); return true; } });

  assert.equal((await actions.execute({ type: "url.open", url: "https://example.com/path?q=1" })).status, "success");
  assert.equal((await actions.execute({ type: "url.open", url: "http://example.com" })).status, "success");
  assert.deepEqual(opened, ["https://example.com/path?q=1", "http://example.com"]);
});

test("url.open rejects malformed or unsafe schemes without invoking opener", async () => {
  const actions = createActionRegistry();
  const router = createRouter();
  let calls = 0;
  registerCoreActionProviders({ actions, router, openUrl: () => { calls += 1; return true; } });

  for (const url of ["", "/relative", "not a url", "javascript:alert(1)", "file:///tmp/test"]) {
    const result = await actions.execute({ type: "url.open", url });
    assert.equal(result.status, "rejected");
  }
  assert.equal(calls, 0);
});

test("url.open false result rejects and thrown opener failure normalizes through Action Registry", async () => {
  const router = createRouter();

  const rejectedActions = createActionRegistry();
  registerCoreActionProviders({ actions: rejectedActions, router, openUrl: () => false });
  assert.equal((await rejectedActions.execute({ type: "url.open", url: "https://example.com" })).status, "rejected");

  const failedActions = createActionRegistry();
  const boom = new Error("opener boom");
  registerCoreActionProviders({ actions: failedActions, router, openUrl: async () => { throw boom; } });
  const failed = await failedActions.execute({ type: "url.open", url: "https://example.com" });
  assert.equal(failed.status, "error");
  assert.equal(failed.error, boom);
});

test("cleanup unregisters both Core actions idempotently", async () => {
  const actions = createActionRegistry();
  const cleanup = registerCoreActionProviders({ actions, router: createRouter(), openUrl: () => true });
  assert.equal(cleanup(), true);
  assert.equal(cleanup(), false);
  assert.equal((await actions.execute({ type: "navigate", route: "home" })).status, "unavailable");
  assert.equal((await actions.execute({ type: "url.open", url: "https://example.com" })).status, "unavailable");
});
