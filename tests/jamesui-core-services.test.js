import test from "node:test";
import assert from "node:assert/strict";

import { createEventBus } from "../custom_components/jamesui/frontend/core/event-bus.js";
import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";

test("event bus isolates listener failures and supports unsubscribe", () => {
  const errors = [];
  const received = [];
  const events = createEventBus({ onError: (failure) => errors.push(failure) });
  const boom = new Error("boom");
  events.on("core:test", () => { throw boom; });
  const unsubscribe = events.on("core:test", (detail) => received.push(detail));

  events.emit("core:test", { marker: 1 });
  assert.deepEqual(received, [{ marker: 1 }]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].type, "core:test");
  assert.equal(errors[0].error, boom);

  unsubscribe();
  events.emit("core:test", { marker: 2 });
  assert.deepEqual(received, [{ marker: 1 }]);
  events.clear();
});

test("overlay service protects a newer overlay from a stale close callback", () => {
  const overlays = createOverlayService();
  assert.throws(() => overlays.open({ title: "missing id" }), /id/i);
  assert.throws(() => overlays.open({ id: "", title: "empty id" }), /id/i);

  const closeFirst = overlays.open({ id: "first", title: "First" });
  overlays.open({ id: "second", title: "Second" });
  closeFirst();
  assert.equal(overlays.current.id, "second");
  assert.equal(overlays.close("unknown"), false);
  assert.equal(overlays.close("second"), true);
  assert.equal(overlays.current, null);
});

test("overlay subscribers see replacements and close events", () => {
  const overlays = createOverlayService();
  const seen = [];
  const unsubscribe = overlays.subscribe((current) => seen.push(current?.id ?? null));
  overlays.open({ id: "first" });
  overlays.open({ id: "second" });
  overlays.close("second");
  unsubscribe();
  overlays.open({ id: "third" });
  assert.deepEqual(seen, ["first", "second", null]);
});

test("health service updates keyed records without duplicates and cleans up", () => {
  const health = createHealthService();
  let notifications = 0;
  const unsubscribe = health.subscribe(() => { notifications += 1; });
  const error = new Error("broken");

  health.report("page:home", { status: "error", message: "first", error });
  health.report("page:home", { status: "ok", message: "recovered" });
  health.report("page:house", { status: "error" });

  assert.deepEqual(health.get("page:home"), {
    id: "page:home",
    status: "ok",
    message: "recovered",
    error: null,
  });
  assert.equal(health.list().length, 2);
  assert.equal(health.clear("page:home"), true);
  assert.equal(health.get("page:home"), null);
  assert.equal(health.clear("missing"), false);
  health.clearAll();
  assert.deepEqual(health.list(), []);

  const before = notifications;
  unsubscribe();
  health.report("after", { status: "ok" });
  assert.equal(notifications, before);
});
