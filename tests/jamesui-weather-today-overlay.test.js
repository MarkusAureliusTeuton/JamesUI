import test from "node:test";
import assert from "node:assert/strict";

import { createForecastOverlay } from "../custom_components/jamesui/frontend/modules/widget.weather-today/overlay.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const available = (value) => ({ status: "available", value, reason: null });
const unavailable = (reason = null) => ({ status: "unavailable", value: null, reason });
const NOW = new Date("2026-10-04T08:30:00Z");

function hourlyItems(count = 14) {
  return Array.from({ length: count }, (_, index) => ({
    datetime: new Date(Date.UTC(2026, 9, 4, 9 + index)).toISOString(),
    condition: index % 2 ? "cloudy" : "sunny",
    temperature: 12 + index,
    precipitation_probability: index * 5,
  }));
}

function dailyItems() {
  return [
    { date: "2026-10-03", condition: "rainy", temperature_high: 13, temperature_low: 7, precipitation_probability: 80 },
    ...Array.from({ length: 8 }, (_, index) => ({
      date: `2026-10-${String(4 + index).padStart(2, "0")}`,
      condition: index % 2 ? "cloudy" : "sunny",
      temperature_high: 18 + index,
      temperature_low: 8 + index,
      precipitation_probability: index * 10,
    })),
  ];
}

test("creates an accessible stable forecast dialog with explicit close behavior", () => {
  const document = createFakeDocument();
  let closes = 0;
  const overlay = createForecastOverlay(document, { onClose: () => { closes += 1; } });
  const root = overlay.root;
  const dialog = root.querySelector('[data-jui-dialog=""]');
  const close = root.querySelector('[data-jui-weather-forecast-close=""]');
  assert.ok(root);
  assert.ok(dialog);
  assert.equal(dialog.getAttribute("aria-label"), "Wetterprognose");
  assert.equal(close.getAttribute("aria-label"), "Prognose schließen");

  close.dispatchEvent({ type: "click", target: close });
  assert.equal(closes, 1);
  root.dispatchEvent({ type: "click", target: dialog });
  assert.equal(closes, 1);
  root.dispatchEvent({ type: "click", target: root });
  assert.equal(closes, 2);

  assert.equal(overlay.root, root);
  assert.equal(overlay.destroy(), true);
  assert.equal(overlay.destroy(), false);
});

test("renders at most twelve future genuine hourly entries in HA timezone", () => {
  const document = createFakeDocument();
  const overlay = createForecastOverlay(document, { onClose() {} });
  overlay.update({
    hourlySnapshot: available({
      time_zone: "Europe/Berlin",
      units: { temperature: "°C" },
      items: [
        { datetime: "2026-10-04T07:00:00Z", condition: "rainy", temperature: 99 },
        { datetime: "parseable but invalid", condition: "rainy", temperature: 99 },
        ...hourlyItems(),
      ],
    }),
    dailySnapshot: unavailable(),
    now: NOW,
  });
  const rows = overlay.root.querySelectorAll('[data-jui-weather-forecast-hour=""]');
  assert.equal(rows.length, 12);
  assert.equal(rows[0].querySelector('[data-jui-weather-forecast-time=""]').textContent, "11:00");
  assert.equal(rows[0].querySelector('[data-jui-weather-forecast-temperature=""]').textContent, "12 °C");
  assert.equal(rows[0].querySelector('[data-jui-weather-forecast-precipitation=""]').textContent, "0 %");
  overlay.destroy();
});

test("hourly with no trustworthy timezone shows an explicit time-basis state", () => {
  const document = createFakeDocument();
  const overlay = createForecastOverlay(document, { onClose() {} });
  overlay.update({
    hourlySnapshot: available({ time_zone: null, units: { temperature: "°C" }, items: hourlyItems(2) }),
    dailySnapshot: unavailable(),
    now: NOW,
  });
  assert.equal(overlay.root.querySelectorAll('[data-jui-weather-forecast-hour=""]').length, 0);
  assert.equal(overlay.root.querySelector('[data-jui-weather-hourly-state=""]').textContent, "Zeitbasis nicht verfügbar");
  overlay.destroy();
});

test("renders at most seven current/future daily entries with Heute Morgen and weekday labels", () => {
  const document = createFakeDocument();
  const overlay = createForecastOverlay(document, { onClose() {} });
  overlay.update({
    hourlySnapshot: unavailable(),
    dailySnapshot: available({ time_zone: "Europe/Berlin", units: { temperature: "°C" }, items: dailyItems() }),
    now: NOW,
  });
  const rows = overlay.root.querySelectorAll('[data-jui-weather-forecast-day=""]');
  assert.equal(rows.length, 7);
  assert.equal(rows[0].querySelector('[data-jui-weather-forecast-day-label=""]').textContent, "Heute");
  assert.equal(rows[1].querySelector('[data-jui-weather-forecast-day-label=""]').textContent, "Morgen");
  assert.match(rows[2].querySelector('[data-jui-weather-forecast-day-label=""]').textContent, /Dienstag/i);
  assert.equal(rows[0].querySelector('[data-jui-weather-forecast-range=""]').textContent, "18 °C / 8 °C");
  overlay.destroy();
});

test("empty forecast stays open with explicit unavailable message", () => {
  const document = createFakeDocument();
  const overlay = createForecastOverlay(document, { onClose() {} });
  overlay.update({ hourlySnapshot: unavailable("unsupported"), dailySnapshot: unavailable("empty_data"), now: NOW });
  assert.equal(overlay.root.querySelector('[data-jui-weather-forecast-empty=""]').textContent, "Prognose aktuell nicht verfügbar");
  overlay.destroy();
});

test("live update preserves overlay and dialog identity while replacing forecast content", () => {
  const document = createFakeDocument();
  const overlay = createForecastOverlay(document, { onClose() {} });
  const root = overlay.root;
  const dialog = root.querySelector('[data-jui-dialog=""]');
  overlay.update({ hourlySnapshot: unavailable(), dailySnapshot: unavailable(), now: NOW });
  overlay.update({
    hourlySnapshot: available({ time_zone: "Europe/Berlin", units: { temperature: "°C" }, items: hourlyItems(1) }),
    dailySnapshot: unavailable(),
    now: NOW,
  });
  assert.equal(overlay.root, root);
  assert.equal(root.querySelector('[data-jui-dialog=""]'), dialog);
  assert.equal(root.querySelectorAll('[data-jui-weather-forecast-hour=""]').length, 1);
  overlay.destroy();
});
