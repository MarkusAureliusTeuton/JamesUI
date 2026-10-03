import test from "node:test";
import assert from "node:assert/strict";

import {
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  SURFACE_VARIANTS,
  createButton,
  createDialog,
  createOverlayFrame,
  createSurface,
} from "../custom_components/jamesui/frontend/design/primitives.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("exports frozen canonical primitive variants", () => {
  assert.deepEqual(SURFACE_VARIANTS, ["default", "raised", "glass"]);
  assert.deepEqual(BUTTON_VARIANTS, ["default", "ghost", "accent"]);
  assert.deepEqual(BUTTON_SIZES, ["sm", "md", "lg"]);
  assert.equal(Object.isFrozen(SURFACE_VARIANTS), true);
  assert.equal(Object.isFrozen(BUTTON_VARIANTS), true);
  assert.equal(Object.isFrozen(BUTTON_SIZES), true);
});

test("surface factory creates only supported semantic variants and tags", () => {
  const document = createFakeDocument();
  for (const variant of SURFACE_VARIANTS) {
    const surface = createSurface(document, { tagName: "article", variant });
    assert.equal(surface.tagName, "ARTICLE");
    assert.equal(surface.getAttribute("data-jui-surface"), variant);
  }
  assert.equal(createSurface(document).tagName, "SECTION");
  for (const variant of ["", "neon", null]) {
    assert.throws(() => createSurface(document, { variant }), TypeError);
  }
  for (const tagName of ["", "1div", "div script", null]) {
    assert.throws(() => createSurface(document, { tagName }), TypeError);
  }
});

test("button factory enforces variants sizes and an accessible name", () => {
  const document = createFakeDocument();
  for (const variant of BUTTON_VARIANTS) {
    for (const size of BUTTON_SIZES) {
      const button = createButton(document, { label: "Start", variant, size });
      assert.equal(button.tagName, "BUTTON");
      assert.equal(button.textContent, "Start");
      assert.equal(button.getAttribute("type"), "button");
      assert.equal(button.getAttribute("data-jui-button"), variant);
      assert.equal(button.getAttribute("data-jui-button-size"), size);
      assert.equal(button.getAttribute("aria-label"), null);
      assert.equal(button.listeners.size, 0);
    }
  }

  const iconReady = createButton(document, { ariaLabel: "Menü öffnen", variant: "ghost" });
  assert.equal(iconReady.textContent, "");
  assert.equal(iconReady.getAttribute("aria-label"), "Menü öffnen");

  assert.throws(() => createButton(document), TypeError);
  assert.throws(() => createButton(document, { label: "   " }), TypeError);
  assert.throws(() => createButton(document, { label: "X", variant: "neon" }), TypeError);
  assert.throws(() => createButton(document, { label: "X", size: "xl" }), TypeError);
});

test("overlay and dialog factories provide presentation hooks without lifecycle behavior", () => {
  const document = createFakeDocument();
  const overlay = createOverlayFrame(document);
  assert.equal(overlay.tagName, "DIV");
  assert.equal(overlay.getAttribute("data-jui-overlay"), "");
  assert.equal(overlay.listeners.size, 0);

  const dialog = createDialog(document, { title: "Wetterdetails" });
  assert.equal(Object.isFrozen(dialog), true);
  assert.equal(dialog.root.getAttribute("data-jui-dialog"), "");
  assert.equal(dialog.root.getAttribute("role"), "dialog");
  assert.equal(dialog.root.getAttribute("aria-modal"), "true");
  assert.equal(dialog.root.getAttribute("aria-label"), "Wetterdetails");
  assert.equal(dialog.title.textContent, "Wetterdetails");
  assert.equal(dialog.title.getAttribute("data-jui-dialog-title"), "");
  assert.equal(dialog.body.getAttribute("data-jui-dialog-body"), "");
  assert.equal(dialog.actions.getAttribute("data-jui-dialog-actions"), "");
  assert.deepEqual(dialog.root.children, [dialog.title, dialog.body, dialog.actions]);
  assert.equal(dialog.root.listeners.size, 0);
  assert.throws(() => createDialog(document, { title: "" }), TypeError);
});
