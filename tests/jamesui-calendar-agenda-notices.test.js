import test from "node:test";
import assert from "node:assert/strict";

import { validateCalendarAgendaConfig } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/config.js";
import { logicalEventKey } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/model.js";
import {
  NOTICE_DISMISSAL_STORAGE_KEY,
  advanceNoticeThreshold,
  buildAdvanceNotices,
  createNoticeDismissalStore,
  eventStartInstant,
} from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/notices.js";

const TZ = "Europe/Berlin";

function config(calendars) {
  return validateCalendarAgendaConfig({
    instance_id: "agenda-notices",
    calendar_enabled: true,
    tasks_enabled: false,
    calendars,
    task_lists: [],
  });
}

function timed(title, startAt, endAt, provenance = ["calendar.family"], sourceVariants = {}) {
  return {
    key: `test:${title}:${startAt}`,
    title,
    all_day: false,
    start_date: null,
    end_date: null,
    start_at: startAt,
    end_at: endAt,
    provenance,
    normal_contributors: provenance,
    normal_ranges: {},
    source_variants: Object.fromEntries(provenance.map((sourceId) => [sourceId, sourceVariants[sourceId] ?? {}])),
  };
}

function allDay(title, startDate, endDate, provenance = ["calendar.family"], sourceVariants = {}) {
  return {
    key: `test:${title}:${startDate}`,
    title,
    all_day: true,
    start_date: startDate,
    end_date: endDate,
    start_at: null,
    end_at: null,
    provenance,
    normal_contributors: provenance,
    normal_ranges: {},
    source_variants: Object.fromEntries(provenance.map((sourceId) => [sourceId, sourceVariants[sourceId] ?? {}])),
  };
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    dump(key) { return data.get(key) ?? null; },
  };
}

test("advance thresholds use HA-local calendar arithmetic through DST for timed and all-day events", () => {
  const springTimed = timed("DST", "2026-03-30T00:30:00Z", "2026-03-30T01:30:00Z"); // 02:30 local after DST switch
  assert.equal(eventStartInstant(springTimed, TZ), "2026-03-30T00:30:00.000Z");
  assert.equal(advanceNoticeThreshold(springTimed, 1, TZ), "2026-03-29T01:30:00.000Z"); // compatible gap -> 03:30 local

  const springAllDay = allDay("Ganztag", "2026-03-30", "2026-03-31");
  assert.equal(eventStartInstant(springAllDay, TZ), "2026-03-29T22:00:00.000Z");
  assert.equal(advanceNoticeThreshold(springAllDay, 1, TZ), "2026-03-28T23:00:00.000Z");

  assert.equal(advanceNoticeThreshold(springTimed, 0, TZ), null);
  assert.equal(advanceNoticeThreshold(springTimed, -1, TZ), null);
});

test("owner calendar and first matching rule decide advance days with inherit and explicit disable", () => {
  const cfg = config([
    {
      entity_id: "calendar.family",
      advance_notice_days: 7,
      rules: [
        { operator: "contains", query: "Zahnarzt", advance_notice_days: 3 },
        { operator: "exact", query: "Privat", advance_notice_days: 0 },
      ],
    },
    { entity_id: "calendar.shared", advance_notice_days: 30 },
  ]);
  const events = [
    timed("Zahnarzt", "2026-10-10T08:00:00Z", "2026-10-10T09:00:00Z", ["calendar.shared", "calendar.family"]),
    timed("Normal", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", ["calendar.shared", "calendar.family"]),
    timed("Privat", "2026-10-09T08:00:00Z", "2026-10-09T09:00:00Z", ["calendar.family"]),
  ];
  const result = buildAdvanceNotices({
    events,
    config: cfg,
    time_zone: TZ,
    now: "2026-10-07T08:00:00Z",
    dismissal_store: createNoticeDismissalStore({ storage: memoryStorage(), instance_id: cfg.instance_id, now: "2026-10-07T08:00:00Z" }),
  });
  assert.deepEqual(result.all.map((notice) => [notice.title, notice.advance_notice_days]), [
    ["Zahnarzt", 3],
    ["Normal", 7],
  ]);
  assert.equal(result.all.some((notice) => notice.title === "Privat"), false);
  assert.equal(result.all[0].presentation.owner_source_id, "calendar.family");
});

test("eligible notices require reached threshold and future start, then sort by start and localized title", () => {
  const cfg = config([{ entity_id: "calendar.family", advance_notice_days: 5 }]);
  const events = [
    timed("Zeta", "2026-10-10T10:00:00Z", "2026-10-10T11:00:00Z"),
    timed("Äpfel", "2026-10-10T10:00:00Z", "2026-10-10T11:00:00Z"),
    timed("Früher", "2026-10-09T10:00:00Z", "2026-10-09T11:00:00Z"),
    timed("Zu weit", "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"),
    timed("Gestartet", "2026-10-06T09:00:00Z", "2026-10-06T10:00:00Z"),
  ];
  const result = buildAdvanceNotices({
    events,
    config: cfg,
    time_zone: TZ,
    now: "2026-10-07T10:00:00Z",
    dismissal_store: createNoticeDismissalStore({ storage: memoryStorage(), instance_id: cfg.instance_id, now: "2026-10-07T10:00:00Z" }),
    expanded: true,
  });
  assert.deepEqual(result.all.map((notice) => notice.title), ["Früher", "Äpfel", "Zeta"]);
  assert.deepEqual(result.visible.map((notice) => notice.title), ["Früher", "Äpfel", "Zeta"]);
  assert.equal(result.hidden_count, 0);
  assert.equal(result.expanded, true);
});

test("collapsed notice region exposes at most two notices and reports expandable remainder", () => {
  const cfg = config([{ entity_id: "calendar.family", advance_notice_days: 7 }]);
  const events = [1, 2, 3, 4].map((day) => timed(
    `Termin ${day}`,
    `2026-10-${String(7 + day).padStart(2, "0")}T08:00:00Z`,
    `2026-10-${String(7 + day).padStart(2, "0")}T09:00:00Z`,
  ));
  const store = createNoticeDismissalStore({ storage: memoryStorage(), instance_id: cfg.instance_id, now: "2026-10-07T08:00:00Z" });
  const collapsed = buildAdvanceNotices({ events, config: cfg, time_zone: TZ, now: "2026-10-07T08:00:00Z", dismissal_store: store });
  assert.equal(collapsed.all.length, 4);
  assert.deepEqual(collapsed.visible.map((notice) => notice.title), ["Termin 1", "Termin 2"]);
  assert.equal(collapsed.hidden_count, 2);
  assert.equal(collapsed.expanded, false);

  const expanded = buildAdvanceNotices({ events, config: cfg, time_zone: TZ, now: "2026-10-07T08:00:00Z", dismissal_store: store, expanded: true });
  assert.equal(expanded.visible.length, 4);
  assert.equal(expanded.hidden_count, 0);
});

test("dismissal persists per instance and exact logical occurrence until event-start expiry", () => {
  const storage = memoryStorage();
  const cfg = config([{ entity_id: "calendar.family", advance_notice_days: 7 }]);
  const event = timed("Termin", "2026-10-10T08:00:00Z", "2026-10-10T09:00:00Z");
  const key = logicalEventKey(event);
  const expiry = eventStartInstant(event, TZ);

  const first = createNoticeDismissalStore({ storage, instance_id: cfg.instance_id, now: "2026-10-07T08:00:00Z" });
  assert.equal(first.isDismissed(key, "2026-10-07T08:00:00Z"), false);
  assert.equal(first.dismiss(key, expiry), true);
  assert.equal(first.isDismissed(key, "2026-10-07T08:00:00Z"), true);
  assert.match(storage.dump(NOTICE_DISMISSAL_STORAGE_KEY), /"version":1/);

  const reload = createNoticeDismissalStore({ storage, instance_id: cfg.instance_id, now: "2026-10-07T08:00:00Z" });
  assert.equal(reload.isDismissed(key, "2026-10-07T08:00:00Z"), true);
  const otherInstance = createNoticeDismissalStore({ storage, instance_id: "agenda-other", now: "2026-10-07T08:00:00Z" });
  assert.equal(otherInstance.isDismissed(key, "2026-10-07T08:00:00Z"), false);

  const changed = timed("Termin geändert", event.start_at, event.end_at);
  assert.notEqual(logicalEventKey(changed), key);
  assert.equal(reload.isDismissed(logicalEventKey(changed), "2026-10-07T08:00:00Z"), false);
  assert.equal(reload.isDismissed(key, expiry), false);
});

test("dismissed eligible occurrence is filtered and pruning removes expired records without touching future siblings", () => {
  const storage = memoryStorage();
  const cfg = config([{ entity_id: "calendar.family", advance_notice_days: 7 }]);
  const dismissed = timed("Dismissed", "2026-10-10T08:00:00Z", "2026-10-10T09:00:00Z");
  const future = timed("Future", "2026-10-11T08:00:00Z", "2026-10-11T09:00:00Z");
  const store = createNoticeDismissalStore({ storage, instance_id: cfg.instance_id, now: "2026-10-07T08:00:00Z" });
  store.dismiss(logicalEventKey(dismissed), eventStartInstant(dismissed, TZ));
  store.dismiss(logicalEventKey(future), eventStartInstant(future, TZ));

  const notices = buildAdvanceNotices({ events: [dismissed, future], config: cfg, time_zone: TZ, now: "2026-10-07T08:00:00Z", dismissal_store: store, expanded: true });
  assert.deepEqual(notices.all.map((notice) => notice.title), ["Future"]);

  assert.equal(store.prune("2026-10-10T08:00:00Z"), 1);
  assert.equal(store.isDismissed(logicalEventKey(dismissed), "2026-10-10T08:00:00Z"), false);
  assert.equal(store.isDismissed(logicalEventKey(future), "2026-10-10T08:00:00Z"), true);
});

test("malformed or throwing device storage falls back to safe session memory", () => {
  const malformed = memoryStorage({ [NOTICE_DISMISSAL_STORAGE_KEY]: "not-json" });
  const first = createNoticeDismissalStore({ storage: malformed, instance_id: "agenda-a", now: "2026-10-01T00:00:00Z" });
  assert.equal(first.dismiss("event-a", "2026-10-10T00:00:00Z"), true);
  assert.equal(first.isDismissed("event-a", "2026-10-02T00:00:00Z"), true);

  const throwing = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  const second = createNoticeDismissalStore({ storage: throwing, instance_id: "agenda-b", now: "2026-10-01T00:00:00Z" });
  assert.equal(second.dismiss("event-b", "2026-10-10T00:00:00Z"), true);
  assert.equal(second.isDismissed("event-b", "2026-10-02T00:00:00Z"), true);
  assert.doesNotThrow(() => second.prune("2026-10-11T00:00:00Z"));
  assert.equal(second.isDismissed("event-b", "2026-10-11T00:00:00Z"), false);
});
