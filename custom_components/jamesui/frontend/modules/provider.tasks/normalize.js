import { isDateKey } from "../../shared/zoned-time.js";

const TODO_ENTITY_ID = /^todo\.[a-z0-9_]+$/;
const TIMED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const STATUSES = new Set(["needs_action", "completed"]);

function trimmedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value) {
  const text = trimmedText(value);
  return text || null;
}

function validTimedInstant(value) {
  return typeof value === "string" && TIMED_ISO.test(value) && Number.isFinite(new Date(value).valueOf());
}

function normalizeDue(value) {
  if (value === null || value === undefined) {
    return Object.freeze({ kind: "none", value: null });
  }
  if (isDateKey(value)) return Object.freeze({ kind: "date", value });
  if (validTimedInstant(value)) return Object.freeze({ kind: "datetime", value });
  return null;
}

function normalizeCompleted(value) {
  return validTimedInstant(value) ? value : null;
}

export function normalizeTodoItem(sourceEntityId, item) {
  if (typeof sourceEntityId !== "string" || !TODO_ENTITY_ID.test(sourceEntityId)) return null;
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const uid = trimmedText(item.uid);
  const title = trimmedText(item.summary);
  if (!uid || !title || !STATUSES.has(item.status)) return null;
  const due = normalizeDue(item.due);
  if (!due) return null;

  return Object.freeze({
    source_entity_id: sourceEntityId,
    uid,
    title,
    status: item.status,
    due,
    description: optionalText(item.description),
    completed_at: normalizeCompleted(item.completed),
  });
}

export function normalizeTodoItems(sourceEntityId, items) {
  if (!Array.isArray(items)) return Object.freeze([]);
  return Object.freeze(items
    .map((item) => normalizeTodoItem(sourceEntityId, item))
    .filter(Boolean));
}
