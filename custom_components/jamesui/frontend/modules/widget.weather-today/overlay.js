import { createButton, createDialog, createOverlayFrame } from "../../design/primitives.js";
import { createIcon } from "../../icons/icon.js";
import { conditionPresentation } from "./model.js";
import { dateKeyInTimeZone, formatForecastDay, formatMeasurement, formatZonedTime } from "./format.js";

function availableValue(snapshot) {
  return snapshot?.status === "available" && snapshot.value && typeof snapshot.value === "object" ? snapshot.value : null;
}

function createText(document, tagName, attribute, text = "") {
  const node = document.createElement(tagName);
  if (attribute) node.setAttribute(attribute, "");
  node.textContent = text;
  return node;
}

function appendCondition(document, target, condition) {
  const presentation = conditionPresentation(condition, null);
  if (presentation.iconId) target.appendChild(createIcon(document, presentation.iconId, { size: "sm" }));
  target.appendChild(createText(document, "span", "data-jui-weather-forecast-condition", presentation.label));
}

function futureHourlyItems(value, now) {
  if (!value || !Array.isArray(value.items) || !value.time_zone) return [];
  const nowTime = now instanceof Date ? now.valueOf() : new Date(now).valueOf();
  if (!Number.isFinite(nowTime)) return [];
  return value.items
    .map((item) => {
      const label = formatZonedTime(item?.datetime, value.time_zone);
      if (!label) return null;
      const date = new Date(item.datetime);
      if (!Number.isFinite(date.valueOf()) || date.valueOf() < nowTime) return null;
      return { item, label, date };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)
    .slice(0, 12);
}

function currentDailyItems(value, now) {
  if (!value || !Array.isArray(value.items) || !value.time_zone) return [];
  const today = dateKeyInTimeZone(now, value.time_zone);
  if (!today) return [];
  return value.items
    .filter((item) => typeof item?.date === "string" && item.date >= today && formatForecastDay(item.date, now, value.time_zone))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);
}

export function createForecastOverlay(document, { onClose } = {}) {
  if (!document || typeof document.createElement !== "function") throw new TypeError("forecast overlay requires document");
  if (typeof onClose !== "function") throw new TypeError("forecast overlay requires onClose");

  const root = createOverlayFrame(document);
  root.setAttribute("data-jui-weather-forecast-overlay", "");
  const dialog = createDialog(document, { title: "Wetterprognose" });
  dialog.root.setAttribute("data-jui-weather-forecast-dialog", "");

  const hourlySection = createText(document, "section", "data-jui-weather-hourly-section");
  hourlySection.appendChild(createText(document, "h3", null, "Nächste Stunden"));
  const hourlyState = createText(document, "p", "data-jui-weather-hourly-state");
  const hourlyList = createText(document, "div", "data-jui-weather-hourly-list");
  hourlySection.appendChild(hourlyState);
  hourlySection.appendChild(hourlyList);

  const dailySection = createText(document, "section", "data-jui-weather-daily-section");
  dailySection.appendChild(createText(document, "h3", null, "Nächste Tage"));
  const dailyState = createText(document, "p", "data-jui-weather-daily-state");
  const dailyList = createText(document, "div", "data-jui-weather-daily-list");
  dailySection.appendChild(dailyState);
  dailySection.appendChild(dailyList);

  const emptyState = createText(document, "p", "data-jui-weather-forecast-empty");
  dialog.body.appendChild(hourlySection);
  dialog.body.appendChild(dailySection);
  dialog.body.appendChild(emptyState);

  const closeButton = createButton(document, { ariaLabel: "Prognose schließen", variant: "ghost", size: "sm" });
  closeButton.setAttribute("data-jui-weather-forecast-close", "");
  closeButton.appendChild(createIcon(document, "shell.close", { size: "sm" }));
  dialog.actions.appendChild(closeButton);
  root.appendChild(dialog.root);

  let destroyed = false;
  const closeListener = () => onClose();
  const backdropListener = (event) => {
    if (event?.target === root) onClose();
  };
  closeButton.addEventListener("click", closeListener);
  root.addEventListener("click", backdropListener);

  const updateHourly = (snapshot, now) => {
    hourlyList.replaceChildren();
    hourlyState.textContent = "";
    const value = availableValue(snapshot);
    if (!value) {
      hourlyState.textContent = "";
      return false;
    }
    if (!value.time_zone) {
      hourlyState.textContent = "Zeitbasis nicht verfügbar";
      return false;
    }
    const items = futureHourlyItems(value, now);
    if (!items.length) return false;
    for (const { item, label } of items) {
      const row = createText(document, "article", "data-jui-weather-forecast-hour");
      row.appendChild(createText(document, "time", "data-jui-weather-forecast-time", label));
      const condition = createText(document, "div", "data-jui-weather-forecast-condition-wrap");
      appendCondition(document, condition, item.condition);
      row.appendChild(condition);
      row.appendChild(createText(document, "span", "data-jui-weather-forecast-temperature", formatMeasurement(item.temperature, value.units?.temperature)));
      row.appendChild(createText(document, "span", "data-jui-weather-forecast-precipitation", formatMeasurement(item.precipitation_probability, "%")));
      hourlyList.appendChild(row);
    }
    return true;
  };

  const updateDaily = (snapshot, now) => {
    dailyList.replaceChildren();
    dailyState.textContent = "";
    const value = availableValue(snapshot);
    if (!value) return false;
    if (!value.time_zone) {
      dailyState.textContent = "Zeitbasis nicht verfügbar";
      return false;
    }
    const items = currentDailyItems(value, now);
    if (!items.length) return false;
    for (const item of items) {
      const row = createText(document, "article", "data-jui-weather-forecast-day");
      row.appendChild(createText(document, "span", "data-jui-weather-forecast-day-label", formatForecastDay(item.date, now, value.time_zone) ?? "—"));
      const condition = createText(document, "div", "data-jui-weather-forecast-condition-wrap");
      appendCondition(document, condition, item.condition);
      row.appendChild(condition);
      const high = formatMeasurement(item.temperature_high, value.units?.temperature);
      const low = formatMeasurement(item.temperature_low, value.units?.temperature);
      row.appendChild(createText(document, "span", "data-jui-weather-forecast-range", `${high} / ${low}`));
      row.appendChild(createText(document, "span", "data-jui-weather-forecast-precipitation", formatMeasurement(item.precipitation_probability, "%")));
      dailyList.appendChild(row);
    }
    return true;
  };

  return Object.freeze({
    root,
    update({ hourlySnapshot, dailySnapshot, now }) {
      if (destroyed) throw new Error("forecast overlay is destroyed");
      const hourlyUsable = updateHourly(hourlySnapshot, now);
      const dailyUsable = updateDaily(dailySnapshot, now);
      const explicitTimeIssue = hourlyState.textContent === "Zeitbasis nicht verfügbar" || dailyState.textContent === "Zeitbasis nicht verfügbar";
      emptyState.textContent = !hourlyUsable && !dailyUsable && !explicitTimeIssue ? "Prognose aktuell nicht verfügbar" : "";
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      closeButton.removeEventListener("click", closeListener);
      root.removeEventListener("click", backdropListener);
      return true;
    },
  });
}
