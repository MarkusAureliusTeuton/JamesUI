const EMPTY = Object.freeze([]);
const CAPABILITIES = Object.freeze(["control.states"]);

export const MANIFEST = Object.freeze({
  id: "provider.control-state",
  type: "provider",
  version: "1.0.0",
  core_api: "1.x",
  depends_on: EMPTY,
  requires_capabilities: EMPTY,
  provides_capabilities: CAPABILITIES,
  config_schema: "provider.control-state/v1",
});
