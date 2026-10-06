const DEFAULT_ICONS = Object.freeze({
  heating_zone: "home.climate",
  lights: "home.light",
  ambient_lights: "home.light",
  devices: "home.device",
  energy: "home.energy",
});

function capabilityValue(snapshot) {
  return snapshot?.status === "available" ? snapshot.value : null;
}

function formatTemperature(value) {
  if (!Number.isFinite(value)) return "–";
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} °C`;
}

function formatPower(value) {
  if (!Number.isFinite(value)) return "–";
  if (Math.abs(value) >= 1000) {
    return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value / 1000)} kW`;
  }
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} W`;
}

function makeButton(button, { label, primary, secondary = [], status }) {
  return Object.freeze({
    id: button.id,
    type: button.type,
    label,
    icon: button.icon ?? DEFAULT_ICONS[button.type],
    status,
    primary,
    secondary: Object.freeze(secondary),
    navigation: button.navigation ?? null,
  });
}

function unavailableButton(button, label) {
  return makeButton(button, { label, primary: "Keine Daten", secondary: ["Nicht verfügbar"], status: "warning" });
}

function heatingButton(button, heating) {
  const data = capabilityValue(heating);
  const zone = data?.zones?.find((item) => item.id === button.source_id);
  if (!zone) return unavailableButton(button, button.source_id);
  const status = zone.availability !== "available"
    ? "warning"
    : zone.auto_regulation_enabled === true ? "active" : "neutral";
  return makeButton(button, {
    label: zone.name,
    primary: `${formatTemperature(zone.current_temperature_c)} → ${formatTemperature(zone.target_temperature_c)}`,
    secondary: [
      zone.auto_regulation_enabled === true ? "Automatik an" : zone.auto_regulation_enabled === false ? "Automatik aus" : "Automatik unbekannt",
      zone.heating_demand === true ? "Heizanforderung ja" : zone.heating_demand === false ? "Heizanforderung nein" : "Heizanforderung unbekannt",
    ],
    status,
  });
}

function lightingButton(button, snapshot, label) {
  const data = capabilityValue(snapshot);
  if (!data) return unavailableButton(button, label);
  const unavailableCount = Number(data.unavailable_count) || 0;
  const onCount = Number(data.on_count) || 0;
  const totalCount = Number(data.total_count) || 0;
  return makeButton(button, {
    label,
    primary: `${onCount} von ${totalCount} an`,
    secondary: unavailableCount > 0 ? [`${unavailableCount} nicht erreichbar`] : [],
    status: unavailableCount > 0 ? "warning" : onCount > 0 ? "active" : "neutral",
  });
}

function devicesButton(button, devices) {
  const data = capabilityValue(devices);
  if (!data) return unavailableButton(button, "Geräte");
  const secondary = [];
  if (data.update_count > 0) secondary.push(`${data.update_count} ${data.update_count === 1 ? "Update" : "Updates"}`);
  if (data.warning_count > 0) secondary.push(`${data.warning_count} ${data.warning_count === 1 ? "Warnung" : "Warnungen"}`);
  if (data.fault_count > 0) secondary.push(`${data.fault_count} ${data.fault_count === 1 ? "Störung" : "Störungen"}`);
  if (data.unreachable_count > 0) secondary.push(`${data.unreachable_count} nicht erreichbar`);
  const incomplete = Array.isArray(data.items) && data.items.some((item) => item?.reason && item?.reachable !== false);
  if (incomplete && data.warning_count === 0 && data.unreachable_count === 0) secondary.push("Daten unvollständig");
  const status = data.fault_count > 0
    ? "critical"
    : data.warning_count > 0 || data.unreachable_count > 0 || incomplete
      ? "warning"
      : data.active_count > 0 ? "active" : "neutral";
  return makeButton(button, {
    label: "Geräte",
    primary: `${Number(data.active_count) || 0} aktiv`,
    secondary,
    status,
  });
}

function energyButton(button, energy, energyResults) {
  const service = capabilityValue(energy);
  const source = service?.configured_sources?.find((item) => item.id === button.source_id);
  const label = source?.name ?? button.source_id;
  const result = energyResults.find((item) => (
    item?.request_id === button.id
    && item.source_id === button.source_id
    && item.window_minutes === button.average_window_minutes
  ));
  if (!service || !result) return unavailableButton(button, label);
  let status = "warning";
  if (result.quality === "full" && Number.isFinite(result.average_power_w)) {
    status = result.average_power_w >= button.critical_threshold_w
      ? "critical"
      : result.average_power_w >= button.warning_threshold_w ? "warning" : "neutral";
  }
  return makeButton(button, {
    label,
    primary: Number.isFinite(result.current_power_w) ? formatPower(result.current_power_w) : "Keine Daten",
    secondary: [`Ø ${button.average_window_minutes} min: ${formatPower(result.average_power_w)}`],
    status,
  });
}

export function buildHouseQuickModel({
  config,
  heating,
  lights,
  ambientLights,
  devices,
  energy,
  energyResults = [],
}) {
  const result = config.buttons.map((button) => {
    if (button.type === "heating_zone") return heatingButton(button, heating);
    if (button.type === "lights") return lightingButton(button, lights, "Licht");
    if (button.type === "ambient_lights") return lightingButton(button, ambientLights, "Ambientelicht");
    if (button.type === "devices") return devicesButton(button, devices);
    if (button.type === "energy") return energyButton(button, energy, energyResults);
    throw new TypeError(`unsupported House Quick button type: ${button.type}`);
  });
  return Object.freeze(result);
}
