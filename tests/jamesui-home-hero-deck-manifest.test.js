import test from "node:test";
import assert from "node:assert/strict";

import { validateModuleManifest } from "../custom_components/jamesui/frontend/core/module-manifest.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/layout.home-hero-deck/manifest.js";

test("defines the canonical immutable Block 8 layout manifest", () => {
  assert.equal(Object.isFrozen(MANIFEST), true);
  assert.deepEqual(MANIFEST, {
    id: "layout.home-hero-deck",
    type: "layout",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: [],
    config_schema: "layout.home-hero-deck/v1",
  });
  assert.equal(Object.isFrozen(MANIFEST.depends_on), true);
  assert.equal(Object.isFrozen(MANIFEST.requires_capabilities), true);
  assert.equal(Object.isFrozen(MANIFEST.provides_capabilities), true);

  const validated = validateModuleManifest(MANIFEST);
  assert.deepEqual(validated, MANIFEST);
});
