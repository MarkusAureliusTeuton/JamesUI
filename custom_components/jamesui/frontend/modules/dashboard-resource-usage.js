// Block 14: an explicit, reference-aware view of central button definitions.
// The registry is shared between pages and widget instances. Never infer
// ownership from the tile currently being removed.
export function isDynamicButtonReferenced(config, buttonId) {
  if (!config || typeof config !== "object" || !buttonId) {
    throw new TypeError("Configuration and button ID are required");
  }
  for (const page of Object.values(config.pages ?? {})) {
    if ((page?.elements ?? []).some((item) =>
      item.kind === "button" && item.ref_id === buttonId)) return true;
  }
  for (const instance of Object.values(config.widget_instances ?? {})) {
    if (instance?.module_id !== "widget.dynamic-buttons") continue;
    if ((instance.config?.buttons ?? []).some((button) =>
      button.button_id === buttonId)) return true;
  }
  return false;
}

export function listUnusedDynamicButtons(config) {
  if (!config || typeof config !== "object" ||
      !config.dynamic_buttons || typeof config.dynamic_buttons !== "object") {
    throw new TypeError("Configuration with central button definitions is required");
  }
  return Object.entries(config.dynamic_buttons)
    .filter(([id]) => !isDynamicButtonReferenced(config, id))
    .map(([id, definition]) => Object.freeze({ id, name: definition?.name || id }));
}

export function removeUnusedDynamicButton(config, buttonId) {
  if (!config || typeof config !== "object" ||
      !config.dynamic_buttons || typeof config.dynamic_buttons !== "object") {
    throw new TypeError("Configuration with central button definitions is required");
  }
  if (!Object.hasOwn(config.dynamic_buttons, buttonId)) return null;
  if (isDynamicButtonReferenced(config, buttonId)) {
    throw new Error(`Button-Definition wird noch verwendet: ${buttonId}`);
  }
  const definitions = { ...config.dynamic_buttons };
  delete definitions[buttonId];
  return { ...config, dynamic_buttons: definitions };
}
