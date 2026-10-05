import test from "node:test";
import assert from "node:assert/strict";

import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { createCalendarAgendaWidget } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/widget.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const TASK_VALUE = Object.freeze({
  version: 1,
  time_zone: "Europe/Berlin",
  sources: Object.freeze({
    "todo.home": Object.freeze({
      status: "available",
      reason: null,
      name: "Haushalt",
      supported_features: 4,
      capabilities: Object.freeze({
        can_update: true,
        can_set_due_date: false,
        can_set_due_datetime: false,
        can_set_description: false,
      }),
      items: Object.freeze([]),
    }),
  }),
});

function config(instanceId) {
  return {
    instance_id: instanceId,
    calendar_enabled: false,
    tasks_enabled: true,
    calendars: [],
    task_lists: [{ entity_id: "todo.home" }],
  };
}

function context() {
  const snapshot = Object.freeze({
    capability: "tasks.items",
    status: "available",
    value: TASK_VALUE,
    reason: null,
    provider: "provider.tasks",
  });
  return {
    events: {},
    capabilities: {
      subscribe(capability, listener, { emitCurrent = true } = {}) {
        assert.equal(capability, "tasks.items");
        if (emitCurrent) listener(snapshot);
        return () => true;
      },
    },
    actions: { execute: async () => ({ status: "success" }) },
    overlays: createOverlayService(),
    module: { id: "widget.calendar-agenda", type: "widget", version: "1.0.0" },
  };
}

function runtime() {
  let storageReads = 0;
  const storage = {
    getItem() { storageReads += 1; return null; },
    setItem() {},
  };
  return {
    storage,
    storageReads: () => storageReads,
    now: () => new Date("2026-10-04T06:00:00Z"),
    setTimeout: () => ({ active: true }),
    clearTimeout() {},
    createResizeObserver: () => ({ observe() {}, disconnect() {} }),
    measureHeight(element) {
      if (element?.getAttribute?.("data-jui-agenda-row-probe") !== null) return 60;
      if (element?.getAttribute?.("data-jui-agenda-header") !== null) return 40;
      return 420;
    },
  };
}

test("same-instance update reuses dismissal store while an instance-id change creates a fresh scoped store", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const ctx = context();
  const clock = runtime();
  const widget = createCalendarAgendaWidget(ctx, config("agenda-a"), clock);

  widget.mount(target);
  assert.equal(clock.storageReads(), 1);

  widget.update(ctx, config("agenda-a"));
  assert.equal(clock.storageReads(), 1);

  widget.update(ctx, config("agenda-b"));
  assert.equal(clock.storageReads(), 2);
  widget.destroy();
});
