import test from "node:test";
import assert from "node:assert/strict";

import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.house-heating/manifest.js";
import { validateHouseHeatingConfig } from "../custom_components/jamesui/frontend/modules/provider.house-heating/config.js";

const zone = (id = "living") => ({
  id,
  name: id === "living" ? " Wohnen " : "Büro",
  current_temperature: { entity_id: `sensor.${id}_current` },
  target_temperature: { entity_id: `sensor.${id}_target` },
  heating_demand: { entity_id: `binary_sensor.${id}_demand` },
  auto_regulation_enabled: { entity_id: `sensor.${id}_auto`, true_values: ["auto"], false_values: ["manual"] },
});

test("declares the exact heating provider contract", () => {
  assert.deepEqual(MANIFEST, {
    id: "provider.house-heating",
    type: "provider",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: ["house.heatingZones"],
    config_schema: "provider.house-heating/v1",
  });
  assert.equal(Object.isFrozen(MANIFEST), true);
  assert.equal(Object.isFrozen(MANIFEST.provides_capabilities), true);
});

test("normalizes and deeply freezes explicit heating zones", () => {
  const config = validateHouseHeatingConfig({ zones: [zone()] });
  assert.equal(config.zones[0].id, "living");
  assert.equal(config.zones[0].name, "Wohnen");
  assert.deepEqual(config.zones[0].heating_demand.true_values, ["on", "true", "1"]);
  assert.deepEqual(config.zones[0].auto_regulation_enabled.true_values, ["auto"]);
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.zones), true);
  assert.equal(Object.isFrozen(config.zones[0]), true);
  assert.equal(Object.isFrozen(config.zones[0].current_temperature), true);
});

test("accepts an empty explicit zone list", () => {
  assert.deepEqual(validateHouseHeatingConfig({ zones: [] }), { zones: [] });
});

test("rejects duplicate ids, missing signals and malformed config", () => {
  assert.throws(() => validateHouseHeatingConfig(null), /plain object/);
  assert.throws(() => validateHouseHeatingConfig({}), /zones/);
  assert.throws(() => validateHouseHeatingConfig({ zones: [zone("living"), zone("living")] }), /duplicate zone id/);
  assert.throws(() => validateHouseHeatingConfig({ zones: [{ ...zone(), name: "" }] }), /name/);
  const missing = zone();
  delete missing.target_temperature;
  assert.throws(() => validateHouseHeatingConfig({ zones: [missing] }), /target_temperature/);
});
