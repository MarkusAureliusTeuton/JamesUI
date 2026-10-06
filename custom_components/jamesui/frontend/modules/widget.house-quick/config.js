function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function finiteNonNegative(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a finite non-negative number`);
  return value;
}

function validateNavigation(value, name) {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) throw new TypeError(`${name} must be a plain object`);
  for (const key of Object.keys(value)) {
    if (key !== "route" && key !== "target_id") throw new TypeError(`${name} contains unsupported field: ${key}`);
  }
  const result = { route: nonEmptyString(value.route, `${name}.route`) };
  if (value.target_id !== undefined) result.target_id = nonEmptyString(value.target_id, `${name}.target_id`);
  return Object.freeze(result);
}

const SINGLETON_TYPES = new Set(["lights", "ambient_lights", "devices"]);
const VALID_TYPES = new Set(["heating_zone", ...SINGLETON_TYPES, "energy"]);

export function validateHouseQuickConfig(config) {
  if (!isPlainObject(config)) throw new TypeError("House Quick config must be a plain object");
  if (!Array.isArray(config.buttons)) throw new TypeError("House Quick config.buttons must be an array");
  for (const key of Object.keys(config)) {
    if (key !== "buttons") throw new TypeError(`House Quick config contains unsupported field: ${key}`);
  }

  const ids = new Set();
  const singletonTypes = new Set();
  const buttons = config.buttons.map((button, index) => {
    if (!isPlainObject(button)) throw new TypeError(`buttons[${index}] must be a plain object`);
    const id = nonEmptyString(button.id, `buttons[${index}].id`);
    if (ids.has(id)) throw new TypeError(`duplicate button id: ${id}`);
    ids.add(id);
    const type = nonEmptyString(button.type, `buttons[${index}].type`);
    if (!VALID_TYPES.has(type)) throw new TypeError(`unsupported House Quick button type: ${type}`);
    if (SINGLETON_TYPES.has(type)) {
      if (singletonTypes.has(type)) throw new TypeError(`duplicate singleton button type: ${type}`);
      singletonTypes.add(type);
    }

    const baseAllowed = new Set(["id", "type", "icon", "navigation"]);
    if (type === "heating_zone") baseAllowed.add("source_id");
    if (type === "energy") {
      for (const key of ["source_id", "average_window_minutes", "warning_threshold_w", "critical_threshold_w"]) baseAllowed.add(key);
    }
    for (const key of Object.keys(button)) {
      if (!baseAllowed.has(key)) throw new TypeError(`buttons[${index}] contains unsupported field: ${key}`);
    }

    const normalized = { id, type };
    if (button.icon !== undefined) normalized.icon = nonEmptyString(button.icon, `buttons[${index}].icon`);
    const navigation = validateNavigation(button.navigation, `buttons[${index}].navigation`);
    if (navigation) normalized.navigation = navigation;

    if (type === "heating_zone" || type === "energy") {
      normalized.source_id = nonEmptyString(button.source_id, `buttons[${index}].source_id`);
    }
    if (type === "energy") {
      if (typeof button.average_window_minutes !== "number" || !Number.isFinite(button.average_window_minutes) || button.average_window_minutes <= 0) {
        throw new TypeError(`buttons[${index}].average_window_minutes must be a positive finite number`);
      }
      normalized.average_window_minutes = button.average_window_minutes;
      normalized.warning_threshold_w = finiteNonNegative(button.warning_threshold_w, `buttons[${index}].warning_threshold_w`);
      normalized.critical_threshold_w = finiteNonNegative(button.critical_threshold_w, `buttons[${index}].critical_threshold_w`);
      if (normalized.critical_threshold_w <= normalized.warning_threshold_w) {
        throw new TypeError(`buttons[${index}].critical_threshold_w must be greater than warning_threshold_w`);
      }
    }
    return Object.freeze(normalized);
  });
  return Object.freeze({ buttons: Object.freeze(buttons) });
}
