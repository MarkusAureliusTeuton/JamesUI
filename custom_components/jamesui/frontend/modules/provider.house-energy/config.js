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

export function validateHouseEnergyConfig(config) {
  if (!isPlainObject(config)) throw new TypeError("House energy config must be a plain object");
  if (!Array.isArray(config.sources)) throw new TypeError("House energy config.sources must be an array");
  for (const key of Object.keys(config)) {
    if (key !== "sources") throw new TypeError(`House energy config contains unsupported field: ${key}`);
  }

  const ids = new Set();
  const sources = config.sources.map((source, index) => {
    if (!isPlainObject(source)) throw new TypeError(`sources[${index}] must be a plain object`);
    const allowed = new Set(["id", "name", "power"]);
    for (const key of Object.keys(source)) {
      if (!allowed.has(key)) throw new TypeError(`sources[${index}] contains unsupported field: ${key}`);
    }
    const id = nonEmptyString(source.id, `sources[${index}].id`);
    if (ids.has(id)) throw new TypeError(`duplicate energy source id: ${id}`);
    ids.add(id);
    return Object.freeze({
      id,
      name: nonEmptyString(source.name, `sources[${index}].name`),
      power: validateHouseSourceBinding(source.power, `sources[${index}].power`),
    });
  });
  return Object.freeze({ sources: Object.freeze(sources) });
}
