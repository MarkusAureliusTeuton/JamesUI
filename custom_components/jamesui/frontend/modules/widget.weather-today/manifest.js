const EMPTY = Object.freeze([]);
const REQUIRED_CAPABILITIES = Object.freeze([
  "weather.current",
  "weather.daily",
  "weather.hourly",
  "weather.sun",
  "weather.moon",
  "weather.atmosphere",
]);

export const MANIFEST = Object.freeze({
  id: "widget.weather-today",
  type: "widget",
  version: "1.0.0",
  core_api: "1.x",
  depends_on: EMPTY,
  requires_capabilities: REQUIRED_CAPABILITIES,
  provides_capabilities: EMPTY,
  config_schema: "widget.weather-today/v1",
});
