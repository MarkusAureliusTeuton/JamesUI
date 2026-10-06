import { readHouseSourceBoolean, readHouseSourceValue } from "../../shared/house-source.js";

const SIGNAL_KEYS = Object.freeze(["active", "update_available", "warning", "fault"]);

export function normalizeDevice(item, getState) {
  const primary = readHouseSourceValue(getState(item.primary_entity_id), { entity_id: item.primary_entity_id });
  const reachable = primary.status === "available";
  let reason = reachable ? null : primary.reason;
  const signals = {};
  for (const key of SIGNAL_KEYS) {
    if (!item[key]) {
      signals[key] = null;
      continue;
    }
    const result = readHouseSourceBoolean(getState(item[key].entity_id), item[key]);
    signals[key] = result.status === "available" ? result.value : null;
    if (reason === null && result.status !== "available") reason = `${key}:${result.reason}`;
  }
  return Object.freeze({
    id: item.id,
    name: item.name,
    active: signals.active,
    update_available: signals.update_available,
    warning: signals.warning,
    fault: signals.fault,
    reachable,
    reason,
  });
}

export function normalizeDevices(items, getState) {
  const normalized = items.map((item) => normalizeDevice(item, getState));
  return Object.freeze({
    version: 1,
    items: Object.freeze(normalized),
    active_count: normalized.filter((item) => item.active === true).length,
    update_count: normalized.filter((item) => item.update_available === true).length,
    warning_count: normalized.filter((item) => item.warning === true).length,
    fault_count: normalized.filter((item) => item.fault === true).length,
    unreachable_count: normalized.filter((item) => item.reachable === false).length,
  });
}
