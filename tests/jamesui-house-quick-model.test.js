import test from "node:test";
import assert from "node:assert/strict";
import { buildHouseQuickModel } from "../custom_components/jamesui/frontend/modules/widget.house-quick/model.js";

const available = (value) => ({ status: "available", value, reason: null });
const unavailable = (reason = "offline") => ({ status: "unavailable", value: null, reason });

function baseInput(buttons) {
  return {
    config: { buttons },
    heating: available({ version: 1, zones: [] }),
    lights: available({ version: 1, items: [], on_count: 0, total_count: 0, unavailable_count: 0 }),
    ambientLights: available({ version: 1, items: [], on_count: 0, total_count: 0, unavailable_count: 0 }),
    devices: available({ version: 1, items: [], active_count: 0, update_count: 0, warning_count: 0, fault_count: 0, unreachable_count: 0 }),
    energy: available({ version: 1, configured_sources: [] }),
    energyResults: [],
  };
}

test("preserves config order and formats normal and ambient light counts", () => {
  const input = baseInput([
    { id: "ambient", type: "ambient_lights" },
    { id: "lights", type: "lights" },
  ]);
  input.lights = available({ version: 1, items: [], on_count: 3, total_count: 8, unavailable_count: 0 });
  input.ambientLights = available({ version: 1, items: [], on_count: 0, total_count: 4, unavailable_count: 0 });
  const model = buildHouseQuickModel(input);
  assert.deepEqual(model.map((button) => button.id), ["ambient", "lights"]);
  assert.equal(model[0].label, "Ambientelicht");
  assert.equal(model[0].primary, "0 von 4 an");
  assert.equal(model[0].status, "neutral");
  assert.equal(model[1].label, "Licht");
  assert.equal(model[1].primary, "3 von 8 an");
  assert.equal(model[1].status, "active");
});

test("lighting unavailability outranks active state", () => {
  const input = baseInput([{ id: "lights", type: "lights" }]);
  input.lights = available({ version: 1, items: [], on_count: 3, total_count: 8, unavailable_count: 1 });
  const button = buildHouseQuickModel(input)[0];
  assert.equal(button.status, "warning");
  assert.deepEqual(button.secondary, ["1 nicht erreichbar"]);
});

test("heating shows actual target demand and auto state while only auto controls activity", () => {
  const input = baseInput([
    { id: "living-button", type: "heating_zone", source_id: "living" },
    { id: "office-button", type: "heating_zone", source_id: "office" },
  ]);
  input.heating = available({ version: 1, zones: [
    { id: "living", name: "Wohnen", current_temperature_c: 21.4, target_temperature_c: 22, heating_demand: false, auto_regulation_enabled: true, availability: "available", reason: null },
    { id: "office", name: "Büro", current_temperature_c: 20, target_temperature_c: 21, heating_demand: true, auto_regulation_enabled: false, availability: "available", reason: null },
  ] });
  const [living, office] = buildHouseQuickModel(input);
  assert.equal(living.label, "Wohnen");
  assert.equal(living.primary, "21,4 °C → 22,0 °C");
  assert.deepEqual(living.secondary, ["Automatik an", "Heizanforderung nein"]);
  assert.equal(living.status, "active");
  assert.deepEqual(office.secondary, ["Automatik aus", "Heizanforderung ja"]);
  assert.equal(office.status, "neutral");
});

test("an unavailable or missing heating zone remains visible as warning", () => {
  const input = baseInput([
    { id: "living", type: "heating_zone", source_id: "living" },
    { id: "missing", type: "heating_zone", source_id: "missing" },
  ]);
  input.heating = available({ version: 1, zones: [
    { id: "living", name: "Wohnen", current_temperature_c: 21.4, target_temperature_c: null, heating_demand: false, auto_regulation_enabled: true, availability: "unavailable", reason: "target_temperature:source_missing" },
  ] });
  const [living, missing] = buildHouseQuickModel(input);
  assert.equal(living.status, "warning");
  assert.equal(living.primary, "21,4 °C → –");
  assert.equal(missing.status, "warning");
  assert.equal(missing.primary, "Keine Daten");
});

test("device fault outranks activity, warning/unreachable stays yellow, and updates alone are informational", () => {
  const buttonConfig = [{ id: "devices", type: "devices" }];
  const input = baseInput(buttonConfig);
  input.devices = available({
    version: 1, items: [{ id: "washer", reachable: true, reason: null }],
    active_count: 2, update_count: 1, warning_count: 0, fault_count: 0, unreachable_count: 0,
  });
  let button = buildHouseQuickModel(input)[0];
  assert.equal(button.status, "active");
  assert.equal(button.primary, "2 aktiv");
  assert.deepEqual(button.secondary, ["1 Update"]);

  input.devices = available({ ...input.devices.value, fault_count: 1 });
  button = buildHouseQuickModel(input)[0];
  assert.equal(button.status, "critical");
  assert.ok(button.secondary.includes("1 Störung"));

  input.devices = available({ ...input.devices.value, fault_count: 0, active_count: 1, warning_count: 1, unreachable_count: 1 });
  button = buildHouseQuickModel(input)[0];
  assert.equal(button.status, "warning");
  assert.ok(button.secondary.includes("1 Warnung"));
  assert.ok(button.secondary.includes("1 nicht erreichbar"));
});

test("energy uses source name, current power as primary and trailing average for severity", () => {
  const energyButton = { id: "energy-main", type: "energy", source_id: "house", average_window_minutes: 15, warning_threshold_w: 3500, critical_threshold_w: 5000 };
  const input = baseInput([energyButton]);
  input.energy = available({ version: 1, configured_sources: [{ id: "house", name: "Haus gesamt" }] });
  input.energyResults = [{ request_id: "energy-main", source_id: "house", window_minutes: 15, current_power_w: 1840, average_power_w: 3600, quality: "full", reason: null }];
  let button = buildHouseQuickModel(input)[0];
  assert.equal(button.label, "Haus gesamt");
  assert.equal(button.primary, "1,84 kW");
  assert.deepEqual(button.secondary, ["Ø 15 min: 3,6 kW"]);
  assert.equal(button.status, "warning");

  input.energyResults = [{ ...input.energyResults[0], average_power_w: 5100 }];
  button = buildHouseQuickModel(input)[0];
  assert.equal(button.status, "critical");

  input.energyResults = [{ ...input.energyResults[0], average_power_w: 1000 }];
  button = buildHouseQuickModel(input)[0];
  assert.equal(button.status, "neutral");
});

test("insufficient or missing energy data is warning and never silently dropped", () => {
  const energyButton = { id: "energy-main", type: "energy", source_id: "house", average_window_minutes: 30, warning_threshold_w: 3000, critical_threshold_w: 5000 };
  const input = baseInput([energyButton]);
  input.energy = available({ version: 1, configured_sources: [{ id: "house", name: "Haus gesamt" }] });
  input.energyResults = [{ request_id: "energy-main", source_id: "house", window_minutes: 30, current_power_w: 900, average_power_w: null, quality: "insufficient", reason: "history_fetch_failed" }];
  let button = buildHouseQuickModel(input)[0];
  assert.equal(button.status, "warning");
  assert.equal(button.primary, "900 W");
  assert.deepEqual(button.secondary, ["Ø 30 min: –"]);

  input.energyResults = [];
  button = buildHouseQuickModel(input)[0];
  assert.equal(button.status, "warning");
  assert.equal(button.primary, "Keine Daten");
});

test("unavailable sibling capability only affects its configured button", () => {
  const input = baseInput([{ id: "lights", type: "lights" }, { id: "devices", type: "devices" }]);
  input.lights = unavailable();
  input.devices = available({ version: 1, items: [], active_count: 0, update_count: 0, warning_count: 0, fault_count: 0, unreachable_count: 0 });
  const [lights, devices] = buildHouseQuickModel(input);
  assert.equal(lights.status, "warning");
  assert.equal(lights.primary, "Keine Daten");
  assert.equal(devices.status, "neutral");
});
