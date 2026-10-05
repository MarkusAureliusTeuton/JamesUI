const ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const ALLOWED_KEYS = Object.freeze(["source_entity_ids"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validTodoEntityId(value) {
  return typeof value === "string"
    && ENTITY_ID_PATTERN.test(value)
    && value.startsWith("todo.");
}

export function validateTasksProviderConfig(config = {}) {
  if (!isPlainObject(config)) throw new TypeError("tasks provider config must be a plain object");
  for (const key of Object.keys(config)) {
    if (!ALLOWED_KEYS.includes(key)) throw new TypeError(`unknown tasks provider config key: ${key}`);
  }

  const sourceEntityIds = config.source_entity_ids ?? [];
  if (!Array.isArray(sourceEntityIds)) throw new TypeError("source_entity_ids must be an array");
  const normalized = [];
  const seen = new Set();
  for (const value of sourceEntityIds) {
    if (!validTodoEntityId(value)) throw new TypeError("source_entity_ids must contain todo entity IDs");
    if (seen.has(value)) throw new TypeError(`duplicate todo source: ${value}`);
    seen.add(value);
    normalized.push(value);
  }
  return Object.freeze({ source_entity_ids: Object.freeze(normalized) });
}
