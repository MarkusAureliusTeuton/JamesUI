import { readHouseSourceBoolean, readHouseSourceNumber } from "../../shared/house-source.js";

const SIGNALS = Object.freeze([
  ["current_temperature", "current_temperature_c", readHouseSourceNumber],
  ["target_temperature", "target_temperature_c", readHouseSourceNumber],
  ["heating_demand", "heating_demand", readHouseSourceBoolean],
  ["auto_regulation_enabled", "auto_regulation_enabled", readHouseSourceBoolean],
]);

export function normalizeHeatingZone(zone, getState) {
  const values = {};
  let reason = null;
  for (const [configKey, outputKey, reader] of SIGNALS) {
    const result = reader(getState(zone[configKey].entity_id), zone[configKey]);
    values[outputKey] = result.status === "available" ? result.value : null;
    if (reason === null && result.status !== "available") reason = `${configKey}:${result.reason}`;
  }
  return Object.freeze({
    id: zone.id,
    name: zone.name,
    current_temperature_c: values.current_temperature_c,
    target_temperature_c: values.target_temperature_c,
    heating_demand: values.heating_demand,
    auto_regulation_enabled: values.auto_regulation_enabled,
    availability: reason === null ? "available" : "unavailable",
    reason,
  });
}
