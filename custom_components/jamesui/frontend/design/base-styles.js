export const BASE_DESIGN_STYLES = `
[data-jui-design-root] {
  color-scheme: dark;
  background: var(--jui-color-canvas);
  color: var(--jui-color-text-primary);
  font-family: var(--jui-font-family);
  font-size: var(--jui-font-size-md);
  line-height: var(--jui-line-height-normal);
}

[data-jui-design-root],
[data-jui-design-root] * {
  box-sizing: border-box;
}

[data-jui-design-root] [data-jui-surface] {
  background: var(--jui-color-surface);
  color: var(--jui-color-text-primary);
  border: 1px solid var(--jui-color-border);
  border-radius: var(--jui-radius-lg);
  box-shadow: var(--jui-shadow-surface), var(--jui-shadow-inset-highlight);
}

[data-jui-design-root] [data-jui-surface="raised"] {
  background: var(--jui-color-surface-raised);
  box-shadow: var(--jui-shadow-surface), var(--jui-shadow-inset-highlight);
}

[data-jui-design-root] [data-jui-surface="glass"] {
  background: var(--jui-color-surface);
  backdrop-filter: blur(var(--jui-blur-md));
  -webkit-backdrop-filter: blur(var(--jui-blur-md));
}

[data-jui-design-root] [data-jui-button] {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--jui-space-2);
  min-width: 0;
  padding: var(--jui-space-2) var(--jui-space-4);
  border: 1px solid var(--jui-color-border);
  border-radius: var(--jui-radius-md);
  background: var(--jui-color-surface-soft);
  color: var(--jui-color-text-primary);
  font: inherit;
  font-size: var(--jui-font-size-sm);
  font-weight: var(--jui-font-weight-medium);
  line-height: var(--jui-line-height-tight);
  text-align: center;
  cursor: pointer;
  box-shadow: var(--jui-shadow-control), var(--jui-shadow-inset-highlight);
  transition:
    transform var(--jui-motion-fast) var(--jui-ease-standard),
    background var(--jui-motion-base) var(--jui-ease-standard),
    border-color var(--jui-motion-base) var(--jui-ease-standard),
    color var(--jui-motion-base) var(--jui-ease-standard),
    opacity var(--jui-motion-base) var(--jui-ease-standard);
}

[data-jui-design-root] [data-jui-button="ghost"] {
  background: transparent;
  box-shadow: none;
}

[data-jui-design-root] [data-jui-button="accent"] {
  background: var(--jui-color-accent-soft);
  color: var(--jui-color-accent-strong);
  border-color: var(--jui-color-border-strong);
}

[data-jui-design-root] [data-jui-button-size="sm"] {
  padding: var(--jui-space-1) var(--jui-space-3);
  font-size: var(--jui-font-size-xs);
  border-radius: var(--jui-radius-sm);
}

[data-jui-design-root] [data-jui-button-size="md"] {
  padding: var(--jui-space-2) var(--jui-space-4);
}

[data-jui-design-root] [data-jui-button-size="lg"] {
  padding: var(--jui-space-3) var(--jui-space-5);
  font-size: var(--jui-font-size-md);
  border-radius: var(--jui-radius-lg);
}

[data-jui-design-root] [data-jui-button]:hover:not(:disabled) {
  border-color: var(--jui-color-border-strong);
}

[data-jui-design-root] [data-jui-button]:active:not(:disabled) {
  transform: translateY(1px);
}

[data-jui-design-root] [data-jui-button]:focus-visible {
  outline: 2px solid var(--jui-color-accent-strong);
  outline-offset: 2px;
}

[data-jui-design-root] [data-jui-button]:disabled,
[data-jui-design-root] [data-jui-button][aria-disabled="true"] {
  color: var(--jui-color-text-muted);
  cursor: default;
  opacity: 0.5;
}

[data-jui-design-root] [data-jui-button][aria-current="page"],
[data-jui-design-root] [data-jui-button][aria-pressed="true"] {
  color: var(--jui-color-accent-strong);
  border-color: var(--jui-color-border-strong);
  background: var(--jui-color-accent-soft);
}

[data-jui-design-root] [data-jui-overlay] {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--jui-space-6);
  background: var(--jui-color-backdrop);
  backdrop-filter: blur(var(--jui-blur-sm));
  -webkit-backdrop-filter: blur(var(--jui-blur-sm));
}

[data-jui-design-root] [data-jui-dialog] {
  width: min(100%, 42rem);
  max-height: min(88vh, 52rem);
  overflow: auto;
  padding: var(--jui-space-6);
  border: 1px solid var(--jui-color-border);
  border-radius: var(--jui-radius-xl);
  background: var(--jui-color-surface-raised);
  color: var(--jui-color-text-primary);
  box-shadow: var(--jui-shadow-overlay), var(--jui-shadow-inset-highlight);
}

[data-jui-design-root] [data-jui-dialog-title] {
  margin: 0;
  color: var(--jui-color-text-primary);
  font-size: var(--jui-font-size-xl);
  font-weight: var(--jui-font-weight-medium);
  line-height: var(--jui-line-height-tight);
}

[data-jui-design-root] [data-jui-dialog-body] {
  margin-top: var(--jui-space-4);
  color: var(--jui-color-text-secondary);
}

[data-jui-design-root] [data-jui-dialog-actions] {
  display: flex;
  justify-content: flex-end;
  gap: var(--jui-space-2);
  margin-top: var(--jui-space-6);
}

@media (prefers-reduced-motion: reduce) {
  [data-jui-design-root] {
    --jui-motion-fast: 0ms;
    --jui-motion-base: 0ms;
    --jui-motion-slow: 0ms;
  }
}
`;
