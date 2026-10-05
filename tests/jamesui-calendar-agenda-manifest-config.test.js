import test from "node:test";
import assert from "node:assert/strict";

import { validateModuleManifest } from "../custom_components/jamesui/frontend/core/module-manifest.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/manifest.js";
import { validateCalendarAgendaConfig } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/config.js";

function minimal(overrides = {}) {
  return {
    instance_id: "agenda-main",
    calendars: [{ entity_id: "calendar.family" }],
    task_lists: [{ entity_id: "todo.household" }],
    ...overrides,
  };
}

test("defines the immutable Block 11 Agenda widget manifest", () => {
  assert.deepEqual(MANIFEST, {
    id: "widget.calendar-agenda",
    type: "widget",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: ["calendar.events", "tasks.items"],
    provides_capabilities: [],
    config_schema: "widget.calendar-agenda/v1",
  });
  assert.equal(Object.isFrozen(MANIFEST), true);
  assert.equal(Object.isFrozen(MANIFEST.requires_capabilities), true);
  assert.deepEqual(validateModuleManifest(MANIFEST), MANIFEST);
});

test("applies exact Agenda defaults and per-source presentation defaults", () => {
  const result = validateCalendarAgendaConfig(minimal());
  assert.deepEqual(result, {
    instance_id: "agenda-main",
    presentation_mode: "grouped",
    calendar_enabled: true,
    tasks_enabled: true,
    visible_items_mode: "auto",
    max_visible_items: 5,
    lookahead_days: 30,
    lookback_days: 7,
    show_all_day: true,
    show_location: false,
    task_order_mode: "chronological",
    untimed_task_position: "after",
    calendars: [{
      entity_id: "calendar.family",
      lookahead_days: null,
      icon_id: "home.calendar",
      accent: null,
      advance_notice_days: 0,
      rules: [],
    }],
    task_lists: [{
      entity_id: "todo.household",
      icon_id: "home.task",
      accent: null,
    }],
  });
});

test("normalizes full valid config with rule defaults and deep-freezes caller-independent data", () => {
  const input = minimal({
    presentation_mode: "day",
    visible_items_mode: "fixed",
    max_visible_items: 8,
    lookahead_days: 365,
    lookback_days: 0,
    show_all_day: false,
    show_location: true,
    task_order_mode: "tasks_before",
    untimed_task_position: "before",
    calendars: [{
      entity_id: "calendar.family",
      lookahead_days: 14,
      icon_id: "home.birthday",
      accent: "#A1B2C3",
      advance_notice_days: 7,
      rules: [{
        operator: "contains",
        query: " Geburtstag ",
        include_description: true,
        include_location: false,
        icon_id: "home.birthday",
        accent: "#112233",
        advance_notice_days: 3,
      }, {
        operator: "exact",
        query: "privat",
      }],
    }],
    task_lists: [{ entity_id: "todo.household", icon_id: "home.task", accent: "#445566" }],
  });
  const result = validateCalendarAgendaConfig(input);
  assert.equal(result.calendars[0].rules[0].query, "Geburtstag");
  assert.deepEqual(result.calendars[0].rules[1], {
    operator: "exact",
    query: "privat",
    include_description: false,
    include_location: false,
    icon_id: null,
    accent: null,
    advance_notice_days: null,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.calendars), true);
  assert.equal(Object.isFrozen(result.calendars[0]), true);
  assert.equal(Object.isFrozen(result.calendars[0].rules), true);
  assert.equal(Object.isFrozen(result.calendars[0].rules[0]), true);
  assert.equal(Object.isFrozen(result.task_lists[0]), true);
  input.calendars[0].rules[0].query = "changed";
  input.task_lists[0].accent = null;
  assert.equal(result.calendars[0].rules[0].query, "Geburtstag");
  assert.equal(result.task_lists[0].accent, "#445566");
});

test("allows calendar-only and task-only configs but rejects both domains disabled", () => {
  assert.equal(validateCalendarAgendaConfig({
    instance_id: "calendar-only",
    calendar_enabled: true,
    tasks_enabled: false,
    calendars: [{ entity_id: "calendar.family" }],
    task_lists: [],
  }).tasks_enabled, false);
  assert.equal(validateCalendarAgendaConfig({
    instance_id: "task-only",
    calendar_enabled: false,
    tasks_enabled: true,
    calendars: [],
    task_lists: [{ entity_id: "todo.home" }],
  }).calendar_enabled, false);
  assert.throws(() => validateCalendarAgendaConfig({
    instance_id: "none",
    calendar_enabled: false,
    tasks_enabled: false,
    calendars: [],
    task_lists: [],
  }), TypeError);
});

test("rejects enabled domains without selected sources and duplicate or wrong-domain sources", () => {
  assert.throws(() => validateCalendarAgendaConfig(minimal({ calendars: [] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ task_lists: [] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({
    calendars: [{ entity_id: "calendar.family" }, { entity_id: "calendar.family" }],
  })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({
    task_lists: [{ entity_id: "todo.home" }, { entity_id: "todo.home" }],
  })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ calendars: [{ entity_id: "todo.bad" }] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ task_lists: [{ entity_id: "calendar.bad" }] })), TypeError);
});

test("rejects invalid instance enum range accent icon and rule contracts", () => {
  for (const instance_id of [undefined, "", "   ", 12]) {
    const value = minimal();
    if (instance_id === undefined) delete value.instance_id;
    else value.instance_id = instance_id;
    assert.throws(() => validateCalendarAgendaConfig(value), TypeError);
  }
  for (const [field, value] of [
    ["presentation_mode", "month"],
    ["visible_items_mode", "grow"],
    ["task_order_mode", "random"],
    ["untimed_task_position", "middle"],
    ["lookahead_days", 0],
    ["lookahead_days", 366],
    ["lookback_days", -1],
    ["lookback_days", 366],
    ["max_visible_items", 2],
    ["max_visible_items", 9],
  ]) assert.throws(() => validateCalendarAgendaConfig(minimal({ [field]: value })), TypeError);

  assert.throws(() => validateCalendarAgendaConfig(minimal({ calendars: [{ entity_id: "calendar.family", lookahead_days: 0 }] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ calendars: [{ entity_id: "calendar.family", advance_notice_days: 366 }] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ calendars: [{ entity_id: "calendar.family", accent: "red" }] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ task_lists: [{ entity_id: "todo.home", accent: "#12345" }] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ calendars: [{ entity_id: "calendar.family", icon_id: "home.not-real" }] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ task_lists: [{ entity_id: "todo.home", icon_id: "weather.not-real" }] })), TypeError);

  for (const rule of [
    { operator: "regex", query: "x" },
    { operator: "exact", query: "   " },
    { operator: "contains", query: "x", include_description: "yes" },
    { operator: "contains", query: "x", include_location: 1 },
    { operator: "starts_with", query: "x", icon_id: "home.not-real" },
    { operator: "starts_with", query: "x", accent: "#12" },
    { operator: "starts_with", query: "x", advance_notice_days: 366 },
  ]) {
    assert.throws(() => validateCalendarAgendaConfig(minimal({
      calendars: [{ entity_id: "calendar.family", rules: [rule] }],
    })), TypeError);
  }
});

test("rejects unknown root and nested fields instead of silently accepting future schema", () => {
  assert.throws(() => validateCalendarAgendaConfig({ ...minimal(), extra: true }), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ calendars: [{ entity_id: "calendar.family", extra: true }] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({ task_lists: [{ entity_id: "todo.home", extra: true }] })), TypeError);
  assert.throws(() => validateCalendarAgendaConfig(minimal({
    calendars: [{ entity_id: "calendar.family", rules: [{ operator: "exact", query: "x", extra: true }] }],
  })), TypeError);
});
