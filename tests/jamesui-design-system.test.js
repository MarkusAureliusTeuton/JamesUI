import test from "node:test";
import assert from "node:assert/strict";

import { BASE_DESIGN_STYLES } from "../custom_components/jamesui/frontend/design/base-styles.js";
import {
  buildDesignStyleText,
  createDesignSystem,
} from "../custom_components/jamesui/frontend/design/design-system.js";
import { JAMESUI_DESIGN_TOKENS } from "../custom_components/jamesui/frontend/design/tokens.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

test("builds one root-scoped stylesheet from canonical tokens and base primitives", () => {
  const css = buildDesignStyleText();
  assert.ok(css.indexOf("[data-jui-design-root]") < css.indexOf("[data-jui-surface]"));
  for (const [name, value] of Object.entries(JAMESUI_DESIGN_TOKENS)) {
    assert.match(css, new RegExp(`${name.replaceAll("-", "\\-")}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }

  for (const hook of [
    "[data-jui-surface]",
    '[data-jui-surface="raised"]',
    '[data-jui-surface="glass"]',
    "[data-jui-button]",
    '[data-jui-button="ghost"]',
    '[data-jui-button="accent"]',
    '[data-jui-button-size="sm"]',
    '[data-jui-button-size="lg"]',
    "[data-jui-overlay]",
    "[data-jui-dialog]",
    "[data-jui-dialog-title]",
    "[data-jui-dialog-body]",
    "[data-jui-dialog-actions]",
  ]) assert.ok(BASE_DESIGN_STYLES.includes(hook), hook);

  assert.match(BASE_DESIGN_STYLES, /prefers-reduced-motion:\s*reduce/);
  for (const token of ["fast", "base", "slow"]) {
    assert.match(BASE_DESIGN_STYLES, new RegExp(`--jui-motion-${token}\\s*:\\s*0ms`));
  }
  assert.doesNotMatch(BASE_DESIGN_STYLES, /!important/i);
  assert.doesNotMatch(BASE_DESIGN_STYLES, /url\s*\(/i);
  assert.doesNotMatch(BASE_DESIGN_STYLES, /#[0-9a-f]{3,8}|rgba?\s*\(|hsla?\s*\(/i);
  assert.doesNotMatch(BASE_DESIGN_STYLES, /(^|[,{]\s*)(html|body|:root)(?=[\s,{])/im);
});

test("mount is root-local, idempotent and moves cleanly between roots", () => {
  const document = createFakeDocument();
  const first = new FakeElement("section");
  const second = new FakeElement("section");
  const design = createDesignSystem({ document });

  const firstStyle = design.mount(first);
  assert.equal(first.getAttribute("data-jui-design-root"), "");
  assert.equal(firstStyle.getAttribute("data-jui-design-system"), "1");
  assert.equal(firstStyle.textContent, buildDesignStyleText());
  assert.equal(first.querySelectorAll('style[data-jui-design-system="1"]').length, 1);
  assert.equal(design.mount(first), firstStyle);
  assert.equal(first.querySelectorAll('style[data-jui-design-system="1"]').length, 1);

  const secondStyle = design.mount(second);
  assert.notEqual(secondStyle, firstStyle);
  assert.equal(first.getAttribute("data-jui-design-root"), null);
  assert.equal(first.querySelectorAll('style[data-jui-design-system="1"]').length, 0);
  assert.equal(second.getAttribute("data-jui-design-root"), "");
  assert.equal(second.querySelectorAll('style[data-jui-design-system="1"]').length, 1);

  assert.equal(design.destroy(), true);
  assert.equal(second.getAttribute("data-jui-design-root"), null);
  assert.equal(second.querySelectorAll('style[data-jui-design-system="1"]').length, 0);
  assert.equal(design.destroy(), false);
});

test("rejects missing DOM dependencies and never mounts into document head", () => {
  assert.throws(() => createDesignSystem(), TypeError);
  const document = createFakeDocument();
  const design = createDesignSystem({ document });
  assert.throws(() => design.mount(null), TypeError);
  assert.throws(() => design.mount({}), TypeError);
  assert.equal("head" in document, false);
});
