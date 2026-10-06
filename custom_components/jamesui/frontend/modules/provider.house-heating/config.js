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

export function validateHouseHeatingConfig(config) {
  if (!isPlainObject(config)) throw new TypeError("House heating config must be a plain object");
  if (!Array.isArray(config.zones)) throw new TypeError("House heating config.zones must be an array");
  for (const key of Object.keys(config)) {
    if (key !== "zones") throw new TypeError(`House heating config contains unsupported field: ${key}`);
  }

  const ids = new Set();
  const zones = config.zones.map((zone, index) => {
    if (!isPlainObject(zone)) throw new TypeError(`zones[${index}] must be a plain object`);
    const allowed = new Set([
      "id", "name", "current_temperature", "target_temperature", "heating_demand", "auto_regulation_enabled",
    ]);
    for (const key of Object.keys(zone)) {
      if (!allowed.has(key)) throw new TypeError(`zones[${index}] contains unsupported field: ${key}`);
    }
    const id = nonEmptyString(zone.id, `zones[${index}].id`);
    if (ids.has(id)) throw new TypeError(`duplicate zone id: ${id}`);
    ids.add(id);
    return Object.freeze({
      id,
      name: nonEmptyString(zone.name, `zones[${index}].name`),
      current_temperature: validateHouseSourceBinding(zone.current_temperature, `zones[${index}].current_temperature`),
      target_temperature: validateHouseSourceBinding(zone.target_temperature, `zones[${index}].target_temperature`),
      heating_demand: validateHouseSourceBinding(zone.heating_demand, `zones[${index}].heating_demand`, { boolean: true }),
      auto_regulation_enabled: validateHouseSourceBinding(zone.auto_regulation_enabled, `zones[${index}].auto_regulation_enabled`, { boolean: true }),
    });
  });
  return Object.freeze({ zones: Object.freeze(zones) });
}
