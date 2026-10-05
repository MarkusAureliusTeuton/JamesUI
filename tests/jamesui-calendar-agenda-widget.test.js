import test from "node:test";
import assert from "node:assert/strict";

import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { createCalendarAgendaWidget, UNDO_DURATION_MS } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/widget.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const TZ = "Europe/Berlin";

const available = (capability, value, provider) => ({ capability, status: "available", value, reason: null, provider });
const unavailable = (capability, reason = null) => ({ capability, status: "unavailable", value: null, reason, provider: null });

function timed(title, start, end) {
  return {
    occurrence_id: `calendar.family:${title}:${start}`,
    source_entity_id: "calendar.family",
    title,
    description: null,
    location: null,
    all_day: false,
    start_date: null,
    end_date: null,
    start_at: start,
    end_at: end,
  };
}

function task(uid, title, status = "needs_action", due = { kind: "none", value: null }) {
  return { source_entity_id: "todo.home", uid, title, status, due, description: null, completed_at: null };
}

function calendarService(events = []) {
  const listeners = new Set();
  const subscriptions = [];
  const unsubscriptions = [];
  const service = Object.freeze({
    version: 1,
    time_zone: TZ,
    configured_sources: Object.freeze([{ entity_id: "calendar.family", name: "Familie" }]),
    subscribe_ranges(request, listener) {
      subscriptions.push(request);
      listeners.add(listener);
      listener(Object.freeze({
        time_zone: TZ,
        sources: Object.freeze({
          "calendar.family": Object.freeze({ status: "available", reason: null, events: Object.freeze([...events]) }),
        }),
      }));
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        listeners.delete(listener);
        unsubscriptions.push(request);
        return true;
      };
    },
  });
  return {
    service,
    subscriptions,
    unsubscriptions,
    publish(nextEvents) {
      const snapshot = Object.freeze({
        time_zone: TZ,
        sources: Object.freeze({
          "calendar.family": Object.freeze({ status: "available", reason: null, events: Object.freeze([...nextEvents]) }),
        }),
      });
      for (const listener of [...listeners]) listener(snapshot);
    },
  };
}

function tasksValue(items = []) {
  return Object.freeze({
    version: 1,
    time_zone: TZ,
    sources: Object.freeze({
      "todo.home": Object.freeze({
        status: "available",
        reason: null,
        name: "Haushalt",
        supported_features: 116,
        capabilities: Object.freeze({
          can_update: true,
          can_set_due_date: true,
          can_set_due_datetime: true,
          can_set_description: true,
        }),
        items: Object.freeze([...items]),
      }),
    }),
  });
}

function fakeCapabilities(calendar, items = []) {
  const snapshots = new Map([
    ["calendar.events", available("calendar.events", calendar.service, "provider.calendar")],
    ["tasks.items", available("tasks.items", tasksValue(items), "provider.tasks")],
  ]);
  const listeners = new Map();
  const subscriptions = [];
  const unsubscriptions = [];
  return {
    subscriptions,
    unsubscriptions,
    get(capability) { return snapshots.get(capability) ?? unavailable(capability); },
    subscribe(capability, listener, { emitCurrent = true } = {}) {
      subscriptions.push(capability);
      if (!listeners.has(capability)) listeners.set(capability, new Set());
      listeners.get(capability).add(listener);
      if (emitCurrent) listener(this.get(capability));
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        listeners.get(capability)?.delete(listener);
        unsubscriptions.push(capability);
        return true;
      };
    },
    publish(capability, snapshot) {
      snapshots.set(capability, snapshot);
      for (const listener of [...(listeners.get(capability) ?? [])]) listener(snapshot);
    },
  };
}

function fakeActions() {
  const calls = [];
  const queued = [];
  return {
    calls,
    queue(result) { queued.push(result); },
    async execute(action) {
      calls.push(action);
      const next = queued.length ? queued.shift() : { status: "success", type: action.type, value: null, error: null };
      return typeof next === "function" ? next(action) : next;
    },
  };
}

function fakeRuntime(initial = "2026-10-04T06:00:00Z", { hostHeight = 420, rowHeight = 60 } = {}) {
  let current = new Date(initial);
  const scheduled = [];
  const cleared = [];
  const observers = [];
  const storageData = new Map();
  const storage = {
    getItem(key) { return storageData.get(key) ?? null; },
    setItem(key, value) { storageData.set(key, String(value)); },
  };
  return {
    scheduled,
    cleared,
    observers,
    storage,
    now: () => new Date(current),
    setNow(value) { current = new Date(value); },
    setTimeout(callback, ms) { const handle = { callback, ms, active: true }; scheduled.push(handle); return handle; },
    clearTimeout(handle) { if (handle?.active) { handle.active = false; cleared.push(handle); } },
    createResizeObserver(callback) {
      const observer = {
        active: true,
        observe() {},
        disconnect() { this.active = false; },
        trigger() { if (this.active) callback(); },
      };
      observers.push(observer);
      return observer;
    },
    measureHeight(element) {
      if (element?.getAttribute?.("data-jui-agenda-row-probe") !== null) return rowHeight;
      if (element?.getAttribute?.("data-jui-agenda-header") !== null) return 40;
      if (element?.getAttribute?.("data-jui-agenda-statuses") !== null) return element.children.length ? 24 : 0;
      if (element?.getAttribute?.("data-jui-agenda-notices") !== null) return element.children.length * 40;
      if (element?.getAttribute?.("data-jui-agenda-undo-region") !== null) return element.children.length ? 32 : 0;
      return hostHeight;
    },
  };
}

function agendaConfig(overrides = {}) {
  return {
    instance_id: "agenda-a",
    calendar_enabled: true,
    tasks_enabled: true,
    calendars: [{ entity_id: "calendar.family" }],
    task_lists: [{ entity_id: "todo.home" }],
    ...overrides,
  };
}

function context(capabilities, actions, overlays = createOverlayService()) {
  return {
    events: {}, capabilities, actions, overlays,
    module: { id: "widget.calendar-agenda", type: "widget", version: "1.0.0" },
  };
}

function mountFixture({ config = agendaConfig(), events = [], items = [], runtime = fakeRuntime() } = {}) {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const calendar = calendarService(events);
  const capabilities = fakeCapabilities(calendar, items);
  const actions = fakeActions();
  const overlays = createOverlayService();
  const widget = createCalendarAgendaWidget(context(capabilities, actions, overlays), config, runtime);
  widget.mount(target);
  return { document, target, calendar, capabilities, actions, overlays, runtime, widget };
}

test("mount binds enabled capabilities, subscribes absolute calendar range and renders stable Agenda rows", () => {
  const fixture = mountFixture({
    events: [timed("Termin", "2026-10-04T08:00:00Z", "2026-10-04T09:00:00Z")],
    items: [task("a", "Aufgabe")],
  });
  const root = fixture.target.querySelector('[data-jui-widget="calendar-agenda"]');
  assert.ok(root);
  assert.deepEqual(fixture.capabilities.subscriptions, ["calendar.events", "tasks.items"]);
  assert.deepEqual(fixture.calendar.subscriptions, [{ ranges: [{ entity_id: "calendar.family", start_date: "2026-10-04", end_date: "2026-11-04" }] }]);
  assert.deepEqual(root.querySelectorAll("[data-jui-agenda-row]").map((row) => row.getAttribute("data-jui-agenda-kind")), ["event", "task"]);
  assert.deepEqual(root.querySelectorAll('[data-jui-agenda-title=""]').map((node) => node.textContent), ["Termin", "Aufgabe"]);
  assert.equal(fixture.runtime.observers.length, 1);
  assert.equal(fixture.runtime.scheduled.filter((entry) => entry.active).length, 1);
  fixture.widget.destroy();
});

test("disabled domains do not subscribe to their capability or calendar range", () => {
  const taskOnly = mountFixture({ config: agendaConfig({ calendar_enabled: false, calendars: [] }), items: [task("a", "Task")] });
  assert.deepEqual(taskOnly.capabilities.subscriptions, ["tasks.items"]);
  assert.equal(taskOnly.calendar.subscriptions.length, 0);
  taskOnly.widget.destroy();

  const calendarOnly = mountFixture({ config: agendaConfig({ tasks_enabled: false, task_lists: [] }) });
  assert.deepEqual(calendarOnly.capabilities.subscriptions, ["calendar.events"]);
  assert.equal(calendarOnly.calendar.subscriptions.length, 1);
  calendarOnly.widget.destroy();
});

test("day navigation buttons and swipe change exactly one day within configured bounds", () => {
  const fixture = mountFixture({ config: agendaConfig({ presentation_mode: "day", lookback_days: 1, lookahead_days: 2 }) });
  const root = fixture.target.querySelector('[data-jui-widget="calendar-agenda"]');
  assert.match(root.querySelector('[data-jui-agenda-header-label=""]').textContent, /^Heute/);
  const next = root.querySelector('[data-jui-agenda-day-nav="next"]');
  next.dispatchEvent({ type: "click", target: next });
  assert.match(root.querySelector('[data-jui-agenda-header-label=""]').textContent, /^Mo, 5\. Oktober/);

  const scroll = root.querySelector('[data-jui-agenda-scroll=""]');
  scroll.dispatchEvent({ type: "pointerdown", clientX: 100, clientY: 50, target: scroll });
  scroll.dispatchEvent({ type: "pointermove", clientX: 160, clientY: 52, target: scroll });
  scroll.dispatchEvent({ type: "pointerup", clientX: 160, clientY: 52, target: scroll });
  assert.match(root.querySelector('[data-jui-agenda-header-label=""]').textContent, /^Heute/);
  fixture.widget.destroy();
});

test("completion uses semantic action, hides successful task and exposes exact five-second status-only Undo", async () => {
  assert.equal(UNDO_DURATION_MS, 5000);
  const fixture = mountFixture({ items: [task("a", "Aufgabe")] });
  const root = fixture.target.querySelector('[data-jui-widget="calendar-agenda"]');
  const complete = root.querySelector('[data-jui-agenda-complete=""]');
  complete.dispatchEvent({ type: "click", target: complete });
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(fixture.actions.calls[0], {
    type: "task.update",
    source_entity_id: "todo.home",
    uid: "a",
    patch: { status: "completed" },
  });
  assert.equal(root.querySelectorAll('[data-jui-agenda-title=""]').some((node) => node.textContent === "Aufgabe"), false);
  const undo = root.querySelector('[data-jui-agenda-undo=""]');
  assert.ok(undo);
  const undoTimer = fixture.runtime.scheduled.find((entry) => entry.active && entry.ms === 5000);
  assert.ok(undoTimer);

  undo.dispatchEvent({ type: "click", target: undo });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(fixture.actions.calls[1], {
    type: "task.update",
    source_entity_id: "todo.home",
    uid: "a",
    patch: { status: "needs_action" },
  });
  assert.equal(root.querySelector('[data-jui-agenda-undo=""]'), null);
  fixture.widget.destroy();
});

test("failed completion does not hide task and external completion wins an in-flight failure race", async () => {
  const fixture = mountFixture({ items: [task("a", "Aufgabe")] });
  let resolveAction;
  fixture.actions.queue(() => new Promise((resolve) => { resolveAction = resolve; }));
  const root = fixture.target.querySelector('[data-jui-widget="calendar-agenda"]');
  root.querySelector('[data-jui-agenda-complete=""]').dispatchEvent({ type: "click" });

  fixture.capabilities.publish("tasks.items", available("tasks.items", tasksValue([task("a", "Aufgabe", "completed")]), "provider.tasks"));
  assert.equal(root.querySelectorAll("[data-jui-agenda-row]").length, 0);
  resolveAction({ status: "error", type: "task.update", value: null, error: new Error("boom") });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(root.querySelectorAll("[data-jui-agenda-row]").length, 0);
  assert.match(root.querySelector('[data-jui-agenda-action-feedback=""]').textContent, /nicht gespeichert/i);
  fixture.widget.destroy();
});

test("source notices and empty state stay distinct from unavailable capability", () => {
  const fixture = mountFixture();
  const root = fixture.target.querySelector('[data-jui-widget="calendar-agenda"]');
  assert.equal(root.querySelector('[data-jui-agenda-empty=""]').textContent, "Keine Termine oder Aufgaben");

  fixture.capabilities.publish("tasks.items", available("tasks.items", Object.freeze({
    version: 1,
    time_zone: TZ,
    sources: Object.freeze({
      "todo.home": Object.freeze({ status: "unavailable", reason: "source_unavailable", name: "Haushalt", supported_features: 0, capabilities: {}, items: [] }),
    }),
  }), "provider.tasks"));
  assert.equal(root.querySelector('[data-jui-agenda-source-notice=""]').textContent, "Haushalt derzeit nicht verfügbar");
  fixture.widget.destroy();
});

test("too-small host never renders partial rows", () => {
  const runtime = fakeRuntime("2026-10-04T06:00:00Z", { hostHeight: 70, rowHeight: 60 });
  const fixture = mountFixture({ runtime, items: [task("a", "Aufgabe")] });
  const root = fixture.target.querySelector('[data-jui-widget="calendar-agenda"]');
  assert.ok(root.querySelector('[data-jui-agenda-too-small=""]'));
  assert.equal(root.querySelectorAll("[data-jui-agenda-row]").length, 0);
  fixture.widget.destroy();
});

test("event and task rows open instance-owned overlays and destroy never closes a newer unrelated overlay", () => {
  const fixture = mountFixture({
    events: [timed("Termin", "2026-10-04T08:00:00Z", "2026-10-04T09:00:00Z")],
    items: [task("a", "Aufgabe")],
  });
  const rows = fixture.target.querySelectorAll("[data-jui-agenda-row-button]");
  const taskButton = rows.find((node) => node.getAttribute("data-jui-agenda-row-kind") === "task");
  taskButton.dispatchEvent({ type: "click", target: taskButton });
  assert.equal(fixture.overlays.current.id, "calendar-agenda:agenda-a:task:todo.home:a");

  const unrelated = fixture.document.createElement("div");
  fixture.overlays.open({ id: "unrelated", content: unrelated });
  fixture.widget.destroy();
  assert.equal(fixture.overlays.current.id, "unrelated");
});

test("two direct widget instances isolate day selection, completion state and overlays", () => {
  const document = createFakeDocument();
  const targetA = document.createElement("div");
  const targetB = document.createElement("div");
  const calendar = calendarService([]);
  const capabilities = fakeCapabilities(calendar, [task("a", "Aufgabe")]);
  const actions = fakeActions();
  const overlays = createOverlayService();
  const runtimeA = fakeRuntime();
  const runtimeB = fakeRuntime();
  const widgetA = createCalendarAgendaWidget(context(capabilities, actions, overlays), agendaConfig({ instance_id: "left", presentation_mode: "day" }), runtimeA);
  const widgetB = createCalendarAgendaWidget(context(capabilities, actions, overlays), agendaConfig({ instance_id: "right", presentation_mode: "day" }), runtimeB);
  widgetA.mount(targetA);
  widgetB.mount(targetB);

  targetA.querySelector('[data-jui-agenda-day-nav="next"]').dispatchEvent("click");
  assert.match(targetA.querySelector('[data-jui-agenda-header-label=""]').textContent, /^Mo/);
  assert.match(targetB.querySelector('[data-jui-agenda-header-label=""]').textContent, /^Heute/);

  targetB.querySelector('[data-jui-agenda-row-button]').dispatchEvent("click");
  assert.equal(overlays.current.id, "calendar-agenda:right:task:todo.home:a");
  widgetA.destroy();
  assert.equal(overlays.current.id, "calendar-agenda:right:task:todo.home:a");
  widgetB.destroy();
});

test("destroy drains capabilities/ranges/observer/timer and late async callbacks are inert", () => {
  const fixture = mountFixture({ items: [task("a", "Aufgabe")] });
  const root = fixture.target.querySelector('[data-jui-widget="calendar-agenda"]');
  const activeTimer = fixture.runtime.scheduled.find((entry) => entry.active);
  assert.equal(fixture.widget.destroy(), true);
  assert.equal(fixture.widget.destroy(), false);
  assert.deepEqual(fixture.capabilities.unsubscriptions.sort(), ["calendar.events", "tasks.items"]);
  assert.equal(fixture.calendar.unsubscriptions.length, 1);
  assert.equal(fixture.runtime.observers[0].active, false);
  assert.equal(fixture.target.querySelector('[data-jui-widget="calendar-agenda"]'), null);
  activeTimer?.callback();
  assert.equal(root.parentNode, null);
});
