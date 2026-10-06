import { readHouseSourceBoolean } from "../../shared/house-source.js";

export function normalizeLightItem(item, getState) {
  const result = readHouseSourceBoolean(getState(item.state.entity_id), item.state);
  return Object.freeze({
    id: item.id,
    name: item.name,
    on: result.status === "available" ? result.value : null,
    availability: result.status,
    reason: result.reason,
  });
}

export function normalizeLightGroup(items, getState) {
  const normalized = items.map((item) => normalizeLightItem(item, getState));
  return Object.freeze({
    version: 1,
    items: Object.freeze(normalized),
    on_count: normalized.filter((item) => item.on === true).length,
    total_count: normalized.length,
    unavailable_count: normalized.filter((item) => item.availability !== "available").length,
  });
}
