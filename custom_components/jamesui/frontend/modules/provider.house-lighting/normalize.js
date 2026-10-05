import { readHouseSourceBoolean } from "../../shared/house-source.js";

export function normalizeLightGroup(entries, getState) {
  const items = Object.freeze(entries.map((entry) => {
    const result = readHouseSourceBoolean(getState(entry.state.entity_id), entry.state);
    return Object.freeze({ id: entry.id, name: entry.name, on: result.status === "available" ? result.value : null, availability: result.status === "available" ? "available" : "unavailable", reason: result.status === "available" ? null : result.reason });
  }));
  return Object.freeze({ version: 1, items, on_count: items.filter((item) => item.on === true).length, total_count: items.length, unavailable_count: items.filter((item) => item.availability !== "available").length });
}
