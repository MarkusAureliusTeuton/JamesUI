import { validateHouseHeatingConfig } from "./provider.house-heating/config.js";
import { validateHouseLightingConfig } from "./provider.house-lighting/config.js";
import { validateHouseDevicesConfig } from "./provider.house-devices/config.js";
import { validateHouseEnergyConfig } from "./provider.house-energy/config.js";
import { validateHouseQuickConfig } from "./widget.house-quick/config.js";

// Block 12 configuration, composed by Block 14. No entity is fabricated:
// all HA bindings originate from existing persisted sources or explicit input.
const ENTITY = /^[a-z0-9_]+\.[a-z0-9_]+$/;

function entity(input, label, domain = null) {
  const value = String(input ?? "").trim();
  if (!ENTITY.test(value) || (domain && !value.startsWith(domain + "."))) {
    throw new TypeError(`${label}: gültige ${domain ? domain + ".*" : "Home-Assistant"}-Entität erforderlich`);
  }
  return value;
}

function title(input, label) {
  const value = String(input ?? "").trim();
  if (!value) throw new TypeError(`${label} darf nicht leer sein`);
  return value;
}

function number(input, label, { positive = false, nonNegative = false } = {}) {
  const raw = String(input ?? "").trim();
  if (!raw) throw new TypeError(`${label} muss angegeben werden`);
  const value = Number(raw);
  if (!Number.isFinite(value) || (positive && value <= 0) || (nonNegative && value < 0)) {
    throw new TypeError(`${label} ist keine gültige Zahl`);
  }
  return value;
}

function uniqueId(prefix, existing) {
  const used = new Set(existing.map((item) => item.id));
  let i = 1;
  while (used.has(prefix + i)) i += 1;
  return prefix + i;
}

function getSource(config, providerId, field) {
  const entry = config.data_sources?.[providerId];
  const raw = entry?.config ?? entry ?? {};
  const rows = raw[field] ?? [];
  if (!Array.isArray(rows)) throw new TypeError(`Ungültige bestehende Datenquelle: ${providerId}`);
  return rows;
}

export function buildHouseQuickSetup({ inputs = {}, currentConfig, priorWidgetConfig = null } = {}) {
  if (!currentConfig || typeof currentConfig !== "object") throw new TypeError("Hauskonfiguration fehlt");
  const kind = String(inputs.houseType ?? "lights");
  const dataSources = {};
  let button;

  if (kind === "lights" || kind === "ambient_lights") {
    const provider = "provider.house-lighting";
    const lights = [...getSource(currentConfig, provider, "lights")];
    const ambientLights = [...getSource(currentConfig, provider, "ambient_lights")];
    const group = kind === "lights" ? lights : ambientLights;
    const entered = String(inputs.lightEntityId ?? "").trim();
    if (entered) {
      const entityId = entity(entered, "Licht", "light");
      if (group.some((row) => row.state?.entity_id === entityId)) {
        // An existing source can be reused without rewriting the provider.
      } else {
        if ([...lights, ...ambientLights].some((row) => row.state?.entity_id === entityId)) {
          throw new TypeError("Licht ist bereits der anderen Lichtgruppe zugeordnet");
        }
        group.push({
          id: uniqueId("dashboard-light-", [...lights, ...ambientLights]),
          name: String(inputs.sourceName ?? "").trim() || entityId,
          state: { entity_id: entityId },
        });
        dataSources[provider] = validateHouseLightingConfig({
          lights, ambient_lights: ambientLights,
        });
      }
    }
    if (group.length === 0) throw new TypeError("Mindestens eine Lichtentität für diese Gruppe angeben");
    button = { id: kind, type: kind };

  } else if (kind === "heating_zone") {
    const provider = "provider.house-heating";
    const zones = [...getSource(currentConfig, provider, "zones")];
    const current = entity(inputs.currentTemperature, "Isttemperatur");
    const target = entity(inputs.targetTemperature, "Solltemperatur");
    const demand = entity(inputs.heatingDemand, "Heizanforderung");
    const auto = entity(inputs.autoRegulation, "Automatikstatus");
    const name = title(inputs.sourceName, "Zonenname");
    const previousButton = priorWidgetConfig?.buttons?.find((entry) => entry.type === kind);
    const previousZone = previousButton
      ? zones.find((entry) => entry.id === previousButton.source_id)
      : null;
    if (previousButton && !previousZone) {
      throw new TypeError("Bisherige Heizungszone existiert nicht mehr");
    }
    const binding = (key, entityId) =>
      previousZone?.[key]?.entity_id === entityId
        ? previousZone[key]
        : { entity_id: entityId };
    const desired = {
      name,
      current_temperature: binding("current_temperature", current),
      target_temperature: binding("target_temperature", target),
      heating_demand: binding("heating_demand", demand),
      auto_regulation_enabled: binding("auto_regulation_enabled", auto),
    };
    const matching = zones.find((row) =>
      row.name === name &&
      row.current_temperature?.entity_id === current &&
      row.target_temperature?.entity_id === target &&
      row.heating_demand?.entity_id === demand &&
      row.auto_regulation_enabled?.entity_id === auto);
    let id;
    if (matching) {
      id = matching.id;
    } else if (previousZone) {
      // Editing a shared zone may change several unrelated widgets. Fork the
      // source if any other widget instance references it. Never silently
      // mutate that shared reference.
      const uses = Object.values(currentConfig.widget_instances ?? {})
        .filter((instance) => instance?.module_id === "widget.house-quick")
        .flatMap((instance) => instance.config?.buttons ?? [])
        .filter((entry) => entry.type === "heating_zone" &&
          entry.source_id === previousZone.id).length;
      if (uses > 1) {
        id = uniqueId("dashboard-zone-", zones);
        zones.push({ id, ...desired });
      } else {
        id = previousZone.id;
        const index = zones.findIndex((entry) => entry.id === id);
        zones[index] = { id, ...desired };
      }
      dataSources[provider] = validateHouseHeatingConfig({ zones });
    } else {
      id = uniqueId("dashboard-zone-", zones);
      zones.push({ id, ...desired });
      dataSources[provider] = validateHouseHeatingConfig({ zones });
    }
    button = { id: "heating", type: "heating_zone", source_id: id };

  } else if (kind === "devices") {
    const provider = "provider.house-devices";
    const devices = [...getSource(currentConfig, provider, "devices")];
    const name = title(inputs.sourceName, "Gerätename");
    const primary = entity(inputs.primaryEntity, "Gerät");
    const active = entity(inputs.activeEntity, "Aktivstatus");
    const existing = devices.find((row) => row.primary_entity_id === primary);
    if (!existing) {
      const record = {
        id: uniqueId("dashboard-device-", devices), name, primary_entity_id: primary,
        active: { entity_id: active },
      };
      for (const [field, input] of [
        ["update_available", "updateEntity"], ["warning", "warningEntity"], ["fault", "faultEntity"],
      ]) {
        if (String(inputs[input] ?? "").trim()) record[field] = { entity_id: entity(inputs[input], field) };
      }
      devices.push(record);
      dataSources[provider] = validateHouseDevicesConfig({ devices });
    } else if (existing.active?.entity_id !== active || existing.name !== name ||
      [["update_available", "updateEntity"], ["warning", "warningEntity"], ["fault", "faultEntity"]]
        .some(([field, input]) => String(inputs[input] ?? "").trim() &&
          existing[field]?.entity_id !== String(inputs[input]).trim())) {
      throw new TypeError("Gerät ist bereits anders konfiguriert; bestehende Zuordnung nicht überschreiben");
    }
    button = { id: "devices", type: "devices" };

  } else if (kind === "energy") {
    const provider = "provider.house-energy";
    const sources = [...getSource(currentConfig, provider, "sources")];
    const name = title(inputs.sourceName, "Energiequelle");
    const powerEntityId = entity(inputs.powerEntity, "Leistung");
    const existing = sources.find((row) => row.power?.entity_id === powerEntityId);
    const id = existing?.id ?? uniqueId("dashboard-energy-", sources);
    if (!existing) {
      sources.push({ id, name, power: { entity_id: powerEntityId } });
      dataSources[provider] = validateHouseEnergyConfig({ sources });
    } else if (existing.name !== name) {
      throw new TypeError("Energiequelle ist bereits mit anderem Namen konfiguriert");
    }
    const window = number(inputs.averageWindow ?? "15", "Mittelungszeit", { positive: true });
    const warning = number(inputs.warningThreshold, "Warnschwelle", { nonNegative: true });
    const critical = number(inputs.criticalThreshold, "Kritische Schwelle", { nonNegative: true });
    if (critical <= warning) throw new TypeError("Kritische Schwelle muss über der Warnschwelle liegen");
    button = { id: "energy", type: "energy", source_id: id,
      average_window_minutes: window, warning_threshold_w: warning, critical_threshold_w: critical };

  } else {
    throw new TypeError(`Unbekannter Hausstatus-Typ: ${kind}`);
  }

  return {
    config: structuredClone(validateHouseQuickConfig({ buttons: [button] })),
    dataSources: structuredClone(dataSources),
  };
}
