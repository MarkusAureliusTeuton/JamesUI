import test from "node:test";
import assert from "node:assert/strict";

import { createActionRegistry } from "../custom_components/jamesui/frontend/core/action-registry.js";
import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { MANIFEST as CALENDAR_MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.calendar/manifest.js";
import { MANIFEST as TASKS_MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.tasks/manifest.js";
import { MANIFEST as TASK_UPDATE_MANIFEST } from "../custom_components/jamesui/frontend/modules/action.task-update/manifest.js";
import { MANIFEST as AGENDA_MANIFEST } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/manifest.js";
import { createFakeDocument } from "./helpers/fake-dom.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

const entries = new Map([
  [CALENDAR_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/provider.calendar/index.js", import.meta.url).href],
  [TASKS_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/provider.tasks/index.js", import.meta.url).href],
  [TASK_UPDATE_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/action.task-update/index.js", import.meta.url).href],
  [AGENDA_MANIFEST.id, new URL("../custom_components/jamesui/frontend/modules/widget.calendar-agenda/index.js", import.meta.url).href],
]);

const flush = () => new Promise((resolve) => setImmediate(resolve));

function measuredDocument() {
  const document = createFakeDocument();
  const createElement = document.createElement;
  document.createElement = (tagName) => {
    const element = createElement(tagName);
    element.getBoundingClientRect = () => {
      if (element.getAttribute("data-jui-agenda-row-probe") !== null) return { height: 60 };
      if (element.getAttribute("data-jui-agenda-header") !== null) return { height: 40 };
      if (element.getAttribute("data-jui-agenda-statuses") !== null) return { height: element.children.length ? 24 : 0 };
      if (element.getAttribute("data-jui-agenda-notices") !== null) return { height: element.children.length * 40 };
      if (element.getAttribute("data-jui-agenda-undo-region") !== null) return { height: element.children.length ? 32 : 0 };
      return { height: 420 };
    };
    return element;
  };
  return document;
}

function installBrowserRuntime() {
  const previous = {
    ResizeObserver: globalThis.ResizeObserver,
    localStorage: globalThis.localStorage,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  const timers = new Set();
  const storage = new Map();

  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); },
  };
  globalThis.setTimeout = (callback, milliseconds) => {
    const handle = { callback, milliseconds, active: true };
    timers.add(handle);
    return handle;
  };
  globalThis.clearTimeout = (handle) => {
    if (!handle) return;
    handle.active = false;
    timers.delete(handle);
  };

  return () => {
    if (previous.ResizeObserver === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = previous.ResizeObserver;
    if (previous.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous.localStorage;
    globalThis.setTimeout = previous.setTimeout;
    globalThis.clearTimeout = previous.clearTimeout;
  };
}

function subscriptionIndex(homeAssistant, type) {
  return homeAssistant.subscriptionCalls.findLastIndex((record) => record.active && record.message?.type === type);
}

function calendarState() {
  return { entity_id: "calendar.family", state: "off", attributes: { friendly_name: "Familie" } };
}

function todoState() {
  return {
    entity_id: "todo.home",
    state: "0",
    attributes: { friendly_name: "Haushalt", supported_features: 4 },
  };
}

const agendaConfig = Object.freeze({
  instance_id: "block11-integration",
  calendar_enabled: true,
  tasks_enabled: true,
  calendars: [{ entity_id: "calendar.family" }],
  task_lists: [{ entity_id: "todo.home" }],
});

test("all four Block 11 modules integrate through real registries and clean ownership on reload/destroy", async () => {
  const restoreBrowser = installBrowserRuntime();
  try {
    const registry = createModuleRegistry();
    registry.register(CALENDAR_MANIFEST, { entryUrl: entries.get(CALENDAR_MANIFEST.id) });
    registry.register(TASKS_MANIFEST, { entryUrl: entries.get(TASKS_MANIFEST.id) });
    registry.register(TASK_UPDATE_MANIFEST, { entryUrl: entries.get(TASK_UPDATE_MANIFEST.id) });
    registry.register(AGENDA_MANIFEST, { entryUrl: entries.get(AGENDA_MANIFEST.id) });

    assert.equal(registry.getCapabilityProvider("calendar.events"), CALENDAR_MANIFEST.id);
    assert.equal(registry.getCapabilityProvider("tasks.items"), TASKS_MANIFEST.id);

    const health = createHealthService();
    const capabilities = createCapabilityRegistry({ moduleRegistry: registry });
    const actions = createActionRegistry({ health });
    const overlays = createOverlayService();
    const homeAssistant = createFakeHomeAssistantAdapter({
      states: {
        "calendar.family": calendarState(),
        "todo.home": todoState(),
      },
    });
    const loader = createModuleLoader({
      registry,
      health,
      getContext: ({ id, manifest }) => {
        const common = {
          events: {},
          overlays,
          capabilities,
          actions,
          module: Object.freeze({ id, type: manifest.type, version: manifest.version }),
        };
        return Object.freeze(
          manifest.type === "provider" || manifest.type === "action"
            ? { ...common, homeAssistant }
            : common,
        );
      },
    });

    const calendarConfig = { source_entity_ids: ["calendar.family"] };
    const tasksConfig = { source_entity_ids: ["todo.home"] };

    assert.equal(await loader.load(CALENDAR_MANIFEST.id, { config: calendarConfig }), true);
    assert.equal(loader.mount(CALENDAR_MANIFEST.id, { kind: "provider" }), true);
    assert.equal(await loader.load(TASKS_MANIFEST.id, { config: tasksConfig }), true);
    assert.equal(loader.mount(TASKS_MANIFEST.id, { kind: "provider" }), true);
    assert.equal(await loader.load(TASK_UPDATE_MANIFEST.id, { config: {} }), true);
    assert.equal(loader.mount(TASK_UPDATE_MANIFEST.id, { kind: "action" }), true);
    assert.equal(actions.has("task.update"), true);

    await flush();
    const initialTodo = subscriptionIndex(homeAssistant, "todo/item/subscribe");
    assert.notEqual(initialTodo, -1);
    homeAssistant.emitSubscription(initialTodo, {
      items: [{ uid: "one", summary: "Eine Aufgabe", status: "needs_action" }],
    });
    await flush();
    assert.equal(capabilities.get("tasks.items").status, "available");

    const document = measuredDocument();
    const target = document.createElement("section");
    assert.equal(await loader.load(AGENDA_MANIFEST.id, { config: agendaConfig }), true);
    assert.equal(loader.mount(AGENDA_MANIFEST.id, target), true);

    await flush();
    const calendarSubscription = subscriptionIndex(homeAssistant, "calendar/event/subscribe");
    assert.notEqual(calendarSubscription, -1);
    homeAssistant.emitSubscription(calendarSubscription, {
      events: [{ start: "2020-01-01", end: "2035-01-01", summary: "Familientag" }],
    });
    await flush();

    const root = target.querySelector('[data-jui-widget="calendar-agenda"]');
    assert.ok(root);
    const titles = root.querySelectorAll('[data-jui-agenda-title=""]').map((node) => node.textContent);
    assert.ok(titles.includes("Familientag"));
    assert.ok(titles.includes("Eine Aufgabe"));

    const actionResult = await actions.execute({
      type: "task.update",
      source_entity_id: "todo.home",
      uid: "one",
      patch: { status: "completed" },
    });
    assert.equal(actionResult.status, "success");
    assert.deepEqual(homeAssistant.serviceCalls.at(-1), {
      domain: "todo",
      service: "update_item",
      data: { item: "one", status: "completed" },
      target: { entity_id: "todo.home" },
    });

    assert.equal(loader.update(CALENDAR_MANIFEST.id, calendarConfig), true);
    assert.equal(loader.update(TASKS_MANIFEST.id, tasksConfig), true);
    assert.equal(loader.update(TASK_UPDATE_MANIFEST.id, {}), true);
    assert.equal(loader.update(AGENDA_MANIFEST.id, agendaConfig), true);

    assert.equal(await loader.reload(CALENDAR_MANIFEST.id), true);
    await flush();
    const reloadedCalendar = subscriptionIndex(homeAssistant, "calendar/event/subscribe");
    assert.notEqual(reloadedCalendar, -1);
    homeAssistant.emitSubscription(reloadedCalendar, {
      events: [{ start: "2020-01-01", end: "2035-01-01", summary: "Familientag" }],
    });

    assert.equal(await loader.reload(TASKS_MANIFEST.id), true);
    await flush();
    const reloadedTodo = subscriptionIndex(homeAssistant, "todo/item/subscribe");
    assert.notEqual(reloadedTodo, -1);
    homeAssistant.emitSubscription(reloadedTodo, {
      items: [{ uid: "one", summary: "Eine Aufgabe", status: "needs_action" }],
    });
    await flush();

    assert.equal(await loader.reload(TASK_UPDATE_MANIFEST.id), true);
    assert.equal(actions.has("task.update"), true);
    assert.equal(await loader.reload(AGENDA_MANIFEST.id), true);
    assert.ok(target.querySelector('[data-jui-widget="calendar-agenda"]'));

    for (const manifest of [CALENDAR_MANIFEST, TASKS_MANIFEST, TASK_UPDATE_MANIFEST, AGENDA_MANIFEST]) {
      assert.equal(health.get(`module:${manifest.id}`), null);
    }

    assert.equal(loader.destroy(AGENDA_MANIFEST.id), true);
    assert.equal(loader.destroy(TASK_UPDATE_MANIFEST.id), true);
    assert.equal(loader.destroy(TASKS_MANIFEST.id), true);
    assert.equal(loader.destroy(CALENDAR_MANIFEST.id), true);
    await flush();

    assert.equal(actions.has("task.update"), false);
    assert.equal(capabilities.get("calendar.events").provider, null);
    assert.equal(capabilities.get("tasks.items").provider, null);
    assert.equal(target.querySelector('[data-jui-widget="calendar-agenda"]'), null);
    assert.equal(overlays.current, null);
    assert.equal(homeAssistant.subscriptionCalls.some((record) => record.active), false);

    actions.destroy();
    capabilities.destroy();
  } finally {
    restoreBrowser();
  }
});
