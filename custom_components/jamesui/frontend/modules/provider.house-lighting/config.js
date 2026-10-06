import { validateHouseSourceBinding } from "../../shared/house-source.js";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function validateGroup(items, name, sourceIds) {
  if (!Array.isArray(items)) throw new TypeError(`House lighting config.${name} must be an array`);
  const ids = new Set();
  return Object.freeze(items.map((item, index) => {
    if (!isPlainObject(item)) throw new TypeError(`${name}[${index}] must be a plain object`);
    const allowed = new Set(["id", "name", "state"]);
    for (const key of Object.keys(item)) {
      if (!allowed.has(key)) throw new TypeError(`${name}[${index}] contains unsupported field: ${key}`);
    }
    const id = nonEmptyString(item.id, `${name}[${index}].id`);
    if (ids.has(id)) throw new TypeError(`duplicate light id: ${id}`);
    ids.add(id);
    const state = validateHouseSourceBinding(item.state, `${name}[${index}].state`, { boolean: true });
    if (sourceIds.has(state.entity_id)) throw new TypeError(`duplicate lighting source: ${state.entity_id}`);
    sourceIds.add(state.entity_id);
    return Object.freeze({ id, name: nonEmptyString(item.name, `${name}[${index}].name`), state });
  }));
}

export function validateHouseLightingConfig(config) {
  if (!isPlainObject(config)) throw new TypeError("House lighting config must be a plain object");
  if (!Object.prototype.hasOwnProperty.call(config, "lights")) throw new TypeError("House lighting config.lights must be an array");
  if (!Object.prototype.hasOwnProperty.call(config, "ambient_lights")) throw new TypeError("House lighting config.ambient_lights must be an array");
  for (const key of Object.keys(config)) {
    if (key !== "lights" && key !== "ambient_lights") throw new TypeError(`House lighting config contains unsupported field: ${key}`);
  }
  const sourceIds = new Set();
  const lights = validateGroup(config.lights, "lights", sourceIds);
  const ambientLights = validateGroup(config.ambient_lights, "ambient_lights", sourceIds);
  return Object.freeze({ lights, ambient_lights: ambientLights });
}
