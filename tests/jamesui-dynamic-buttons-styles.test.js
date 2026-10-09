import test from "node:test";
import assert from "node:assert/strict";
import { DYNAMIC_BUTTON_STYLES } from "../custom_components/jamesui/frontend/modules/widget.dynamic-buttons/styles.js";

test("styles semantic modes states feedback and all three size classes", () => {
  for (const value of ["toggle", "trigger"]) assert.match(DYNAMIC_BUTTON_STYLES, new RegExp(`data-jui-dynamic-mode="${value}"`));
  for (const value of ["active", "inactive", "intermediate", "unavailable"]) assert.match(DYNAMIC_BUTTON_STYLES, new RegExp(`data-jui-dynamic-real-status="${value}"`));
  for (const value of ["pending", "success", "error"]) assert.match(DYNAMIC_BUTTON_STYLES, new RegExp(`data-jui-dynamic-feedback="${value}"`));
  for (const value of ["compact", "normal", "wide"]) assert.match(DYNAMIC_BUTTON_STYLES, new RegExp(`data-jui-dynamic-size="${value}"`));
  assert.match(DYNAMIC_BUTTON_STYLES, /--jui-color-status-error/);
  assert.match(DYNAMIC_BUTTON_STYLES, /--jui-color-status-success/);
  assert.match(DYNAMIC_BUTTON_STYLES, /prefers-reduced-motion/);
});

test("does not own page layout or hard-code final 4/5-column Start grid", () => {
  assert.doesNotMatch(DYNAMIC_BUTTON_STYLES, /\bbody\b|\bhtml\b|position:\s*fixed|overflow-y:\s*(auto|scroll)/);
  assert.doesNotMatch(DYNAMIC_BUTTON_STYLES, /repeat\(\s*[45]\s*,/);
  assert.doesNotMatch(DYNAMIC_BUTTON_STYLES, /jamesui-v11|start-footer|home-hero-deck/);
});
