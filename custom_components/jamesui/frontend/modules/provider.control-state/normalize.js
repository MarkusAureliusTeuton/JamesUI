function matches(values, raw) {
  return values.some((value) => Object.is(value, raw));
}

function unavailable(reason) {
  return Object.freeze({ status: "unavailable", detail: null, reason });
}

export function normalizeControlState(source, entity) {
  if (!entity || typeof entity !== "object") return unavailable("source_missing");
  if (entity.state === "unknown" || entity.state === "unavailable") return unavailable("source_unavailable");

  let raw;
  if (source.attribute !== undefined) {
    if (!entity.attributes || !Object.prototype.hasOwnProperty.call(entity.attributes, source.attribute)) {
      return unavailable("attribute_missing");
    }
    raw = entity.attributes[source.attribute];
  } else {
    raw = entity.state;
  }

  if (raw === null || raw === undefined || raw === "unknown" || raw === "unavailable") return unavailable("value_unavailable");
  if (matches(source.active_values, raw)) return Object.freeze({ status: "active", detail: null, reason: null });
  if (matches(source.inactive_values, raw)) return Object.freeze({ status: "inactive", detail: null, reason: null });
  for (const entry of source.intermediate) {
    if (matches(entry.values, raw)) return Object.freeze({ status: "intermediate", detail: entry.id, reason: null });
  }
  return unavailable("value_unmapped");
}
