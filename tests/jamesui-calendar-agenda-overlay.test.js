import test from "node:test";
import assert from "node:assert/strict";

import {
  createEventDetailOverlay,
  createTaskEditOverlay,
} from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/overlay.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const TZ = "Europe/Berlin";

function event() {
  return {
    key: "event-key",
    title: "Zahnarzt",
    all_day: false,
    start_date: null,
    end_date: null,
    start_at: "2026-10-10T08:00:00Z",
    end_at: "2026-10-10T09:30:00Z",
    provenance: ["calendar.family", "calendar.shared"],
    source_variants: {
      "calendar.family": { description: "Kontrolle", location: null },
      "calendar.shared": { description: null, location: "Praxis" },
    },
  };
}

function task() {
  return {
    source_entity_id: "todo.home",
    uid: "task-1",
    title: "Einkaufen",
    status: "needs_action",
    due: { kind: "date", value: "2026-10-10" },
    description: "Milch",
    completed_at: null,
  };
}

const FULL_SOURCE = Object.freeze({
  name: "Haushalt",
  capabilities: Object.freeze({
    can_update: true,
    can_set_due_date: true,
    can_set_due_datetime: true,
    can_set_description: true,
  }),
});

test("event detail uses shared dialog primitives, instance-scoped id and truthful full event fields", () => {
  const document = createFakeDocument();
  let closes = 0;
  const overlay = createEventDetailOverlay(document, {
    instanceId: "agenda-left",
    event: event(),
    presentation: {
      location: "Praxis",
      location_source_id: "calendar.shared",
      description: "Kontrolle",
      description_source_id: "calendar.family",
    },
    sourceNames: {
      "calendar.family": "Familie",
      "calendar.shared": "Gemeinsam",
    },
    timeZone: TZ,
    onClose: () => { closes += 1; },
  });

  assert.equal(overlay.root.getAttribute("data-jui-overlay"), "");
  assert.equal(overlay.root.getAttribute("data-jui-agenda-overlay-id"), "calendar-agenda:agenda-left:event:event-key");
  assert.equal(overlay.root.querySelector("[data-jui-dialog]").getAttribute("role"), "dialog");
  assert.equal(overlay.root.querySelector("[data-jui-dialog-title]").textContent, "Zahnarzt");
  assert.equal(overlay.root.querySelector("[data-jui-agenda-event-range]").textContent, "Sa, 10. Oktober 2026 · 10:00–11:30");
  assert.equal(overlay.root.querySelector("[data-jui-agenda-event-location]").textContent, "Praxis");
  assert.equal(overlay.root.querySelector("[data-jui-agenda-event-description]").textContent, "Kontrolle");
  assert.deepEqual(
    overlay.root.querySelectorAll("[data-jui-agenda-event-source]").map((node) => node.textContent),
    ["Familie", "Gemeinsam"],
  );

  overlay.root.querySelector("[data-jui-agenda-overlay-close]").dispatchEvent("click");
  assert.equal(closes, 1);
  assert.equal(overlay.destroy(), true);
  assert.equal(overlay.destroy(), false);
});

test("all-day event detail preserves exclusive end semantics and omits unavailable optional fields", () => {
  const document = createFakeDocument();
  const allDay = {
    key: "holiday",
    title: "Urlaub",
    all_day: true,
    start_date: "2026-10-10",
    end_date: "2026-10-13",
    start_at: null,
    end_at: null,
    provenance: ["calendar.family"],
    source_variants: { "calendar.family": { description: null, location: null } },
  };
  const overlay = createEventDetailOverlay(document, {
    instanceId: "agenda",
    event: allDay,
    presentation: { location: null, description: null },
    sourceNames: { "calendar.family": "Familie" },
    timeZone: TZ,
    onClose: () => {},
  });
  assert.equal(overlay.root.querySelector("[data-jui-agenda-event-range]").textContent, "10.–12. Oktober 2026 · Ganztägig");
  assert.equal(overlay.root.querySelector("[data-jui-agenda-event-location]"), null);
  assert.equal(overlay.root.querySelector("[data-jui-agenda-event-description]"), null);
  overlay.destroy();
});

test("task overlay enables only source-supported fields and uses an instance-scoped overlay id", () => {
  const document = createFakeDocument();
  const source = {
    name: "Haushalt",
    capabilities: {
      can_update: true,
      can_set_due_date: true,
      can_set_due_datetime: false,
      can_set_description: false,
    },
  };
  const overlay = createTaskEditOverlay(document, {
    instanceId: "agenda-right",
    task: task(),
    source,
    timeZone: TZ,
    onClose: () => {},
    onSave: async () => ({ status: "success" }),
  });

  assert.equal(overlay.root.getAttribute("data-jui-agenda-overlay-id"), "calendar-agenda:agenda-right:task:todo.home:task-1");
  assert.equal(overlay.root.querySelector("[data-jui-agenda-task-source]").textContent, "Haushalt");
  assert.equal(overlay.root.querySelector("[data-jui-agenda-task-title]").getAttribute("disabled"), null);
  assert.equal(overlay.root.querySelector("[data-jui-agenda-task-due-date]").getAttribute("disabled"), null);
  assert.equal(overlay.root.querySelector("[data-jui-agenda-task-due-time]"), null);
  assert.equal(overlay.root.querySelector("[data-jui-agenda-task-description]").getAttribute("disabled"), "");
  overlay.destroy();
});

test("empty patch closes without action while changed draft sends only minimal task patch", async () => {
  const document = createFakeDocument();
  const saves = [];
  let closes = 0;
  const overlay = createTaskEditOverlay(document, {
    instanceId: "agenda",
    task: task(),
    source: FULL_SOURCE,
    timeZone: TZ,
    onClose: () => { closes += 1; },
    onSave: async (patch) => { saves.push(patch); return { status: "success" }; },
  });

  overlay.root.querySelector("[data-jui-agenda-task-save]").dispatchEvent("click");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(saves, []);
  assert.equal(closes, 1);

  const changed = createTaskEditOverlay(document, {
    instanceId: "agenda",
    task: task(),
    source: FULL_SOURCE,
    timeZone: TZ,
    onClose: () => { closes += 1; },
    onSave: async (patch) => { saves.push(patch); return { status: "success" }; },
  });
  changed.root.querySelector("[data-jui-agenda-task-title]").value = "  Einkaufen morgen  ";
  changed.root.querySelector("[data-jui-agenda-task-save]").dispatchEvent("click");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(saves, [{ title: "Einkaufen morgen" }]);
  assert.equal(closes, 2);
  changed.destroy();
  overlay.destroy();
});

test("failed task save keeps dialog and edited draft intact with normalized feedback only", async () => {
  const document = createFakeDocument();
  let closes = 0;
  const overlay = createTaskEditOverlay(document, {
    instanceId: "agenda",
    task: task(),
    source: FULL_SOURCE,
    timeZone: TZ,
    onClose: () => { closes += 1; },
    onSave: async () => ({ status: "error", error: new Error("SECRET BACKEND DETAIL") }),
  });
  const title = overlay.root.querySelector("[data-jui-agenda-task-title]");
  title.value = "Neue Fassung";
  overlay.root.querySelector("[data-jui-agenda-task-save]").dispatchEvent("click");
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(closes, 0);
  assert.equal(title.value, "Neue Fassung");
  assert.equal(overlay.root.querySelector("[data-jui-agenda-task-feedback]").textContent, "Änderung konnte nicht gespeichert werden");
  assert.equal(overlay.root.querySelector("[data-jui-agenda-task-feedback]").textContent.includes("SECRET"), false);
  overlay.destroy();
});

test("unavailable task save gets concise unavailable feedback and read-only source disables save", async () => {
  const document = createFakeDocument();
  const unavailable = createTaskEditOverlay(document, {
    instanceId: "agenda",
    task: task(),
    source: FULL_SOURCE,
    timeZone: TZ,
    onClose: () => {},
    onSave: async () => ({ status: "unavailable" }),
  });
  unavailable.root.querySelector("[data-jui-agenda-task-title]").value = "Neu";
  unavailable.root.querySelector("[data-jui-agenda-task-save]").dispatchEvent("click");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(unavailable.root.querySelector("[data-jui-agenda-task-feedback]").textContent, "Aufgabe derzeit nicht verfügbar");

  const readOnly = createTaskEditOverlay(document, {
    instanceId: "agenda",
    task: task(),
    source: { name: "Read only", capabilities: { ...FULL_SOURCE.capabilities, can_update: false } },
    timeZone: TZ,
    onClose: () => {},
    onSave: async () => ({ status: "success" }),
  });
  assert.equal(readOnly.root.querySelector("[data-jui-agenda-task-title]").getAttribute("disabled"), "");
  assert.equal(readOnly.root.querySelector("[data-jui-agenda-task-save]").getAttribute("disabled"), "");
  unavailable.destroy();
  readOnly.destroy();
});
