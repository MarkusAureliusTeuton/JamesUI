function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateTaskUpdateConfig(config = {}) {
  if (!isPlainObject(config)) throw new TypeError("task-update config must be a plain object");
  if (Object.keys(config).length !== 0) throw new TypeError("task-update V1 config does not accept fields");
  return Object.freeze({});
}
