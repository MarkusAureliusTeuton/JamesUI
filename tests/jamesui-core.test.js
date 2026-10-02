import test from "node:test";
import assert from "node:assert/strict";

import { createJamesUICore } from "../custom_components/jamesui/frontend/core/index.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

function moduleManifest(id, type = "provider", { provides = [], requires = [], version = "1.0.0" } = {}) {
  return {
    id,
    type,
    version,
    core_api: "1.x",
    depends_on: [],
    requires_capabilities: requires,
    provides_capabilities: provides,
    config_schema: `${id}.schema.json`,
  };
}

function dataModuleUrl(source) {
  return `data:text/javascript,${encodeURIComponent(source)}%0A//`;
}

test("stores Home Assistant host properties opaquely before mount", () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  const hass = { marker: "opaque" };
  const route = { path: "/jamesui" };
  const panel = { title: "JamesUI" };
  const changes = [];
  core.events.on("core:host-context-changed", (detail) => changes.push(detail));

  core.hass = hass;
  core.narrow = true;
  core.route = route;
  core.panel = panel;
  core.hass = hass;

  const context = core.getHostContext();
  assert.equal(context.hass, hass);
  assert.equal(context.route, route);
  assert.equal(context.panel, panel);
  assert.equal(context.narrow, true);
  assert.equal(core.router.currentRouteId, "home");
  assert.deepEqual(changes, [{ key: "hass" }, { key: "narrow" }, { key: "route" }, { key: "panel" }]);
});

test("passes the opaque host context to the page renderer", () => {
  const document = createFakeDocument();
  let renderedContext = null;
  const core = createJamesUICore({
    document,
    renderPage: ({ route, context }) => {
      renderedContext = context;
      const node = document.createElement("section");
      node.dataset.routeId = route.id;
      return node;
    },
  });
  const hass = { marker: "hass" };
  const route = { path: "/jamesui" };
  core.hass = hass;
  core.route = route;
  core.mount(new FakeElement("main"));
  assert.equal(renderedContext.hass, hass);
  assert.equal(renderedContext.route, route);
});

test("destroy and remount do not duplicate navigation subscriptions", () => {
  const document = createFakeDocument();
  let renders = 0;
  const core = createJamesUICore({
    document,
    renderPage: ({ route }) => {
      renders += 1;
      const node = document.createElement("section");
      node.dataset.routeId = route.id;
      return node;
    },
  });
  const target = new FakeElement("main");
  core.mount(target);
  target.querySelector('button[data-route-id="house"]').dispatchEvent("click");
  assert.equal(renders, 2);

  core.destroy();
  core.mount(target);
  assert.equal(renders, 3);
  target.querySelector('button[data-route-id="climate"]').dispatchEvent("click");
  assert.equal(renders, 4);
});

test("event listener failures are recorded in Core health without aborting dispatch", () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  let successful = 0;
  const boom = new Error("boom");
  core.events.on("core:test", () => { throw boom; });
  core.events.on("core:test", () => { successful += 1; });

  core.events.emit("core:test", { marker: true });
  assert.equal(successful, 1);
  const record = core.health.get("core:event-bus");
  assert.equal(record.status, "error");
  assert.equal(record.error, boom);
});

test("exposes Core service references as read-only", () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  const router = core.router;
  const capabilities = core.capabilities;
  const actions = core.actions;
  assert.ok(capabilities);
  assert.ok(actions);
  assert.throws(() => { core.router = null; }, TypeError);
  assert.throws(() => { core.capabilities = null; }, TypeError);
  assert.throws(() => { core.actions = null; }, TypeError);
  assert.equal(core.router, router);
  assert.equal(core.capabilities, capabilities);
  assert.equal(core.actions, actions);
});

test("composes Module Registry and Loader as read-only Core services", () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  const registry = core.moduleRegistry;
  const loader = core.moduleLoader;
  assert.ok(registry);
  assert.ok(loader);
  assert.throws(() => { core.moduleRegistry = null; }, TypeError);
  assert.throws(() => { core.moduleLoader = null; }, TypeError);
  assert.equal(core.moduleRegistry, registry);
  assert.equal(core.moduleLoader, loader);
});

test("provider module context contains only safe services plus HA adapter and Core destroy cleans once", async () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  core.hass = { states: { secret: true } };
  core.narrow = true;
  core.route = { path: "/jamesui" };
  core.panel = { title: "JamesUI" };

  const entryUrl = new URL("./fixtures/modules/provider-minimal.js", import.meta.url).href;
  core.moduleRegistry.register(moduleManifest("provider.context"), { entryUrl });
  assert.equal(await core.moduleLoader.load("provider.context", { config: { value: "safe" } }), true);

  const target = { events: [] };
  assert.equal(core.moduleLoader.mount("provider.context", target), true);
  assert.deepEqual(target.events[0], [
    "provider", "mount", "safe", ["actions", "capabilities", "events", "homeAssistant", "module", "overlays"],
  ]);

  core.destroy();
  core.destroy();
  assert.equal(target.events.filter((event) => event[1] === "destroy").length, 1);
  assert.equal(core.moduleLoader.isLoaded("provider.context"), false);
});

test("provider and consumer modules exchange capabilities and actions through the safe context", async () => {
  const core = createJamesUICore({ document: createFakeDocument(), openUrl: () => true });
  core.hass = { states: { secret: true } };
  core.narrow = true;
  core.route = { path: "/jamesui" };
  core.panel = { title: "JamesUI" };

  const providerSource = `
    export function create(context) {
      let target = null;
      let handle = null;
      return {
        mount(nextTarget) {
          target = nextTarget;
          target.keys = Object.keys(context).sort();
          target.module = context.module;
          target.moduleFrozen = Object.isFrozen(context.module);
          handle = context.capabilities.register(context.module.id, "demo.value");
          handle.available({ value: 42 });
        },
        update(nextContext) { target.updatedModule = nextContext.module; },
        destroy() { target.unregisterResult = handle.unregister(); }
      };
    }
  `;
  const consumerSource = `
    export function create(context) {
      let target = null;
      let stop = null;
      return {
        mount(nextTarget) {
          target = nextTarget;
          target.keys = Object.keys(context).sort();
          target.module = context.module;
          target.moduleFrozen = Object.isFrozen(context.module);
          target.states = [];
          stop = context.capabilities.subscribe("demo.value", (state) => target.states.push(state));
          target.actionPromise = context.actions.execute({ type: "navigate", route: "house" })
            .then((result) => { target.actionResult = result; return result; });
        },
        update(nextContext) { target.updatedModule = nextContext.module; },
        destroy() { stop?.(); }
      };
    }
  `;

  core.moduleRegistry.register(
    moduleManifest("provider.demo", "provider", { provides: ["demo.value"], version: "1.2.0" }),
    { entryUrl: dataModuleUrl(providerSource) },
  );
  core.moduleRegistry.register(
    moduleManifest("widget.demo", "widget", { requires: ["demo.value"], version: "2.3.0" }),
    { entryUrl: dataModuleUrl(consumerSource) },
  );

  assert.equal(await core.moduleLoader.load("provider.demo"), true);
  assert.equal(await core.moduleLoader.load("widget.demo"), true);
  const providerTarget = {};
  const consumerTarget = {};
  assert.equal(core.moduleLoader.mount("provider.demo", providerTarget), true);
  assert.equal(core.moduleLoader.mount("widget.demo", consumerTarget), true);
  await consumerTarget.actionPromise;

  const providerKeys = ["actions", "capabilities", "events", "homeAssistant", "module", "overlays"];
  const consumerKeys = ["actions", "capabilities", "events", "module", "overlays"];
  assert.deepEqual(providerTarget.keys, providerKeys);
  assert.deepEqual(consumerTarget.keys, consumerKeys);
  assert.deepEqual(providerTarget.module, { id: "provider.demo", type: "provider", version: "1.2.0" });
  assert.deepEqual(consumerTarget.module, { id: "widget.demo", type: "widget", version: "2.3.0" });
  assert.equal(providerTarget.moduleFrozen, true);
  assert.equal(consumerTarget.moduleFrozen, true);
  assert.equal("hass" in providerTarget.module, false);
  assert.equal(consumerTarget.states[0].status, "available");
  assert.deepEqual(consumerTarget.states[0].value, { value: 42 });
  assert.equal(consumerTarget.actionResult.status, "success");
  assert.equal(core.router.currentRouteId, "house");

  assert.equal(core.moduleLoader.update("provider.demo", {}), true);
  assert.equal(core.moduleLoader.update("widget.demo", {}), true);
  assert.equal(providerTarget.updatedModule.id, "provider.demo");
  assert.equal(consumerTarget.updatedModule.id, "widget.demo");

  core.destroy();
  assert.equal(providerTarget.unregisterResult, true);
  assert.equal(consumerTarget.states.at(-1).status, "unavailable");
  assert.equal(consumerTarget.states.at(-1).provider, null);
  assert.equal((await core.actions.execute({ type: "navigate", route: "home" })).status, "unavailable");
});
