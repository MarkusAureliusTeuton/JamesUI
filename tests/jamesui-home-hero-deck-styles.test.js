import test from "node:test";
import assert from "node:assert/strict";

import { create } from "../custom_components/jamesui/frontend/modules/layout.home-hero-deck/index.js";
import { HOME_HERO_DECK_STYLES } from "../custom_components/jamesui/frontend/modules/layout.home-hero-deck/styles.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const ROOT = '[data-jui-layout="home-hero-deck"]';

test("defines one root-scoped token-driven hero/deck stylesheet", () => {
  assert.equal(typeof HOME_HERO_DECK_STYLES, "string");
  assert.match(HOME_HERO_DECK_STYLES, /\[data-jui-layout="home-hero-deck"\]\s*\{/);
  assert.match(HOME_HERO_DECK_STYLES, /container-type:\s*inline-size/);
  assert.match(HOME_HERO_DECK_STYLES, /grid-template-rows:\\s*var\\(--jui-home-hero-ratio\\)\\s+minmax\\(0,\\s*1fr\\)/);
  assert.match(HOME_HERO_DECK_STYLES, /\\[data-jui-layout-slot="content"\\][^{]*\\{[^}]*overflow:\\s*hidden/s);
  assert.match(HOME_HERO_DECK_STYLES, /@container\s*\(max-width:\s*44rem\)/);

  for (const token of [
    "--jui-space-",
    "--jui-radius-xl",
    "--jui-color-surface",
    "--jui-color-border-strong",
    "--jui-blur-md",
    "--jui-shadow-surface",
    "--jui-shadow-inset-highlight",
  ]) {
    assert.equal(HOME_HERO_DECK_STYLES.includes(token), true, token);
  }
  assert.match(HOME_HERO_DECK_STYLES, /margin-top:\s*calc\(var\(--jui-space-\d\)\s*\*\s*-1\)/);
  assert.match(HOME_HERO_DECK_STYLES, /border-radius:\s*var\(--jui-radius-xl\)\s+var\(--jui-radius-xl\)\s+0\s+0/);

  for (const forbidden of [
    "!important",
    "data:image",
    ".jamesui-home",
    "weather.",
    "calendar.",
    "widget.weather",
    "widget.calendar",
    "body {",
    "html {",
    "url(",
  ]) assert.equal(HOME_HERO_DECK_STYLES.includes(forbidden), false, forbidden);
  assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(/.test(HOME_HERO_DECK_STYLES), false);

  const selectorBlocks = HOME_HERO_DECK_STYLES
    .replace(/@container\s*\([^)]*\)\s*\{/g, "")
    .split("}")
    .map((block) => block.trim())
    .filter(Boolean);
  for (const block of selectorBlocks) {
    const selector = block.split("{")[0]?.trim();
    if (!selector || selector.startsWith("@")) continue;
    for (const part of selector.split(",")) assert.equal(part.trim().startsWith(ROOT), true, part.trim());
  }
});

test("mount owns exactly one style node and remount/destroy do not leak it", () => {
  const document = createFakeDocument();
  const target = document.createElement("main");
  const instance = create({}, {});

  instance.mount(target);
  const firstRoot = target.querySelector(ROOT);
  assert.equal(firstRoot.querySelectorAll('style[data-jui-layout-style="home-hero-deck"]').length, 1);
  assert.equal(firstRoot.querySelector('style[data-jui-layout-style="home-hero-deck"]').textContent, HOME_HERO_DECK_STYLES);

  instance.mount(target);
  const secondRoot = target.querySelector(ROOT);
  assert.notEqual(secondRoot, firstRoot);
  assert.equal(firstRoot.querySelectorAll('style[data-jui-layout-style="home-hero-deck"]').length, 0);
  assert.equal(secondRoot.querySelectorAll('style[data-jui-layout-style="home-hero-deck"]').length, 1);

  instance.destroy();
  assert.equal(secondRoot.querySelectorAll('style[data-jui-layout-style="home-hero-deck"]').length, 0);
  assert.equal(target.querySelector(ROOT), null);
});
