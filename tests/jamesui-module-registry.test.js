import test from "node:test";
import assert from "node:assert/strict";

import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";

function manifest(id, overrides = {}) {
  return {
    id,
    type: "provider",
    version: "1.0.0",
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: [],
    config_schema: `${id}.schema.json`,
    ...overrides,
  };
}

test("registers immutable records and returns stable list/get views", () => {
  const registry = createModuleRegistry();
  const input = manifest("provider.weather", { provides_capabilities: ["weather.current"] });
  const record = registry.register(input, { entryUrl: "/modules/weather/index.js" });

  assert.equal(Object.isFrozen(record), true);
  assert.equal(record.manifest.id, "provider.weather");
  assert.equal(record.entryUrl, "/modules/weather/index.js");
  assert.equal(registry.has("provider.weather"), true);
  assert.equal(registry.get("provider.weather"), record);
  assert.deepEqual(registry.list(), [record]);
  assert.equal(registry.getCapabilityProvider("weather.current"), "provider.weather");
  assert.throws(() => { record.entryUrl = "/changed.js"; }, TypeError);
});

test("rejects duplicate IDs and missing dependencies without partial state", () => {
  const registry = createModuleRegistry();
  const original = registry.register(manifest("provider.base"), { entryUrl: "/base.js" });

  assert.throws(() => registry.register(manifest("provider.base"), { entryUrl: "/other.js" }));
  assert.equal(registry.get("provider.base"), original);

  assert.throws(() => registry.register(manifest("widget.needs-base", {
    type: "widget",
    depends_on: ["provider.missing"],
    provides_capabilities: ["widget.partial"],
  }), { entryUrl: "/widget.js" }));
  assert.equal(registry.has("widget.needs-base"), false);
  assert.equal(registry.getCapabilityProvider("widget.partial"), null);
});

test("allows registered dependencies and unresolved required capabilities", () => {
  const registry = createModuleRegistry();
  registry.register(manifest("provider.base"), { entryUrl: "/base.js" });
  const dependent = registry.register(manifest("widget.weather", {
    type: "widget",
    depends_on: ["provider.base"],
    requires_capabilities: ["weather.current"],
  }), { entryUrl: "/weather-widget.js" });

  assert.equal(dependent.manifest.requires_capabilities[0], "weather.current");
  assert.equal(registry.getCapabilityProvider("weather.current"), null);
});

test("rejects duplicate provided capability claims atomically", () => {
  const registry = createModuleRegistry();
  registry.register(manifest("provider.weather-a", { provides_capabilities: ["weather.current"] }), { entryUrl: "/a.js" });

  assert.throws(() => registry.register(manifest("provider.weather-b", {
    provides_capabilities: ["weather.current", "weather.daily"],
  }), { entryUrl: "/b.js" }));

  assert.equal(registry.has("provider.weather-b"), false);
  assert.equal(registry.getCapabilityProvider("weather.current"), "provider.weather-a");
  assert.equal(registry.getCapabilityProvider("weather.daily"), null);
});

test("refuses dependency removal and releases IDs/capabilities after safe unregister", () => {
  const registry = createModuleRegistry();
  registry.register(manifest("provider.base", { provides_capabilities: ["base.ready"] }), { entryUrl: "/base.js" });
  registry.register(manifest("widget.child", { type: "widget", depends_on: ["provider.base"] }), { entryUrl: "/child.js" });

  assert.equal(registry.unregister("unknown"), false);
  assert.equal(registry.unregister("provider.base"), false);
  assert.equal(registry.has("provider.base"), true);

  assert.equal(registry.unregister("widget.child"), true);
  assert.equal(registry.unregister("provider.base"), true);
  assert.equal(registry.has("provider.base"), false);
  assert.equal(registry.getCapabilityProvider("base.ready"), null);

  const replacement = registry.register(manifest("provider.base", { provides_capabilities: ["base.ready"] }), { entryUrl: "/base-v2.js" });
  assert.equal(replacement.entryUrl, "/base-v2.js");
});

test("requires a non-empty entry URL", () => {
  const registry = createModuleRegistry();
  assert.throws(() => registry.register(manifest("provider.base"), { entryUrl: "  " }));
  assert.equal(registry.has("provider.base"), false);
});
