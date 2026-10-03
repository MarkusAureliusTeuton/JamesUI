import test from "node:test";
import assert from "node:assert/strict";

import {
  DESIGN_TOKEN_PREFIX,
  JAMESUI_DESIGN_TOKENS,
} from "../custom_components/jamesui/frontend/design/tokens.js";

const REQUIRED_TOKENS = {
  "--jui-color-canvas": "#070809",
  "--jui-color-surface": "rgba(10, 11, 12, 0.90)",
  "--jui-color-accent": "#d8b58a",
  "--jui-color-text-primary": "#f2eee7",
  "--jui-font-family": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  "--jui-font-size-md": "0.9375rem",
  "--jui-space-4": "16px",
  "--jui-radius-lg": "18px",
  "--jui-blur-md": "14px",
  "--jui-shadow-surface": "0 18px 48px rgba(0, 0, 0, 0.34)",
  "--jui-motion-base": "180ms",
  "--jui-ease-standard": "cubic-bezier(0.2, 0.8, 0.2, 1)",
  "--jui-icon-lg": "24px",
};

const REQUIRED_PREFIXES = [
  "--jui-color-",
  "--jui-font-",
  "--jui-line-height-",
  "--jui-space-",
  "--jui-radius-",
  "--jui-blur-",
  "--jui-shadow-",
  "--jui-motion-",
  "--jui-ease-",
  "--jui-icon-",
];

test("design token contract is frozen, namespaced and contains canonical values", () => {
  assert.equal(DESIGN_TOKEN_PREFIX, "--jui-");
  assert.equal(Object.isFrozen(JAMESUI_DESIGN_TOKENS), true);
  assert.equal(Object.keys(JAMESUI_DESIGN_TOKENS).length, 62);

  for (const [name, value] of Object.entries(REQUIRED_TOKENS)) {
    assert.equal(JAMESUI_DESIGN_TOKENS[name], value, name);
  }

  for (const prefix of REQUIRED_PREFIXES) {
    assert.ok(Object.keys(JAMESUI_DESIGN_TOKENS).some((name) => name.startsWith(prefix)), prefix);
  }

  for (const [name, value] of Object.entries(JAMESUI_DESIGN_TOKENS)) {
    assert.ok(name.startsWith(DESIGN_TOKEN_PREFIX), name);
    assert.equal(typeof value, "string");
    assert.ok(value.trim().length > 0, name);
    assert.equal(value.includes("url("), false, name);
  }
});

test("token families include the complete planned geometry and interaction ranges", () => {
  for (let index = 1; index <= 9; index += 1) {
    assert.ok(`--jui-space-${index}` in JAMESUI_DESIGN_TOKENS);
  }
  for (const name of ["sm", "md", "lg", "xl", "pill"]) {
    assert.ok(`--jui-radius-${name}` in JAMESUI_DESIGN_TOKENS);
  }
  for (const name of ["fast", "base", "slow"]) {
    assert.ok(`--jui-motion-${name}` in JAMESUI_DESIGN_TOKENS);
  }
  for (const name of ["sm", "md", "lg", "xl", "hero"]) {
    assert.ok(`--jui-icon-${name}` in JAMESUI_DESIGN_TOKENS);
  }
});
