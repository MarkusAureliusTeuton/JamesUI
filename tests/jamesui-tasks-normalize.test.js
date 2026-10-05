import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTodoItem,
  normalizeTodoItems,
} from "../custom_components/jamesui/frontend/modules/provider.tasks/normalize.js";

test("normalizes actionable task with date due and truthful optional fields", () => {
  const task = normalizeTodoItem("todo.household", {
    uid: " task-1 ",
    summary: " Mülltonne rausstellen ",
    status: "needs_action",
    due: "2026-10-06",
    description: "  Gelbe Tonne  ",
    completed: null,
  });
  assert.deepEqual(task, {
    source_entity_id: "todo.household",
    uid: "task-1",
    title: "Mülltonne rausstellen",
    status: "needs_action",
    due: { kind: "date", value: "2026-10-06" },
    description: "Gelbe Tonne",
    completed_at: null,
  });
  assert.equal(Object.isFrozen(task), true);
  assert.equal(Object.isFrozen(task.due), true);
});

test("keeps timezone-aware datetime due distinct from date due", () => {
  const task = normalizeTodoItem("todo.household", {
    uid: "task-2",
    summary: "Termin vorbereiten",
    status: "needs_action",
    due: "2026-10-06T18:30:00+02:00",
  });
  assert.deepEqual(task.due, { kind: "datetime", value: "2026-10-06T18:30:00+02:00" });
});

test("normalizes absent or null due to explicit none", () => {
  for (const due of [undefined, null]) {
    const task = normalizeTodoItem("todo.household", {
      uid: "task-3",
      summary: "Ohne Termin",
      status: "needs_action",
      ...(due === undefined ? {} : { due }),
    });
    assert.deepEqual(task.due, { kind: "none", value: null });
  }
});

test("preserves valid completed status and completed timestamp", () => {
  const task = normalizeTodoItem("todo.household", {
    uid: "task-4",
    summary: "Erledigt",
    status: "completed",
    completed: "2026-10-05T08:00:00Z",
  });
  assert.equal(task.status, "completed");
  assert.equal(task.completed_at, "2026-10-05T08:00:00Z");
});

test("rejects malformed identity status due and local datetime instead of guessing", () => {
  const base = { uid: "task", summary: "Task", status: "needs_action" };
  const cases = [
    { ...base, uid: "   " },
    { ...base, summary: "   " },
    { ...base, status: "cancelled" },
    { ...base, due: "2026-02-30" },
    { ...base, due: "2026-10-06T18:30:00" },
    { ...base, due: "not-a-date" },
  ];
  for (const value of cases) assert.equal(normalizeTodoItem("todo.household", value), null);
  assert.equal(normalizeTodoItem("calendar.bad", base), null);
});

test("invalid optional description/completed timestamp become null without inventing data", () => {
  const task = normalizeTodoItem("todo.household", {
    uid: "task-5",
    summary: "Optional",
    status: "needs_action",
    description: 42,
    completed: "yesterday",
  });
  assert.equal(task.description, null);
  assert.equal(task.completed_at, null);
});

test("normalizes item arrays immutably, excludes malformed rows and preserves source order", () => {
  const result = normalizeTodoItems("todo.household", [
    { uid: "b", summary: "B", status: "needs_action" },
    { uid: "bad", summary: " ", status: "needs_action" },
    { uid: "a", summary: "A", status: "completed" },
  ]);
  assert.deepEqual(result.map((item) => item.uid), ["b", "a"]);
  assert.equal(Object.isFrozen(result), true);
});
