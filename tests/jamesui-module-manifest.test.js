import test from "node:test";
import assert from "node:assert/strict";

import { CORE_API_VERSION, isCoreApiCompatible } from "../custom_components/jamesui/frontend/core/core-api.js";
import { SUPPORTED_MODULE_TYPES, validateModuleManifest } from "../custom_components/jamesui/frontend/core/module-manifest.js";

const validManifest = () => ({
  id: "widget.weather-today",
  type: "widget",
  version: "1.0.0",
  core_api: "1.x",
  depends_on: [],
  requires_capabilities: ["weather.current", "weather.daily"],
  provides_capabilities: [],
  config_schema: "weather-today.schema.json",
});

test("defines the JamesUI 1.0 Core API compatibility contract", () => {
  assert.equal(CORE_API_VERSION, "1.0.0");
  assert.equal(isCoreApiCompatible("1.x"), true);
  assert.equal(isCoreApiCompatible("2.x"), false);
  assert.equal(isCoreApiCompatible("1.0"), false);
  assert.equal(isCoreApiCompatible(null), false);
});

test("validates the canonical manifest into a detached immutable snapshot", () => {
  const input = validManifest();
  const originalRequires = input.requires_capabilities;
  const result = validateModuleManifest(input);

  assert.notEqual(result, input);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.depends_on), true);
  assert.equal(Object.isFrozen(result.requires_capabilities), true);
  assert.equal(Object.isFrozen(result.provides_capabilities), true);
  assert.deepEqual(result, input);

  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(originalRequires), false);
  input.requires_capabilities.push("weather.hourly");
  assert.deepEqual(result.requires_capabilities, ["weather.current", "weather.daily"]);
});

test("supports exactly the four Block 2 module types", () => {
  assert.deepEqual([...SUPPORTED_MODULE_TYPES], ["layout", "widget", "provider", "action"]);
});

test("rejects malformed or ambiguous manifest metadata", () => {
  const invalidCases = [
    { name: "unsupported page extension", change: { type: "page-extension" } },
    { name: "incompatible Core API", change: { core_api: "2.x" } },
    { name: "malformed Core API", change: { core_api: "1.0" } },
    { name: "malformed module version", change: { version: "1.0" } },
    { name: "empty id", change: { id: "  " } },
    { name: "empty config schema", change: { config_schema: "" } },
    { name: "non-array dependency metadata", change: { depends_on: "provider.weather" } },
    { name: "duplicate dependencies", change: { depends_on: ["provider.weather", "provider.weather"] } },
    { name: "duplicate required capabilities", change: { requires_capabilities: ["weather.current", "weather.current"] } },
    { name: "empty provided capability", change: { provides_capabilities: [""] } },
    { name: "self dependency", change: { depends_on: ["widget.weather-today"] } },
  ];

  for (const { name, change } of invalidCases) {
    assert.throws(() => validateModuleManifest({ ...validManifest(), ...change }), undefined, name);
  }

  assert.throws(() => validateModuleManifest({ ...validManifest(), requires: ["weather.current"] }));
});
