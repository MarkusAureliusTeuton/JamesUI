import test from "node:test";
import assert from "node:assert/strict";
import { summarizeHomeState } from "../custom_components/jamesui/frontend/jamesui-home.js";

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

test("summarizes calm home state into navigation-ready status cards", () => {
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
