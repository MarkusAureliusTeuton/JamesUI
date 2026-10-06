import test from "node:test";
import assert from "node:assert/strict";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/widget.house-quick/manifest.js";
import { validateHouseQuickConfig } from "../custom_components/jamesui/frontend/modules/widget.house-quick/config.js";

test("declares all five House capabilities and no provided capability", () => {
  assert.deepEqual(MANIFEST, {
    id: "widget.house-quick", type: "widget", version: "1.0.0", core_api: "1.x",
    depends_on: [],
    requires_capabilities: ["house.heatingZones", "house.lights", "house.ambientLights", "house.devices", "house.energy"],
    provides_capabilities: [], config_schema: "widget.house-quick/v1",
  });
});

test("preserves arbitrary button subset and order with semantic navigation", () => {
  const config = validateHouseQuickConfig({ buttons: [
    { id: "office", type: "heating_zone", source_id: "office", navigation: { route: "climate", target_id: "zone:office" } },
    { id: "light", type: "lights", icon: "home.light", navigation: { route: "lighting", target_id: "lights" } },
    { id: "energy-main", type: "energy", source_id: "house", average_window_minutes: 15, warning_threshold_w: 3500, critical_threshold_w: 5000 },
  ] });
  assert.deepEqual(config.buttons.map((button) => button.id), ["office", "light", "energy-main"]);
  assert.deepEqual(config.buttons[0].navigation, { route: "climate", target_id: "zone:office" });
  assert.equal(Object.isFrozen(config.buttons), true);
  assert.equal(Object.isFrozen(config.buttons[0]), true);
});

test("allows repeated heating and energy sources with different button ids", () => {
  const config = validateHouseQuickConfig({ buttons: [
    { id: "heat-a", type: "heating_zone", source_id: "living" },
    { id: "heat-b", type: "heating_zone", source_id: "living" },
    { id: "energy-15", type: "energy", source_id: "house", average_window_minutes: 15, warning_threshold_w: 3000, critical_threshold_w: 5000 },
    { id: "energy-60", type: "energy", source_id: "house", average_window_minutes: 60, warning_threshold_w: 2000, critical_threshold_w: 4000 },
  ] });
  assert.equal(config.buttons.length, 4);
});

test("rejects duplicate ids and repeated singleton button types", () => {
  assert.throws(() => validateHouseQuickConfig({ buttons: [
    { id: "same", type: "lights" }, { id: "same", type: "devices" },
  ] }), /duplicate button id/);
  assert.throws(() => validateHouseQuickConfig({ buttons: [
    { id: "l1", type: "lights" }, { id: "l2", type: "lights" },
  ] }), /duplicate singleton button type/);
});

test("validates energy windows, threshold order and navigation", () => {
  const base = { id: "energy", type: "energy", source_id: "house", average_window_minutes: 15, warning_threshold_w: 3500, critical_threshold_w: 5000 };
  assert.throws(() => validateHouseQuickConfig({ buttons: [{ ...base, average_window_minutes: 0 }] }), /average_window_minutes/);
  assert.throws(() => validateHouseQuickConfig({ buttons: [{ ...base, warning_threshold_w: -1 }] }), /warning_threshold_w/);
  assert.throws(() => validateHouseQuickConfig({ buttons: [{ ...base, critical_threshold_w: 3500 }] }), /greater than/);
  assert.throws(() => validateHouseQuickConfig({ buttons: [{ id: "l", type: "lights", navigation: { route: "" } }] }), /route/);
});

test("accepts an empty button list but rejects malformed fields", () => {
  assert.deepEqual(validateHouseQuickConfig({ buttons: [] }), { buttons: [] });
  assert.throws(() => validateHouseQuickConfig(null), /plain object/);
  assert.throws(() => validateHouseQuickConfig({}), /buttons/);
  assert.throws(() => validateHouseQuickConfig({ buttons: [{ id: "x", type: "lights", source_id: "not-allowed" }] }), /unsupported field/);
});
