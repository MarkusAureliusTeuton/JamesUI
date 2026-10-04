import test from "node:test";
import assert from "node:assert/strict";

import { alpineAssetForScene } from "../custom_components/jamesui/frontend/modules/widget.weather-today/assets.js";
import {
  formatDeviceClock,
  formatDeviceDate,
  formatForecastDay,
  formatMeasurement,
  formatZonedTime,
} from "../custom_components/jamesui/frontend/modules/widget.weather-today/format.js";
import {
  buildHeroModel,
  conditionPresentation,
  moonIconForPhase,
  todayDailyItem,
} from "../custom_components/jamesui/frontend/modules/widget.weather-today/model.js";

const available = (value) => ({ status: "available", value, reason: null });
const unavailable = (reason = null) => ({ status: "unavailable", value: null, reason });
const NOW = new Date("2026-10-04T08:30:00Z");

test("maps canonical weather conditions to semantic icons and German labels without guessing unknown states", () => {
  const cases = [
    ["sunny", "weather.sunny", "Sonnig"],
    ["partlycloudy", "weather.partly-cloudy", "Teilweise bewölkt"],
    ["cloudy", "weather.cloudy", "Bewölkt"],
    ["exceptional", "weather.cloudy", "Außergewöhnliche Wetterlage"],
    ["rainy", "weather.rain", "Regen"],
    ["pouring", "weather.heavy-rain", "Starkregen"],
    ["snowy", "weather.snow", "Schnee"],
    ["lightning", "weather.storm", "Gewitter"],
    ["lightning-rainy", "weather.storm", "Gewitter mit Regen"],
    ["hail", "weather.storm", "Hagel"],
    ["windy", "weather.wind", "Windig"],
    ["windy-variant", "weather.wind", "Windig"],
    ["fog", "weather.fog", "Nebel"],
    ["snowy-rainy", "weather.rain", "Schneeregen"],
  ];
  for (const [condition, iconId, label] of cases) {
    assert.deepEqual(conditionPresentation(condition, null), { iconId, label, emphasis: ["lightning", "lightning-rainy", "hail", "windy", "windy-variant"].includes(condition) ? "alert" : "normal" });
  }
  assert.deepEqual(conditionPresentation("clear-night", "waxing_gibbous"), {
    iconId: "moon.waxing-gibbous", label: "Klar", emphasis: "normal",
  });
  assert.deepEqual(conditionPresentation("clear-night", null), { iconId: null, label: "Klar", emphasis: "normal" });
  assert.deepEqual(conditionPresentation("brand-new", null), { iconId: null, label: "Wetterlage unbekannt", emphasis: "normal" });
  assert.deepEqual(conditionPresentation(null, null), { iconId: null, label: "Wetterdaten nicht verfügbar", emphasis: "normal" });
});

test("maps all canonical moon phases and no others", () => {
  const cases = {
    new_moon: "moon.new",
    waxing_crescent: "moon.waxing-crescent",
    first_quarter: "moon.first-quarter",
    waxing_gibbous: "moon.waxing-gibbous",
    full_moon: "moon.full",
    waning_gibbous: "moon.waning-gibbous",
    last_quarter: "moon.last-quarter",
    waning_crescent: "moon.waning-crescent",
  };
  for (const [phase, iconId] of Object.entries(cases)) assert.equal(moonIconForPhase(phase), iconId);
  assert.equal(moonIconForPhase("unknown"), null);
  assert.equal(moonIconForPhase(null), null);
});

test("formats device clock separately from explicit weather timezone formatting", () => {
  const deviceNow = new Date(2026, 9, 4, 10, 7, 45);
  assert.match(formatDeviceClock(deviceNow), /^10:07$/);
  assert.match(formatDeviceDate(deviceNow), /Sonntag/i);
  assert.equal(formatZonedTime("2026-10-04T08:00:00Z", "Europe/Berlin"), "10:00");
  assert.equal(formatZonedTime("2026-10-04T08:00:00Z", "America/Los_Angeles"), "01:00");
  assert.equal(formatZonedTime("2026-10-04T08:00:00Z", null), null);
  assert.equal(formatZonedTime("2026-10-04T08:00:00Z", "Mars/Olympus"), null);
  assert.equal(formatZonedTime("not-an-instant", "Europe/Berlin"), null);
});

test("formats measurements and forecast day labels without converting missing numbers to zero", () => {
  assert.equal(formatMeasurement(18, "°C"), "18 °C");
  assert.equal(formatMeasurement(18.25, "°C"), "18,3 °C");
  assert.equal(formatMeasurement(null, "°C"), "—");
  assert.equal(formatMeasurement("bad", "km/h"), "—");

  assert.equal(formatForecastDay("2026-10-04", NOW, "Europe/Berlin"), "Heute");
  assert.equal(formatForecastDay("2026-10-05", NOW, "Europe/Berlin"), "Morgen");
  assert.match(formatForecastDay("2026-10-06", NOW, "Europe/Berlin"), /Dienstag/i);
  assert.equal(formatForecastDay("2026-10-06", NOW, null), null);
});

test("today daily lookup uses HA-local date only and never borrows tomorrow", () => {
  const daily = available({
    time_zone: "Europe/Berlin",
    units: { temperature: "°C" },
    items: [
      { date: "2026-10-05", temperature_high: 22, temperature_low: 12 },
      { date: "2026-10-04", temperature_high: 19, temperature_low: 8 },
    ],
  });
  assert.deepEqual(todayDailyItem(daily, NOW), daily.value.items[1]);
  assert.equal(todayDailyItem(available({ time_zone: "Europe/Berlin", items: [daily.value.items[0]] }), NOW), null);
  assert.equal(todayDailyItem(available({ time_zone: null, items: daily.value.items }), NOW), null);
  assert.equal(todayDailyItem(unavailable(), NOW), null);
});

test("Alpine scene mapping is an exact local allowlist with neutral unknown fallback", () => {
  const root = "/jamesui_static/assets/alpine/";
  const cases = {
    "clear-day": "clear-day.webp",
    "cloudy-day": "cloudy-day.webp",
    "rain-day": "rain-day.webp",
    "snow-day": "snow-day.webp",
    fog: "fog.webp",
    dusk: "dusk.webp",
    "clear-night": "clear-night.webp",
    "cloudy-night": "cloudy-night.webp",
  };
  for (const [key, file] of Object.entries(cases)) assert.equal(alpineAssetForScene(key), `${root}${file}`);
  assert.equal(alpineAssetForScene("rain-night"), null);
  assert.equal(alpineAssetForScene(null), null);
});

test("hero model keeps partial capabilities truthful and derives no precipitation time", () => {
  const model = buildHeroModel({
    currentSnapshot: available({
      time_zone: "Europe/Berlin",
      condition: "snowy",
      temperature: null,
      temperature_unit: "°C",
      wind_speed: 18,
      wind_gust_speed: 35,
      wind_speed_unit: "km/h",
      next_precipitation_at: "2026-10-04T12:00:00Z",
      next_precipitation_probability: 70,
    }),
    dailySnapshot: available({
      time_zone: "Europe/Berlin",
      units: { temperature: "°C" },
      items: [{ date: "2026-10-04", temperature_high: 19, temperature_low: 8, precipitation_probability: 60 }],
    }),
    sunSnapshot: available({ time_zone: "Europe/Berlin", next_rising: "2026-10-04T05:15:00Z", next_setting: "2026-10-04T16:45:00Z" }),
    moonSnapshot: available({ phase: "waxing_gibbous", illumination_percent: 72 }),
    atmosphereSnapshot: available({ scene_key: "snow-day" }),
    now: NOW,
  });

  assert.equal(model.temperature, "—");
  assert.equal(model.condition.label, "Schnee");
  assert.equal(model.backgroundAsset, "/jamesui_static/assets/alpine/snow-day.webp");
  assert.deepEqual(model.facts.map((fact) => fact.key), ["maximum", "minimum", "precipitation", "wind", "sunrise", "sunset", "moon"]);
  assert.equal(model.facts[0].value, "19 °C");
  assert.equal(model.facts[1].value, "8 °C");
  assert.equal(model.facts[2].label, "Schnee");
  assert.equal(model.facts[2].value, "14:00 · 70 %");
  assert.equal(model.facts[3].value, "18 km/h · Böe 35 km/h");
  assert.equal(model.facts[4].value, "07:15");
  assert.equal(model.facts[5].value, "18:45");
  assert.equal(model.facts[6].value, "72 %");
  assert.equal(model.facts[3].emphasis, "normal");
});

test("hero model never guesses scene, weather clocks or current values when inputs are unavailable", () => {
  const model = buildHeroModel({
    currentSnapshot: unavailable("source_unavailable"),
    dailySnapshot: available({ time_zone: "Europe/Berlin", units: { temperature: "°C" }, items: [{ date: "2026-10-04", temperature_high: 20, temperature_low: 10 }] }),
    sunSnapshot: available({ time_zone: null, next_rising: "2026-10-04T05:00:00Z", next_setting: "2026-10-04T17:00:00Z" }),
    moonSnapshot: unavailable(),
    atmosphereSnapshot: available({ scene_key: "unknown-new" }),
    now: NOW,
  });
  assert.equal(model.temperature, "—");
  assert.equal(model.condition.iconId, null);
  assert.equal(model.backgroundAsset, null);
  assert.equal(model.facts[0].value, "20 °C");
  assert.equal(model.facts[1].value, "10 °C");
  assert.equal(model.facts[4].value, "—");
  assert.equal(model.facts[5].value, "—");
  assert.equal(model.facts[6].value, "—");
});
