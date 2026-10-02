import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeCalendarEvents,
  resolveFavoriteScenes,
  activateScene,
  renderSceneOverlay,
  renderCalendarOverlay,
  installHomeDataExperience,
} from "../custom_components/jamesui/frontend/jamesui-home-data.js";

const dataSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home-data.js", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home.js", import.meta.url),
  "utf8"
);
const NOW = new Date("2026-10-02T10:00:00+02:00");

test("normalizes, filters and sorts calendar events across the next seven local days", () => {
  const events = normalizeCalendarEvents({
    "calendar.family": [
      { start: "2026-10-03", end: "2026-10-04", summary: "Geburtstag" },
      { start: "2026-10-02T14:00:00+02:00", end: "2026-10-02T15:00:00+02:00", summary: "Kindergarten", location: "Eitting" },
      { start: "2026-10-11T09:00:00+02:00", end: "2026-10-11T10:00:00+02:00", summary: "Zu spät" },
    ],
    "calendar.work": [
      { start: "2026-10-02T09:00:00+02:00", end: "2026-10-02T09:30:00+02:00", summary: "Team Besprechung" },
    ],
  }, NOW);
  assert.deepEqual(events.map((event) => event.title), ["Team Besprechung", "Kindergarten", "Geburtstag"]);
  assert.equal(events[0].allDay, false);
  assert.equal(events[2].allDay, true);
  assert.equal(events[1].location, "Eitting");
});

test("deduplicates only identical events from the same calendar", () => {
  const duplicate = { start: "2026-10-02T12:00:00+02:00", end: "2026-10-02T13:00:00+02:00", summary: "Mittag" };
  const events = normalizeCalendarEvents({
    "calendar.family": [duplicate, { ...duplicate }],
    "calendar.work": [{ ...duplicate }],
  }, NOW);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.calendarEntityId).sort(), ["calendar.family", "calendar.work"]);
});

test("returns an empty calendar model for empty or malformed input", () => {
  assert.deepEqual(normalizeCalendarEvents({}, NOW), []);
  assert.deepEqual(normalizeCalendarEvents(null, NOW), []);
});

test("resolves at most four favorite scenes with configured order and alphabetical fallback", () => {
  const states = {
    "scene.nacht": { state: "scening", attributes: { friendly_name: "Nacht" } },
    "scene.alltag": { state: "scening", attributes: { friendly_name: "Alltag" } },
    "scene.fernsehen": { state: "scening", attributes: { friendly_name: "Fernsehen" } },
    "scene.morgen": { state: "scening", attributes: { friendly_name: "Morgen" } },
    "scene.abend": { state: "scening", attributes: { friendly_name: "Abend" } },
  };
  const scenes = resolveFavoriteScenes(states, ["scene.nacht", "scene.missing", "scene.fernsehen"]);
  assert.deepEqual(scenes.map((scene) => scene.entityId), ["scene.nacht", "scene.fernsehen", "scene.abend", "scene.alltag"]);
  assert.equal(scenes.length, 4);
});

test("activates a scene through Home Assistant and returns false on failure", async () => {
  const calls = [];
  const panel = { _hass: { async callService(domain, service, data) { calls.push([domain, service, data]); } } };
  assert.equal(await activateScene(panel, "scene.abend"), true);
  assert.deepEqual(calls, [["scene", "turn_on", { entity_id: "scene.abend" }]]);
  const broken = { _hass: { async callService() { throw new Error("boom"); } } };
  assert.equal(await activateScene(broken, "scene.abend"), false);
  assert.equal(await activateScene(panel, "light.invalid"), false);
});

test("renders useful all-scenes and calendar overlays", () => {
  const scenes = renderSceneOverlay([
    { entityId: "scene.morgen", name: "Morgen" },
    { entityId: "scene.abend", name: "Abend" },
  ]);
  assert.match(scenes, /Alle Szenen/);
  assert.equal((scenes.match(/data-overlay-scene=/g) || []).length, 2);
  assert.match(scenes, /data-close-home-overlay/);

  const calendar = renderCalendarOverlay([
    { title: "Termin", start: new Date("2026-10-02T12:00:00+02:00"), allDay: false, location: "Eitting" },
  ]);
  assert.match(calendar, /Termine/);
  assert.match(calendar, /Termin/);
  assert.match(calendar, /Eitting/);
});

test("Start runtime reuses existing shell controls and hides only the normal Start header", () => {
  assert.match(dataSource, /data-start-menu/);
  assert.match(dataSource, /_toggleAppMenu/);
  assert.match(dataSource, /data-start-settings/);
  assert.match(dataSource, /_toggleSettings/);
  assert.match(dataSource, /data-home-house-more/);
  assert.match(dataSource, /_setPage\("house"\)/);
  assert.match(dataSource, /data-home-scene/);
  assert.match(dataSource, /data-home-scenes-more/);
  assert.match(dataSource, /data-home-calendar-more/);
  assert.match(dataSource, /start-v9-shell/);
  assert.match(homeSource, /\.app-shell\.start-v9-shell/);
  assert.match(homeSource, />\.topbar\{display:none/);
});

test("V9 styles refine the global bottom navigation without changing its destinations", () => {
  assert.match(homeSource, /\.bottom-nav/);
  assert.match(homeSource, /\.bottom-nav button\.active \.nav-icon/);
  assert.match(homeSource, /backdrop-filter:blur/);
  assert.doesNotMatch(homeSource, /box-shadow:0 0 \d+px var\(--start-accent\)/);
});

test("home data installer owns calendar subscriptions and exposes Start data hooks", () => {
  assert.equal(typeof installHomeDataExperience, "function");
  assert.match(dataSource, /calendar\./);
  assert.match(dataSource, /calendar\/event\/subscribe/);
  assert.match(dataSource, /_jamesHomeCalendarEvents/);
  assert.match(dataSource, /_jamesHomeScenes/);
  assert.match(dataSource, /_activateHomeScene/);
  assert.match(dataSource, /Panel\.prototype\.render/);
  assert.match(dataSource, /Panel\.prototype\.disconnectedCallback/);
  assert.match(dataSource, /unsubscribe/);
});
