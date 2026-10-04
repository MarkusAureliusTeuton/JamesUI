const UNUSABLE_STATES = new Set(["unknown", "unavailable"]);
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function finiteOrNull(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function percentOrNull(value) {
  const number = finiteOrNull(value);
  if (number === null) return null;
  return Math.min(100, Math.max(0, number));
}

export function isoInstantOrNull(value) {
  if (typeof value !== "string") return null;
  const instant = value.trim();
  if (!ISO_INSTANT_PATTERN.test(instant)) return null;
  const parsed = new Date(instant);
  return Number.isFinite(parsed.valueOf()) ? instant : null;
}

export function normalizeTimeZone(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const timeZone = value.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return timeZone;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

function nonEmptyStringOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function usableWeatherEntity(entity) {
  return Boolean(
    entity
    && typeof entity.entity_id === "string"
    && entity.entity_id.startsWith("weather.")
    && typeof entity.state === "string"
    && !UNUSABLE_STATES.has(entity.state),
  );
}

export function selectWeatherSource(configuredEntityId, weatherEntities) {
  const entities = Array.isArray(weatherEntities) ? [...weatherEntities] : [];
  if (configuredEntityId) {
    const entity = entities.find((item) => item?.entity_id === configuredEntityId) ?? null;
    if (!entity) {
      return Object.freeze({ mode: "explicit", entityId: configuredEntityId, status: "unavailable", reason: "source_missing" });
    }
    if (!usableWeatherEntity(entity)) {
      return Object.freeze({ mode: "explicit", entityId: configuredEntityId, status: "unavailable", reason: "source_unavailable" });
    }
    return Object.freeze({ mode: "explicit", entityId: configuredEntityId, status: "available", reason: null });
  }

  if (entities.length === 0) {
    return Object.freeze({ mode: "automatic", entityId: null, status: "not_configured", reason: "no_weather_source" });
  }
  const usable = entities.filter(usableWeatherEntity).sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  if (usable.length === 0) {
    return Object.freeze({ mode: "automatic", entityId: null, status: "unavailable", reason: "sources_unavailable" });
  }
  return Object.freeze({ mode: "automatic", entityId: usable[0].entity_id, status: "available", reason: null });
}

export function weatherUnits(entity) {
  const attributes = entity?.attributes ?? {};
  return deepFreeze({
    temperature: nonEmptyStringOrNull(attributes.temperature_unit),
    pressure: nonEmptyStringOrNull(attributes.pressure_unit),
    precipitation: nonEmptyStringOrNull(attributes.precipitation_unit),
    wind_speed: nonEmptyStringOrNull(attributes.wind_speed_unit),
    visibility: nonEmptyStringOrNull(attributes.visibility_unit),
  });
}

function validOverride(entity) {
  if (!entity || UNUSABLE_STATES.has(entity.state)) return null;
  const value = finiteOrNull(entity.state);
  if (value === null) return null;
  return { value, unit: nonEmptyStringOrNull(entity.attributes?.unit_of_measurement) };
}

export function normalizeCurrentWeather({ weatherEntity, overrideEntity = null, nextPrecipitation = null, timeZone = null }) {
  if (!weatherEntity || typeof weatherEntity.entity_id !== "string") {
    throw new TypeError("weatherEntity is required");
  }
  const attributes = weatherEntity.attributes ?? {};
  const override = validOverride(overrideEntity);
  const weatherTemperature = finiteOrNull(attributes.temperature);
  const temperature = override?.value ?? weatherTemperature;
  const temperatureSource = override
    ? overrideEntity.entity_id
    : weatherTemperature === null ? null : weatherEntity.entity_id;
  const temperatureUnit = override
    ? (override.unit ?? nonEmptyStringOrNull(attributes.temperature_unit))
    : nonEmptyStringOrNull(attributes.temperature_unit);
  const condition = typeof weatherEntity.state === "string"
    && weatherEntity.state.trim() !== ""
    && !UNUSABLE_STATES.has(weatherEntity.state)
    ? weatherEntity.state.trim()
    : null;

  return deepFreeze({
    source_entity_id: weatherEntity.entity_id,
    time_zone: normalizeTimeZone(timeZone),
    condition,
    temperature,
    temperature_unit: temperatureUnit,
    temperature_source_entity_id: temperatureSource,
    apparent_temperature: finiteOrNull(attributes.apparent_temperature),
    humidity: percentOrNull(attributes.humidity),
    dew_point: finiteOrNull(attributes.dew_point),
    pressure: finiteOrNull(attributes.pressure),
    pressure_unit: nonEmptyStringOrNull(attributes.pressure_unit),
    cloud_coverage: percentOrNull(attributes.cloud_coverage),
    visibility: finiteOrNull(attributes.visibility),
    visibility_unit: nonEmptyStringOrNull(attributes.visibility_unit),
    wind_speed: finiteOrNull(attributes.wind_speed),
    wind_gust_speed: finiteOrNull(attributes.wind_gust_speed),
    wind_speed_unit: nonEmptyStringOrNull(attributes.wind_speed_unit),
    wind_bearing: finiteOrNull(attributes.wind_bearing),
    uv_index: finiteOrNull(attributes.uv_index),
    next_precipitation_at: isoInstantOrNull(nextPrecipitation?.datetime),
    next_precipitation_probability: percentOrNull(nextPrecipitation?.probability),
  });
}
