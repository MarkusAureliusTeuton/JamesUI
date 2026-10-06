import test from "node:test";
import assert from "node:assert/strict";
import { normalizePowerWatts, timeWeightedAverageWatts } from "../custom_components/jamesui/frontend/modules/provider.house-energy/history.js";

const minute = 60_000;
const h = (state, ms) => ({ s: String(state), lu: ms / 1000 });

test("normalizes only W and kW to canonical watts", () => {
  assert.equal(normalizePowerWatts("1840.5", "W"), 1840.5);
  assert.equal(normalizePowerWatts("1.84", "kW"), 1840);
  assert.equal(normalizePowerWatts("bad", "W"), null);
  assert.equal(normalizePowerWatts("100", "MW"), null);
  assert.equal(normalizePowerWatts(Infinity, "W"), null);
});

test("calculates a piecewise-constant time-weighted average", () => {
  const result = timeWeightedAverageWatts([h(0, 0), h(3000, 10 * minute)], {
    start_ms: 0, end_ms: 15 * minute, unit: "W",
  });
  assert.deepEqual(result, { quality: "full", average_power_w: 1000, reason: null });
});

test("clamps a state from before the requested start to the start boundary", () => {
  const result = timeWeightedAverageWatts([h(1000, -5 * minute), h(2000, 5 * minute)], {
    start_ms: 0, end_ms: 10 * minute, unit: "W",
  });
  assert.deepEqual(result, { quality: "full", average_power_w: 1500, reason: null });
});

test("converts kW history before integrating", () => {
  const result = timeWeightedAverageWatts([h(1, 0), h(2, 5 * minute)], {
    start_ms: 0, end_ms: 10 * minute, unit: "kW",
  });
  assert.equal(result.quality, "full");
  assert.equal(result.average_power_w, 1500);
});

test("marks an unknown or unavailable interval as insufficient instead of carrying stale power", () => {
  for (const bad of ["unknown", "unavailable"]) {
    const result = timeWeightedAverageWatts([h(1000, 0), h(bad, 5 * minute), h(2000, 10 * minute)], {
      start_ms: 0, end_ms: 15 * minute, unit: "W",
    });
    assert.equal(result.quality, "insufficient");
    assert.equal(result.average_power_w, null);
    assert.equal(result.reason, "history_gap");
  }
});

test("requires a known state covering the start of the interval", () => {
  const result = timeWeightedAverageWatts([h(1000, minute)], { start_ms: 0, end_ms: 10 * minute, unit: "W" });
  assert.deepEqual(result, { quality: "insufficient", average_power_w: null, reason: "history_start_missing" });
});

test("does not silently average malformed history samples", () => {
  assert.equal(timeWeightedAverageWatts([{ s: "1000", lu: "bad" }], { start_ms: 0, end_ms: minute, unit: "W" }).reason, "history_sample_invalid");
  assert.equal(timeWeightedAverageWatts([h("not-a-number", 0)], { start_ms: 0, end_ms: minute, unit: "W" }).reason, "history_value_invalid");
  assert.equal(timeWeightedAverageWatts([], { start_ms: 0, end_ms: minute, unit: "W" }).reason, "history_empty");
});
