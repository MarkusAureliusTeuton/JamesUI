import { deepFreeze, finiteOrNull } from "./normalize.js";

function stringOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function sunPeriod(elevation, horizonState) {
  const numeric = finiteOrNull(elevation);
  if (numeric !== null) {
    if (numeric < -6) return "night";
    if (numeric < 1) return "twilight";
    if (numeric < 12) return "golden";
    return "day";
  }
  if (horizonState === "above_horizon") return "day";
  if (horizonState === "below_horizon") return "night";
  return null;
}

export function normalizeSun(entity) {
  if (!entity || entity.entity_id !== "sun.sun" || entity.state === "unknown" || entity.state === "unavailable") return null;
  const attributes = entity.attributes ?? {};
  const elevation = finiteOrNull(attributes.elevation);
  const state = typeof entity.state === "string" ? entity.state : null;
  return deepFreeze({
    source_entity_id: "sun.sun",
    is_up: state === "above_horizon" ? true : state === "below_horizon" ? false : null,
    elevation,
    azimuth: finiteOrNull(attributes.azimuth),
    period: sunPeriod(elevation, state),
    next_rising: stringOrNull(attributes.next_rising),
    next_setting: stringOrNull(attributes.next_setting),
  });
}

export function weatherClass(condition) {
  switch (condition) {
    case "sunny":
    case "clear-night":
      return "clear";
    case "partlycloudy":
    case "cloudy":
    case "windy":
    case "windy-variant":
    case "exceptional":
      return "cloudy";
    case "rainy":
    case "pouring":
    case "lightning":
    case "lightning-rainy":
    case "hail":
    case "snowy-rainy":
      return "rain";
    case "snowy":
      return "snow";
    case "fog":
      return "fog";
    default:
      return null;
  }
}

function sceneKeyFor(weather, period) {
  if (!weather || !period) return null;
  if (weather === "fog") return "fog";
  if (period === "golden" || period === "twilight") return "dusk";
  if (period === "night") return weather === "clear" ? "clear-night" : "cloudy-night";
  if (period !== "day") return null;
  if (weather === "clear") return "clear-day";
  if (weather === "cloudy") return "cloudy-day";
  if (weather === "rain") return "rain-day";
  if (weather === "snow") return "snow-day";
  return null;
}

export function resolveAtmosphere({ condition, period, ambientLux = null }) {
  const weather = weatherClass(condition);
  return deepFreeze({
    weather_class: weather,
    period: ["day", "golden", "twilight", "night"].includes(period) ? period : null,
    scene_key: sceneKeyFor(weather, period),
    ambient_lux: finiteOrNull(ambientLux),
  });
}
