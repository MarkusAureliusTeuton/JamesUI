import test from "node:test";
import assert from "node:assert/strict";

import {
  addDateKey,
  dateKeyInTimeZone,
  formatZonedTime,
  isDateKey,
  shiftInstantByLocalDays,
  zonedLocalToInstant,
  zonedStartOfDate,
} from "../custom_components/jamesui/frontend/shared/zoned-time.js";

test("validates and adds calendar date keys without instant arithmetic", () => {
  assert.equal(isDateKey("2026-03-29"), true);
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("2026-3-9"), false);
  assert.equal(addDateKey("2026-03-28", 1), "2026-03-29");
  assert.equal(addDateKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDateKey("bad", 1), null);
});

test("projects instants to explicit Home Assistant timezone only", () => {
  assert.equal(dateKeyInTimeZone("2026-10-04T22:30:00Z", "Europe/Berlin"), "2026-10-05");
  assert.equal(formatZonedTime("2026-10-04T22:30:00Z", "Europe/Berlin"), "00:30");
  assert.equal(dateKeyInTimeZone("2026-10-04T22:30:00Z", "Mars/Olympus"), null);
  assert.equal(formatZonedTime("bad", "Europe/Berlin"), null);
});

test("resolves Berlin local midnight correctly across spring DST", () => {
  assert.equal(zonedStartOfDate("2026-03-29", "Europe/Berlin"), "2026-03-28T23:00:00.000Z");
  assert.equal(zonedStartOfDate("2026-03-30", "Europe/Berlin"), "2026-03-29T22:00:00.000Z");
});

test("resolves Berlin local midnight correctly across autumn DST", () => {
  assert.equal(zonedStartOfDate("2026-10-25", "Europe/Berlin"), "2026-10-24T22:00:00.000Z");
  assert.equal(zonedStartOfDate("2026-10-26", "Europe/Berlin"), "2026-10-25T23:00:00.000Z");
});

test("resolves arbitrary valid local wall time and rejects nonexistent local wall time", () => {
  assert.equal(
    zonedLocalToInstant({ dateKey: "2026-03-28", hour: 10, minute: 30 }, "Europe/Berlin"),
    "2026-03-28T09:30:00.000Z",
  );
  assert.equal(
    zonedLocalToInstant({ dateKey: "2026-03-29", hour: 2, minute: 30 }, "Europe/Berlin"),
    null,
  );
});

test("shifts timed instants by local calendar days while preserving wall clock through DST", () => {
  assert.equal(
    shiftInstantByLocalDays("2026-04-02T08:30:00.000Z", -7, "Europe/Berlin"),
    "2026-03-26T09:30:00.000Z",
  );
  assert.equal(
    shiftInstantByLocalDays("2026-10-29T09:30:00.000Z", -7, "Europe/Berlin"),
    "2026-10-22T08:30:00.000Z",
  );
});

test("invalid date timezone and instant inputs return null instead of browser-local guesses", () => {
  assert.equal(zonedStartOfDate("2026-02-30", "Europe/Berlin"), null);
  assert.equal(zonedStartOfDate("2026-10-04", "Mars/Olympus"), null);
  assert.equal(zonedLocalToInstant({ dateKey: "bad", hour: 10 }, "Europe/Berlin"), null);
  assert.equal(shiftInstantByLocalDays("bad", 1, "Europe/Berlin"), null);
});
