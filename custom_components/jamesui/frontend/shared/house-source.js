const DEFAULT_TRUE_VALUES = Object.freeze(["on", "true", "1"]);
const DEFAULT_FALSE_VALUES = Object.freeze(["off", "false", "0"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizedBooleanValue(value) {
  return String(value).trim().toLowerCase();
}

function validateBooleanValues(values, name) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${name} must be a non-empty array`);
  }
  const normalized = values.map((value) => normalizedBooleanValue(value));
  if (normalized.some((value) => value === "")) {
    throw new TypeError(`${name} values must not be empty`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${name} contains duplicate values`);
  }
  return Object.freeze(normalized);
}

export function validateHouseSourceBinding(value, name, { boolean = false } = {}) {
  if (!isPlainObject(value)) throw new TypeError(`${name} binding must be a plain object`);
  const allowed = new Set(["entity_id", "attribute", "true_values", "false_values"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${name} binding contains unsupported field: ${key}`);
  }

  const entityId = nonEmptyString(value.entity_id, `${name}.entity_id`);
  const result = { entity_id: entityId };
  if (value.attribute !== undefined) result.attribute = nonEmptyString(value.attribute, `${name}.attribute`);

  const hasBooleanMapping = value.true_values !== undefined || value.false_values !== undefined;
  if (!boolean && hasBooleanMapping) {
    throw new TypeError(`${name} boolean mappings require boolean mode`);
  }
  if (boolean) {
    const trueValues = value.true_values === undefined
      ? DEFAULT_TRUE_VALUES
      : validateBooleanValues(value.true_values, `${name}.true_values`);
    const falseValues = value.false_values === undefined
      ? DEFAULT_FALSE_VALUES
      : validateBooleanValues(value.false_values, `${name}.false_values`);
    const overlap = trueValues.find((entry) => falseValues.includes(entry));
    if (overlap !== undefined) throw new TypeError(`${name} boolean mappings overlap: ${overlap}`);
    result.true_values = trueValues;
    result.false_values = falseValues;
  }

  return Object.freeze(result);
}

function unavailable(reason) {
  return Object.freeze({ status: "unavailable", value: null, reason });
}

function available(value) {
  return Object.freeze({ status: "available", value, reason: null });
}

export function readHouseSourceValue(state, binding) {
  if (!state) return unavailable("source_missing");
  if (state.state === "unknown") return unavailable("source_unknown");
  if (state.state === "unavailable") return unavailable("source_unavailable");

  if (binding.attribute !== undefined) {
    if (!state.attributes || !Object.prototype.hasOwnProperty.call(state.attributes, binding.attribute)) {
      return unavailable("attribute_missing");
    }
    const value = state.attributes[binding.attribute];
    if (value === undefined || value === null || value === "") return unavailable("value_missing");
    return available(value);
  }

  if (state.state === undefined || state.state === null || state.state === "") return unavailable("value_missing");
  return available(state.state);
}

export function readHouseSourceNumber(state, binding) {
  const raw = readHouseSourceValue(state, binding);
  if (raw.status !== "available") return raw;
  const value = typeof raw.value === "number" ? raw.value : Number(String(raw.value).trim());
  return Number.isFinite(value) ? available(value) : unavailable("value_invalid");
}

export function readHouseSourceBoolean(state, binding) {
  const raw = readHouseSourceValue(state, binding);
  if (raw.status !== "available") return raw;
  const value = normalizedBooleanValue(raw.value);
  if (binding.true_values.includes(value)) return available(true);
  if (binding.false_values.includes(value)) return available(false);
  return unavailable("value_unrecognized");
}
