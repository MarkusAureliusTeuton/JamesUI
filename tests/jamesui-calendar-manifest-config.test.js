import test from "node:test";
import assert from "node:assert/strict";

import { validateModuleManifest } from "../custom_components/jamesui/frontend/core/module-manifest.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.calendar/manifest.js";
import { validateCalendarProviderConfig } from "../custom_components/jamesui/frontend/modules/provider.calendar/config.js";

test("defines the immutable Block 11 calendar provider manifest", () => {
  assert.deepEqual(MANIFEST, {
    id: "provider.calendar",
    type: "provider",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: ["calendar.events"],
    config_schema: "provider.calendar/v1",
  });
  assert.equal(Object.isFrozen(MANIFEST), true);
  assert.equal(Object.isFrozen(MANIFEST.provides_capabilities), true);
  assert.deepEqual(validateModuleManifest(MANIFEST), MANIFEST);
});

test("normalizes omitted calendar provider config to an immutable empty source list", () => {
  const result = validateCalendarProviderConfig(undefined);
  assert.deepEqual(result, { source_entity_ids: [] });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.source_entity_ids), true);
});

test("accepts explicit unique calendar entity IDs and isolates normalized config from caller mutation", () => {
  const input = { source_entity_ids: ["calendar.family", "calendar.waste"] };
  const result = validateCalendarProviderConfig(input);
  assert.deepEqual(result, input);
  assert.notEqual(result.source_entity_ids, input.source_entity_ids);
  input.source_entity_ids.push("calendar.changed");
  assert.deepEqual(result.source_entity_ids, ["calendar.family", "calendar.waste"]);
});

test("rejects unknown config keys duplicate sources wrong domains and malformed IDs", () => {
  assert.throws(() => validateCalendarProviderConfig({ extra: true }), TypeError);
  assert.throws(() => validateCalendarProviderConfig({ source_entity_ids: ["calendar.family", "calendar.family"] }), TypeError);
  assert.throws(() => validateCalendarProviderConfig({ source_entity_ids: ["sensor.family"] }), TypeError);
  for (const value of ["", "Calendar.Family", "calendar", "calendar.family extra", 12, null]) {
    assert.throws(() => validateCalendarProviderConfig({ source_entity_ids: [value] }), TypeError);
  }
  for (const value of [null, [], "calendar.family", { source_entity_ids: "calendar.family" }]) {
    assert.throws(() => validateCalendarProviderConfig(value), TypeError);
  }
});
