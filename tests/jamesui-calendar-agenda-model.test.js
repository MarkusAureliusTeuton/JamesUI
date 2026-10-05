import test from "node:test";
import assert from "node:assert/strict";

import { validateCalendarAgendaConfig } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/config.js";
import {
  buildAgendaModel,
  buildCalendarRangeRequest,
  collapseCalendarEvents,
  logicalEventKey,
  projectEventForDay,
} from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/model.js";

const TZ = "Europe/Berlin";
const TODAY = "2026-10-04";
const NOW = "2026-10-04T10:00:00.000Z"; // 12:00 local

function config(overrides = {}) {
  return validateCalendarAgendaConfig({
    instance_id: "agenda-model",
    calendars: [{ entity_id: "calendar.family" }],
    task_lists: [{ entity_id: "todo.home" }],
    ...overrides,
  });
}

function timed(source, title, start, end, extra = {}) {
  return {
    occurrence_id: `${source}:${title}:${start}`,
    source_entity_id: source,
    title,
    description: extra.description ?? null,
    location: extra.location ?? null,
    all_day: false,
    start_date: null,
    end_date: null,
    start_at: start,
    end_at: end,
  };
}

function allDay(source, title, start, end, extra = {}) {
  return {
    occurrence_id: `${source}:${title}:${start}`,
    source_entity_id: source,
    title,
    description: extra.description ?? null,
    location: extra.location ?? null,
    all_day: true,
    start_date: start,
    end_date: end,
    start_at: null,
    end_at: null,
  };
}

function task(source, uid, title, due = { kind: "none", value: null }, status = "needs_action") {
  return { source_entity_id: source, uid, title, status, due, description: null, completed_at: null };
}

function calendarSnapshot(sources, timeZone = TZ) {
  return { time_zone: timeZone, sources };
}

function taskSnapshot(sources, timeZone = TZ) {
  return { version: 1, time_zone: timeZone, sources };
}

function availableEvents(events, name = "Kalender") {
  return { status: "available", reason: null, name, events };
}

function availableTasks(items, name = "Aufgaben") {
  return { status: "available", reason: null, name, supported_features: 4, capabilities: {}, items };
}

test("buildCalendarRangeRequest uses day lookback, per-calendar normal horizon and notice-only extension", () => {
  const cfg = config({
    presentation_mode: "day",
    lookback_days: 7,
    lookahead_days: 30,
    calendars: [
      {
        entity_id: "calendar.family",
        lookahead_days: 7,
        advance_notice_days: 30,
        rules: [{ operator: "contains", query: "Zahnarzt", advance_notice_days: 14 }],
      },
      { entity_id: "calendar.shared", lookahead_days: 20, advance_notice_days: 0 },
    ],
  });
  assert.deepEqual(buildCalendarRangeRequest(cfg, TODAY), {
    ranges: [
      { entity_id: "calendar.family", start_date: "2026-09-27", end_date: "2026-11-04" },
      { entity_id: "calendar.shared", start_date: "2026-09-27", end_date: "2026-10-25" },
    ],
  });

  const disabled = config({ calendar_enabled: false, tasks_enabled: true, calendars: [], task_lists: [{ entity_id: "todo.home" }] });
  assert.deepEqual(buildCalendarRangeRequest(disabled, TODAY), { ranges: [] });
});

test("logicalEventKey canonicalizes title and timed instants but ignores source/location/description", () => {
  const first = timed("calendar.a", "  Müll   Abholung ", "2026-10-10T10:00:00+02:00", "2026-10-10T11:00:00+02:00", { location: "A" });
  const second = timed("calendar.b", "müll abholung", "2026-10-10T08:00:00Z", "2026-10-10T09:00:00Z", { description: "B" });
  assert.equal(logicalEventKey(first), logicalEventKey(second));
  assert.notEqual(logicalEventKey(first), logicalEventKey({ ...second, end_at: "2026-10-10T09:30:00Z" }));
});

test("collapseCalendarEvents retains provenance while advance-only contributors cannot leak normal rows", () => {
  const cfg = config({
    calendars: [
      { entity_id: "calendar.family", lookahead_days: 7, advance_notice_days: 30 },
      { entity_id: "calendar.shared", lookahead_days: 20 },
    ],
  });
  const duplicateA = timed("calendar.family", " Termin ", "2026-10-24T08:00:00Z", "2026-10-24T09:00:00Z", { description: "A" });
  const duplicateB = timed("calendar.shared", "termin", "2026-10-24T10:00:00+02:00", "2026-10-24T11:00:00+02:00", { location: "B" });
  const noticeOnly = timed("calendar.family", "Weit weg", "2026-10-29T08:00:00Z", "2026-10-29T09:00:00Z");
  const result = collapseCalendarEvents(calendarSnapshot({
    "calendar.family": availableEvents([duplicateA, noticeOnly], "Familie"),
    "calendar.shared": availableEvents([duplicateB], "Geteilt"),
  }), cfg, TODAY);

  assert.equal(result.length, 2);
  const collapsed = result.find((entry) => entry.title.trim().toLowerCase() === "termin");
  assert.deepEqual(collapsed.provenance, ["calendar.family", "calendar.shared"]);
  assert.deepEqual(collapsed.normal_contributors, ["calendar.shared"]);
  assert.equal(collapsed.source_variants["calendar.family"].description, "A");
  assert.equal(collapsed.source_variants["calendar.shared"].location, "B");
  assert.deepEqual(result.find((entry) => entry.title === "Weit weg").normal_contributors, []);
});

test("projectEventForDay preserves all-day and multi-day timed semantics across local days", () => {
  const holiday = allDay("calendar.family", "Urlaub", "2026-10-04", "2026-10-07");
  assert.equal(projectEventForDay(holiday, "2026-10-04", TZ).time_label, "Ganztägig");
  assert.equal(projectEventForDay(holiday, "2026-10-06", TZ).time_label, "Ganztägig");
  assert.equal(projectEventForDay(holiday, "2026-10-07", TZ), null);

  const trip = timed("calendar.family", "Reise", "2026-10-02T16:00:00Z", "2026-10-04T08:00:00Z"); // Fri 18:00 -> Sun 10:00
  assert.equal(projectEventForDay(trip, "2026-10-02", TZ).time_label, "18:00");
  assert.equal(projectEventForDay(trip, "2026-10-03", TZ).time_label, "laufend");
  assert.equal(projectEventForDay(trip, "2026-10-04", TZ).time_label, "bis 10:00");

  const midnightEnd = timed("calendar.family", "Nacht", "2026-10-04T20:00:00Z", "2026-10-04T22:00:00Z"); // 22:00 -> local midnight
  assert.equal(projectEventForDay(midnightEnd, "2026-10-04", TZ).time_label, "22:00");
  assert.equal(projectEventForDay(midnightEnd, "2026-10-05", TZ), null);
});

test("Today hides ended timed events but keeps running/upcoming and past day mode shows full historical day", () => {
  const cfg = config({ presentation_mode: "day", lookback_days: 7 });
  const todayEvents = [
    timed("calendar.family", "Beendet", "2026-10-04T06:00:00Z", "2026-10-04T08:00:00Z"),
    timed("calendar.family", "Läuft", "2026-10-04T09:00:00Z", "2026-10-04T11:00:00Z"),
    timed("calendar.family", "Später", "2026-10-04T12:00:00Z", "2026-10-04T13:00:00Z"),
    timed("calendar.family", "Historisch", "2026-10-03T06:00:00Z", "2026-10-03T07:00:00Z"),
  ];
  const cal = calendarSnapshot({ "calendar.family": availableEvents(todayEvents) });
  const tasks = taskSnapshot({ "todo.home": availableTasks([]) });

  const today = buildAgendaModel({ config: cfg, today_key: TODAY, now: NOW, selected_day: TODAY, calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.deepEqual(today.sections[0].rows.filter((row) => row.kind === "event").map((row) => row.title), ["Läuft", "Später"]);

  const past = buildAgendaModel({ config: cfg, today_key: TODAY, now: NOW, selected_day: "2026-10-03", calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.deepEqual(past.sections[0].rows.filter((row) => row.kind === "event").map((row) => row.title), ["Historisch"]);
});

test("task assignment hides completed, carries overdue only to Today and respects future horizon", () => {
  const cfg = config({ presentation_mode: "day", lookahead_days: 3, lookback_days: 7 });
  const items = [
    task("todo.home", "none", "Ohne Termin"),
    task("todo.home", "old", "Überfällig", { kind: "date", value: "2026-10-02" }),
    task("todo.home", "future", "Zukunft", { kind: "date", value: "2026-10-07" }),
    task("todo.home", "too-far", "Zu weit", { kind: "date", value: "2026-10-08" }),
    task("todo.home", "done", "Erledigt", { kind: "date", value: TODAY }, "completed"),
  ];
  const cal = calendarSnapshot({ "calendar.family": availableEvents([]) });
  const tasks = taskSnapshot({ "todo.home": availableTasks(items) });

  const original = buildAgendaModel({ config: cfg, today_key: TODAY, now: NOW, selected_day: "2026-10-02", calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.deepEqual(original.sections[0].rows.map((row) => row.title), ["Überfällig"]);

  const intervening = buildAgendaModel({ config: cfg, today_key: TODAY, now: NOW, selected_day: "2026-10-03", calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.deepEqual(intervening.sections[0].rows.map((row) => row.title), []);

  const today = buildAgendaModel({ config: cfg, today_key: TODAY, now: NOW, selected_day: TODAY, calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.deepEqual(today.sections[0].rows.map((row) => row.title), ["Ohne Termin", "Überfällig"]);
  assert.equal(today.sections[0].rows.find((row) => row.title === "Überfällig").carried_forward, true);

  const lastFuture = buildAgendaModel({ config: cfg, today_key: TODAY, now: NOW, selected_day: "2026-10-07", calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.deepEqual(lastFuture.sections[0].rows.map((row) => row.title), ["Zukunft"]);
  assert.equal(lastFuture.bounds.end_day, "2026-10-07");
});

test("chronological ordering uses untimed placement, all-day bucket, times and configured source order deterministically", () => {
  const orderingNow = "2026-10-04T06:00:00.000Z"; // 08:00 local; all tested timed rows are still current/future
  const cfg = config({
    presentation_mode: "day",
    show_location: true,
    calendars: [{ entity_id: "calendar.family" }],
    task_lists: [{ entity_id: "todo.first" }, { entity_id: "todo.second" }],
  });
  const cal = calendarSnapshot({ "calendar.family": availableEvents([
    allDay("calendar.family", "Ganztag", TODAY, "2026-10-05"),
    timed("calendar.family", "Termin 10", "2026-10-04T08:00:00Z", "2026-10-04T09:00:00Z"),
  ]) });
  const tasks = taskSnapshot({
    "todo.first": availableTasks([
      task("todo.first", "a", "Task 09 A", { kind: "datetime", value: "2026-10-04T07:00:00Z" }),
      task("todo.first", "u", "Ohne Zeit", { kind: "date", value: TODAY }),
    ]),
    "todo.second": availableTasks([
      task("todo.second", "b", "Task 09 B", { kind: "datetime", value: "2026-10-04T07:00:00Z" }),
    ]),
  });
  const model = buildAgendaModel({ config: cfg, today_key: TODAY, now: orderingNow, selected_day: TODAY, calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.deepEqual(model.sections[0].rows.map((row) => row.title), ["Ganztag", "Task 09 A", "Task 09 B", "Termin 10", "Ohne Zeit"]);
  assert.equal(model.sections[0].rows.every((row) => row.reserve_location_line === true), true);

  const before = buildAgendaModel({
    config: config({ presentation_mode: "day", task_order_mode: "tasks_before", calendars: [{ entity_id: "calendar.family" }], task_lists: [{ entity_id: "todo.first" }, { entity_id: "todo.second" }] }),
    today_key: TODAY, now: orderingNow, selected_day: TODAY, calendar_snapshot: cal, tasks_snapshot: tasks,
  });
  assert.deepEqual(before.sections[0].rows.map((row) => row.kind), ["task", "task", "task", "event", "event"]);
});

test("mode bounds, German headers, source notices, empty states and scheduler candidates are deterministic", () => {
  const cal = calendarSnapshot({
    "calendar.family": { status: "unavailable", reason: "source_unavailable", name: "Familie", events: [] },
  });
  const tasks = taskSnapshot({ "todo.home": availableTasks([]) });
  const dayCfg = config({ presentation_mode: "day", lookback_days: 1, lookahead_days: 2 });
  const day = buildAgendaModel({ config: dayCfg, today_key: TODAY, now: NOW, selected_day: TODAY, calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.deepEqual(day.bounds, { start_day: "2026-10-03", end_day: "2026-10-06" });
  assert.equal(day.sections[0].header, "Heute · So, 4. Oktober");
  assert.equal(day.empty_state, "Keine Termine oder Aufgaben");
  assert.deepEqual(day.source_notices, [{ domain: "calendar", source_entity_id: "calendar.family", name: "Familie", reason: "source_unavailable" }]);

  const other = buildAgendaModel({ config: dayCfg, today_key: TODAY, now: NOW, selected_day: "2026-10-05", calendar_snapshot: cal, tasks_snapshot: tasks });
  assert.equal(other.sections[0].header, "Mo, 5. Oktober");

  const taskOnly = config({ calendar_enabled: false, tasks_enabled: true, calendars: [], task_lists: [{ entity_id: "todo.home" }], lookahead_days: 4 });
  const taskOnlyModel = buildAgendaModel({ config: taskOnly, today_key: TODAY, now: NOW, calendar_snapshot: null, tasks_snapshot: tasks });
  assert.deepEqual(taskOnlyModel.bounds, { start_day: TODAY, end_day: "2026-10-08" });
  assert.equal(taskOnlyModel.empty_state, "Keine Aufgaben");

  const scheduledCfg = config({ presentation_mode: "grouped" });
  const scheduled = buildAgendaModel({
    config: scheduledCfg,
    today_key: TODAY,
    now: NOW,
    calendar_snapshot: calendarSnapshot({ "calendar.family": availableEvents([
      timed("calendar.family", "Später", "2026-10-04T12:00:00Z", "2026-10-04T13:00:00Z"),
    ]) }),
    tasks_snapshot: tasks,
  });
  assert.deepEqual(scheduled.scheduler_candidates, ["2026-10-04T12:00:00.000Z", "2026-10-04T13:00:00.000Z"]);
  assert.equal(scheduled.sections[0].header, "Heute");
});
