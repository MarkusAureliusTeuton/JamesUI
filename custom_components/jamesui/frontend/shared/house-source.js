const UNAVAILABLE_VALUES = new Set(["unknown", "unavailable"]);
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

function normalizeMapping(values, name) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${name} must be a non-empty array`);
  }
  const normalized = values.map((value, index) => nonEmptyString(String(value), `${name}[${index}]`).toLowerCase());
  if (new Set(normalized).size !== normalized.length) throw new TypeError(`${name} contains duplicate values`);
  return Object.freeze(normalized);
}

export function validateHouseSourceBinding(value, name, { boolean = false } = {}) {
  if (!isPlainObject(value)) throw new TypeError(`${name} must be a plain object`);
  const allowed = new Set(["entity_id", "attribute", ...(boolean ? ["true_values", "false_values"] : [])]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${name} has unknown field: ${key}`);
  }
  const binding = { entity_id: nonEmptyString(value.entity_id, `${name}.entity_id`) };
  if (value.attribute !== undefined) binding.attribute = nonEmptyString(value.attribute, `${name}.attribute`);
  if (boolean) {
    const trueValues = value.true_values === undefined ? DEFAULT_TRUE_VALUES : normalizeMapping(value.true_values, `${name}.true_values`);
    const falseValues = value.false_values === undefined ? DEFAULT_FALSE_VALUES : normalizeMapping(value.false_values, `${name}.false_values`);
    const overlap = trueValues.find((entry) => falseValues.includes(entry));
    if (overlap !== undefined) throw new TypeError(`${name} boolean mappings overlap: ${overlap}`);
    binding.true_values = trueValues;
    binding.false_values = falseValues;
  }
  return Object.freeze(binding);
}

export function readHouseSourceValue(state, binding) {
  if (!state) return Object.freeze({ status: "unavailable", value: null, reason: "source_missing" });
  const rawState = state.state;
  if (typeof rawState === "string" && UNAVAILABLE_VALUES.has(rawState.trim().toLowerCase())) {
    return Object.freeze({ status: "unavailable", value: null, reason: "source_unavailable" });
  }
  let value;
  if (binding.attribute !== undefined) {
    if (!state.attributes || !(binding.attribute in state.attributes)) {
      return Object.freeze({ status: "unavailable", value: null, reason: "attribute_missing" });
    }
    value = state.attributes[binding.attribute];
  } else {
    value = rawState;
  }
  if (value === null || value === undefined) {
    return Object.freeze({ status: "unavailable", value: null, reason: "value_missing" });
  }
  if (typeof value === "string" && UNAVAILABLE_VALUES.has(value.trim().toLowerCase())) {
    return Object.freeze({ status: "unavailable", value: null, reason: "source_unavailable" });
  }
  return Object.freeze({ status: "available", value, reason: null });
}

export function readHouseSourceNumber(state, binding) {
  const raw = readHouseSourceValue(state, binding);
  if (raw.status !== "available") return raw;
  const value = typeof raw.value === "number" ? raw.value : Number(raw.value);
  if (!Number.isFinite(value)) return Object.freeze({ status: "unavailable", value: null, reason: "value_unrecognized" });
  return Object.freeze({ status: "available", value, reason: null });
}

export function readHouseSourceBoolean(state, binding) {
  const raw = readHouseSourceValue(state, binding);
  if (raw.status !== "available") return raw;
  const normalized = String(raw.value).trim().toLowerCase();
  const trueValues = binding.true_values ?? DEFAULT_TRUE_VALUES;
  const falseValues = binding.false_values ?? DEFAULT_FALSE_VALUES;
  if (trueValues.includes(normalized)) return Object.freeze({ status: "available", value: true, reason: null });
  if (falseValues.includes(normalized)) return Object.freeze({ status: "available", value: false, reason: null });
  return Object.freeze({ status: "unavailable", value: null, reason: "value_unrecognized" });
}
