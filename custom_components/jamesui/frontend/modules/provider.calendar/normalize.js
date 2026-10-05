import { isDateKey } from "../../shared/zoned-time.js";

const CALENDAR_ENTITY_ID = /^calendar\.[a-z0-9_]+$/;
const TIMED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeText(value, { nullable = false } = {}) {
  if (value === null || value === undefined) return nullable ? null : "";
  if (typeof value !== "string") return nullable ? null : "";
  const trimmed = value.trim();
  return trimmed || (nullable ? null : "");
}

function validTimedInstant(value) {
  return typeof value === "string" && TIMED_ISO.test(value) && Number.isFinite(new Date(value).valueOf());
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function occurrenceId(sourceEntityId, title, start, end, allDay) {
  return `jui-cal-${fnv1a(`${sourceEntityId}\u0000${title}\u0000${start}\u0000${end}\u0000${allDay ? "1" : "0"}`)}`;
}

export function normalizeCalendarEvent(sourceEntityId, event) {
  if (typeof sourceEntityId !== "string" || !CALENDAR_ENTITY_ID.test(sourceEntityId)) return null;
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;

  const title = normalizeText(event.summary);
  if (!title) return null;
  const description = normalizeText(event.description, { nullable: true });
  const location = normalizeText(event.location, { nullable: true });
  const start = event.start;
  const end = event.end;
  const startIsDate = isDateKey(start);
  const endIsDate = isDateKey(end);
  const startIsTimed = validTimedInstant(start);
  const endIsTimed = validTimedInstant(end);

  if (startIsDate && endIsDate) {
    if (end <= start) return null;
    return Object.freeze({
      occurrence_id: occurrenceId(sourceEntityId, title, start, end, true),
      source_entity_id: sourceEntityId,
      title,
      description,
      location,
      all_day: true,
      start_date: start,
      end_date: end,
      start_at: null,
      end_at: null,
    });
  }

  if (startIsTimed && endIsTimed) {
    if (new Date(end).valueOf() <= new Date(start).valueOf()) return null;
    return Object.freeze({
      occurrence_id: occurrenceId(sourceEntityId, title, start, end, false),
      source_entity_id: sourceEntityId,
      title,
      description,
      location,
      all_day: false,
      start_date: null,
      end_date: null,
      start_at: start,
      end_at: end,
    });
  }

  return null;
}

function sortKey(event) {
  return event.all_day ? event.start_date : event.start_at;
}

export function normalizeCalendarEvents(sourceEntityId, events) {
  if (!Array.isArray(events)) return Object.freeze([]);
  const normalized = events
    .map((event) => normalizeCalendarEvent(sourceEntityId, event))
    .filter(Boolean)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title, "de"));
  return Object.freeze(normalized);
}
