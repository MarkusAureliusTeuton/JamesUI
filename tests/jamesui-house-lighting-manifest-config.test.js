import test from "node:test";
import assert from "node:assert/strict";

import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.house-lighting/manifest.js";
import { validateHouseLightingConfig } from "../custom_components/jamesui/frontend/modules/provider.house-lighting/config.js";

const light = (id, entityId = `light.${id}`) => ({ id, name: id, state: { entity_id: entityId } });

test("declares both lighting capabilities", () => {
  assert.deepEqual(MANIFEST, {
    id: "provider.house-lighting", type: "provider", version: "1.0.0", core_api: "1.x",
    depends_on: [], requires_capabilities: [],
    provides_capabilities: ["house.lights", "house.ambientLights"],
    config_schema: "provider.house-lighting/v1",
  });
});

test("normalizes explicit normal and ambient sources", () => {
  const config = validateHouseLightingConfig({
    lights: [{ id: "ceiling", name: " Decke ", state: { entity_id: "light.ceiling" } }],
    ambient_lights: [{ id: "shelf", name: "Regal", state: { entity_id: "switch.shelf_led", true_values: ["enabled"], false_values: ["disabled"] } }],
  });
  assert.equal(config.lights[0].name, "Decke");
  assert.deepEqual(config.lights[0].state.true_values, ["on", "true", "1"]);
  assert.deepEqual(config.ambient_lights[0].state.true_values, ["enabled"]);
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.lights), true);
});

test("rejects duplicate ids and duplicate physical sources including cross-group overlap", () => {
  assert.throws(() => validateHouseLightingConfig({ lights: [light("a"), light("a", "light.b")], ambient_lights: [] }), /duplicate light id/);
  assert.throws(() => validateHouseLightingConfig({ lights: [light("a", "light.same"), light("b", "light.same")], ambient_lights: [] }), /duplicate lighting source/);
  assert.throws(() => validateHouseLightingConfig({ lights: [light("normal", "light.shared")], ambient_lights: [light("ambient", "light.shared")] }), /duplicate lighting source/);
});

test("requires both explicit lists and rejects unknown fields", () => {
  assert.throws(() => validateHouseLightingConfig(null), /plain object/);
  assert.throws(() => validateHouseLightingConfig({ lights: [] }), /ambient_lights/);
  assert.throws(() => validateHouseLightingConfig({ lights: [], ambient_lights: [], auto_discover: true }), /unsupported field/);
});
