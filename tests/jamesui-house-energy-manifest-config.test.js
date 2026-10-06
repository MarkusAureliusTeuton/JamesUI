import test from "node:test";
import assert from "node:assert/strict";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.house-energy/manifest.js";
import { validateHouseEnergyConfig } from "../custom_components/jamesui/frontend/modules/provider.house-energy/config.js";

const source = (id = "house") => ({ id, name: id === "house" ? " Haus gesamt " : id, power: { entity_id: `sensor.${id}_power` } });

test("declares the house energy query capability", () => {
  assert.deepEqual(MANIFEST, {
    id: "provider.house-energy", type: "provider", version: "1.0.0", core_api: "1.x",
    depends_on: [], requires_capabilities: [], provides_capabilities: ["house.energy"],
    config_schema: "provider.house-energy/v1",
  });
});

test("normalizes explicit named power sources", () => {
  const config = validateHouseEnergyConfig({ sources: [source()] });
  assert.equal(config.sources[0].id, "house");
  assert.equal(config.sources[0].name, "Haus gesamt");
  assert.deepEqual(config.sources[0].power, { entity_id: "sensor.house_power" });
  assert.equal(Object.isFrozen(config.sources[0].power), true);
  assert.equal(Object.isFrozen(config.sources), true);
});

test("rejects duplicate ids, missing power bindings and widget-level thresholds", () => {
  assert.throws(() => validateHouseEnergyConfig({ sources: [source("a"), source("a")] }), /duplicate energy source id/);
  assert.throws(() => validateHouseEnergyConfig({ sources: [{ id: "x", name: "X" }] }), /power/);
  assert.throws(() => validateHouseEnergyConfig({ sources: [{ ...source(), warning_threshold_w: 3500 }] }), /unsupported field/);
});

test("rejects malformed provider config", () => {
  assert.throws(() => validateHouseEnergyConfig(null), /plain object/);
  assert.throws(() => validateHouseEnergyConfig({}), /sources/);
});
