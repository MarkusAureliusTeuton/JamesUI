import test from "node:test";
import assert from "node:assert/strict";

import { BASE_DESIGN_STYLES } from "../custom_components/jamesui/frontend/design/base-styles.js";
import {
  ICON_SIZES,
  SVG_NS,
  createIcon,
} from "../custom_components/jamesui/frontend/icons/icon.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("creates a normalized 24x24 currentColor SVG through the SVG namespace", () => {
  const document = createFakeDocument();
  const icon = createIcon(document, "nav.start");
  assert.equal(icon.namespaceURI, SVG_NS);
  assert.equal(icon.tagName, "SVG");
  assert.equal(icon.getAttribute("viewBox"), "0 0 24 24");
  assert.equal(icon.getAttribute("fill"), "none");
  assert.equal(icon.getAttribute("stroke"), "currentColor");
  assert.equal(icon.getAttribute("stroke-width"), "2");
  assert.equal(icon.getAttribute("stroke-linecap"), "round");
  assert.equal(icon.getAttribute("stroke-linejoin"), "round");
  assert.equal(icon.getAttribute("data-jui-icon"), "nav.start");
  assert.equal(icon.getAttribute("data-jui-icon-size"), "md");
  assert.ok(icon.children.length > 0);
  for (const child of icon.children) assert.equal(child.namespaceURI, SVG_NS);
});

test("defaults icons to decorative accessibility", () => {
  const icon = createIcon(createFakeDocument(), "home.light");
  assert.equal(icon.getAttribute("aria-hidden"), "true");
  assert.equal(icon.getAttribute("focusable"), "false");
  assert.equal(icon.getAttribute("role"), null);
  assert.equal(icon.getAttribute("aria-label"), null);
});

test("gives labelled standalone icons exactly one accessible name", () => {
  const icon = createIcon(createFakeDocument(), "weather.storm", { label: "Gewitter" });
  assert.equal(icon.getAttribute("aria-hidden"), null);
  assert.equal(icon.getAttribute("role"), "img");
  assert.equal(icon.getAttribute("aria-label"), "Gewitter");
  assert.equal(icon.getAttribute("focusable"), "false");
});

test("maps all semantic icon sizes to existing Block 6 tokens", () => {
  assert.equal(Object.isFrozen(ICON_SIZES), true);
  assert.deepEqual(ICON_SIZES, ["sm", "md", "lg", "xl", "hero"]);
  for (const size of ICON_SIZES) {
    const icon = createIcon(createFakeDocument(), "home.energy", { size });
    assert.equal(icon.getAttribute("data-jui-icon-size"), size);
    assert.match(BASE_DESIGN_STYLES, new RegExp(`data-jui-icon-size=\\"${size}\\"[^}]*--jui-icon-${size}`, "s"));
  }
});

test("rejects unknown or malformed IDs and unsupported sizes without a fallback", () => {
  let created = 0;
  const document = {
    createElementNS(namespace, tagName) {
      created += 1;
      return createFakeDocument().createElementNS(namespace, tagName);
    },
  };
  assert.throws(() => createIcon(document, "home.unknown"), /unknown icon/i);
  assert.equal(created, 0);
  assert.throws(() => createIcon(document, "Home Light"), /icon id/i);
  assert.equal(created, 0);
  assert.throws(() => createIcon(document, "home.light", { size: "xxl" }), /size/i);
  assert.equal(created, 0);
});

test("rejects blank or non-string supplied accessibility labels", () => {
  const document = createFakeDocument();
  assert.throws(() => createIcon(document, "home.light", { label: "   " }), /label/i);
  assert.throws(() => createIcon(document, "home.light", { label: 42 }), /label/i);
});

test("requires SVG namespace DOM support", () => {
  assert.throws(() => createIcon({}, "home.light"), /createElementNS|SVG DOM/i);
});
