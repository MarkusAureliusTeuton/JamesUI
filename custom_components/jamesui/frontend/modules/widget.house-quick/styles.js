export const HOUSE_QUICK_STYLES = `
[data-jui-widget="house-quick"] {
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--jui-space-3);
  align-content: start;
}

[data-jui-house-quick-button] {
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--jui-color-border);
  border-radius: var(--jui-radius-lg);
  padding: var(--jui-space-4);
  background: var(--jui-color-surface-soft);
  color: var(--jui-color-text-primary);
  font: inherit;
  text-align: left;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--jui-space-3);
  align-items: start;
  box-shadow: var(--jui-shadow-inset-highlight);
}

[data-jui-house-quick-button][data-jui-house-quick-actionable="true"] {
  cursor: pointer;
}

[data-jui-house-quick-status="neutral"] {
  border-color: var(--jui-color-border);
}

[data-jui-house-quick-status="active"] {
  border-color: var(--jui-color-accent-strong);
  background: var(--jui-color-accent-soft);
}

[data-jui-house-quick-status="warning"] {
  border-color: var(--jui-color-status-warning);
}

[data-jui-house-quick-status="critical"] {
  border-color: var(--jui-color-status-error);
}

[data-jui-house-quick-icon] {
  display: grid;
  place-items: center;
  color: var(--jui-color-text-secondary);
}

[data-jui-house-quick-copy] {
  min-width: 0;
  display: grid;
  gap: var(--jui-space-1);
}

[data-jui-house-quick-label] {
  color: var(--jui-color-text-secondary);
  font-size: var(--jui-font-size-sm);
  font-weight: var(--jui-font-weight-medium);
}

[data-jui-house-quick-primary] {
  color: var(--jui-color-text-primary);
  font-size: var(--jui-font-size-lg);
  font-weight: var(--jui-font-weight-semibold);
  line-height: var(--jui-line-height-tight);
}

[data-jui-house-quick-secondary] {
  color: var(--jui-color-text-muted);
  font-size: var(--jui-font-size-xs);
  line-height: var(--jui-line-height-normal);
}

[data-jui-house-quick-status-label] {
  width: fit-content;
  margin-top: var(--jui-space-1);
  border-radius: var(--jui-radius-pill);
  padding: 2px var(--jui-space-2);
  font-size: var(--jui-font-size-xs);
  font-weight: var(--jui-font-weight-semibold);
}

[data-jui-house-quick-status="active"] [data-jui-house-quick-status-label] {
  color: var(--jui-color-accent-strong);
}

[data-jui-house-quick-status="warning"] [data-jui-house-quick-status-label] {
  color: var(--jui-color-status-warning);
}

[data-jui-house-quick-status="critical"] [data-jui-house-quick-status-label] {
  color: var(--jui-color-status-error);
}
`;
