import test from "node:test";
import assert from "node:assert/strict";

import { createRouter } from "../custom_components/jamesui/frontend/core/router.js";
import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createAppShell } from "../custom_components/jamesui/frontend/core/shell.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

function setup(options = {}) {
  const document = createFakeDocument();
  const router = createRouter();
  const overlays = createOverlayService();
  const health = createHealthService();
  const target = new FakeElement("main");
  const shell = createAppShell({
    document,
    router,
    overlays,
    health,
    getContext: () => ({ marker: "context" }),
    ...options,
  });
  shell.mount(target);
  return { document, router, overlays, health, target, shell };
}

test("mounts canonical persistent navigation and changes only page content", () => {
  const { target } = setup();
  const nav = target.querySelector('[data-role="bottom-navigation"]');
  const page = target.querySelector('[data-role="page-region"]');
  const buttons = nav.querySelectorAll("button");
  assert.deepEqual(buttons.map((button) => [button.dataset.routeId, button.textContent]), [
    ["home", "Start"], ["house", "Haus"], ["climate", "Klima"], ["media", "Medien"], ["door", "Tür"],
  ]);
  assert.equal(page.children[0].dataset.routeId, "home");
  assert.equal(buttons[0].getAttribute("aria-current"), "page");

  nav.querySelector('button[data-route-id="house"]').dispatchEvent("click");
  assert.equal(page.children[0].dataset.routeId, "house");
  assert.equal(target.querySelector('[data-role="bottom-navigation"]'), nav);
  assert.equal(buttons[0].getAttribute("aria-current"), null);
  assert.equal(buttons[1].getAttribute("aria-current"), "page");
});

test("page renderer failures stay isolated and recover on another route", () => {
  const document = createFakeDocument();
  const { target, health } = setup({
    document,
    renderPage: ({ route }) => {
      if (route.id === "climate") throw new Error("page failed");
      const node = document.createElement("section");
      node.dataset.routeId = route.id;
      return node;
    },
  });
  const nav = target.querySelector('[data-role="bottom-navigation"]');
  assert.doesNotThrow(() => nav.querySelector('button[data-route-id="climate"]').dispatchEvent("click"));
  assert.equal(target.querySelector('[data-role="page-error"]').dataset.routeId, "climate");
  assert.equal(health.get("page:climate").status, "error");
  assert.equal(target.querySelector('[data-role="bottom-navigation"]'), nav);

  nav.querySelector('button[data-route-id="home"]').dispatchEvent("click");
  assert.equal(target.querySelector('[data-role="page-region"]').children[0].dataset.routeId, "home");
  assert.equal(health.get("page:climate"), null);
});

test("overlay replacement and stale close never rebuild the shell", () => {
  const { target, overlays } = setup();
  const nav = target.querySelector('[data-role="bottom-navigation"]');
  const overlayRoot = target.querySelector('[data-role="overlay-root"]');
  const closeFirst = overlays.open({ id: "first", title: "First" });
  assert.equal(overlayRoot.hidden, false);
  assert.equal(overlayRoot.dataset.overlayId, "first");
  assert.equal(overlayRoot.textContent, "First");

  overlays.open({ id: "second", title: "Second" });
  closeFirst();
  assert.equal(overlayRoot.dataset.overlayId, "second");
  assert.equal(overlayRoot.textContent, "Second");
  overlays.close("second");
  assert.equal(overlayRoot.hidden, true);
  assert.equal(target.querySelector('[data-role="bottom-navigation"]'), nav);
});
