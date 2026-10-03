import test from "node:test";
import assert from "node:assert/strict";

import { createRouter } from "../custom_components/jamesui/frontend/core/router.js";
import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createAppShell } from "../custom_components/jamesui/frontend/core/shell.js";
import { createDesignSystem } from "../custom_components/jamesui/frontend/design/design-system.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

const NAV_ICONS = Object.freeze({
  home: "nav.start",
  house: "nav.house",
  climate: "nav.climate",
  media: "nav.media",
  door: "nav.door",
});

function setup(options = {}) {
  const document = options.document ?? createFakeDocument();
  const router = createRouter();
  const overlays = createOverlayService();
  const health = createHealthService();
  const designSystem = options.designSystem ?? createDesignSystem({ document });
  const target = new FakeElement("main");
  const shell = createAppShell({
    document,
    router,
    overlays,
    health,
    designSystem,
    getContext: () => ({ marker: "context" }),
    renderPage: options.renderPage,
  });
  shell.mount(target);
  return { document, router, overlays, health, designSystem, target, shell };
}

test("mounts canonical persistent navigation through shared design and icon primitives", () => {
  const { target } = setup();
  const root = target.querySelector('[data-role="app-shell"]');
  const nav = target.querySelector('[data-role="bottom-navigation"]');
  const page = target.querySelector('[data-role="page-region"]');
  const buttons = nav.querySelectorAll("button");
  assert.equal(root.getAttribute("data-jui-design-root"), "");
  assert.equal(root.querySelectorAll('style[data-jui-design-system="1"]').length, 1);
  assert.deepEqual(buttons.map((button) => [
    button.dataset.routeId,
    button.textContent,
    button.getAttribute("data-jui-button"),
    button.getAttribute("data-jui-button-size"),
  ]), [
    ["home", "Start", "ghost", "md"],
    ["house", "Haus", "ghost", "md"],
    ["climate", "Klima", "ghost", "md"],
    ["media", "Medien", "ghost", "md"],
    ["door", "Tür", "ghost", "md"],
  ]);

  const icons = buttons.map((button) => {
    const routeId = button.dataset.routeId;
    const icon = button.querySelector(`svg[data-jui-icon="${NAV_ICONS[routeId]}"]`);
    assert.ok(icon, routeId);
    assert.equal(button.querySelectorAll("svg").length, 1, routeId);
    assert.equal(icon.getAttribute("data-jui-icon-size"), "md", routeId);
    assert.equal(icon.getAttribute("aria-hidden"), "true", routeId);
    assert.equal(icon.getAttribute("role"), null, routeId);
    return icon;
  });

  assert.equal(page.children[0].dataset.routeId, "home");
  assert.equal(buttons[0].getAttribute("aria-current"), "page");

  nav.querySelector('button[data-route-id="house"]').dispatchEvent("click");
  assert.equal(page.children[0].dataset.routeId, "house");
  assert.equal(target.querySelector('[data-role="bottom-navigation"]'), nav);
  assert.equal(buttons[0].getAttribute("aria-current"), null);
  assert.equal(buttons[1].getAttribute("aria-current"), "page");
  buttons.forEach((button, index) => assert.equal(button.querySelector("svg"), icons[index]));
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

test("shell cleanup destroys design and icon state and remounts one fresh navigation set", () => {
  const { target, shell } = setup();
  const firstRoot = target.querySelector('[data-role="app-shell"]');
  const firstNav = target.querySelector('[data-role="bottom-navigation"]');
  const firstIcons = firstNav.querySelectorAll("svg");
  assert.equal(firstIcons.length, 5);

  shell.destroy();
  assert.equal(firstRoot.getAttribute("data-jui-design-root"), null);
  assert.equal(firstRoot.querySelectorAll('style[data-jui-design-system="1"]').length, 0);
  assert.equal(target.querySelector('[data-role="bottom-navigation"]'), null);
  assert.doesNotThrow(() => shell.destroy());

  shell.mount(target);
  const secondRoot = target.querySelector('[data-role="app-shell"]');
  const secondNav = target.querySelector('[data-role="bottom-navigation"]');
  const secondIcons = secondNav.querySelectorAll("svg");
  assert.notEqual(secondRoot, firstRoot);
  assert.notEqual(secondNav, firstNav);
  assert.equal(secondRoot.getAttribute("data-jui-design-root"), "");
  assert.equal(secondRoot.querySelectorAll('style[data-jui-design-system="1"]').length, 1);
  assert.equal(secondIcons.length, 5);
  secondIcons.forEach((icon, index) => assert.notEqual(icon, firstIcons[index]));
});

test("shell requires an explicit Design System dependency", () => {
  const document = createFakeDocument();
  assert.throws(() => createAppShell({
    document,
    router: createRouter(),
    overlays: createOverlayService(),
    health: createHealthService(),
    getContext: () => ({}),
  }), /designSystem/);
});
