import test from "node:test";
import assert from "node:assert/strict";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.house-devices/manifest.js";
import { validateHouseDevicesConfig } from "../custom_components/jamesui/frontend/modules/provider.house-devices/config.js";

const device = (id = "washer") => ({
  id,
  name: id === "washer" ? " Waschmaschine " : id,
  primary_entity_id: `sensor.${id}_status`,
  active: { entity_id: `binary_sensor.${id}_active` },
});

test("declares the house devices capability", () => {
  assert.deepEqual(MANIFEST, {
    id: "provider.house-devices", type: "provider", version: "1.0.0", core_api: "1.x",
    depends_on: [], requires_capabilities: [], provides_capabilities: ["house.devices"],
    config_schema: "provider.house-devices/v1",
  });
});

test("normalizes explicit devices and optional signals", () => {
  const config = validateHouseDevicesConfig({ devices: [{
    ...device(),
    update_available: { entity_id: "update.washer" },
    warning: { entity_id: "binary_sensor.washer_warning" },
    fault: { entity_id: "binary_sensor.washer_fault", true_values: ["fault"], false_values: ["ok"] },
  }] });
  const item = config.devices[0];
  assert.equal(item.name, "Waschmaschine");
  assert.deepEqual(item.active.true_values, ["on", "true", "1"]);
  assert.deepEqual(item.fault.true_values, ["fault"]);
  assert.equal(Object.isFrozen(item), true);
});

test("requires unique ids, a primary entity and at least one status signal", () => {
  assert.throws(() => validateHouseDevicesConfig({ devices: [device("a"), device("a")] }), /duplicate device id/);
  assert.throws(() => validateHouseDevicesConfig({ devices: [{ id: "x", name: "X", active: { entity_id: "binary_sensor.x" } }] }), /primary_entity_id/);
  assert.throws(() => validateHouseDevicesConfig({ devices: [{ id: "x", name: "X", primary_entity_id: "sensor.x" }] }), /at least one/);
});

test("rejects malformed config and unknown fields", () => {
  assert.throws(() => validateHouseDevicesConfig(null), /plain object/);
  assert.throws(() => validateHouseDevicesConfig({}), /devices/);
  assert.throws(() => validateHouseDevicesConfig({ devices: [{ ...device(), area: "Kitchen" }] }), /unsupported field/);
});
