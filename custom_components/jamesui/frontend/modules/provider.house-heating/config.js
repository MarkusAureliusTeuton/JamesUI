import { validateHouseSourceBinding } from "../../shared/house-source.js";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function nonEmpty(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function rejectUnknown(value, allowed, name) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${name} has unknown field: ${key}`);
}

export function validateHouseHeatingConfig(config = {}) {
  if (!isPlainObject(config)) throw new TypeError("House heating config must be a plain object");
  rejectUnknown(config, new Set(["zones"]), "House heating config");
  if (!Array.isArray(config.zones)) throw new TypeError("House heating config.zones must be an array");
  const ids = new Set();
  const zones = config.zones.map((value, index) => {
    const name = `zones[${index}]`;
    if (!isPlainObject(value)) throw new TypeError(`${name} must be a plain object`);
    rejectUnknown(value, new Set(["id","name","current_temperature","target_temperature","heating_demand","auto_regulation_enabled"]), name);
    const id = nonEmpty(value.id, `${name}.id`);
    if (ids.has(id)) throw new TypeError(`duplicate zone id: ${id}`);
    ids.add(id);
    return Object.freeze({
      id,
      name: nonEmpty(value.name, `${name}.name`),
      current_temperature: validateHouseSourceBinding(value.current_temperature, `${name}.current_temperature`),
      target_temperature: validateHouseSourceBinding(value.target_temperature, `${name}.target_temperature`),
      heating_demand: validateHouseSourceBinding(value.heating_demand, `${name}.heating_demand`, { boolean: true }),
      auto_regulation_enabled: validateHouseSourceBinding(value.auto_regulation_enabled, `${name}.auto_regulation_enabled`, { boolean: true }),
    });
  });
  return Object.freeze({ zones: Object.freeze(zones) });
}
