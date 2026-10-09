function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function scalarKey(value) {
  return `${typeof value}:${String(value)}`;
}

function validateScalar(value, name) {
  const type = typeof value;
  if (type === "string" || type === "boolean") return value;
  if (type === "number" && Number.isFinite(value)) return value;
  throw new TypeError(`${name} must be a JSON scalar (string, finite number, or boolean)`);
}

function validateValues(values, name, seen) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError(`${name} must be a non-empty array`);
  const local = new Set();
  const normalized = values.map((value, index) => {
    const scalar = validateScalar(value, `${name}[${index}]`);
    const key = scalarKey(scalar);
    if (local.has(key)) throw new TypeError(`${name} contains duplicate value`);
    if (seen.has(key)) throw new TypeError(`${name} overlaps another mapping`);
    local.add(key);
    seen.add(key);
    return scalar;
  });
  return Object.freeze(normalized);
}

function validateSource(source, index) {
  if (!isPlainObject(source)) throw new TypeError(`sources[${index}] must be a plain object`);
  const allowed = new Set(["id", "entity_id", "attribute", "active_values", "inactive_values", "intermediate"]);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) throw new TypeError(`sources[${index}] contains unsupported field: ${key}`);
  }

  const seenValues = new Set();
  const normalized = {
    id: nonEmptyString(source.id, `sources[${index}].id`),
    entity_id: nonEmptyString(source.entity_id, `sources[${index}].entity_id`),
  };
  if (source.attribute !== undefined) normalized.attribute = nonEmptyString(source.attribute, `sources[${index}].attribute`);
  normalized.active_values = validateValues(source.active_values, `sources[${index}].active_values`, seenValues);
  normalized.inactive_values = validateValues(source.inactive_values, `sources[${index}].inactive_values`, seenValues);

  const intermediate = source.intermediate === undefined ? [] : source.intermediate;
  if (!Array.isArray(intermediate)) throw new TypeError(`sources[${index}].intermediate must be an array`);
  const intermediateIds = new Set();
  normalized.intermediate = Object.freeze(intermediate.map((entry, entryIndex) => {
    if (!isPlainObject(entry)) throw new TypeError(`sources[${index}].intermediate[${entryIndex}] must be a plain object`);
    for (const key of Object.keys(entry)) {
      if (key !== "id" && key !== "values") throw new TypeError(`sources[${index}].intermediate[${entryIndex}] contains unsupported field: ${key}`);
    }
    const id = nonEmptyString(entry.id, `sources[${index}].intermediate[${entryIndex}].id`);
    if (intermediateIds.has(id)) throw new TypeError(`duplicate intermediate id: ${id}`);
    intermediateIds.add(id);
    return Object.freeze({
      id,
      values: validateValues(entry.values, `sources[${index}].intermediate[${entryIndex}].values`, seenValues),
    });
  }));
  return Object.freeze(normalized);
}

export function validateControlStateConfig(config) {
  if (!isPlainObject(config)) throw new TypeError("Control State config must be a plain object");
  if (!Array.isArray(config.sources)) throw new TypeError("Control State config.sources must be an array");
  for (const key of Object.keys(config)) {
    if (key !== "sources") throw new TypeError(`Control State config contains unsupported field: ${key}`);
  }
  const ids = new Set();
  const sources = config.sources.map((source, index) => {
    const normalized = validateSource(source, index);
    if (ids.has(normalized.id)) throw new TypeError(`duplicate source id: ${normalized.id}`);
    ids.add(normalized.id);
    return normalized;
  });
  return Object.freeze({ sources: Object.freeze(sources) });
}
