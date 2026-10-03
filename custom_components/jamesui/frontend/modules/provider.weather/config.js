const ALLOWED_KEYS = Object.freeze([
  "entity_id",
  "outdoor_temperature_entity_id",
  "moon_entity_id",
  "illuminance_entity_id",
]);

const ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/;

function validateEntityId(value, field, { domain = null } = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty entity ID string`);
  }
  const normalized = value.trim();
  if (!ENTITY_ID_PATTERN.test(normalized)) {
    throw new TypeError(`${field} must be a valid entity ID`);
  }
  if (domain !== null && !normalized.startsWith(`${domain}.`)) {
    throw new TypeError(`${field} must use the ${domain} domain`);
  }
  return normalized;
}

export function validateWeatherProviderConfig(config = undefined) {
  if (config === undefined) return Object.freeze({});
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("weather provider config must be an object");
  }

  for (const key of Object.keys(config)) {
    if (!ALLOWED_KEYS.includes(key)) throw new TypeError(`unknown weather provider config key: ${key}`);
  }

  const normalized = {};
  if (Object.prototype.hasOwnProperty.call(config, "entity_id")) {
    normalized.entity_id = validateEntityId(config.entity_id, "entity_id", { domain: "weather" });
  }
  for (const key of ["outdoor_temperature_entity_id", "moon_entity_id", "illuminance_entity_id"]) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      normalized[key] = validateEntityId(config[key], key);
    }
  }
  return Object.freeze(normalized);
}
