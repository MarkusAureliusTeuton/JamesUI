const EMPTY = Object.freeze([]);
const REQUIRED_CAPABILITIES = Object.freeze([
  "house.heatingZones",
  "house.lights",
  "house.ambientLights",
  "house.devices",
  "house.energy",
]);

export const MANIFEST = Object.freeze({
  id: "widget.house-quick",
  type: "widget",
  version: "1.0.0",
  core_api: "1.x",
  depends_on: EMPTY,
  requires_capabilities: REQUIRED_CAPABILITIES,
  provides_capabilities: EMPTY,
  config_schema: "widget.house-quick/v1",
});
