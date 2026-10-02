import test from "node:test";
import assert from "node:assert/strict";

import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import {
  ACTION_RESULT_STATUSES,
  createActionRegistry,
} from "../custom_components/jamesui/frontend/core/action-registry.js";

test("exports exactly the normalized action result statuses", () => {
  assert.deepEqual(ACTION_RESULT_STATUSES, ["success", "unavailable", "rejected", "error"]);
  assert.ok(Object.isFrozen(ACTION_RESULT_STATUSES));
});

test("registers one provider per action type and unregisters idempotently", async () => {
  const actions = createActionRegistry();
  const stop = actions.register("demo.run", () => ({ status: "success", value: 1 }));
  assert.equal(actions.has("demo.run"), true);
  assert.throws(() => actions.register("demo.run", () => ({ status: "success" })), /already registered/i);
  assert.equal(stop(), true);
  assert.equal(stop(), false);
  assert.equal(actions.has("demo.run"), false);
  assert.equal((await actions.execute({ type: "demo.run" })).status, "unavailable");
});

test("rejects malformed action input without invoking a provider", async () => {
  const actions = createActionRegistry();
  let calls = 0;
  actions.register("demo.run", () => { calls += 1; return { status: "success" }; });
  for (const action of [null, [], {}, { type: "" }, { type: 42 }]) {
    const result = await actions.execute(action);
    assert.equal(result.status, "rejected");
    assert.equal(result.value, null);
    assert.equal(result.error, null);
    assert.ok(Object.isFrozen(result));
  }
  assert.equal(calls, 0);
});

test("unknown action type returns normalized unavailable", async () => {
  const actions = createActionRegistry();
  assert.deepEqual(await actions.execute({ type: "missing.action" }), {
    status: "unavailable", type: "missing.action", value: null, error: null,
  });
});

test("normalizes synchronous and asynchronous provider results", async () => {
  const actions = createActionRegistry();
  actions.register("sync.ok", (_action, context) => ({ status: "success", value: context.marker }));
  actions.register("async.ok", async () => ({ status: "success", value: 7 }));
  actions.register("explicit.no", () => ({ status: "unavailable", value: "offline" }));
  actions.register("explicit.reject", () => ({ status: "rejected", value: "invalid" }));

  assert.deepEqual(await actions.execute({ type: "sync.ok" }, { marker: 3 }), {
    status: "success", type: "sync.ok", value: 3, error: null,
  });
  assert.equal((await actions.execute({ type: "async.ok" })).value, 7);
  assert.equal((await actions.execute({ type: "explicit.no" })).status, "unavailable");
  assert.equal((await actions.execute({ type: "explicit.reject" })).status, "rejected");
});

test("provider failures normalize to error health and later success clears it", async () => {
  const health = createHealthService();
  const actions = createActionRegistry({ health });
  const boom = new Error("provider boom");
  let fail = true;
  actions.register("demo.flaky", async () => {
    if (fail) throw boom;
    return { status: "success", value: "recovered" };
  });

  const failed = await actions.execute({ type: "demo.flaky" });
  assert.equal(failed.status, "error");
  assert.equal(failed.error, boom);
  assert.equal(health.get("action:demo.flaky").status, "error");

  fail = false;
  const recovered = await actions.execute({ type: "demo.flaky" });
  assert.equal(recovered.status, "success");
  assert.equal(health.get("action:demo.flaky"), null);
});

test("malformed provider result normalizes to error", async () => {
  const actions = createActionRegistry();
  actions.register("bad.result", () => ({ value: 1 }));
  const result = await actions.execute({ type: "bad.result" });
  assert.equal(result.status, "error");
  assert.ok(result.error instanceof TypeError);
  assert.equal(result.value, null);
});

test("HA-backed action identifiers work only through explicitly registered fake providers", async () => {
  const actions = createActionRegistry();
  for (const type of ["entity.toggle", "ha.service", "scene.activate"]) {
    assert.equal((await actions.execute({ type })).status, "unavailable");
    actions.register(type, (action) => ({ status: "success", value: { fake: true, type: action.type } }));
    const result = await actions.execute({ type });
    assert.equal(result.status, "success");
    assert.deepEqual(result.value, { fake: true, type });
  }
});

test("destroy removes every registered provider", async () => {
  const actions = createActionRegistry();
  actions.register("one", () => ({ status: "success" }));
  actions.register("two", () => ({ status: "success" }));
  actions.destroy();
  assert.equal(actions.has("one"), false);
  assert.equal((await actions.execute({ type: "one" })).status, "unavailable");
  assert.equal((await actions.execute({ type: "two" })).status, "unavailable");
});
