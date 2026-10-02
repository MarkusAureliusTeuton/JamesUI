import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarizeHomeState,
  resolveHomeAtmosphere,
  weatherTrendSummary,
  firstExpectedRainTime,
  renderAlpineHome,
} from "../custom_components/jamesui/frontend/jamesui-home.js";

process.env.TZ = "Europe/Berlin";

const homeSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home.js", import.meta.url),
  "utf8"
);

function panelWith(states, house = {}) {
  return {
    _hass: { states, config: { location_name: "Eitting" } },
    _houseSummary() {
      return {
        lightsOn: 0,
        socketsOn: 0,
        fansOn: 0,
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

test("summarizes house status including windows, doors, climate and media", () => {
  const panel = panelWith({
    "binary_sensor.kuche_fenster": { state: "off", attributes: { device_class: "window", friendly_name: "Küche Fenster" } },
    "binary_sensor.haustur": { state: "off", attributes: { device_class: "door", friendly_name: "Haustür" } },
    "climate.wohnzimmer": { state: "heat", attributes: { current_temperature: 21.5 } },
    "media_player.tv": { state: "idle", attributes: {} },
  }, { lightsOn: 2, socketsOn: 1, fansOn: 0 });
  const model = summarizeHomeState(panel);
  assert.equal(model.windows.value, "Alle zu");
  assert.equal(model.doors.value, "Alle zu");
  assert.equal(model.climate.value, "21,5°");
  assert.equal(model.media.value, "Aus");
  assert.equal(model.lights.value, "2 an");
  assert.equal(model.sockets.value, "1 an");
});

test("surfaces open windows and doors as attention states", () => {
  const panel = panelWith({
    "binary_sensor.bad_fenster": { state: "on", attributes: { device_class: "window", friendly_name: "Bad Fenster" } },
    "binary_sensor.garage": { state: "on", attributes: { device_class: "garage_door", friendly_name: "Garagentor" } },
  });
  const model = summarizeHomeState(panel);
  assert.equal(model.windows.value, "1 offen");
  assert.equal(model.windows.tone, "alert");
  assert.equal(model.doors.value, "1 offen");
  assert.equal(model.doors.tone, "alert");
  assert.equal(model.headline, "Aufmerksamkeit nötig");
});

test("maps Home Assistant weather and sun period to local Alpine assets", () => {
  assert.equal(resolveHomeAtmosphere("sunny", "day").key, "clear-day");
  assert.equal(resolveHomeAtmosphere("cloudy", "night").key, "cloudy-night");
  assert.equal(resolveHomeAtmosphere("rainy", "day").key, "rain-day");
  assert.equal(resolveHomeAtmosphere("snowy", "night").asset.endsWith("cloudy-night.webp"), true);
  assert.equal(resolveHomeAtmosphere("fog", "twilight").key, "fog");
});

test("builds a three-day temperature and rain tendency", () => {
  assert.deepEqual(weatherTrendSummary([
    { temperature: 18, precipitation_probability: 10 },
    { temperature: 20, precipitation_probability: 20 },
    { temperature: 23, precipitation_probability: 55 },
  ]), { label: "Wärmer", direction: "up", rainExpected: true });

  assert.deepEqual(weatherTrendSummary([
    { temperature: 23, precipitation_probability: 10 },
    { temperature: 21, precipitation_probability: 10 },
    { temperature: 18, precipitation_probability: 10 },
  ]), { label: "Kühler", direction: "down", rainExpected: false });

  assert.equal(weatherTrendSummary([{ temperature: 20 }, { temperature: 21 }, { temperature: 20.5 }]).direction, "stable");
});

test("derives rain time only from granular forecasts", () => {
  const daily = {
    _forecastType: "daily",
    _forecast: [{ datetime: "2026-10-02T16:00:00+02:00", precipitation_probability: 80 }],
  };
  assert.equal(firstExpectedRainTime(daily), null);

  const hourly = {
    _forecastType: "hourly",
    _forecast: [
      { datetime: "2026-10-02T14:00:00+02:00", precipitation_probability: 20, condition: "cloudy" },
      { datetime: "2026-10-02T16:00:00+02:00", precipitation_probability: 65, condition: "rainy" },
    ],
  };
  assert.equal(firstExpectedRainTime(hourly), "16:00");
});

function alpinePanel(overrides = {}) {
  const states = {
    "weather.home": {
      state: "partlycloudy",
      attributes: {
        friendly_name: "Wetter Zuhause",
        temperature: 17.6,
        temperature_unit: "°C",
        humidity: 74,
        wind_speed: 11,
        wind_speed_unit: "km/h",
      },
    },
    "sun.sun": {
      state: "above_horizon",
      attributes: {
        elevation: 16.2,
        next_rising: "2026-10-03T05:14:00+00:00",
        next_setting: "2026-10-02T16:47:00+00:00",
      },
    },
    "binary_sensor.kuche_fenster": { state: "off", attributes: { device_class: "window", friendly_name: "Küche Fenster" } },
    "binary_sensor.haustur": { state: "off", attributes: { device_class: "door", friendly_name: "Haustür" } },
    "climate.wohnzimmer": { state: "heat", attributes: { current_temperature: 21.3 } },
    "media_player.tv": { state: "idle", attributes: {} },
  };
  return {
    _hass: { states, config: { location_name: "Eitting" } },
    _weatherEntityId: () => "weather.home",
    _normalizedDailyForecast: () => [
      { datetime: "2026-10-02", temperature: 22, templow: 16, precipitation_probability: 55, condition: "partlycloudy" },
      { datetime: "2026-10-03", temperature: 19, templow: 12, precipitation_probability: 20, condition: "cloudy" },
      { datetime: "2026-10-04", temperature: 18, templow: 10, precipitation_probability: 10, condition: "sunny" },
    ],
    _forecastType: "hourly",
    _forecast: [{ datetime: "2026-10-02T16:00:00+02:00", precipitation_probability: 65, condition: "rainy" }],
    _moonInfo: () => ["Zunehmender Mond", "◕", "waxing_gibbous"],
    _moonDetails: () => ({ illumination: 68 }),
    _ambientLight: () => ({ label: "840 lx", dim: 0 }),
    _sunPeriod: () => "day",
    _formatTemperature: (value, unit = "°C") => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString("de-DE")}${unit}` : "–",
    _formatSunEvent: (value) => value ? new Date(value).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–",
    _currentTemperature: () => "17,6°C",
    _weatherConditionLabel: () => "Teilweise bewölkt",
    _weatherSymbol: () => "◒",
    _isNight: () => false,
    _houseSummary: () => ({ lightsOn: 2, socketsOn: 1, fansOn: 0, unavailable: 0, lowBattery: 0 }),
    _entityIds: (domain) => Object.keys(states).filter((id) => id.startsWith(`${domain}.`)),
    _jamesHomeCalendarEvents: [
      { id: "1", title: "Team Besprechung", start: new Date("2026-10-02T09:00:00+02:00"), end: new Date("2026-10-02T09:30:00+02:00"), allDay: false, location: "" },
      { id: "2", title: "Kindergarten abholen", start: new Date("2026-10-02T14:00:00+02:00"), end: new Date("2026-10-02T14:30:00+02:00"), allDay: false, location: "Eitting" },
      { id: "3", title: "Familientag", start: new Date("2026-10-03T00:00:00+02:00"), end: new Date("2026-10-04T00:00:00+02:00"), allDay: true, location: "" },
    ],
    _jamesHomeScenes: [
      { entityId: "scene.morgen", name: "Morgen" },
      { entityId: "scene.alltag", name: "Alltag" },
      { entityId: "scene.fernsehen", name: "Fernsehen" },
      { entityId: "scene.abend", name: "Abend" },
    ],
    ...overrides,
  };
}

test("renders V9 hero with moon integrated into the daily weather facts", () => {
  const html = renderAlpineHome(alpinePanel());
  assert.match(html, /class="start-v9-hero/);
  assert.match(html, /class="start-v9-weather-facts"/);
  assert.match(html, /Zunehmender Mond/);
  assert.match(html, /68%/);
  assert.match(html, /Max/);
  assert.match(html, /Min/);
  assert.match(html, /Regen/);
  assert.match(html, /Wind/);
  assert.match(html, /Sonnenaufgang/);
  assert.match(html, /Sonnenuntergang/);
  assert.doesNotMatch(html, /alpine-moon-note/);
  assert.match(html, /data-open-forecast/);
  assert.match(html, /Kühler/);
  assert.match(html, /Regen erwartet/);
  assert.match(html, /16:00/);
});

test("renders calendar timeline with timed, all-day and following-day events", () => {
  const html = renderAlpineHome(alpinePanel());
  assert.match(html, /class="start-v9-calendar/);
  assert.match(html, /Team Besprechung/);
  assert.match(html, /Kindergarten abholen/);
  assert.match(html, /Familientag/);
  assert.match(html, /Ganztägig/);
  assert.match(html, /Weitere Termine/);
});

test("renders a calm calendar empty state without fake data", () => {
  const html = renderAlpineHome(alpinePanel({ _jamesHomeCalendarEvents: [] }));
  assert.match(html, /Keine Kalenderdaten/);
  assert.doesNotMatch(html, /Team Besprechung/);
});

test("renders real house status plus four favorite scenes and Weitere", () => {
  const html = renderAlpineHome(alpinePanel());
  assert.match(html, /class="start-v9-house/);
  assert.match(html, /Licht/);
  assert.match(html, /Steckdosen/);
  assert.match(html, /Fenster/);
  assert.match(html, /Türen/);
  assert.match(html, /Lüftung/);
  assert.match(html, /Klima/);
  assert.match(html, /Medien/);
  assert.equal((html.match(/data-home-scene=/g) || []).length, 4);
  assert.match(html, /data-home-scenes-more/);
  assert.match(html, />Weitere</);
});

test("keeps Start free of duplicate primary navigation", () => {
  const html = renderAlpineHome(alpinePanel());
  assert.doesNotMatch(html, /alpine-function-strip/);
  assert.doesNotMatch(html, /data-nav="(?:house|climate|media|door)"/);
  assert.match(html, /data-home-house-more/);
});

test("defines portrait-first stacked lower layout and landscape two-column grid", () => {
  assert.match(homeSource, /\.start-v9-lower-grid/);
  assert.match(homeSource, /@media\(orientation:portrait\)/);
  assert.match(homeSource, /grid-template-columns:1fr/);
  assert.match(homeSource, /@media\(orientation:landscape\)/);
  assert.match(homeSource, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});
