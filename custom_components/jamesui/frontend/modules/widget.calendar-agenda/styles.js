export const CALENDAR_AGENDA_STYLES = `
[data-jui-widget="calendar-agenda"] {
  --jui-agenda-row-height: 3.75rem;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: var(--jui-space-2);
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  color: var(--jui-color-text-primary);
  background: var(--jui-color-surface);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-header] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--jui-space-2);
  min-width: 0;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-header-label] {
  overflow: hidden;
  font-size: var(--jui-font-size-sm);
  font-weight: var(--jui-font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-statuses],
[data-jui-widget="calendar-agenda"] [data-jui-agenda-notices] {
  display: grid;
  gap: var(--jui-space-1);
  min-height: 0;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-source-notice] {
  color: var(--jui-color-text-muted);
  font-size: var(--jui-font-size-xs);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-notices][data-expanded="true"] {
  overflow-y: auto;
  overscroll-behavior: contain;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-notice] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--jui-space-2);
  min-width: 0;
  padding: var(--jui-space-2);
  border: 1px solid var(--jui-color-border);
  border-radius: var(--jui-radius-md);
  background: var(--jui-color-surface-raised);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-notice-title] {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-scroll] {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-section] + [data-jui-agenda-section] {
  margin-top: var(--jui-space-3);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-section-title] {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: var(--jui-space-1) 0;
  background: var(--jui-color-surface);
  color: var(--jui-color-text-secondary);
  font-size: var(--jui-font-size-xs);
  font-weight: var(--jui-font-weight-semibold);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-row] {
  --jui-agenda-row-accent: var(--jui-agenda-accent, var(--jui-color-accent-strong));
  display: grid;
  grid-template-columns: 4.5rem 1.5rem minmax(0, 1fr) 2rem;
  align-items: center;
  gap: var(--jui-space-2);
  height: var(--jui-agenda-row-height);
  min-width: 0;
  border-bottom: 1px solid var(--jui-color-border);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-row-button] {
  appearance: none;
  display: contents;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-row-button]:focus-visible,
[data-jui-widget="calendar-agenda"] [data-jui-agenda-complete]:focus-visible,
[data-jui-widget="calendar-agenda"] [data-jui-agenda-day-nav]:focus-visible,
[data-jui-widget="calendar-agenda"] [data-jui-agenda-notice-expand]:focus-visible,
[data-jui-widget="calendar-agenda"] [data-jui-agenda-notice-dismiss]:focus-visible,
[data-jui-widget="calendar-agenda"] [data-jui-agenda-undo]:focus-visible {
  outline: 2px solid var(--jui-color-accent-strong);
  outline-offset: var(--jui-space-1);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-time] {
  color: var(--jui-color-text-muted);
  font-size: var(--jui-font-size-xs);
  white-space: nowrap;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-icon] {
  color: var(--jui-agenda-row-accent);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-copy] {
  min-width: 0;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-title],
[data-jui-widget="calendar-agenda"] [data-jui-agenda-location] {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-title] {
  font-size: var(--jui-font-size-sm);
  font-weight: var(--jui-font-weight-medium);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-location] {
  min-height: var(--jui-line-height-tight);
  color: var(--jui-color-text-muted);
  font-size: var(--jui-font-size-xs);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-complete] {
  justify-self: end;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-continuation="before"] {
  border-top: 1px dashed var(--jui-color-border-strong);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-continuation="after"] {
  border-bottom: 1px dashed var(--jui-color-border-strong);
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-empty],
[data-jui-widget="calendar-agenda"] [data-jui-agenda-too-small] {
  padding: var(--jui-space-4) 0;
  color: var(--jui-color-text-muted);
  font-size: var(--jui-font-size-sm);
  text-align: center;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-too-small] {
  align-self: center;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-undo-region] {
  min-height: 0;
}

[data-jui-widget="calendar-agenda"] [data-jui-agenda-undo-entry] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--jui-space-2);
  padding-top: var(--jui-space-1);
  color: var(--jui-color-text-secondary);
  font-size: var(--jui-font-size-xs);
}

@media (prefers-reduced-motion: reduce) {
  [data-jui-widget="calendar-agenda"],
  [data-jui-widget="calendar-agenda"] * {
    scroll-behavior: auto;
    transition-duration: 0s;
    animation-duration: 0s;
  }
}
`;
