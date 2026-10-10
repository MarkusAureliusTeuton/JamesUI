import test from "node:test";
import assert from "node:assert/strict";

import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { buildModuleImportUrl, createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";

const fixtureUrl = (name) => new URL(`./fixtures/modules/${name}`, import.meta.url).href;

function manifest(id, type = "widget", version = "1.2.3") {
  return {
    id,
    type,
    version,
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: [],
    provides_capabilities: [],
    config_schema: `${id}.schema.json`,
  };
}

function setup({ importer, getContext } = {}) {
  const registry = createModuleRegistry();
  const health = createHealthService();
  const loader = createModuleLoader({ registry, health, importer, getContext });
  return { registry, health, loader };
}

test("buildModuleImportUrl preserves query/hash and replaces version/reload tokens", () => {
  assert.equal(
    buildModuleImportUrl("/module.js?theme=dark#section", "1.3.1"),
    "/module.js?theme=dark&v=1.3.1#section",
  );
  assert.equal(
    buildModuleImportUrl("/module.js?theme=dark&v=old&r=9#section", "2.0.0", 3),
    "/module.js?theme=dark&v=2.0.0&r=3#section",
  );
  assert.equal(buildModuleImportUrl("/module.js?v=old&r=9", "2.0.0"), "/module.js?v=2.0.0");
});

test("requests module-specific context for create and update", async () => {
  const contextRequests = [];
  const received = [];
  const importer = async () => ({
    create(context) {
      received.push(["create", context.request]);
      return {
        mount() {},
        update(nextContext) { received.push(["update", nextContext.request]); },
        destroy() {},
      };
    },
  });
  const { registry, loader } = setup({
    importer,
    getContext: (request) => {
      contextRequests.push(request);
      return Object.freeze({ request });
    },
  });
  const layoutManifest = manifest("layout.context", "layout", "1.4.0");
  const widgetManifest = manifest("widget.context", "widget", "2.1.0");
  registry.register(layoutManifest, { entryUrl: "https://example.test/layout-context.js" });
  registry.register(widgetManifest, { entryUrl: "https://example.test/widget-context.js" });

  assert.equal(await loader.load("layout.context"), true);
  assert.equal(await loader.load("widget.context"), true);
  assert.equal(loader.update("layout.context", { changed: "layout" }), true);
  assert.equal(loader.update("widget.context", { changed: "widget" }), true);

  assert.deepEqual(contextRequests.map((request) => request?.id), [
    "layout.context", "widget.context", "layout.context", "widget.context",
  ]);
  assert.equal(contextRequests[0].manifest, registry.get("layout.context").manifest);
  assert.equal(contextRequests[1].manifest, registry.get("widget.context").manifest);
  assert.equal(contextRequests[2].manifest, contextRequests[0].manifest);
  assert.equal(contextRequests[3].manifest, contextRequests[1].manifest);
  assert.deepEqual(received.map(([phase, request]) => [phase, request?.id]), [
    ["create", "layout.context"],
    ["create", "widget.context"],
    ["update", "layout.context"],
    ["update", "widget.context"],
  ]);
});

test("loads a real fixture with its module version and runs the lifecycle", async () => {
  const imported = [];
  let marker = "ctx-1";
  const { registry, health, loader } = setup({
    importer: async (url) => { imported.push(url); return import(url); },
    getContext: () => ({ marker }),
  });
  registry.register(manifest("layout.minimal", "layout", "1.4.2"), { entryUrl: fixtureUrl("layout-minimal.js") });

  assert.equal(await loader.load("layout.minimal", { config: { value: "first" } }), true);
  assert.equal(loader.isLoaded("layout.minimal"), true);
  assert.match(imported[0], /[?&]v=1\.4\.2(?:&|$)/);
  assert.doesNotMatch(imported[0], /[?&]r=/);

  const target = { events: [] };
  assert.equal(loader.mount("layout.minimal", target), true);
  marker = "ctx-2";
  assert.equal(loader.update("layout.minimal", { value: "second" }), true);
  assert.deepEqual(target.events, [
    ["layout", "mount", "first", "ctx-1"],
    ["layout", "update", "second", "ctx-2"],
  ]);
  assert.equal(health.get("module:layout.minimal"), null);

  assert.equal(loader.destroy("layout.minimal"), true);
  assert.equal(loader.isLoaded("layout.minimal"), false);
  assert.deepEqual(target.events.at(-1), ["layout", "destroy"]);
});

test("reload changes only the requested module generation and preserves mount/config", async () => {
  const imported = [];
  const { registry, loader } = setup({ importer: async (url) => { imported.push(url); return import(url); } });
  registry.register(manifest("layout.a", "layout", "1.0.0"), { entryUrl: fixtureUrl("layout-minimal.js") });
  registry.register(manifest("widget.b", "widget", "2.0.0"), { entryUrl: fixtureUrl("widget-minimal.js") });

  await loader.load("layout.a", { config: { value: "A" } });
  await loader.load("widget.b", { config: { value: "B" } });
  const targetA = { events: [] };
  const targetB = { events: [] };
  loader.mount("layout.a", targetA);
  loader.mount("widget.b", targetB);

  assert.equal(await loader.reload("layout.a"), true);
  const importsA = imported.filter((url) => url.includes("layout-minimal.js"));
  const importsB = imported.filter((url) => url.includes("widget-minimal.js"));
  assert.equal(importsA.length, 2);
  assert.equal(importsB.length, 1);
  assert.match(importsA[1], /[?&]v=1\.0\.0(?:&|$)/);
  assert.match(importsA[1], /[?&]r=1(?:&|$)/);
  assert.equal(targetB.events.some((event) => event[1] === "destroy"), false);
  assert.deepEqual(targetA.events.slice(-2), [["layout", "destroy"], ["layout", "mount", "A", null]]);
});

test("isolates import/create/contract failures in module health", async () => {
  const cases = [
    { id: "widget.import", importer: async () => { throw new Error("import boom"); } },
    { id: "widget.create", importer: async () => ({ create() { throw new Error("create boom"); } }) },
    { id: "widget.promise", importer: async () => ({ create() { return Promise.resolve({}); } }) },
    { id: "widget.contract", importer: async () => ({ create() { return { mount() {}, update() {} }; } }) },
  ];

  for (const item of cases) {
    const { registry, health, loader } = setup({ importer: item.importer });
    registry.register(manifest(item.id), { entryUrl: `https://example.test/${item.id}.js` });
    assert.equal(await loader.load(item.id), false, item.id);
    assert.equal(loader.isLoaded(item.id), false, item.id);
    assert.equal(health.get(`module:${item.id}`).status, "error", item.id);
  }
});

test("isolates mount/update/destroy failures and removes stale runtime after destroy failure", async () => {
  const modes = new Map();
  const importer = async (url) => {
    const id = [...modes.keys()].find((key) => url.includes(key));
    const mode = modes.get(id);
    return {
      create() {
        return {
          mount() { if (mode === "mount") throw new Error("mount boom"); },
          update() { if (mode === "update") throw new Error("update boom"); },
          destroy() { if (mode === "destroy") throw new Error("destroy boom"); },
        };
      },
    };
  };

  for (const mode of ["mount", "update", "destroy"]) {
    const id = `widget.${mode}`;
    modes.clear(); modes.set(id, mode);
    const { registry, health, loader } = setup({ importer });
    registry.register(manifest(id), { entryUrl: `https://example.test/${id}.js` });
    assert.equal(await loader.load(id), true);
    if (mode === "mount") assert.equal(loader.mount(id, {}), false);
    if (mode === "update") assert.equal(loader.update(id, { changed: true }), false);
    if (mode === "destroy") assert.equal(loader.destroy(id), false);
    assert.equal(health.get(`module:${id}`).status, "error");
    if (mode === "destroy") assert.equal(loader.isLoaded(id), false);
  }
});

test("one failed module does not block another and destroyAll attempts every runtime", async () => {
  const destroyed = [];
  const importer = async (url) => {
    const id = url.includes("bad") ? "bad" : "good";
    return {
      create() {
        return {
          mount() {}, update() {},
          destroy() { destroyed.push(id); if (id === "bad") throw new Error("destroy bad"); },
        };
      },
    };
  };
  const { registry, loader } = setup({ importer });
  registry.register(manifest("widget.bad"), { entryUrl: "https://example.test/bad.js" });
  registry.register(manifest("widget.good"), { entryUrl: "https://example.test/good.js" });
  assert.equal(await loader.load("widget.bad"), true);
  assert.equal(await loader.load("widget.good"), true);
  loader.destroyAll();
  assert.deepEqual(destroyed.sort(), ["bad", "good"]);
  assert.equal(loader.isLoaded("widget.bad"), false);
  assert.equal(loader.isLoaded("widget.good"), false);
});

test("failed reload is isolated and leaves no stale old runtime", async () => {
  let imports = 0;
  const { registry, health, loader } = setup({ importer: async (url) => {
    imports += 1;
    if (imports > 1) throw new Error("reload import boom");
    return import(url);
  } });
  registry.register(manifest("provider.reload", "provider"), { entryUrl: fixtureUrl("provider-minimal.js") });
  assert.equal(await loader.load("provider.reload", { config: { value: "kept" } }), true);
  loader.mount("provider.reload", { events: [] });
  assert.equal(await loader.reload("provider.reload"), false);
  assert.equal(loader.isLoaded("provider.reload"), false);
  assert.equal(health.get("module:provider.reload").status, "error");
});


test("Block 14 loads separate widget occurrences with independent lifecycles and module identity", async () => {
  const observations = [];
  const { registry, loader } = setup({
    importer: async () => ({
      create(context, config) {
        const instanceId = context.instanceId;
        observations.push(["create", instanceId, context.moduleId, config.value]);
        return {
          mount() { observations.push(["mount", instanceId]); },
          update(_context, next) { observations.push(["update", instanceId, next.value]); },
          destroy() { observations.push(["destroy", instanceId]); },
        };
      },
    }),
    getContext: ({ id, instanceId }) => ({ instanceId, moduleId: id }),
  });
  registry.register(manifest("widget.multiple"), { entryUrl: "https://example.test/multi.js" });
  assert.equal(await loader.load("widget.multiple", { instanceId: "calendar.a", config: { value: "A" } }), true);
  assert.equal(await loader.load("widget.multiple", { instanceId: "calendar.b", config: { value: "B" } }), true);
  assert.equal(loader.isLoaded("calendar.a"), true);
  assert.equal(loader.isLoaded("calendar.b"), true);
  assert.equal(loader.mount("calendar.a", {}), true);
  assert.equal(loader.mount("calendar.b", {}), true);
  assert.equal(loader.update("calendar.b", { value: "B2" }), true);
  assert.equal(loader.destroy("calendar.a"), true);
  assert.equal(loader.isLoaded("calendar.b"), true);
  assert.deepEqual(observations, [
    ["create", "calendar.a", "widget.multiple", "A"],
    ["create", "calendar.b", "widget.multiple", "B"],
    ["mount", "calendar.a"],
    ["mount", "calendar.b"],
    ["update", "calendar.b", "B2"],
    ["destroy", "calendar.a"],
  ]);
  loader.destroyAll();
});

test("Block 14 rejects ambiguous instance reuse and prevents provider duplicate instances", async () => {
  const { registry, loader } = setup({
    importer: async () => ({ create: () => ({ mount() {}, update() {}, destroy() {} }) }),
  });
  registry.register(manifest("widget.one"), { entryUrl: "https://example.test/one.js" });
  registry.register(manifest("widget.two"), { entryUrl: "https://example.test/two.js" });
  registry.register(manifest("provider.one", "provider"), { entryUrl: "https://example.test/prov.js" });
  assert.equal(await loader.load("widget.one", { instanceId: "shared" }), true);
  assert.equal(await loader.load("widget.two", { instanceId: "shared" }), false);
  assert.equal(await loader.load("provider.one", { instanceId: "provider.duplicate" }), false);
  assert.equal(await loader.load("provider.one"), true);
  loader.destroyAll();
});

test("Block 14 cancels pending instance loads on teardown", async () => {
  let resolveImport;
  const { registry, loader } = setup({
    importer: () => new Promise((resolve) => { resolveImport = resolve; }),
  });
  registry.register(manifest("widget.late"), { entryUrl: "https://example.test/late.js" });
  const load = loader.load("widget.late", { instanceId: "late.a" });
  loader.destroyAll();
  resolveImport({ create: () => ({ mount() {}, update() {}, destroy() {} }) });
  assert.equal(await load, false);
  assert.equal(loader.isLoaded("late.a"), false);
});


test("Block 14 reload affects only one occurrence and retains its configuration", async () => {
  const lifecycle = [];
  const { registry, loader } = setup({
    importer: async () => ({
      create(context, config) {
        const id = context.instanceId;
        return {
          mount() { lifecycle.push([id, "mount", config.label]); },
          update() {},
          destroy() { lifecycle.push([id, "destroy"]); },
        };
      },
    }),
    getContext: ({ instanceId }) => ({ instanceId }),
  });
  registry.register(manifest("widget.repeated"), { entryUrl: "https://example.test/repeated.js" });
  assert.equal(await loader.load("widget.repeated", { instanceId: "first", config: { label: "one" } }), true);
  assert.equal(await loader.load("widget.repeated", { instanceId: "second", config: { label: "two" } }), true);
  loader.mount("first", {});
  loader.mount("second", {});
  assert.equal(await loader.reload("first"), true);
  assert.equal(loader.isLoaded("second"), true);
  assert.deepEqual(lifecycle, [
    ["first", "mount", "one"], ["second", "mount", "two"],
    ["first", "destroy"], ["first", "mount", "one"],
  ]);
  loader.destroyAll();
});

test("explicit mount refusal must never be reported as a successful runtime", async () => {
  const { registry, health, loader } = setup({
    importer: async () => ({
      create() {
        return { mount() { return false; }, update() {}, destroy() {} };
      },
    }),
  });
  registry.register(manifest("widget.refuses"), { entryUrl: "https://example.test/refuses.js" });
  assert.equal(await loader.load("widget.refuses"), true);
  const target = {};
  assert.equal(loader.mount("widget.refuses", target), false);
  assert.equal(health.get("module:widget.refuses")?.status, "error");
  assert.match(health.get("module:widget.refuses")?.error?.message ?? "", /returned false/);
  loader.destroyAll();
  assert.equal(loader.isLoaded("widget.refuses"), false);
});

test("explicit update refusal is reported instead of falsely succeeding", async () => {
  const { registry, health, loader } = setup({
    importer: async () => ({
      create() {
        return { mount() { return true; }, update() { return false; }, destroy() {} };
      },
    }),
  });
  registry.register(manifest("provider.refuses", "provider"), {
    entryUrl: "https://example.test/provider-refuses.js",
  });
  assert.equal(await loader.load("provider.refuses", { config: { revision: 1 } }), true);
  assert.equal(loader.mount("provider.refuses", {}), true);
  assert.equal(loader.update("provider.refuses", { revision: 2 }), false);
  assert.equal(health.get("module:provider.refuses")?.status, "error");
  assert.match(health.get("module:provider.refuses")?.error?.message ?? "", /returned false/);
  assert.equal(loader.isLoaded("provider.refuses"), true, "Refused update keeps old instance available for recovery");
  assert.equal(loader.destroy("provider.refuses"), true);
});

test("failed remount after module reload destroys new runtime and keeps health error", async () => {
  let generations = 0;
  const events = [];
  const { registry, health, loader } = setup({
    importer: async () => ({
      create() {
        const current = ++generations;
        return {
          mount() {
            events.push(["mount", current]);
            return current === 1;
          },
          update() { return true; },
          destroy() { events.push(["destroy", current]); return true; },
        };
      },
    }),
  });
  registry.register(manifest("widget.reload-refuses"), {
    entryUrl: "https://example.test/widget-reload-refuses.js",
  });
  assert.equal(await loader.load("widget.reload-refuses"), true);
  assert.equal(loader.mount("widget.reload-refuses", {}), true);
  assert.equal(await loader.reload("widget.reload-refuses"), false);
  assert.equal(loader.isLoaded("widget.reload-refuses"), false);
  assert.deepEqual(events, [
    ["mount", 1], ["destroy", 1], ["mount", 2], ["destroy", 2],
  ]);
  assert.equal(health.get("module:widget.reload-refuses")?.status, "error");
  assert.match(health.get("module:widget.reload-refuses")?.error?.message ?? "", /returned false/);
});

test("pending widget load can be cancelled and immediately remounted under the same instance ID", async () => {
  const resolve = [];
  const events = [];
  const { registry, health, loader } = setup({
    importer: () => new Promise((done) => resolve.push(done)),
    getContext: ({ instanceId }) => ({ instanceId }),
  });
  registry.register(manifest("widget.fast-undo"), {
    entryUrl: "https://example.test/undo.js",
  });
  const old = loader.load("widget.fast-undo", {
    instanceId: "dashboard:agenda", config: { revision: "old" },
  });
  assert.equal(resolve.length, 1);
  assert.equal(loader.destroy("dashboard:agenda"), true);
  const fresh = loader.load("widget.fast-undo", {
    instanceId: "dashboard:agenda", config: { revision: "new" },
  });
  assert.equal(resolve.length, 2, "New mount must never reuse a cancelled import");
  resolve[1]({
    create(_context, config) {
      return {
        mount() { events.push(["mount", config.revision]); return true; },
        update() { return true; },
        destroy() { events.push(["destroy", config.revision]); },
      };
    },
  });
  assert.equal(await fresh, true);
  assert.equal(loader.mount("dashboard:agenda", {}), true);
  assert.equal(loader.isLoaded("dashboard:agenda"), true);
  resolve[0]({
    create() { throw new Error("cancelled loader should not instantiate stale widget"); },
  });
  assert.equal(await old, false);
  assert.equal(loader.isLoaded("dashboard:agenda"), true);
  assert.deepEqual(events, [["mount", "new"]]);
  assert.equal(health.get("module:dashboard:agenda"), null);
  assert.equal(loader.destroy("dashboard:agenda"), true);
  assert.deepEqual(events.at(-1), ["destroy", "new"]);
});

test("late rejected obsolete import cannot damage a newer successful instance or its health", async () => {
  const resolve = [];
  const reject = [];
  const { registry, health, loader } = setup({
    importer: () => new Promise((done, fail) => { resolve.push(done); reject.push(fail); }),
  });
  registry.register(manifest("widget.reused"), { entryUrl: "https://example.test/reused.js" });
  const old = loader.load("widget.reused", { instanceId: "dashboard:same" });
  assert.equal(loader.destroy("dashboard:same"), true);
  const fresh = loader.load("widget.reused", { instanceId: "dashboard:same" });
  resolve[1]({ create: () => ({ mount() { return true; }, update() {}, destroy() {} }) });
  assert.equal(await fresh, true);
  reject[0](new Error("stale network request failed"));
  assert.equal(await old, false);
  assert.equal(loader.isLoaded("dashboard:same"), true);
  assert.equal(health.get("module:dashboard:same"), null);
  loader.destroyAll();
});

test("multiple superseded pending widget generations cannot delete the last live runtime", async () => {
  const resolve = [];
  const { registry, loader } = setup({
    importer: () => new Promise((done) => resolve.push(done)),
  });
  registry.register(manifest("widget.switching"), { entryUrl: "https://example.test/switching.js" });
  const loaded = [];
  for (let revision = 0; revision < 3; revision++) {
    loaded.push(loader.load("widget.switching", { instanceId: "dashboard:switching" }));
    if (revision < 2) assert.equal(loader.destroy("dashboard:switching"), true);
  }
  const component = { create: () => ({ mount() { return true; }, update() {}, destroy() {} }) };
  resolve[2](component);
  assert.equal(await loaded[2], true);
  resolve[0](component);
  resolve[1](component);
  assert.deepEqual(await Promise.all(loaded.slice(0, 2)), [false, false]);
  assert.equal(loader.isLoaded("dashboard:switching"), true);
  loader.destroyAll();
});
