const EMPTY = Object.freeze([]);
const REQUIRED_CAPABILITIES = Object.freeze(["calendar.events", "tasks.items"]);

export const MANIFEST = Object.freeze({
  id: "widget.calendar-agenda",
  type: "widget",
  version: "1.0.0",
  core_api: "1.x",
  depends_on: EMPTY,
  requires_capabilities: REQUIRED_CAPABILITIES,
  provides_capabilities: EMPTY,
  config_schema: "widget.calendar-agenda/v1",
});
