import test from "node:test";
import assert from "node:assert/strict";
import { normalizeControlState } from "../custom_components/jamesui/frontend/modules/provider.control-state/normalize.js";

const source = Object.freeze({
  id: "garage", entity_id: "cover.garage", attribute: "position",
  active_values: Object.freeze([100]), inactive_values: Object.freeze([0]),
  intermediate: Object.freeze([{ id: "moving", values: Object.freeze([50]) }]),
});

test("normalizes active inactive and intermediate attribute values", () => {
  assert.deepEqual(normalizeControlState(source, { state: "open", attributes: { position: 100 } }), { status: "active", detail: null, reason: null });
  assert.deepEqual(normalizeControlState(source, { state: "closed", attributes: { position: 0 } }), { status: "inactive", detail: null, reason: null });
  assert.deepEqual(normalizeControlState(source, { state: "open", attributes: { position: 50 } }), { status: "intermediate", detail: "moving", reason: null });
});

test("uses entity state when no attribute is configured and preserves typed matching", () => {
  const stateSource = { ...source, attribute: undefined, active_values: [1], inactive_values: ["1"], intermediate: [] };
  assert.equal(normalizeControlState(stateSource, { state: 1, attributes: {} }).status, "active");
  assert.equal(normalizeControlState(stateSource, { state: "1", attributes: {} }).status, "inactive");
});

test("returns unavailable for missing, HA unavailable, missing attributes, and unmapped values", () => {
  assert.equal(normalizeControlState(source, null).reason, "source_missing");
  assert.equal(normalizeControlState(source, { state: "unavailable", attributes: { position: 100 } }).reason, "source_unavailable");
  assert.equal(normalizeControlState(source, { state: "open", attributes: {} }).reason, "attribute_missing");
  assert.equal(normalizeControlState(source, { state: "open", attributes: { position: 25 } }).reason, "value_unmapped");
});
