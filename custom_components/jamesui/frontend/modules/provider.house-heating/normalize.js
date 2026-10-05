import { readHouseSourceBoolean, readHouseSourceNumber } from "../../shared/house-source.js";

function resolve(field, result) { return { field, ...result }; }

export function normalizeHeatingZone(zone, getState) {
  const current = resolve("current_temperature", readHouseSourceNumber(getState(zone.current_temperature.entity_id), zone.current_temperature));
  const target = resolve("target_temperature", readHouseSourceNumber(getState(zone.target_temperature.entity_id), zone.target_temperature));
  const demand = resolve("heating_demand", readHouseSourceBoolean(getState(zone.heating_demand.entity_id), zone.heating_demand));
  const auto = resolve("auto_regulation_enabled", readHouseSourceBoolean(getState(zone.auto_regulation_enabled.entity_id), zone.auto_regulation_enabled));
  const failed = [current, target, demand, auto].find((entry) => entry.status !== "available");
  return Object.freeze({
    id: zone.id,
    name: zone.name,
    current_temperature_c: current.status === "available" ? current.value : null,
    target_temperature_c: target.status === "available" ? target.value : null,
    heating_demand: demand.status === "available" ? demand.value : null,
    auto_regulation_enabled: auto.status === "available" ? auto.value : null,
    availability: failed ? "unavailable" : "available",
    reason: failed ? `${failed.field}:${failed.reason}` : null,
  });
}
