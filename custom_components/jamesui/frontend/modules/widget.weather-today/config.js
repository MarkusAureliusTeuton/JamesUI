function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateWeatherTodayConfig(config = {}) {
  if (!isPlainObject(config)) throw new TypeError("Weather Today config must be a plain object");
  if (Object.keys(config).length !== 0) throw new TypeError("Weather Today V1 config does not accept fields");
  return Object.freeze({});
}
