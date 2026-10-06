import test from "node:test";
import assert from "node:assert/strict";

import {
  readHouseSourceBoolean,
  readHouseSourceNumber,
  readHouseSourceValue,
  validateHouseSourceBinding,
} from "../custom_components/jamesui/frontend/shared/house-source.js";

const state = (entity_id, value, attributes = {}) => ({ entity_id, state: value, attributes });

test("validates and freezes a plain entity binding", () => {
  const binding = validateHouseSourceBinding({ entity_id: " sensor.room_temperature " }, "temperature");
  assert.deepEqual(binding, { entity_id: "sensor.room_temperature" });
  assert.equal(Object.isFrozen(binding), true);
});

test("reads entity state and configured attribute values", () => {
  const entity = state("climate.living", "heat", { current_temperature: 21.4 });
  const direct = validateHouseSourceBinding({ entity_id: "climate.living" }, "mode");
  const attribute = validateHouseSourceBinding({ entity_id: "climate.living", attribute: "current_temperature" }, "temperature");
  assert.deepEqual(readHouseSourceValue(entity, direct), { status: "available", value: "heat", reason: null });
  assert.deepEqual(readHouseSourceValue(entity, attribute), { status: "available", value: 21.4, reason: null });
});

test("normalizes finite numeric strings", () => {
  const binding = validateHouseSourceBinding({ entity_id: "sensor.power" }, "power");
  assert.deepEqual(readHouseSourceNumber(state("sensor.power", " 1840.5 "), binding), {
    status: "available", value: 1840.5, reason: null,
  });
});

test("reports missing, unknown, unavailable and missing attributes explicitly", () => {
  const direct = validateHouseSourceBinding({ entity_id: "sensor.value" }, "value");
  const attribute = validateHouseSourceBinding({ entity_id: "sensor.value", attribute: "wanted" }, "value");
  assert.equal(readHouseSourceValue(null, direct).reason, "source_missing");
  assert.equal(readHouseSourceValue(state("sensor.value", "unknown"), direct).reason, "source_unknown");
  assert.equal(readHouseSourceValue(state("sensor.value", "unavailable"), direct).reason, "source_unavailable");
  assert.equal(readHouseSourceValue(state("sensor.value", "ok", {}), attribute).reason, "attribute_missing");
  assert.equal(readHouseSourceNumber(state("sensor.value", "not-a-number"), direct).reason, "value_invalid");
});

test("boolean bindings use default and custom mappings", () => {
  const defaults = validateHouseSourceBinding({ entity_id: "binary_sensor.demand" }, "demand", { boolean: true });
  assert.deepEqual(defaults.true_values, ["on", "true", "1"]);
  assert.deepEqual(defaults.false_values, ["off", "false", "0"]);
  assert.equal(Object.isFrozen(defaults.true_values), true);
  assert.deepEqual(readHouseSourceBoolean(state("binary_sensor.demand", "ON"), defaults), {
    status: "available", value: true, reason: null,
  });
  assert.deepEqual(readHouseSourceBoolean(state("binary_sensor.demand", "0"), defaults), {
    status: "available", value: false, reason: null,
  });

  const custom = validateHouseSourceBinding({
    entity_id: "sensor.auto",
    true_values: ["enabled", "auto"],
    false_values: ["disabled", "manual"],
  }, "auto", { boolean: true });
  assert.equal(readHouseSourceBoolean(state("sensor.auto", "AUTO"), custom).value, true);
  assert.equal(readHouseSourceBoolean(state("sensor.auto", "manual"), custom).value, false);
  assert.equal(readHouseSourceBoolean(state("sensor.auto", "standby"), custom).reason, "value_unrecognized");
});

test("rejects malformed bindings and overlapping boolean values", () => {
  assert.throws(() => validateHouseSourceBinding(null, "value"), /plain object/);
  assert.throws(() => validateHouseSourceBinding({ entity_id: "" }, "value"), /entity_id/);
  assert.throws(() => validateHouseSourceBinding({ entity_id: "sensor.x", attribute: "" }, "value"), /attribute/);
  assert.throws(() => validateHouseSourceBinding({ entity_id: "sensor.x", true_values: ["on"] }, "value"), /boolean/);
  assert.throws(() => validateHouseSourceBinding({
    entity_id: "sensor.x",
    true_values: ["yes", "YES"],
    false_values: ["no"],
  }, "value", { boolean: true }), /duplicate/);
  assert.throws(() => validateHouseSourceBinding({
    entity_id: "sensor.x",
    true_values: ["yes"],
    false_values: ["YES"],
  }, "value", { boolean: true }), /overlap/);
});
