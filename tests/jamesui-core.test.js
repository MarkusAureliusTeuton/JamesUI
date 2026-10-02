import test from "node:test";
import assert from "node:assert/strict";

import { createJamesUICore } from "../custom_components/jamesui/frontend/core/index.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

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
