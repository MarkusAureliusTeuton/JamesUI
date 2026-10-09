export const DYNAMIC_BUTTON_STYLES = `
[data-jui-widget="dynamic-buttons"] {
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: var(--jui-space-3);
  align-content: flex-start;
}

[data-jui-dynamic-button] {
  min-width: 0;
  min-height: 72px;
  box-sizing: border-box;
  border: 1px solid var(--jui-color-border);
  border-radius: var(--jui-radius-lg);
  padding: var(--jui-space-3) var(--jui-space-4);
  background: var(--jui-color-surface-soft);
  color: var(--jui-color-text-primary);
  font: inherit;
  text-align: left;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--jui-space-3);
  align-items: center;
  box-shadow: var(--jui-shadow-inset-highlight);
  transition: border-color var(--jui-motion-base) var(--jui-ease-standard), background var(--jui-motion-base) var(--jui-ease-standard), opacity var(--jui-motion-base) var(--jui-ease-standard);
}

[data-jui-dynamic-size="compact"] { flex: 1 1 128px; min-width: 128px; }
[data-jui-dynamic-size="normal"] { flex: 1 1 168px; min-width: 168px; }
[data-jui-dynamic-size="wide"] { flex: 2 1 260px; min-width: 260px; }

[data-jui-dynamic-mode="toggle"] [data-jui-dynamic-mode-indicator] { border-color: var(--jui-color-accent-strong); }
[data-jui-dynamic-mode="trigger"] [data-jui-dynamic-mode-indicator] { border-color: var(--jui-color-border-strong); }

[data-jui-dynamic-real-status="inactive"] { border-color: var(--jui-color-border); }
[data-jui-dynamic-real-status="active"] { border-color: var(--jui-color-accent-strong); background: var(--jui-color-accent-soft); }
[data-jui-dynamic-real-status="intermediate"] { border-color: var(--jui-color-border-strong); }
[data-jui-dynamic-real-status="unavailable"] { border-color: var(--jui-color-status-unavailable); opacity: .62; }

[data-jui-dynamic-feedback="pending"] { border-color: var(--jui-color-border-strong); }
[data-jui-dynamic-feedback="success"] { border-color: var(--jui-color-status-success); }
[data-jui-dynamic-feedback="error"] { border-color: var(--jui-color-status-error); animation: jui-dynamic-error-pulse 500ms ease-in-out 3; }

[data-jui-dynamic-button][aria-disabled="true"] { cursor: default; }
[data-jui-dynamic-button]:not([aria-disabled="true"]) { cursor: pointer; }
[data-jui-dynamic-icon] { display: grid; place-items: center; color: var(--jui-color-text-secondary); }
[data-jui-dynamic-copy] { min-width: 0; display: grid; gap: var(--jui-space-1); }
[data-jui-dynamic-name] { font-size: var(--jui-font-size-md); font-weight: var(--jui-font-weight-semibold); line-height: var(--jui-line-height-tight); }
[data-jui-dynamic-secondary] { color: var(--jui-color-text-muted); font-size: var(--jui-font-size-xs); line-height: var(--jui-line-height-normal); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[data-jui-dynamic-mode-indicator] { color: var(--jui-color-text-muted); border: 1px solid var(--jui-color-border); border-radius: var(--jui-radius-pill); padding: 2px var(--jui-space-2); font-size: var(--jui-font-size-xs); font-weight: var(--jui-font-weight-semibold); }

@keyframes jui-dynamic-error-pulse {
  0%, 100% { box-shadow: var(--jui-shadow-inset-highlight); }
  50% { box-shadow: 0 0 0 2px var(--jui-color-status-error), var(--jui-shadow-inset-highlight); }
}

@media (prefers-reduced-motion: reduce) {
  [data-jui-dynamic-button] { transition: none; }
  [data-jui-dynamic-feedback="error"] { animation: none; box-shadow: 0 0 0 2px var(--jui-color-status-error), var(--jui-shadow-inset-highlight); }
}
`;
