import {
  addDateKey,
  shiftInstantByLocalDays,
  zonedStartOfDate,
} from "../../shared/zoned-time.js";
import { logicalEventKey } from "./model.js";
import { presentationForEvent } from "./presentation.js";

export const NOTICE_DISMISSAL_STORAGE_KEY = "jamesui-agenda-notice-dismissals-v1";
const STORAGE_VERSION = 1;
const COLLAPSED_NOTICE_LIMIT = 2;

function validInstant(value) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function freshState() {
  return { version: STORAGE_VERSION, instances: {} };
}

function normalizeStoredState(value) {
  if (!plainObject(value) || value.version !== STORAGE_VERSION || !plainObject(value.instances)) return null;
  const state = freshState();
  for (const [instanceId, records] of Object.entries(value.instances)) {
    if (typeof instanceId !== "string" || !instanceId || !plainObject(records)) return null;
    const normalizedRecords = {};
    for (const [key, expiry] of Object.entries(records)) {
      const normalizedExpiry = validInstant(expiry);
      if (typeof key !== "string" || !key || !normalizedExpiry) return null;
      normalizedRecords[key] = normalizedExpiry;
    }
    state.instances[instanceId] = normalizedRecords;
  }
  return state;
}

function readStoredState(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    return { state: freshState(), persistent: false };
  }
  try {
    const raw = storage.getItem(NOTICE_DISMISSAL_STORAGE_KEY);
    if (raw === null) return { state: freshState(), persistent: true };
    const parsed = JSON.parse(raw);
    const normalized = normalizeStoredState(parsed);
    if (!normalized) return { state: freshState(), persistent: false };
    return { state: normalized, persistent: true };
  } catch {
    return { state: freshState(), persistent: false };
  }
}

function pruneState(state, nowIso) {
  const now = validInstant(nowIso);
  if (!now) return 0;
  const nowMs = new Date(now).valueOf();
  let removed = 0;
  for (const [instanceId, records] of Object.entries(state.instances)) {
    for (const [key, expiry] of Object.entries(records)) {
      if (new Date(expiry).valueOf() <= nowMs) {
        delete records[key];
        removed += 1;
      }
    }
    if (Object.keys(records).length === 0) delete state.instances[instanceId];
  }
  return removed;
}

export function createNoticeDismissalStore({ storage = null, instance_id: instanceId, now } = {}) {
  if (typeof instanceId !== "string" || instanceId.trim() === "") {
    throw new TypeError("notice dismissal store requires instance_id");
  }
  if (!validInstant(now)) throw new TypeError("notice dismissal store requires valid now instant");

  const loaded = readStoredState(storage);
  const state = loaded.state;
  let persistent = loaded.persistent;

  const persist = () => {
    if (!persistent) return false;
    try {
      storage.setItem(NOTICE_DISMISSAL_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      persistent = false;
      return false;
    }
  };

  if (pruneState(state, now) > 0) persist();

  return Object.freeze({
    instance_id: instanceId,

    isDismissed(key, at) {
      if (typeof key !== "string" || !key || !validInstant(at)) return false;
      const expiry = state.instances[instanceId]?.[key];
      return Boolean(expiry && new Date(expiry).valueOf() > new Date(at).valueOf());
    },

    dismiss(key, expiry) {
      const normalizedExpiry = validInstant(expiry);
      if (typeof key !== "string" || !key || !normalizedExpiry) return false;
      if (!state.instances[instanceId]) state.instances[instanceId] = {};
      state.instances[instanceId][key] = normalizedExpiry;
      persist();
      return true;
    },

    prune(at) {
      const removed = pruneState(state, at);
      if (removed > 0) persist();
      return removed;
    },
  });
}

export function eventStartInstant(event, timeZone) {
  if (!event || typeof event !== "object") return null;
  if (event.all_day === true) return zonedStartOfDate(event.start_date, timeZone);
  if (event.all_day === false) return validInstant(event.start_at);
  return null;
}

export function advanceNoticeThreshold(event, advanceDays, timeZone) {
  if (!Number.isInteger(advanceDays) || advanceDays <= 0 || advanceDays > 365) return null;
  if (!event || typeof event !== "object") return null;
  if (event.all_day === true) {
    const thresholdDate = addDateKey(event.start_date, -advanceDays);
    return thresholdDate ? zonedStartOfDate(thresholdDate, timeZone) : null;
  }
  if (event.all_day === false) {
    return shiftInstantByLocalDays(event.start_at, -advanceDays, timeZone);
  }
  return null;
}

function immutableNotice(event, key, presentation, thresholdAt, eventStartAt) {
  return Object.freeze({
    logical_event_key: key,
    title: event.title,
    all_day: event.all_day,
    threshold_at: thresholdAt,
    event_start_at: eventStartAt,
    advance_notice_days: presentation.advance_notice_days,
    presentation,
    event,
  });
}

export function buildAdvanceNotices({
  events = [],
  config,
  time_zone: timeZone,
  now,
  dismissal_store: dismissalStore = null,
  expanded = false,
} = {}) {
  if (!Array.isArray(events)) throw new TypeError("advance notice events must be an array");
  if (!config || typeof config !== "object") throw new TypeError("advance notice config is required");
  const nowIso = validInstant(now);
  if (!nowIso) throw new TypeError("advance notice now must be a valid instant");
  const nowMs = new Date(nowIso).valueOf();
  const notices = [];

  for (const event of events) {
    let key;
    try {
      key = logicalEventKey(event);
    } catch {
      continue;
    }
    const presentation = presentationForEvent(event, config);
    const advanceDays = presentation.advance_notice_days;
    if (!Number.isInteger(advanceDays) || advanceDays <= 0) continue;
    const eventStartAt = eventStartInstant(event, timeZone);
    const thresholdAt = advanceNoticeThreshold(event, advanceDays, timeZone);
    if (!eventStartAt || !thresholdAt) continue;
    const startMs = new Date(eventStartAt).valueOf();
    const thresholdMs = new Date(thresholdAt).valueOf();
    if (startMs <= nowMs || thresholdMs > nowMs) continue;
    if (dismissalStore?.isDismissed?.(key, nowIso)) continue;
    notices.push(immutableNotice(event, key, presentation, thresholdAt, eventStartAt));
  }

  notices.sort((left, right) => (
    new Date(left.event_start_at).valueOf() - new Date(right.event_start_at).valueOf()
    || left.title.localeCompare(right.title, "de-DE", { sensitivity: "base" })
  ));

  const all = Object.freeze([...notices]);
  const visible = Object.freeze(expanded ? [...notices] : notices.slice(0, COLLAPSED_NOTICE_LIMIT));
  return Object.freeze({
    all,
    visible,
    hidden_count: expanded ? 0 : Math.max(0, notices.length - COLLAPSED_NOTICE_LIMIT),
    expanded: Boolean(expanded),
  });
}
