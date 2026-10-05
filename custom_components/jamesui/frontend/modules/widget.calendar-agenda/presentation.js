function normalizedText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function matches(operator, haystack, needle) {
  if (!haystack) return false;
  if (operator === "exact") return haystack === needle;
  if (operator === "contains") return haystack.includes(needle);
  if (operator === "starts_with") return haystack.startsWith(needle);
  return false;
}

export function matchEventRule(event, calendar) {
  if (!event || typeof event !== "object" || !calendar || !Array.isArray(calendar.rules)) return null;
  for (const rule of calendar.rules) {
    const query = normalizedText(rule.query);
    const fields = [normalizedText(event.title)];
    if (rule.include_description) fields.push(normalizedText(event.description));
    if (rule.include_location) fields.push(normalizedText(event.location));
    if (fields.some((field) => matches(rule.operator, field, query))) return rule;
  }
  return null;
}

function neutralPresentation() {
  return {
    icon_id: null,
    accent: null,
    advance_notice_days: 0,
    owner_source_id: null,
    description: null,
    description_source_id: null,
    location: null,
    location_source_id: null,
  };
}

function sourceVariant(logicalEvent, sourceId) {
  const variants = logicalEvent?.source_variants;
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) return {};
  const value = variants[sourceId];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstConfiguredContributor(logicalEvent, config) {
  const provenance = new Set(Array.isArray(logicalEvent?.provenance) ? logicalEvent.provenance : []);
  return config.calendars.find((calendar) => provenance.has(calendar.entity_id)) ?? null;
}

function optionalField(logicalEvent, config, owner, field) {
  const ownerValue = sourceVariant(logicalEvent, owner.entity_id)[field];
  if (isNonEmptyString(ownerValue)) {
    return { value: ownerValue, source_id: owner.entity_id };
  }

  const provenance = new Set(Array.isArray(logicalEvent?.provenance) ? logicalEvent.provenance : []);
  for (const calendar of config.calendars) {
    if (calendar.entity_id === owner.entity_id || !provenance.has(calendar.entity_id)) continue;
    const value = sourceVariant(logicalEvent, calendar.entity_id)[field];
    if (isNonEmptyString(value)) return { value, source_id: calendar.entity_id };
  }
  return { value: null, source_id: null };
}

export function presentationForEvent(logicalEvent, config) {
  if (!logicalEvent || typeof logicalEvent !== "object" || !config || !Array.isArray(config.calendars)) {
    return neutralPresentation();
  }

  const owner = firstConfiguredContributor(logicalEvent, config);
  if (!owner) return neutralPresentation();

  const ownerVariant = sourceVariant(logicalEvent, owner.entity_id);
  const rule = matchEventRule({
    title: logicalEvent.title,
    description: ownerVariant.description,
    location: ownerVariant.location,
  }, owner);

  const description = optionalField(logicalEvent, config, owner, "description");
  const location = optionalField(logicalEvent, config, owner, "location");

  return {
    icon_id: rule?.icon_id ?? owner.icon_id ?? null,
    accent: rule?.accent ?? owner.accent ?? null,
    advance_notice_days: rule?.advance_notice_days ?? owner.advance_notice_days ?? 0,
    owner_source_id: owner.entity_id,
    description: description.value,
    description_source_id: description.source_id,
    location: location.value,
    location_source_id: location.source_id,
  };
}
