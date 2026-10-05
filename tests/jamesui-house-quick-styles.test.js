import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_QUICK_STYLES } from '../custom_components/jamesui/frontend/modules/widget.house-quick/styles.js';

test('styles are host bounded and use JamesUI design tokens', () => {
  assert.match(HOUSE_QUICK_STYLES, /\[data-jui-widget="house-quick"\]/);
  assert.match(HOUSE_QUICK_STYLES, /width:\s*100%/);
  assert.match(HOUSE_QUICK_STYLES, /height:\s*100%/);
  assert.match(HOUSE_QUICK_STYLES, /min-width:\s*0/);
  assert.match(HOUSE_QUICK_STYLES, /min-height:\s*0/);
  assert.match(HOUSE_QUICK_STYLES, /var\(--jui-color-surface/);
  assert.match(HOUSE_QUICK_STYLES, /var\(--jui-space-/);
  assert.match(HOUSE_QUICK_STYLES, /var\(--jui-radius-/);
});

test('styles define all semantic button states with shared status tokens', () => {
  for (const status of ['neutral','active','warning','critical']) {
    assert.match(HOUSE_QUICK_STYLES, new RegExp(`data-jui-house-quick-status="${status}"`));
  }
  assert.match(HOUSE_QUICK_STYLES, /--jui-color-accent/);
  assert.match(HOUSE_QUICK_STYLES, /--jui-color-status-warning/);
  assert.match(HOUSE_QUICK_STYLES, /--jui-color-status-error/);
});

test('styles do not control page scrolling or copy legacy selectors', () => {
  assert.doesNotMatch(HOUSE_QUICK_STYLES, /(^|[},\s])(html|body)\s*\{/m);
  assert.doesNotMatch(HOUSE_QUICK_STYLES, /jamesui-panel|jamesui-v11|house-grid|home-house/i);
  assert.doesNotMatch(HOUSE_QUICK_STYLES, /position:\s*fixed/i);
});
