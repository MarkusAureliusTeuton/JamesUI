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

const SIGNAL_KEYS = Object.freeze(["active", "update_available", "warning", "fault"]);

export function validateHouseDevicesConfig(config) {
  if (!isPlainObject(config)) throw new TypeError("House devices config must be a plain object");
  if (!Array.isArray(config.devices)) throw new TypeError("House devices config.devices must be an array");
  for (const key of Object.keys(config)) {
    if (key !== "devices") throw new TypeError(`House devices config contains unsupported field: ${key}`);
  }

  const ids = new Set();
  const devices = config.devices.map((item, index) => {
    if (!isPlainObject(item)) throw new TypeError(`devices[${index}] must be a plain object`);
    const allowed = new Set(["id", "name", "primary_entity_id", ...SIGNAL_KEYS]);
    for (const key of Object.keys(item)) {
      if (!allowed.has(key)) throw new TypeError(`devices[${index}] contains unsupported field: ${key}`);
    }
    const id = nonEmptyString(item.id, `devices[${index}].id`);
    if (ids.has(id)) throw new TypeError(`duplicate device id: ${id}`);
    ids.add(id);
    const normalized = {
      id,
      name: nonEmptyString(item.name, `devices[${index}].name`),
      primary_entity_id: nonEmptyString(item.primary_entity_id, `devices[${index}].primary_entity_id`),
    };
    let configuredSignals = 0;
    for (const key of SIGNAL_KEYS) {
      if (item[key] === undefined) continue;
      normalized[key] = validateHouseSourceBinding(item[key], `devices[${index}].${key}`, { boolean: true });
      configuredSignals += 1;
    }
    if (configuredSignals === 0) throw new TypeError(`devices[${index}] must configure at least one status signal`);
    return Object.freeze(normalized);
  });
  return Object.freeze({ devices: Object.freeze(devices) });
}
