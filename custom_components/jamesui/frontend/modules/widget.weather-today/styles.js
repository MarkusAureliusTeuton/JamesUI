export const WEATHER_TODAY_STYLES = `
[data-jui-widget="weather-today"] {
  container-type: inline-size;
  position: relative;
  min-width: 0;
  min-height: 100%;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(180deg, var(--jui-color-surface-raised), var(--jui-color-canvas));
  color: var(--jui-color-text-primary);
}

[data-jui-widget="weather-today"] [data-jui-weather-background] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

[data-jui-widget="weather-today"] [data-jui-weather-shade] {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent, var(--jui-color-backdrop));
}

[data-jui-widget="weather-today"] [data-jui-weather-content] {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--jui-space-4);
  min-height: 100%;
  padding: var(--jui-space-6) var(--jui-space-6) calc(var(--jui-space-6) + var(--jui-space-4));
}

[data-jui-widget="weather-today"] [data-jui-weather-date] {
  color: var(--jui-color-text-secondary);
  font-size: var(--jui-font-size-sm);
  font-weight: var(--jui-font-weight-medium);
  line-height: var(--jui-line-height-tight);
  text-transform: capitalize;
}

[data-jui-widget="weather-today"] [data-jui-weather-clock] {
  margin-top: var(--jui-space-1);
  font-size: var(--jui-font-size-display-lg);
  font-weight: var(--jui-font-weight-regular);
  line-height: var(--jui-line-height-tight);
  letter-spacing: -0.04em;
}

[data-jui-widget="weather-today"] [data-jui-weather-current] {
  align-self: end;
  display: flex;
  align-items: center;
  gap: var(--jui-space-4);
  min-width: 0;
}

[data-jui-widget="weather-today"] [data-jui-weather-current-icon] {
  color: var(--jui-color-accent-strong);
}

[data-jui-widget="weather-today"] [data-jui-weather-forecast-trigger] {
  appearance: none;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

[data-jui-widget="weather-today"] [data-jui-weather-forecast-trigger]:focus-visible {
  outline: 2px solid var(--jui-color-accent-strong);
  outline-offset: var(--jui-space-2);
}

[data-jui-widget="weather-today"] [data-jui-weather-temperature] {
  display: block;
  font-size: var(--jui-font-size-display-sm);
  font-weight: var(--jui-font-weight-regular);
  line-height: var(--jui-line-height-tight);
}

[data-jui-widget="weather-today"] [data-jui-weather-condition] {
  display: block;
  margin-top: var(--jui-space-1);
  color: var(--jui-color-text-secondary);
  font-size: var(--jui-font-size-md);
}

[data-jui-widget="weather-today"] [data-jui-weather-condition-emphasis="alert"] {
  color: var(--jui-color-warning);
}

[data-jui-widget="weather-today"] [data-jui-weather-facts] {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  min-width: 0;
  padding-top: var(--jui-space-3);
  border-top: 1px solid var(--jui-color-border-strong);
}

[data-jui-widget="weather-today"] [data-jui-weather-fact] {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--jui-space-2);
  padding: 0 var(--jui-space-2);
  border-right: 1px solid var(--jui-color-border);
}

[data-jui-widget="weather-today"] [data-jui-weather-fact]:first-child {
  padding-left: 0;
}

[data-jui-widget="weather-today"] [data-jui-weather-fact]:last-child {
  border-right: 0;
}

[data-jui-widget="weather-today"] [data-jui-weather-fact-icon] {
  color: var(--jui-color-accent-strong);
}

[data-jui-widget="weather-today"] [data-jui-weather-fact-emphasis="alert"] [data-jui-weather-fact-icon],
[data-jui-widget="weather-today"] [data-jui-weather-fact-emphasis="alert"] [data-jui-weather-fact-value] {
  color: var(--jui-color-warning);
}

[data-jui-widget="weather-today"] [data-jui-weather-fact-label] {
  display: block;
  color: var(--jui-color-text-muted);
  font-size: var(--jui-font-size-xs);
  line-height: var(--jui-line-height-tight);
}

[data-jui-widget="weather-today"] [data-jui-weather-fact-value] {
  display: block;
  margin-top: var(--jui-space-1);
  overflow: hidden;
  color: var(--jui-color-text-primary);
  font-size: var(--jui-font-size-xs);
  font-weight: var(--jui-font-weight-medium);
  line-height: var(--jui-line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-jui-weather-forecast-overlay] [data-jui-weather-hourly-list],
[data-jui-weather-forecast-overlay] [data-jui-weather-daily-list] {
  display: grid;
  gap: var(--jui-space-2);
}

[data-jui-weather-forecast-overlay] [data-jui-weather-hourly-section] + [data-jui-weather-daily-section] {
  margin-top: var(--jui-space-6);
}

[data-jui-weather-forecast-overlay] [data-jui-weather-forecast-hour],
[data-jui-weather-forecast-overlay] [data-jui-weather-forecast-day] {
  display: grid;
  grid-template-columns: minmax(4rem, auto) minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--jui-space-3);
  padding: var(--jui-space-2) 0;
  border-bottom: 1px solid var(--jui-color-border);
}

[data-jui-weather-forecast-overlay] [data-jui-weather-forecast-condition-wrap] {
  display: flex;
  align-items: center;
  gap: var(--jui-space-2);
  min-width: 0;
}

[data-jui-weather-forecast-overlay] [data-jui-weather-hourly-state],
[data-jui-weather-forecast-overlay] [data-jui-weather-daily-state],
[data-jui-weather-forecast-overlay] [data-jui-weather-forecast-empty] {
  color: var(--jui-color-text-muted);
  font-size: var(--jui-font-size-sm);
}

@container (max-width: 44rem) {
  [data-jui-widget="weather-today"] [data-jui-weather-facts] {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    row-gap: var(--jui-space-3);
  }

  [data-jui-widget="weather-today"] [data-jui-weather-fact] {
    border-right: 0;
  }
}

@container (max-width: 30rem) {
  [data-jui-widget="weather-today"] [data-jui-weather-content] {
    padding-inline: var(--jui-space-4);
  }

  [data-jui-widget="weather-today"] [data-jui-weather-facts] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;
