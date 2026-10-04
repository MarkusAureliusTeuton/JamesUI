import test from "node:test";
import assert from "node:assert/strict";

import { createAppShell } from "../custom_components/jamesui/frontend/core/shell.js";
import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { BASE_DESIGN_STYLES } from "../custom_components/jamesui/frontend/design/base-styles.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

function router() {
  const listeners = new Set();
  return {
    currentRouteId: "home",
    currentRoute: { id: "home", label: "Start" },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    navigate() { return true; },
  };
}

function shellHarness() {
  const document = createFakeDocument();
  const overlays = createOverlayService();
  const target = document.createElement("div");
  const shell = createAppShell({
    document,
    router: router(),
    overlays,
    health: createHealthService(),
    getContext: () => ({}),
    designSystem: { mount() {}, destroy() { return true; } },
    renderPage: ({ document: doc }) => doc.createElement("section"),
  });
  shell.mount(target);
  const overlayRoot = target.querySelector('[data-role="overlay-root"]');
  return { document, overlays, shell, overlayRoot };
}

test("shell mounts only same-document element overlay content and preserves text fallback", () => {
  const { document, overlays, shell, overlayRoot } = shellHarness();
  overlays.open({ id: "legacy", title: "Legacy title" });
  assert.equal(overlayRoot.textContent, "Legacy title");

  const content = document.createElement("section");
  content.nodeType = 1;
  overlays.open({ id: "dom", title: "DOM fallback", content });
  assert.deepEqual(overlayRoot.children, [content]);
  assert.equal(content.parentNode, overlayRoot);

  const foreignDocument = createFakeDocument();
  const foreign = foreignDocument.createElement("section");
  foreign.nodeType = 1;
  overlays.open({ id: "foreign", title: "Foreign fallback", content: foreign });
  assert.equal(overlayRoot.children.length, 0);
  assert.equal(overlayRoot.textContent, "Foreign fallback");

  overlays.close("foreign");
  assert.equal(overlayRoot.hidden, true);
  assert.equal(overlayRoot.children.length, 0);
  assert.equal(overlayRoot.textContent, "");
  shell.destroy();
});

test("stale DOM overlay close cannot close a newer overlay", () => {
  const { document, overlays, shell } = shellHarness();
  const first = document.createElement("div"); first.nodeType = 1;
  const second = document.createElement("div"); second.nodeType = 1;
  const closeFirst = overlays.open({ id: "first", content: first });
  overlays.open({ id: "second", content: second });
  closeFirst();
  assert.equal(overlays.current.id, "second");
  shell.destroy();
});

test("shared overlay primitive has an explicit structural layer above sticky navigation", () => {
  assert.match(BASE_DESIGN_STYLES, /\[data-jui-design-root\] \[data-jui-overlay\][\s\S]*?z-index:\s*100\s*;/);
  assert.doesNotMatch(BASE_DESIGN_STYLES, /weather[^\n]*z-index/i);
});
