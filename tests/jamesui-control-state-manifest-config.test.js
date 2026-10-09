import test from "node:test";
import assert from "node:assert/strict";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.control-state/manifest.js";
import { validateControlStateConfig } from "../custom_components/jamesui/frontend/modules/provider.control-state/config.js";

test("declares control.states capability", () => {
  assert.deepEqual(MANIFEST, {
    id: "provider.control-state", type: "provider", version: "1.0.0", core_api: "1.x",
    depends_on: [], requires_capabilities: [], provides_capabilities: ["control.states"],
    config_schema: "provider.control-state/v1",
  });
});

test("validates deterministic typed mappings and freezes config", () => {
  const config = validateControlStateConfig({ sources: [{
    id: "garage", entity_id: "cover.garage", attribute: "state",
    active_values: ["open", 1], inactive_values: ["closed", 0],
    intermediate: [{ id: "opening", values: ["opening"] }, { id: "closing", values: ["closing"] }],
  }] });
  assert.equal(config.sources[0].id, "garage");
  assert.equal(Object.isFrozen(config.sources), true);
  assert.equal(Object.isFrozen(config.sources[0].active_values), true);
});

test("rejects duplicate source ids, invalid scalars, and overlapping typed mappings", () => {
  const base = { id: "x", entity_id: "sensor.x", active_values: [1], inactive_values: [0], intermediate: [] };
  assert.throws(() => validateControlStateConfig({ sources: [base, { ...base }] }), /duplicate source id/);
  assert.throws(() => validateControlStateConfig({ sources: [{ ...base, active_values: [null] }] }), /scalar/);
  assert.throws(() => validateControlStateConfig({ sources: [{ ...base, inactive_values: [1] }] }), /overlap/);
  assert.doesNotThrow(() => validateControlStateConfig({ sources: [{ ...base, active_values: [1], inactive_values: ["1"] }] }));
});

test("rejects malformed and unsupported fields", () => {
  assert.throws(() => validateControlStateConfig(null), /plain object/);
  assert.throws(() => validateControlStateConfig({}), /sources/);
  assert.throws(() => validateControlStateConfig({ sources: [], extra: true }), /unsupported field/);
  assert.throws(() => validateControlStateConfig({ sources: [{ id: "x", entity_id: "", active_values: [1], inactive_values: [0] }] }), /entity_id/);
});
