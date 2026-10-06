import test from "node:test";
import assert from "node:assert/strict";

import { HOUSE_QUICK_STYLES } from "../custom_components/jamesui/frontend/modules/widget.house-quick/styles.js";

test("uses JamesUI tokens for all four semantic status treatments", () => {
  assert.match(HOUSE_QUICK_STYLES, /--jui-/);
  for (const status of ["neutral", "active", "warning", "critical"]) {
    assert.match(HOUSE_QUICK_STYLES, new RegExp(`data-jui-house-quick-status="${status}"`));
  }
  assert.match(HOUSE_QUICK_STYLES, /--jui-color-accent/);
  assert.match(HOUSE_QUICK_STYLES, /--jui-color-status-warning/);
  assert.match(HOUSE_QUICK_STYLES, /--jui-color-status-error/);
});

test("stays bounded by its host and does not own page scrolling or legacy selectors", () => {
  assert.match(HOUSE_QUICK_STYLES, /max-width:\s*100%/);
  assert.match(HOUSE_QUICK_STYLES, /max-height:\s*100%/);
  assert.match(HOUSE_QUICK_STYLES, /box-sizing:\s*border-box/);
  assert.doesNotMatch(HOUSE_QUICK_STYLES, /\bbody\b|\bhtml\b/);
  assert.doesNotMatch(HOUSE_QUICK_STYLES, /position:\s*fixed/);
  assert.doesNotMatch(HOUSE_QUICK_STYLES, /jamesui-v11|house-grid|overflow-y:\s*(auto|scroll)/);
});
