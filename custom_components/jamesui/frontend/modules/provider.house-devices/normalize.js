import { readHouseSourceBoolean } from "../../shared/house-source.js";

function primaryAvailability(state) {
  if (!state) return { reachable: false, reason: "primary:source_missing" };
  const value = typeof state.state === "string" ? state.state.trim().toLowerCase() : state.state;
  if (value === "unknown" || value === "unavailable") return { reachable: false, reason: "primary:source_unavailable" };
  return { reachable: true, reason: null };
}

export function normalizeHouseDevice(device, getState) {
  const primary = primaryAvailability(getState(device.primary_entity_id));
  const result = { id: device.id, name: device.name, active: null, update_available: null, warning: null, fault: null, reachable: primary.reachable, reason: primary.reason };
  if (!primary.reachable) return Object.freeze(result);
  for (const key of ["active", "update_available", "warning", "fault"]) {
    if (!device[key]) continue;
    const read = readHouseSourceBoolean(getState(device[key].entity_id), device[key]);
    if (read.status === "available") result[key] = read.value;
    else if (result.reason === null) result.reason = `${key}:${read.reason}`;
  }
  return Object.freeze(result);
}

export function normalizeDeviceCapability(devices, getState) {
  const items = Object.freeze(devices.map((device) => normalizeHouseDevice(device, getState)));
  return Object.freeze({
    version: 1,
    items,
    active_count: items.filter((item) => item.active === true).length,
    update_count: items.filter((item) => item.update_available === true).length,
    warning_count: items.filter((item) => item.warning === true || (item.reachable && item.reason !== null)).length,
    fault_count: items.filter((item) => item.fault === true).length,
    unreachable_count: items.filter((item) => item.reachable === false).length,
  });
}
