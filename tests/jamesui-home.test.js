import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeHomeState,
  resolveHomeAtmosphere,
  homeNavItems,
  renderAlpineHome,
} from "../custom_components/jamesui/frontend/jamesui-home.js";

const homeSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home.js", import.meta.url),
  "utf8"
);

function panelWith(states, house = {}) {
  return {
    _hass: { states },
    _houseSummary() {
      return {
        lightsOn: 0,
        unavailable: 0,
        lowBattery: 0,
        ...house,
      };
    },
    _entityIds(domain) {
      return Object.keys(states).filter((id) => id.startsWith(`${domain}.`));
    },
  };
}

test("summarizes calm home state into navigation-ready status", () => {
  const panel = panelWith({
    "climate.wohnzimmer": { state: "heat", attributes: { current_temperature: 21.5 } },
    "media_player.tv": { state: "idle", attributes: {} },
    "binary_sensor.haustur": { state: "off", attributes: { device_class: "door", friendly_name: "Haustür" } },
  });
  const model = summarizeHomeState(panel);
  assert.equal(model.headline, "Alles ruhig");
  assert.equal(model.climate.value, "21,5°");
  assert.equal(model.media.value, "Keine Wiedergabe");
  assert.equal(model.door.value, "Geschlossen");
  assert.equal(model.house.tone, "quiet");
});

test("prioritizes relevant house alerts and detects live activity", () => {
  const panel = panelWith({
    "media_player.onkyo": { state: "playing", attributes: {} },
    "binary_sensor.haustur": { state: "on", attributes: { device_class: "door", friendly_name: "Haustür" } },
  }, { lightsOn: 3, unavailable: 2, lowBattery: 1 });
  const model = summarizeHomeState(panel);
  assert.equal(model.headline, "Aufmerksamkeit nötig");
  assert.match(model.detail, /2 Geräte offline/);
  assert.match(model.detail, /1 Batterie niedrig/);
  assert.match(model.detail, /Haustür offen/);
  assert.equal(model.house.tone, "alert");
  assert.equal(model.media.value, "Wiedergabe aktiv");
  assert.equal(model.media.tone, "active");
  assert.equal(model.door.tone, "alert");
});

test("maps Home Assistant weather and sun period to alpine atmosphere", () => {
  assert.equal(resolveHomeAtmosphere("sunny", "day").key, "clear-day");
  assert.equal(resolveHomeAtmosphere("cloudy", "night").key, "cloudy-night");
  assert.equal(resolveHomeAtmosphere("rainy", "day").key, "rain-day");
  assert.equal(resolveHomeAtmosphere("snowy", "night").key, "snow-night");
  assert.equal(resolveHomeAtmosphere("fog", "twilight").key, "fog");
  const fallback = resolveHomeAtmosphere("unknown-value", "night");
  assert.equal(fallback.key, "cloudy-night");
  assert.ok(fallback.asset);
});

test("alpine atmosphere uses approved local assets", () => {
  const approved = new Set([
    "clear-day.webp", "cloudy-day.webp", "rain-day.webp", "snow-day.webp",
    "dusk.webp", "clear-night.webp", "cloudy-night.webp", "fog.webp",
  ]);
  for (const [condition, period] of [
    ["sunny", "day"], ["cloudy", "day"], ["rainy", "day"], ["snowy", "day"],
    ["sunny", "twilight"], ["sunny", "night"], ["cloudy", "night"], ["fog", "day"],
  ]) {
    const result = resolveHomeAtmosphere(condition, period);
    assert.ok(result.asset.startsWith("/jamesui_static/assets/alpine/"));
    assert.ok(approved.has(result.asset.split("/").at(-1)));
  }
});

test("builds ordered functional navigation from live status", () => {
  const status = {
    house: { value: "3 Lichter an", tone: "active" },
    climate: { value: "21,4°", tone: "quiet" },
    media: { value: "Keine Wiedergabe", tone: "quiet" },
    door: { value: "Geschlossen", tone: "quiet" },
  };
  const items = homeNavItems(status);
  assert.deepEqual(items.map((item) => item.target), ["house", "climate", "media", "door"]);
  assert.deepEqual(items.map((item) => item.value), ["3 Lichter an", "21,4°", "Keine Wiedergabe", "Geschlossen"]);
  assert.deepEqual(items.map((item) => item.tone), ["active", "quiet", "quiet", "quiet"]);
});

function alpinePanel(overrides = {}) {
  return {
    _hass: {
      states: {
        "weather.home": {
          state: "partlycloudy",
          attributes: {
            temperature: 12.4,
            temperature_unit: "°C",
            humidity: 74,
            wind_speed: 11,
            wind_speed_unit: "km/h",
          },
        },
        "sun.sun": {
          state: "above_horizon",
          attributes: {
            elevation: 7.2,
            azimuth: 220,
            next_rising: "2026-10-02T05:12:00+00:00",
            next_setting: "2026-10-01T16:48:00+00:00",
          },
        },
      },
    },
    _weatherEntityId: () => "weather.home",
    _normalizedDailyForecast: () => [{ temperature: 15, templow: 7, precipitation_probability: 20 }],
    _moonInfo: () => ["Zunehmender Mond", "◕", "waxing_gibbous"],
    _moonDetails: () => ({ illumination: 72 }),
    _ambientLight: () => ({ label: "840 lx", dim: 0 }),
    _sunPeriod: () => "golden",
    _formatTemperature: (value, unit = "°C") => Number.isFinite(Number(value)) ? `${Number(value)}${unit}` : "–",
    _formatSunEvent: (value) => value ? value.slice(11, 16) : "–",
    _currentTemperature: () => "12,4°C",
    _weatherConditionLabel: () => "Teilweise bewölkt",
    _weatherSymbol: () => "◒",
    _isNight: () => false,
    _houseSummary: () => ({ lightsOn: 2, unavailable: 0, lowBattery: 0 }),
    _entityIds: () => [],
    ...overrides,
  };
}

test("renders one alpine surface with integrated functional strip instead of card grid", () => {
  const html = renderAlpineHome(alpinePanel());
  assert.match(html, /class="alpine-home/);
  assert.match(html, /class="alpine-atmosphere"/);
  assert.match(html, /class="alpine-home-status/);
  assert.match(html, /class="alpine-function-strip"/);
  for (const target of ["house", "climate", "media", "door"]) {
    assert.match(html, new RegExp(`data-nav="${target}"`));
  }
  assert.match(html, /class="alpine-moon-note"/);
  assert.doesNotMatch(html, /home-nav-card|home-nav-grid|home-action-row/);
});

test("renders graceful fallback values when optional weather data is missing", () => {
  const panel = alpinePanel({
    _hass: { states: { "sun.sun": { state: "below_horizon", attributes: {} } } },
    _weatherEntityId: () => null,
    _normalizedDailyForecast: () => [],
    _ambientLight: () => ({ label: "Automatisch", dim: 0 }),
    _sunPeriod: () => "night",
    _currentTemperature: () => "–",
    _weatherConditionLabel: () => "Keine Wetterdaten",
    _weatherSymbol: () => "◌",
  });
  const html = renderAlpineHome(panel);
  assert.match(html, /Keine Wetterdaten/);
  assert.match(html, />–</);
  assert.match(html, /cloudy-night\.webp/);
  assert.match(html, /data-nav="house"/);
});

test("renders v2 as a flatter architectural surface with semantic weather facts", () => {
  const html = renderAlpineHome(alpinePanel());
  assert.match(html, /class="alpine-home[^\"]*alpine-home-v2/);
  assert.match(html, /data-atmosphere="dusk"/);
  assert.match(html, /<dl class="alpine-weather-facts">/);
  assert.match(html, /<dt>Feuchte<\/dt><dd>74%<\/dd>/);
  assert.doesNotMatch(html, /class="alpine-facts"/);
});

test("defines v4 as a portrait-first visible Alpine weather hero", () => {
  const html = renderAlpineHome(alpinePanel());
  assert.match(html, /class="alpine-home[^\"]*alpine-home-v3/);
  assert.match(homeSource, /@media\(orientation:portrait\)/);
  assert.match(homeSource, /height:calc\(100dvh - 172px\)/);
  assert.match(homeSource, /background-size:100% 100%,100% 100%,cover/);
  assert.match(homeSource, /background-position:center,center,center 28%/);
  assert.match(homeSource, /grid-template-rows:minmax\(430px,58vh\) auto/);
  assert.match(homeSource, /tone-night \.alpine-atmosphere\{filter:saturate\(\.86\) contrast\(1\.02\) brightness\(\.93\)\}/);
  assert.match(homeSource, /grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(homeSource, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("keeps the Alpine atmosphere above the host background and below the UI surface", () => {
  assert.match(homeSource, /\.alpine-atmosphere\{z-index:1;/);
  assert.match(homeSource, /\.alpine-atmosphere-fallback\{z-index:0;/);
  assert.match(homeSource, /\.alpine-ambient-shade\{z-index:2;/);
  assert.match(homeSource, /\.alpine-surface\{position:relative;z-index:3;/);
  assert.doesNotMatch(homeSource, /\.alpine-atmosphere\{z-index:-/);
});
