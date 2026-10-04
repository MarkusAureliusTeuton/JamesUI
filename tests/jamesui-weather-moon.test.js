import test from "node:test";
import assert from "node:assert/strict";

import {
  MOON_PHASES,
  calculateMoon,
  phaseBucketFromCycle,
  resolveMoon,
} from "../custom_components/jamesui/frontend/modules/provider.weather/moon.js";

const REFERENCES = [
  ["2026-01-18T19:52:00Z", "new_moon", 0, null],
  ["2026-01-26T04:47:00Z", "first_quarter", 50, true],
  ["2026-02-01T22:09:00Z", "full_moon", 100, null],
  ["2026-02-09T12:43:00Z", "last_quarter", 50, false],
  ["2026-10-10T15:50:00Z", "new_moon", 0, null],
  ["2026-10-18T16:12:00Z", "first_quarter", 50, true],
  ["2026-10-26T04:12:00Z", "full_moon", 100, null],
  ["2026-11-01T20:28:00Z", "last_quarter", 50, false],
];

test("defines canonical moon phases and deterministic 45-degree sector boundaries", () => {
  assert.deepEqual(MOON_PHASES, [
    "new_moon",
    "waxing_crescent",
    "first_quarter",
    "waxing_gibbous",
    "full_moon",
    "waning_gibbous",
    "last_quarter",
    "waning_crescent",
  ]);
  assert.equal(Object.isFrozen(MOON_PHASES), true);
  for (let index = 0; index < 8; index += 1) {
    assert.equal(phaseBucketFromCycle(index / 8), MOON_PHASES[index]);
    const boundary = (index / 8 + 1 / 16) % 1;
    assert.equal(phaseBucketFromCycle(boundary), MOON_PHASES[(index + 1) % 8]);
  }
  assert.equal(phaseBucketFromCycle(0.999), "new_moon");
});

test("rejects malformed moon calculation dates", () => {
  assert.throws(() => calculateMoon("2026-01-01"), TypeError);
  assert.throws(() => calculateMoon(new Date("invalid")), TypeError);
});

test("matches independent 2026 primary-phase references with fixed illumination tolerance", () => {
  for (const [timestamp, phase, expectedIllumination, waxing] of REFERENCES) {
    const value = calculateMoon(new Date(timestamp));
    assert.equal(value.phase, phase, timestamp);
    assert.ok(Math.abs(value.illumination_percent - expectedIllumination) <= 3, `${timestamp}: ${value.illumination_percent}`);
    assert.ok(value.illumination_percent >= 0 && value.illumination_percent <= 100);
    if (waxing !== null) assert.equal(value.waxing, waxing, timestamp);
  }
});

test("tracks waxing and waning chronology away from primary boundaries", () => {
  assert.equal(calculateMoon(new Date("2026-01-22T12:00:00Z")).waxing, true);
  assert.equal(calculateMoon(new Date("2026-02-05T12:00:00Z")).waxing, false);
});

function sensor(entityId, state) {
  return { entity_id: entityId, state, attributes: {} };
}

test("prefers configured recognized HA moon phase while calculating illumination locally", () => {
  const value = resolveMoon({
    now: new Date("2026-01-22T12:00:00Z"),
    configuredEntityId: "sensor.moon_custom",
    sensorEntities: [sensor("sensor.moon_custom", "first_quarter"), sensor("sensor.a_moon", "full_moon")],
  });
  assert.equal(value.phase, "first_quarter");
  assert.equal(value.phase_source, "home_assistant");
  assert.equal(value.illumination_source, "calculated");
  assert.equal(value.source_entity_id, "sensor.moon_custom");
  assert.equal(value.source_issue, null);
  assert.equal(typeof value.illumination_percent, "number");
  assert.equal(Object.isFrozen(value), true);
});

test("configured invalid moon records diagnostic then uses deterministic recognized sensor discovery", () => {
  const value = resolveMoon({
    now: new Date("2026-01-22T12:00:00Z"),
    configuredEntityId: "sensor.configured",
    sensorEntities: [
      sensor("sensor.z_moon", "full_moon"),
      sensor("sensor.configured", "unavailable"),
      sensor("sensor.a_moon", "waxing_crescent"),
    ],
  });
  assert.equal(value.phase, "waxing_crescent");
  assert.equal(value.phase_source, "home_assistant");
  assert.equal(value.source_entity_id, "sensor.a_moon");
  assert.equal(value.source_issue, "configured_source_invalid");
});

test("missing configured moon falls back to calculated phase when no valid sensor exists", () => {
  const expected = calculateMoon(new Date("2026-01-22T12:00:00Z"));
  const value = resolveMoon({
    now: new Date("2026-01-22T12:00:00Z"),
    configuredEntityId: "sensor.missing",
    sensorEntities: [sensor("sensor.other", "unknown")],
  });
  assert.equal(value.phase, expected.phase);
  assert.equal(value.phase_source, "calculated");
  assert.equal(value.illumination_source, "calculated");
  assert.equal(value.source_entity_id, null);
  assert.equal(value.source_issue, "configured_source_missing");
});
