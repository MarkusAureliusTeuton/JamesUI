import { validateCalendarAgendaConfig } from "./widget.calendar-agenda/config.js";
import { validateCalendarProviderConfig } from "./provider.calendar/config.js";
import { validateTasksProviderConfig } from "./provider.tasks/config.js";
import { buildHouseQuickSetup } from "./dashboard-house-setup.js";
import { validateWeatherProviderConfig } from "./provider.weather/config.js";
import { validateWeatherTodayConfig } from "./widget.weather-today/config.js";
import { validateDynamicButtonDefinitions, validateDynamicButtonInstanceConfig } from "./widget.dynamic-buttons/config.js";

// A configuration plan is strictly local until the dashboard edit session commits.
// Only explicit user-entered entity IDs become source bindings.
function ids(value, domain) {
  const entries = String(value ?? "").split(/[\s,;]+/).map((entry) => entry.trim()).filter(Boolean);
  const invalid = entries.find((entry) => !new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(entry));
  if (invalid) throw new TypeError(`Ungültige ${domain}-Entität: ${invalid}`);
  return [...new Set(entries)];
}

function configuredSource(config, name) {
  const item = config.data_sources?.[name];
  return item?.config ?? item ?? {};
}

function mergeSourceIds(existing, incoming, validator) {
  return validator({ source_entity_ids: [...new Set([...(existing.source_entity_ids ?? []), ...incoming])] });
}

function requireAbsoluteWebUrl(raw) {
  let url;
  try { url = new URL(String(raw ?? "").trim()); }
  catch { throw new TypeError("Bitte eine vollständige HTTP-/HTTPS-Adresse angeben"); }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("Nur HTTP- und HTTPS-Adressen sind erlaubt");
  }
  return url.href;
}

export function buildDashboardWidgetSetup({ moduleId, inputs = {}, currentConfig } = {}) {
  if (!currentConfig || typeof currentConfig !== "object") throw new TypeError("Konfiguration fehlt");
  const dataSources = {};
  const dynamicButtons = {};
  let widgetConfig;

  switch (moduleId) {
    case "widget.weather-today": {
      const configured = configuredSource(currentConfig, "provider.weather");
      const legacy = configuredSource(currentConfig, "weather");
      const prior = Object.keys(configured).length ? configured : legacy;
      const weatherId = String(inputs.weatherEntityId ?? prior.entity_id ?? "").trim();
      if (!weatherId) throw new TypeError("Wetter-Entität (weather.*) angeben");
      const weather = {
        ...prior, entity_id: weatherId,
      };
      for (const [key, property] of [
        ["outdoorTemperatureEntityId", "outdoor_temperature_entity_id"],
        ["moonEntityId", "moon_entity_id"],
        ["illuminanceEntityId", "illuminance_entity_id"],
      ]) {
        const input = String(inputs[key] ?? "").trim();
        if (input) weather[property] = input;
      }
      const validated = validateWeatherProviderConfig(weather);
      if (JSON.stringify(validated) !== JSON.stringify(configured)) {
        dataSources["provider.weather"] = validated;
      }
      widgetConfig = validateWeatherTodayConfig({});
      break;
    }

    case "widget.calendar-agenda": {
      const calendars = ids(inputs.calendars, "calendar");
      const taskLists = ids(inputs.tasks, "todo");
      if (calendars.length === 0 && taskLists.length === 0) {
        throw new TypeError("Mindestens eine Kalender- oder Aufgaben-Entität angeben");
      }
      widgetConfig = validateCalendarAgendaConfig({
        instance_id: "dashboard-pending",
        calendar_enabled: calendars.length > 0,
        tasks_enabled: taskLists.length > 0,
        calendars: calendars.map((entity_id) => ({ entity_id })),
        task_lists: taskLists.map((entity_id) => ({ entity_id })),
      });
      if (calendars.length) dataSources["provider.calendar"] =
        mergeSourceIds(configuredSource(currentConfig, "provider.calendar"), calendars, validateCalendarProviderConfig);
      if (taskLists.length) dataSources["provider.tasks"] =
        mergeSourceIds(configuredSource(currentConfig, "provider.tasks"), taskLists, validateTasksProviderConfig);
      break;
    }

    case "widget.house-quick": {
      const planned = buildHouseQuickSetup({ inputs, currentConfig });
      widgetConfig = planned.config;
      Object.assign(dataSources, planned.dataSources);
      break;
    }

    case "widget.dynamic-buttons": {
      const existing = currentConfig.dynamic_buttons ?? {};
      const selectedId = String(inputs.existingButtonId ?? "").trim();
      let buttonId = selectedId;
      if (selectedId) {
        if (!(selectedId in existing)) throw new TypeError("Gewählter Button existiert nicht");
        validateDynamicButtonDefinitions({ [selectedId]: existing[selectedId] });
      } else {
        const label = String(inputs.buttonName ?? "").trim();
        if (!label) throw new TypeError("Bitte einen Button-Namen angeben");
        const url = requireAbsoluteWebUrl(inputs.url);
        let index = 1;
        while (`dashboard-link-${index}` in existing) index++;
        buttonId = `dashboard-link-${index}`;
        dynamicButtons[buttonId] = {
          name: label, mode: "trigger", action: { type: "url.open", url },
        };
        validateDynamicButtonDefinitions(dynamicButtons);
      }
      widgetConfig = validateDynamicButtonInstanceConfig({
        buttons: [{ id: "button-1", button_id: buttonId, size: "normal" }],
      });
      break;
    }

    default:
      throw new TypeError(`Nicht unterstützter Widgettyp: ${moduleId}`);
  }
  return {
    config: structuredClone(widgetConfig),
    ...(moduleId === "widget.calendar-agenda" ? { instanceIdConfigKey: "instance_id" } : {}),
    dataSources: structuredClone(dataSources),
    dynamicButtons: structuredClone(dynamicButtons),
  };
}
