const EMPTY = Object.freeze([]);
const CAPABILITIES = Object.freeze(["calendar.events"]);

export const MANIFEST = Object.freeze({
  id: "provider.calendar",
  type: "provider",
  version: "1.0.0",
  core_api: "1.x",
  depends_on: EMPTY,
  requires_capabilities: EMPTY,
  provides_capabilities: CAPABILITIES,
  config_schema: "provider.calendar/v1",
});
