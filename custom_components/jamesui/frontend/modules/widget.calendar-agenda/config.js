import { hasIcon } from "../../icons/icon-registry.js";

const ROOT_KEYS = Object.freeze([
  "instance_id",
  "presentation_mode",
  "calendar_enabled",
  "tasks_enabled",
  "visible_items_mode",
  "max_visible_items",
  "lookahead_days",
  "lookback_days",
  "show_all_day",
  "show_location",
  "task_order_mode",
  "untimed_task_position",
  "calendars",
  "task_lists",
]);
const CALENDAR_KEYS = Object.freeze([
  "entity_id",
  "lookahead_days",
  "icon_id",
  "accent",
  "advance_notice_days",
  "rules",
]);
const TASK_LIST_KEYS = Object.freeze(["entity_id", "icon_id", "accent"]);
const RULE_KEYS = Object.freeze([
  "operator",
  "query",
  "include_description",
  "include_location",
  "icon_id",
  "accent",
  "advance_notice_days",
]);

const ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/;
const PRESENTATION_MODES = Object.freeze(["grouped", "timeline", "day"]);
const VISIBLE_ITEMS_MODES = Object.freeze(["fixed", "auto"]);
const TASK_ORDER_MODES = Object.freeze(["chronological", "tasks_before", "tasks_after"]);
const UNTIMED_TASK_POSITIONS = Object.freeze(["before", "after"]);
const RULE_OPERATORS = Object.freeze(["exact", "contains", "starts_with"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnknownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`unknown ${label} key: ${key}`);
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean`);
  return value;
}

function requireIntegerRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) throw new TypeError(`${label} must be one of ${allowed.join(", ")}`);
  return value;
}

function normalizeAccent(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !ACCENT_PATTERN.test(value)) throw new TypeError(`${label} must be #RRGGBB or null`);
  return value;
}

function normalizeIcon(value, fallback, label, { nullable = false } = {}) {
  const iconId = value === undefined ? fallback : value;
  if (nullable && iconId === null) return null;
  if (typeof iconId !== "string" || !hasIcon(iconId)) throw new TypeError(`${label} must reference a registered icon`);
  return iconId;
}

function normalizeEntityId(value, domain, label) {
  if (typeof value !== "string" || !ENTITY_ID_PATTERN.test(value) || !value.startsWith(`${domain}.`)) {
    throw new TypeError(`${label} must be a ${domain} entity id`);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeRule(rule) {
  if (!isPlainObject(rule)) throw new TypeError("calendar rule must be a plain object");
  rejectUnknownKeys(rule, RULE_KEYS, "calendar rule");
  const operator = requireEnum(rule.operator, RULE_OPERATORS, "calendar rule operator");
  const query = requireNonEmptyString(rule.query, "calendar rule query");
  const includeDescription = rule.include_description === undefined
    ? false
    : requireBoolean(rule.include_description, "include_description");
  const includeLocation = rule.include_location === undefined
    ? false
    : requireBoolean(rule.include_location, "include_location");
  const advanceNoticeDays = rule.advance_notice_days === undefined || rule.advance_notice_days === null
    ? null
    : requireIntegerRange(rule.advance_notice_days, 0, 365, "calendar rule advance_notice_days");

  return {
    operator,
    query,
    include_description: includeDescription,
    include_location: includeLocation,
    icon_id: normalizeIcon(rule.icon_id, null, "calendar rule icon_id", { nullable: true }),
    accent: normalizeAccent(rule.accent, "calendar rule accent"),
    advance_notice_days: advanceNoticeDays,
  };
}

function normalizeCalendar(calendar) {
  if (!isPlainObject(calendar)) throw new TypeError("calendar config must be a plain object");
  rejectUnknownKeys(calendar, CALENDAR_KEYS, "calendar config");
  const rules = calendar.rules ?? [];
  if (!Array.isArray(rules)) throw new TypeError("calendar rules must be an array");
  const lookaheadDays = calendar.lookahead_days === undefined || calendar.lookahead_days === null
    ? null
    : requireIntegerRange(calendar.lookahead_days, 1, 365, "calendar lookahead_days");
  const advanceNoticeDays = calendar.advance_notice_days === undefined
    ? 0
    : requireIntegerRange(calendar.advance_notice_days, 0, 365, "calendar advance_notice_days");

  return {
    entity_id: normalizeEntityId(calendar.entity_id, "calendar", "calendar entity_id"),
    lookahead_days: lookaheadDays,
    icon_id: normalizeIcon(calendar.icon_id, "home.calendar", "calendar icon_id"),
    accent: normalizeAccent(calendar.accent, "calendar accent"),
    advance_notice_days: advanceNoticeDays,
    rules: rules.map(normalizeRule),
  };
}

function normalizeTaskList(taskList) {
  if (!isPlainObject(taskList)) throw new TypeError("task list config must be a plain object");
  rejectUnknownKeys(taskList, TASK_LIST_KEYS, "task list config");
  return {
    entity_id: normalizeEntityId(taskList.entity_id, "todo", "task list entity_id"),
    icon_id: normalizeIcon(taskList.icon_id, "home.task", "task list icon_id"),
    accent: normalizeAccent(taskList.accent, "task list accent"),
  };
}

function rejectDuplicates(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.entity_id)) throw new TypeError(`duplicate ${label}: ${item.entity_id}`);
    seen.add(item.entity_id);
  }
}

export function validateCalendarAgendaConfig(config) {
  if (!isPlainObject(config)) throw new TypeError("Agenda config must be a plain object");
  rejectUnknownKeys(config, ROOT_KEYS, "Agenda config");

  const calendarEnabled = config.calendar_enabled === undefined
    ? true
    : requireBoolean(config.calendar_enabled, "calendar_enabled");
  const tasksEnabled = config.tasks_enabled === undefined
    ? true
    : requireBoolean(config.tasks_enabled, "tasks_enabled");
  if (!calendarEnabled && !tasksEnabled) throw new TypeError("at least one Agenda domain must be enabled");

  const calendarsInput = config.calendars ?? [];
  const taskListsInput = config.task_lists ?? [];
  if (!Array.isArray(calendarsInput)) throw new TypeError("calendars must be an array");
  if (!Array.isArray(taskListsInput)) throw new TypeError("task_lists must be an array");

  const calendars = calendarsInput.map(normalizeCalendar);
  const taskLists = taskListsInput.map(normalizeTaskList);
  rejectDuplicates(calendars, "calendar source");
  rejectDuplicates(taskLists, "task list source");
  if (calendarEnabled && calendars.length === 0) throw new TypeError("calendar_enabled requires at least one calendar");
  if (tasksEnabled && taskLists.length === 0) throw new TypeError("tasks_enabled requires at least one task list");

  const normalized = {
    instance_id: requireNonEmptyString(config.instance_id, "instance_id"),
    presentation_mode: requireEnum(config.presentation_mode ?? "grouped", PRESENTATION_MODES, "presentation_mode"),
    calendar_enabled: calendarEnabled,
    tasks_enabled: tasksEnabled,
    visible_items_mode: requireEnum(config.visible_items_mode ?? "auto", VISIBLE_ITEMS_MODES, "visible_items_mode"),
    max_visible_items: requireIntegerRange(config.max_visible_items ?? 5, 3, 8, "max_visible_items"),
    lookahead_days: requireIntegerRange(config.lookahead_days ?? 30, 1, 365, "lookahead_days"),
    lookback_days: requireIntegerRange(config.lookback_days ?? 7, 0, 365, "lookback_days"),
    show_all_day: config.show_all_day === undefined ? true : requireBoolean(config.show_all_day, "show_all_day"),
    show_location: config.show_location === undefined ? false : requireBoolean(config.show_location, "show_location"),
    task_order_mode: requireEnum(config.task_order_mode ?? "chronological", TASK_ORDER_MODES, "task_order_mode"),
    untimed_task_position: requireEnum(config.untimed_task_position ?? "after", UNTIMED_TASK_POSITIONS, "untimed_task_position"),
    calendars,
    task_lists: taskLists,
  };

  return deepFreeze(normalized);
}
