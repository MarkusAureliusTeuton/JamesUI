import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTaskPatch,
  createTaskDraft,
} from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/overlay.js";

const TZ = "Europe/Berlin";
const FULL = Object.freeze({
  can_update: true,
  can_set_due_date: true,
  can_set_due_datetime: true,
  can_set_description: true,
});

function task(overrides = {}) {
  return {
    source_entity_id: "todo.home",
    uid: "task-1",
    title: " Aufgabe ",
    status: "needs_action",
    due: { kind: "none", value: null },
    description: null,
    completed_at: null,
    ...overrides,
  };
}

test("createTaskDraft projects normalized due values into HA-local editable fields", () => {
  assert.deepEqual(createTaskDraft(task(), TZ), {
    title: " Aufgabe ",
    due_date: "",
    due_time: "",
    description: "",
  });
  assert.deepEqual(createTaskDraft(task({ due: { kind: "date", value: "2026-10-25" } }), TZ), {
    title: " Aufgabe ",
    due_date: "2026-10-25",
    due_time: "",
    description: "",
  });
  assert.deepEqual(createTaskDraft(task({
    due: { kind: "datetime", value: "2026-10-25T07:30:00Z" },
    description: "Notiz",
  }), TZ), {
    title: " Aufgabe ",
    due_date: "2026-10-25",
    due_time: "08:30",
    description: "Notiz",
  });
});

test("buildTaskPatch trims title and emits only fields that actually changed", () => {
  const original = task({ title: "Alt", description: "Notiz", due: { kind: "date", value: "2026-10-10" } });
  assert.deepEqual(buildTaskPatch({
    original,
    draft: { title: "  Neu  ", due_date: "2026-10-10", due_time: "", description: "Notiz" },
    capabilities: FULL,
    time_zone: TZ,
  }), { title: "Neu" });

  assert.deepEqual(buildTaskPatch({
    original,
    draft: { title: " Alt ", due_date: "2026-10-10", due_time: "", description: "Notiz" },
    capabilities: FULL,
    time_zone: TZ,
  }), {});
});

test("datetime-local edit converts through HA timezone with compatible DST semantics", () => {
  const original = task({ title: "DST" });
  const patch = buildTaskPatch({
    original,
    draft: { title: "DST", due_date: "2026-03-29", due_time: "02:30", description: "" },
    capabilities: FULL,
    time_zone: TZ,
  });
  assert.deepEqual(patch, {
    due: { kind: "datetime", value: "2026-03-29T01:30:00.000Z" },
  });
});

test("unchanged ambiguous datetime does not get rewritten to another overlap occurrence", () => {
  const original = task({
    title: "Overlap",
    due: { kind: "datetime", value: "2026-10-25T01:30:00Z" }, // later 02:30 occurrence in Berlin
  });
  const draft = createTaskDraft(original, TZ);
  assert.equal(draft.due_date, "2026-10-25");
  assert.equal(draft.due_time, "02:30");
  assert.deepEqual(buildTaskPatch({ original, draft, capabilities: FULL, time_zone: TZ }), {});
});

test("due clear and description clear are emitted only when the original task had a value", () => {
  const populated = task({
    title: "A",
    due: { kind: "datetime", value: "2026-10-10T08:30:00Z" },
    description: "Hinweis",
  });
  assert.deepEqual(buildTaskPatch({
    original: populated,
    draft: { title: "A", due_date: "", due_time: "", description: "" },
    capabilities: FULL,
    time_zone: TZ,
  }), {
    due: { kind: "none", value: null },
    description: null,
  });

  const empty = task({ title: "A" });
  assert.deepEqual(buildTaskPatch({
    original: empty,
    draft: { title: "A", due_date: "", due_time: "", description: "" },
    capabilities: FULL,
    time_zone: TZ,
  }), {});
});

test("date-only and datetime-only sources accept only representable due edits", () => {
  const original = task({ title: "A" });
  const dateOnly = { ...FULL, can_set_due_datetime: false };
  assert.deepEqual(buildTaskPatch({
    original,
    draft: { title: "A", due_date: "2026-10-10", due_time: "", description: "" },
    capabilities: dateOnly,
    time_zone: TZ,
  }), { due: { kind: "date", value: "2026-10-10" } });
  assert.throws(() => buildTaskPatch({
    original,
    draft: { title: "A", due_date: "2026-10-10", due_time: "09:00", description: "" },
    capabilities: dateOnly,
    time_zone: TZ,
  }), /datetime/i);

  const datetimeOnly = { ...FULL, can_set_due_date: false };
  assert.throws(() => buildTaskPatch({
    original,
    draft: { title: "A", due_date: "2026-10-10", due_time: "", description: "" },
    capabilities: datetimeOnly,
    time_zone: TZ,
  }), /date/i);
});

test("unsupported edits, blank titles and malformed local due values are rejected locally", () => {
  const original = task({ title: "A", description: "Old" });
  assert.throws(() => buildTaskPatch({
    original,
    draft: { title: "   ", due_date: "", due_time: "", description: "Old" },
    capabilities: FULL,
    time_zone: TZ,
  }), /title/i);

  assert.throws(() => buildTaskPatch({
    original,
    draft: { title: "B", due_date: "", due_time: "", description: "Old" },
    capabilities: { ...FULL, can_update: false },
    time_zone: TZ,
  }), /update/i);

  assert.throws(() => buildTaskPatch({
    original,
    draft: { title: "A", due_date: "2026-02-30", due_time: "09:00", description: "Old" },
    capabilities: FULL,
    time_zone: TZ,
  }), /due/i);

  assert.throws(() => buildTaskPatch({
    original,
    draft: { title: "A", due_date: "", due_time: "", description: "Neu" },
    capabilities: { ...FULL, can_set_description: false },
    time_zone: TZ,
  }), /description/i);
});
