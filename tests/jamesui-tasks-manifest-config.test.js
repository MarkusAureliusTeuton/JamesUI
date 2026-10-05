import test from "node:test";
import assert from "node:assert/strict";

import { validateModuleManifest } from "../custom_components/jamesui/frontend/core/module-manifest.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.tasks/manifest.js";
import { validateTasksProviderConfig } from "../custom_components/jamesui/frontend/modules/provider.tasks/config.js";

test("defines the immutable Block 11 tasks provider manifest", () => {
  assert.deepEqual(MANIFEST, {
    id: "provider.tasks",
    type: "provider",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: ["tasks.items"],
    config_schema: "provider.tasks/v1",
  });
  assert.equal(Object.isFrozen(MANIFEST), true);
  assert.equal(Object.isFrozen(MANIFEST.provides_capabilities), true);
  assert.deepEqual(validateModuleManifest(MANIFEST), MANIFEST);
});

test("normalizes omitted tasks config to an immutable empty source list", () => {
  const result = validateTasksProviderConfig(undefined);
  assert.deepEqual(result, { source_entity_ids: [] });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.source_entity_ids), true);
});

test("accepts explicit unique todo sources without retaining caller arrays", () => {
  const input = { source_entity_ids: ["todo.household", "todo.shopping"] };
  const result = validateTasksProviderConfig(input);
  assert.deepEqual(result, input);
  assert.notEqual(result.source_entity_ids, input.source_entity_ids);
  input.source_entity_ids.push("todo.changed");
  assert.deepEqual(result.source_entity_ids, ["todo.household", "todo.shopping"]);
});

test("rejects unknown keys duplicate todo sources wrong domains and malformed config", () => {
  assert.throws(() => validateTasksProviderConfig({ extra: true }), TypeError);
  assert.throws(() => validateTasksProviderConfig({ source_entity_ids: ["todo.household", "todo.household"] }), TypeError);
  assert.throws(() => validateTasksProviderConfig({ source_entity_ids: ["calendar.household"] }), TypeError);
  for (const value of ["", "Todo.Household", "todo", "todo.household extra", 12, null]) {
    assert.throws(() => validateTasksProviderConfig({ source_entity_ids: [value] }), TypeError);
  }
  for (const value of [null, [], "todo.household", { source_entity_ids: "todo.household" }]) {
    assert.throws(() => validateTasksProviderConfig(value), TypeError);
  }
});
