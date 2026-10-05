export const HOUSE_QUICK_STYLES = `
[data-jui-widget="house-quick"] {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  grid-auto-rows: minmax(88px, 1fr);
  gap: var(--jui-space-3);
  overflow: auto;
  padding: var(--jui-space-1);
}

[data-jui-house-quick-button] {
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--jui-space-3);
  padding: var(--jui-space-4);
  border: 1px solid var(--jui-color-border);
  border-radius: var(--jui-radius-lg);
  background: var(--jui-color-surface-soft);
  color: var(--jui-color-text-primary);
  font: inherit;
  text-align: left;
  box-shadow: var(--jui-shadow-control);
  transition: background var(--jui-motion-base) var(--jui-ease-standard), border-color var(--jui-motion-base) var(--jui-ease-standard);
}

[data-jui-house-quick-button]:not([disabled]) { cursor: pointer; }
[data-jui-house-quick-button][disabled] { cursor: default; }
[data-jui-house-quick-icon] { display: grid; place-items: center; color: var(--jui-color-text-secondary); }
[data-jui-house-quick-text] { min-width: 0; display: grid; gap: var(--jui-space-1); }
[data-jui-house-quick-label] { color: var(--jui-color-text-secondary); font-size: var(--jui-font-size-sm); font-weight: var(--jui-font-weight-medium); }
[data-jui-house-quick-primary] { color: var(--jui-color-text-primary); font-size: var(--jui-font-size-lg); font-weight: var(--jui-font-weight-semibold); line-height: var(--jui-line-height-tight); }
[data-jui-house-quick-secondary] { color: var(--jui-color-text-muted); font-size: var(--jui-font-size-xs); line-height: var(--jui-line-height-normal); }

[data-jui-house-quick-status="neutral"] { background: var(--jui-color-surface-soft); border-color: var(--jui-color-border); }
[data-jui-house-quick-status="active"] { background: var(--jui-color-accent-soft); border-color: var(--jui-color-border-strong); }
[data-jui-house-quick-status="active"] [data-jui-house-quick-icon] { color: var(--jui-color-accent-strong); }
[data-jui-house-quick-status="warning"] { border-color: var(--jui-color-status-warning); }
[data-jui-house-quick-status="warning"] [data-jui-house-quick-icon] { color: var(--jui-color-status-warning); }
[data-jui-house-quick-status="critical"] { border-color: var(--jui-color-status-error); }
[data-jui-house-quick-status="critical"] [data-jui-house-quick-icon] { color: var(--jui-color-status-error); }
`;
