const EMPTY = Object.freeze([]);
const REQUIRED = Object.freeze(["control.states"]);

export const MANIFEST = Object.freeze({
  id: "widget.dynamic-buttons",
  type: "widget",
  version: "1.0.0",
  core_api: "1.x",
  depends_on: EMPTY,
  requires_capabilities: REQUIRED,
  provides_capabilities: EMPTY,
  config_schema: "widget.dynamic-buttons/v1",
});
