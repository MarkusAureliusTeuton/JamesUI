import test from "node:test";
import assert from "node:assert/strict";
import { createJamesUICore } from "../custom_components/jamesui/frontend/core/index.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("opt-in dashboard exposes Start only, with unavailable routes disabled and rejected", () => {
  const document = createFakeDocument();
  const core = createJamesUICore({ document, availableRoutes: ["home"] });
  const target = document.createElement("div");
  core.mount(target);
  const nav = target.querySelector('[data-role="bottom-navigation"]');
  assert.equal(nav.querySelectorAll("button").length, 5);
  for (const id of ["house", "climate", "media", "door"]) {
    const button = nav.querySelector('[data-route-id="' + id + '"]');
    assert.equal(button.disabled, true);
    assert.match(button.getAttribute("aria-label"), /noch nicht verfügbar/);
    button.dispatchEvent("click");
    assert.equal(core.router.currentRouteId, "home");
    assert.equal(core.navigate(id), false);
  }
  assert.equal(nav.querySelector('[data-route-id="home"]').disabled, false);
  core.destroy();
});

test("core default navigation keeps all canonical routes available", () => {
  const core = createJamesUICore({ document: createFakeDocument() });
  assert.equal(core.navigate("house"), true);
  core.destroy();
});
