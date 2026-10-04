import { alpineAssetForScene } from "./assets.js";
import { dateKeyInTimeZone, formatMeasurement, formatZonedTime } from "./format.js";

const CONDITION_PRESENTATIONS = Object.freeze({
  sunny: Object.freeze({ iconId: "weather.sunny", label: "Sonnig", emphasis: "normal" }),
  partlycloudy: Object.freeze({ iconId: "weather.partly-cloudy", label: "Teilweise bewölkt", emphasis: "normal" }),
  cloudy: Object.freeze({ iconId: "weather.cloudy", label: "Bewölkt", emphasis: "normal" }),
  exceptional: Object.freeze({ iconId: "weather.cloudy", label: "Außergewöhnliche Wetterlage", emphasis: "normal" }),
  rainy: Object.freeze({ iconId: "weather.rain", label: "Regen", emphasis: "normal" }),
  pouring: Object.freeze({ iconId: "weather.heavy-rain", label: "Starkregen", emphasis: "normal" }),
  snowy: Object.freeze({ iconId: "weather.snow", label: "Schnee", emphasis: "normal" }),
  lightning: Object.freeze({ iconId: "weather.storm", label: "Gewitter", emphasis: "alert" }),
  "lightning-rainy": Object.freeze({ iconId: "weather.storm", label: "Gewitter mit Regen", emphasis: "alert" }),
  hail: Object.freeze({ iconId: "weather.storm", label: "Hagel", emphasis: "alert" }),
  windy: Object.freeze({ iconId: "weather.wind", label: "Windig", emphasis: "alert" }),
  "windy-variant": Object.freeze({ iconId: "weather.wind", label: "Windig", emphasis: "alert" }),
  fog: Object.freeze({ iconId: "weather.fog", label: "Nebel", emphasis: "normal" }),
  "snowy-rainy": Object.freeze({ iconId: "weather.rain", label: "Schneeregen", emphasis: "normal" }),
});

const MOON_ICONS = Object.freeze({
  new_moon: "moon.new",
  waxing_crescent: "moon.waxing-crescent",
  first_quarter: "moon.first-quarter",
  waxing_gibbous: "moon.waxing-gibbous",
  full_moon: "moon.full",
  waning_gibbous: "moon.waning-gibbous",
  last_quarter: "moon.last-quarter",
  waning_crescent: "moon.waning-crescent",
});

const SNOW_CONDITIONS = new Set(["snowy", "snowy-rainy"]);
const ALERT_CONDITIONS = new Set(["lightning", "lightning-rainy", "hail", "windy", "windy-variant"]);

function availableValue(snapshot) {
  return snapshot?.status === "available" && snapshot.value && typeof snapshot.value === "object"
    ? snapshot.value
    : null;
}

function percentText(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} %`;
}

function freezeFact(key, label, value, iconId, emphasis = "normal") {
  return Object.freeze({ key, label, value, iconId, emphasis });
}

export function moonIconForPhase(phase) {
  return typeof phase === "string" && Object.prototype.hasOwnProperty.call(MOON_ICONS, phase) ? MOON_ICONS[phase] : null;
}

export function conditionPresentation(condition, moonPhase = null) {
  if (condition === "clear-night") {
    return Object.freeze({ iconId: moonIconForPhase(moonPhase), label: "Klar", emphasis: "normal" });
  }
  if (typeof condition === "string" && Object.prototype.hasOwnProperty.call(CONDITION_PRESENTATIONS, condition)) {
    return CONDITION_PRESENTATIONS[condition];
  }
  if (typeof condition === "string" && condition.trim() !== "") {
    return Object.freeze({ iconId: null, label: "Wetterlage unbekannt", emphasis: "normal" });
  }
  return Object.freeze({ iconId: null, label: "Wetterdaten nicht verfügbar", emphasis: "normal" });
}

export function todayDailyItem(dailySnapshot, now) {
  const daily = availableValue(dailySnapshot);
  if (!daily || !Array.isArray(daily.items)) return null;
  const today = dateKeyInTimeZone(now, daily.time_zone);
  if (!today) return null;
  return daily.items.find((item) => item?.date === today) ?? null;
}

function precipitationFact(current, today) {
  const snow = SNOW_CONDITIONS.has(current?.condition);
  const label = snow ? "Schnee" : "Niederschlag";
  const iconId = snow ? "weather.snow" : "weather.rain";
  const exactTime = current?.next_precipitation_at
    ? formatZonedTime(current.next_precipitation_at, current.time_zone)
    : null;
  const exactProbability = percentText(current?.next_precipitation_probability);
  if (exactTime) {
    return freezeFact("precipitation", label, exactProbability ? `${exactTime} · ${exactProbability}` : exactTime, iconId);
  }
  const dailyProbability = percentText(today?.precipitation_probability);
  return freezeFact("precipitation", label, dailyProbability ?? "—", iconId);
}

function windFact(current) {
  const speed = formatMeasurement(current?.wind_speed, current?.wind_speed_unit);
  const gust = formatMeasurement(current?.wind_gust_speed, current?.wind_speed_unit);
  let value = "—";
  if (speed !== "—" && gust !== "—") value = `${speed} · Böe ${gust}`;
  else if (speed !== "—") value = speed;
  else if (gust !== "—") value = `Böe ${gust}`;
  return freezeFact("wind", "Wind", value, "weather.wind", ALERT_CONDITIONS.has(current?.condition) ? "alert" : "normal");
}

export function buildHeroModel({
  currentSnapshot,
  dailySnapshot,
  sunSnapshot,
  moonSnapshot,
  atmosphereSnapshot,
  now,
}) {
  const current = availableValue(currentSnapshot);
  const daily = availableValue(dailySnapshot);
  const sun = availableValue(sunSnapshot);
  const moon = availableValue(moonSnapshot);
  const atmosphere = availableValue(atmosphereSnapshot);
  const today = todayDailyItem(dailySnapshot, now);
  const temperatureUnit = current?.temperature_unit ?? daily?.units?.temperature ?? null;
  const dailyTemperatureUnit = daily?.units?.temperature ?? current?.temperature_unit ?? null;
  const condition = conditionPresentation(current?.condition ?? null, moon?.phase ?? null);
  const moonIcon = moonIconForPhase(moon?.phase ?? null);

  const facts = Object.freeze([
    freezeFact("maximum", "Maximum", formatMeasurement(today?.temperature_high, dailyTemperatureUnit), "weather.temperature-high"),
    freezeFact("minimum", "Minimum", formatMeasurement(today?.temperature_low, dailyTemperatureUnit), "weather.temperature-low"),
    precipitationFact(current, today),
    windFact(current),
    freezeFact("sunrise", "Sonnenaufgang", formatZonedTime(sun?.next_rising, sun?.time_zone) ?? "—", "weather.sunrise"),
    freezeFact("sunset", "Sonnenuntergang", formatZonedTime(sun?.next_setting, sun?.time_zone) ?? "—", "weather.sunset"),
    freezeFact("moon", "Mond", percentText(moon?.illumination_percent) ?? "—", moonIcon),
  ]);

  return Object.freeze({
    temperature: formatMeasurement(current?.temperature, temperatureUnit),
    condition,
    backgroundAsset: alpineAssetForScene(atmosphere?.scene_key ?? null),
    facts,
  });
}
