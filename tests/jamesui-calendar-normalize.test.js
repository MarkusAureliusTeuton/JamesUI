import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCalendarEvent,
  normalizeCalendarEvents,
} from "../custom_components/jamesui/frontend/modules/provider.calendar/normalize.js";

test("normalizes an all-day event with exclusive end date and truthful optional fields", () => {
  const event = normalizeCalendarEvent("calendar.family", {
    start: "2026-10-04",
    end: "2026-10-06",
    summary: " Familienfest ",
    description: "  Mitbringen: Kuchen  ",
    location: "  Zuhause  ",
  });

  assert.equal(event.source_entity_id, "calendar.family");
  assert.equal(event.title, "Familienfest");
  assert.equal(event.description, "Mitbringen: Kuchen");
  assert.equal(event.location, "Zuhause");
  assert.equal(event.all_day, true);
  assert.equal(event.start_date, "2026-10-04");
  assert.equal(event.end_date, "2026-10-06");
  assert.equal(event.start_at, null);
  assert.equal(event.end_at, null);
  assert.match(event.occurrence_id, /^jui-cal-/);
  assert.equal(Object.isFrozen(event), true);
});

test("normalizes a timed event without converting its source instant", () => {
  const event = normalizeCalendarEvent("calendar.family", {
    start: "2026-10-04T10:15:00+02:00",
    end: "2026-10-04T11:45:00+02:00",
    summary: "Zahnarzt",
  });

  assert.deepEqual({
    all_day: event.all_day,
    start_date: event.start_date,
    end_date: event.end_date,
    start_at: event.start_at,
    end_at: event.end_at,
    description: event.description,
    location: event.location,
  }, {
    all_day: false,
    start_date: null,
    end_date: null,
    start_at: "2026-10-04T10:15:00+02:00",
    end_at: "2026-10-04T11:45:00+02:00",
    description: null,
    location: null,
  });
});

test("rejects malformed mixed blank and non-positive calendar events instead of guessing", () => {
  const cases = [
    { start: "2026-10-04", end: "2026-10-05", summary: "   " },
    { start: "2026-10-04", end: "2026-10-04", summary: "Same day zero range" },
    { start: "2026-10-05", end: "2026-10-04", summary: "Backwards" },
    { start: "2026-10-04", end: "2026-10-04T11:00:00+02:00", summary: "Mixed" },
    { start: "2026-10-04T10:00:00", end: "2026-10-04T11:00:00", summary: "No timezone" },
    { start: "bad", end: "2026-10-05", summary: "Bad start" },
  ];
  for (const value of cases) assert.equal(normalizeCalendarEvent("calendar.family", value), null);
});

test("occurrence identity is source-specific and changes with title range or all-day semantics", () => {
  const base = { start: "2026-10-04", end: "2026-10-05", summary: "Event" };
  const a = normalizeCalendarEvent("calendar.a", base);
  const same = normalizeCalendarEvent("calendar.a", { ...base });
  const source = normalizeCalendarEvent("calendar.b", base);
  const title = normalizeCalendarEvent("calendar.a", { ...base, summary: "Other" });
  const range = normalizeCalendarEvent("calendar.a", { ...base, end: "2026-10-06" });
  const timed = normalizeCalendarEvent("calendar.a", {
    start: "2026-10-04T00:00:00+02:00",
    end: "2026-10-05T00:00:00+02:00",
    summary: "Event",
  });

  assert.equal(a.occurrence_id, same.occurrence_id);
  for (const candidate of [source, title, range, timed]) assert.notEqual(a.occurrence_id, candidate.occurrence_id);
  assert.equal(Object.prototype.hasOwnProperty.call(a, "uid"), false);
});

test("normalizes arrays immutably and sorts deterministically by start then title", () => {
  const result = normalizeCalendarEvents("calendar.family", [
    { start: "2026-10-05T09:00:00+02:00", end: "2026-10-05T10:00:00+02:00", summary: "Zeta" },
    { start: "2026-10-04", end: "2026-10-05", summary: "Beta" },
    { start: "2026-10-04", end: "2026-10-05", summary: "Alpha" },
    { start: "bad", end: "2026-10-05", summary: "Broken" },
  ]);
  assert.deepEqual(result.map((item) => item.title), ["Alpha", "Beta", "Zeta"]);
  assert.equal(Object.isFrozen(result), true);
});
