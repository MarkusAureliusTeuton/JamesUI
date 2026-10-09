import { hasIcon } from "../../icons/icon-registry.js";

const SIZE_CLASSES = new Set(["compact", "normal", "wide"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function optionalIcon(value, name) {
  if (value === undefined || value === null) return null;
  const id = nonEmptyString(value, name);
  if (!hasIcon(id)) throw new TypeError(`${name} must reference a registered semantic icon`);
  return id;
}

function jsonCloneFreeze(value, name) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${name} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item, index) => jsonCloneFreeze(item, `${name}[${index}]`)));
  if (!isPlainObject(value)) throw new TypeError(`${name} must contain JSON-safe values only`);
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) throw new TypeError(`${name}.${key} must not be undefined`);
    result[key] = jsonCloneFreeze(child, `${name}.${key}`);
  }
  return Object.freeze(result);
}

function validateAction(value, name) {
  if (!isPlainObject(value)) throw new TypeError(`${name} must be a plain object`);
  nonEmptyString(value.type, `${name}.type`);
  return jsonCloneFreeze(value, name);
}

function validateStatePresentation(value, name) {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) throw new TypeError(`${name} must be a plain object`);
  for (const key of Object.keys(value)) {
    if (key !== "text" && key !== "icon") throw new TypeError(`${name} contains unsupported field: ${key}`);
  }
  const result = {};
  if (value.text !== undefined) result.text = nonEmptyString(value.text, `${name}.text`);
  const icon = optionalIcon(value.icon, `${name}.icon`);
  if (icon !== null) result.icon = icon;
  return Object.freeze(result);
}

function validatePresentation(value, name) {
  if (value === undefined) return Object.freeze({ active: undefined, inactive: undefined, intermediate: Object.freeze({}) });
  if (!isPlainObject(value)) throw new TypeError(`${name} must be a plain object`);
  for (const key of Object.keys(value)) {
    if (!["active", "inactive", "intermediate"].includes(key)) throw new TypeError(`${name} contains unsupported field: ${key}`);
  }
  const intermediateValue = value.intermediate ?? {};
  if (!isPlainObject(intermediateValue)) throw new TypeError(`${name}.intermediate must be a plain object`);
  const intermediate = {};
  for (const [detail, presentation] of Object.entries(intermediateValue)) {
    const id = nonEmptyString(detail, `${name}.intermediate key`);
    intermediate[id] = validateStatePresentation(presentation, `${name}.intermediate.${id}`);
  }
  return Object.freeze({
    active: validateStatePresentation(value.active, `${name}.active`),
    inactive: validateStatePresentation(value.inactive, `${name}.inactive`),
    intermediate: Object.freeze(intermediate),
  });
}

function timeout(value, name) {
  if (value === undefined) return 5000;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a positive finite number`);
  return value;
}

export function validateDynamicButtonDefinitions(value) {
  if (!isPlainObject(value)) throw new TypeError("dynamic_buttons must be a plain object");
  const result = {};
  for (const [rawId, definition] of Object.entries(value)) {
    const id = nonEmptyString(rawId, "dynamic button id");
    if (!isPlainObject(definition)) throw new TypeError(`dynamic_buttons.${id} must be a plain object`);
    const name = nonEmptyString(definition.name, `dynamic_buttons.${id}.name`);
    const mode = nonEmptyString(definition.mode, `dynamic_buttons.${id}.mode`);
    if (mode !== "toggle" && mode !== "trigger") throw new TypeError(`dynamic_buttons.${id}.mode is unsupported`);
    const allowed = mode === "toggle"
      ? new Set(["name", "mode", "icon", "timeout_ms", "state_source_id", "activate_action", "deactivate_action", "presentation"])
      : new Set(["name", "mode", "icon", "timeout_ms", "description", "action"]);
    for (const key of Object.keys(definition)) {
      if (!allowed.has(key)) throw new TypeError(`dynamic_buttons.${id} contains unsupported field: ${key}`);
    }
    const normalized = { name, mode, icon: optionalIcon(definition.icon, `dynamic_buttons.${id}.icon`), timeout_ms: timeout(definition.timeout_ms, `dynamic_buttons.${id}.timeout_ms`) };
    if (mode === "toggle") {
      normalized.state_source_id = nonEmptyString(definition.state_source_id, `dynamic_buttons.${id}.state_source_id`);
      normalized.activate_action = validateAction(definition.activate_action, `dynamic_buttons.${id}.activate_action`);
      normalized.deactivate_action = validateAction(definition.deactivate_action, `dynamic_buttons.${id}.deactivate_action`);
      normalized.presentation = validatePresentation(definition.presentation, `dynamic_buttons.${id}.presentation`);
    } else {
      if (definition.description !== undefined) normalized.description = nonEmptyString(definition.description, `dynamic_buttons.${id}.description`);
      normalized.action = validateAction(definition.action, `dynamic_buttons.${id}.action`);
    }
    result[id] = Object.freeze(normalized);
  }
  return Object.freeze(result);
}

export function validateDynamicButtonInstanceConfig(value) {
  if (!isPlainObject(value)) throw new TypeError("Dynamic Buttons instance config must be a plain object");
  if (!Array.isArray(value.buttons)) throw new TypeError("Dynamic Buttons instance config.buttons must be an array");
  for (const key of Object.keys(value)) {
    if (key !== "buttons") throw new TypeError(`Dynamic Buttons instance config contains unsupported field: ${key}`);
  }
  const ids = new Set();
  const buttons = value.buttons.map((use, index) => {
    if (!isPlainObject(use)) throw new TypeError(`buttons[${index}] must be a plain object`);
    for (const key of Object.keys(use)) {
      if (!["id", "button_id", "size"].includes(key)) throw new TypeError(`buttons[${index}] contains unsupported field: ${key}`);
    }
    const id = nonEmptyString(use.id, `buttons[${index}].id`);
    if (ids.has(id)) throw new TypeError(`duplicate button use id: ${id}`);
    ids.add(id);
    const buttonId = nonEmptyString(use.button_id, `buttons[${index}].button_id`);
    const size = nonEmptyString(use.size, `buttons[${index}].size`);
    if (!SIZE_CLASSES.has(size)) throw new TypeError(`buttons[${index}].size is unsupported`);
    return Object.freeze({ id, button_id: buttonId, size });
  });
  return Object.freeze({ buttons: Object.freeze(buttons) });
}

export function resolveDynamicButtonInstance({ definitions, instance } = {}) {
  const normalizedDefinitions = validateDynamicButtonDefinitions(definitions);
  const normalizedInstance = validateDynamicButtonInstanceConfig(instance);
  const buttons = normalizedInstance.buttons.map((use) => {
    const definition = normalizedDefinitions[use.button_id];
    if (!definition) throw new TypeError(`dynamic button definition is missing: ${use.button_id}`);
    return Object.freeze({ ...use, definition });
  });
  return Object.freeze({ buttons: Object.freeze(buttons) });
}

export function validateResolvedDynamicButtonConfig(value) {
  if (!isPlainObject(value) || !Array.isArray(value.buttons)) throw new TypeError("resolved Dynamic Buttons config requires buttons");
  for (const key of Object.keys(value)) {
    if (key !== "buttons") throw new TypeError(`resolved Dynamic Buttons config contains unsupported field: ${key}`);
  }
  const ids = new Set();
  const buttons = value.buttons.map((use, index) => {
    if (!isPlainObject(use)) throw new TypeError(`resolved buttons[${index}] must be a plain object`);
    for (const key of Object.keys(use)) {
      if (!["id", "button_id", "size", "definition"].includes(key)) throw new TypeError(`resolved buttons[${index}] contains unsupported field: ${key}`);
    }
    const instance = validateDynamicButtonInstanceConfig({ buttons: [{ id: use.id, button_id: use.button_id, size: use.size }] }).buttons[0];
    if (ids.has(instance.id)) throw new TypeError(`duplicate button use id: ${instance.id}`);
    ids.add(instance.id);
    const definitionMap = validateDynamicButtonDefinitions({ [instance.button_id]: use.definition });
    return Object.freeze({ ...instance, definition: definitionMap[instance.button_id] });
  });
  return Object.freeze({ buttons: Object.freeze(buttons) });
}
