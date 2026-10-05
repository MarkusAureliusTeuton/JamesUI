import test from "node:test";
import assert from "node:assert/strict";

import { createActionRegistry } from "../custom_components/jamesui/frontend/core/action-registry.js";
import { createTaskUpdateAction } from "../custom_components/jamesui/frontend/modules/action.task-update/action.js";
import {
  SET_DESCRIPTION,
  SET_DUE_DATE,
  SET_DUE_DATETIME,
  UPDATE_TODO_ITEM,
} from "../custom_components/jamesui/frontend/shared/todo-features.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

function todo(entityId, supportedFeatures = UPDATE_TODO_ITEM | SET_DUE_DATE | SET_DUE_DATETIME | SET_DESCRIPTION) {
  return { entity_id: entityId, state: "0", attributes: { supported_features: supportedFeatures } };
}

function setup({ supportedFeatures, connected = true } = {}) {
  const actions = createActionRegistry();
  const homeAssistant = createFakeHomeAssistantAdapter({
    connectionState: connected ? "connected" : "disconnected",
    states: connected ? { "todo.home": todo("todo.home", supportedFeatures) } : {},
  });
  const module = createTaskUpdateAction({ actions, homeAssistant }, {});
  module.mount(null);
  return { actions, homeAssistant, module };
}

const action = (patch, extra = {}) => ({
  type: "task.update",
  source_entity_id: "todo.home",
  uid: "task-1",
  patch,
  ...extra,
});

test("rejects malformed source uid patch fields and values before Home Assistant calls", async () => {
  const { actions, homeAssistant, module } = setup();
  const cases = [
    { ...action({ title: "x" }), source_entity_id: "calendar.bad" },
    { ...action({ title: "x" }), uid: "   " },
    action({}),
    action({ unknown: true }),
    action({ title: "   " }),
    action({ status: "cancelled" }),
    action({ due: { kind: "date", value: "2026-02-30" } }),
    action({ due: { kind: "datetime", value: "2026-10-06T18:30:00" } }),
    action({ due: { kind: "none", value: "x" } }),
    action({ description: 42 }),
  ];
  for (const candidate of cases) {
    const result = await actions.execute(candidate);
    assert.equal(result.status, "rejected");
  }
  assert.equal(homeAssistant.serviceCalls.length, 0);
  assert.equal(homeAssistant.wsCalls.length, 0);
  module.destroy();
});

test("translates combined supported patch to todo.update_item using UID selector and entity target", async () => {
  const { actions, homeAssistant, module } = setup();
  homeAssistant.setServiceResult({ ok: true });
  const result = await actions.execute(action({
    title: " Neue Aufgabe ",
    status: "completed",
    due: { kind: "date", value: "2026-10-06" },
    description: "Hinweis",
  }));
  assert.equal(result.status, "success");
  assert.deepEqual(homeAssistant.serviceCalls, [{
    domain: "todo",
    service: "update_item",
    data: {
      item: "task-1",
      rename: "Neue Aufgabe",
      status: "completed",
      due_date: "2026-10-06",
      description: "Hinweis",
    },
    target: { entity_id: "todo.home" },
  }]);
  module.destroy();
});

test("uses due_datetime only for timezone-aware datetime and enforces matching feature bit", async () => {
  const full = setup();
  let result = await full.actions.execute(action({ due: { kind: "datetime", value: "2026-10-06T18:30:00+02:00" } }));
  assert.equal(result.status, "success");
  assert.equal(full.homeAssistant.serviceCalls[0].data.due_datetime, "2026-10-06T18:30:00+02:00");
  assert.equal(Object.hasOwn(full.homeAssistant.serviceCalls[0].data, "due_date"), false);
  full.module.destroy();

  const dateOnly = setup({ supportedFeatures: UPDATE_TODO_ITEM | SET_DUE_DATE });
  result = await dateOnly.actions.execute(action({ due: { kind: "datetime", value: "2026-10-06T18:30:00+02:00" } }));
  assert.equal(result.status, "rejected");
  assert.equal(dateOnly.homeAssistant.serviceCalls.length, 0);
  dateOnly.module.destroy();
});

test("requires update and description features before service execution", async () => {
  const noUpdate = setup({ supportedFeatures: SET_DESCRIPTION });
  assert.equal((await noUpdate.actions.execute(action({ title: "Neu" }))).status, "rejected");
  noUpdate.module.destroy();

  const noDescription = setup({ supportedFeatures: UPDATE_TODO_ITEM });
  assert.equal((await noDescription.actions.execute(action({ description: null }))).status, "rejected");
  assert.equal(noDescription.homeAssistant.serviceCalls.length, 0);
  noDescription.module.destroy();
});

test("clears date due by listing real item then sending only due_date null", async () => {
  const { actions, homeAssistant, module } = setup();
  homeAssistant.setWSResult({ items: [{ uid: "task-1", summary: "A", status: "needs_action", due: "2026-10-06" }] });
  const result = await actions.execute(action({ due: { kind: "none", value: null } }));
  assert.equal(result.status, "success");
  assert.deepEqual(homeAssistant.wsCalls, [{ type: "todo/item/list", entity_id: "todo.home" }]);
  assert.deepEqual(homeAssistant.serviceCalls[0].data, { item: "task-1", due_date: null });
  assert.equal(Object.hasOwn(homeAssistant.serviceCalls[0].data, "due_datetime"), false);
  module.destroy();
});

test("clears datetime due by listing real item then sending only due_datetime null", async () => {
  const { actions, homeAssistant, module } = setup();
  homeAssistant.setWSResult({ items: [{ uid: "task-1", summary: "A", status: "needs_action", due: "2026-10-06T18:30:00+02:00" }] });
  const result = await actions.execute(action({ due: { kind: "none", value: null } }));
  assert.equal(result.status, "success");
  assert.deepEqual(homeAssistant.serviceCalls[0].data, { item: "task-1", due_datetime: null });
  assert.equal(Object.hasOwn(homeAssistant.serviceCalls[0].data, "due_date"), false);
  module.destroy();
});

test("due clear is successful no-op when real item has no due and rejects missing item", async () => {
  const noDue = setup();
  noDue.homeAssistant.setWSResult({ items: [{ uid: "task-1", summary: "A", status: "needs_action" }] });
  let result = await noDue.actions.execute(action({ due: { kind: "none", value: null } }));
  assert.equal(result.status, "success");
  assert.deepEqual(result.value, { noop: true });
  assert.equal(noDue.homeAssistant.serviceCalls.length, 0);
  noDue.module.destroy();

  const missing = setup();
  missing.homeAssistant.setWSResult({ items: [{ uid: "other", summary: "B", status: "needs_action", due: "2026-10-06" }] });
  result = await missing.actions.execute(action({ due: { kind: "none", value: null } }));
  assert.equal(result.status, "rejected");
  assert.equal(missing.homeAssistant.serviceCalls.length, 0);
  missing.module.destroy();
});

test("description null clears supported description field", async () => {
  const { actions, homeAssistant, module } = setup();
  const result = await actions.execute(action({ description: null }));
  assert.equal(result.status, "success");
  assert.deepEqual(homeAssistant.serviceCalls[0].data, { item: "task-1", description: null });
  module.destroy();
});

test("disconnected Home Assistant maps to unavailable while unexpected backend failure becomes registry error", async () => {
  const disconnected = setup({ connected: false });
  assert.equal((await disconnected.actions.execute(action({ title: "Neu" }))).status, "unavailable");
  disconnected.module.destroy();

  const failing = setup();
  failing.homeAssistant.setServiceError(new Error("backend boom"));
  const result = await failing.actions.execute(action({ title: "Neu" }));
  assert.equal(result.status, "error");
  assert.match(result.error.message, /backend boom/);
  failing.module.destroy();
});

test("lifecycle registers exactly task.update, rebinds registries atomically and destroys idempotently", async () => {
  const firstActions = createActionRegistry();
  const secondActions = createActionRegistry();
  const homeAssistant = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home") } });
  const module = createTaskUpdateAction({ actions: firstActions, homeAssistant }, {});
  assert.equal(firstActions.has("task.update"), false);
  assert.equal(module.mount(null), true);
  assert.equal(module.mount(null), false);
  assert.equal(firstActions.has("task.update"), true);
  assert.throws(() => module.update({ actions: secondActions, homeAssistant }, { extra: true }), TypeError);
  assert.equal(firstActions.has("task.update"), true);
  assert.equal(secondActions.has("task.update"), false);
  assert.equal(module.update({ actions: secondActions, homeAssistant }, {}), true);
  assert.equal(firstActions.has("task.update"), false);
  assert.equal(secondActions.has("task.update"), true);
  assert.equal(module.destroy(), true);
  assert.equal(module.destroy(), false);
  assert.equal(secondActions.has("task.update"), false);
});
