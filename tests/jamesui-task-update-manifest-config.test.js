import test from "node:test";
import assert from "node:assert/strict";

import { validateModuleManifest } from "../custom_components/jamesui/frontend/core/module-manifest.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/action.task-update/manifest.js";
import { validateTaskUpdateConfig } from "../custom_components/jamesui/frontend/modules/action.task-update/config.js";

test("defines the immutable Block 11 task-update action manifest", () => {
  assert.deepEqual(MANIFEST, {
    id: "action.task-update",
    type: "action",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: [],
    config_schema: "action.task-update/v1",
  });
  assert.equal(Object.isFrozen(MANIFEST), true);
  assert.deepEqual(validateModuleManifest(MANIFEST), MANIFEST);
});

test("task-update V1 config is strictly empty and immutable", () => {
  assert.deepEqual(validateTaskUpdateConfig(undefined), {});
  assert.equal(Object.isFrozen(validateTaskUpdateConfig({})), true);
  for (const value of [null, [], "x", { extra: true }]) {
    assert.throws(() => validateTaskUpdateConfig(value), TypeError);
  }
});
