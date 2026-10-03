import { deepFreeze, finiteOrNull, percentOrNull } from "./normalize.js";

export const FORECAST_FEATURE_DAILY = 1;
export const FORECAST_FEATURE_HOURLY = 2;
export const FORECAST_FEATURE_TWICE_DAILY = 4;

const PRECIPITATION_CONDITIONS = new Set(["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"]);

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone.trim() }).format(new Date(0));
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function parsedDate(instant) {
  const date = instant instanceof Date ? new Date(instant.valueOf()) : new Date(instant);
  return Number.isFinite(date.valueOf()) ? date : null;
}

export function localDateParts(instant, timeZone) {
  if (!isValidTimeZone(timeZone)) throw new RangeError("invalid IANA timezone");
  const date = parsedDate(instant);
  if (!date) throw new TypeError("instant must be a valid date/time");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone.trim(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
    minute: Number(value.minute),
  };
}

export function localDateKey(instant, timeZone) {
  const { year, month, day } = localDateParts(instant, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function validForecastRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const datetime = stringOrNull(record.datetime);
  const date = datetime ? parsedDate(datetime) : null;
  return date ? { record, datetime, date } : null;
}

function normalizeCommon(record) {
  return {
    datetime: record.datetime,
    condition: stringOrNull(record.condition),
    temperature: finiteOrNull(record.temperature),
    apparent_temperature: finiteOrNull(record.apparent_temperature),
    precipitation: finiteOrNull(record.precipitation),
    precipitation_probability: percentOrNull(record.precipitation_probability),
    humidity: percentOrNull(record.humidity),
    pressure: finiteOrNull(record.pressure),
    wind_speed: finiteOrNull(record.wind_speed),
    wind_gust_speed: finiteOrNull(record.wind_gust_speed),
    wind_bearing: finiteOrNull(record.wind_bearing),
    cloud_coverage: percentOrNull(record.cloud_coverage),
    uv_index: finiteOrNull(record.uv_index),
  };
}

function frozenUnits(units) {
  return deepFreeze({
    temperature: stringOrNull(units?.temperature),
    pressure: stringOrNull(units?.pressure),
    precipitation: stringOrNull(units?.precipitation),
    wind_speed: stringOrNull(units?.wind_speed),
    visibility: stringOrNull(units?.visibility),
  });
}

function invalidArrayReason(forecast) {
  if (!Array.isArray(forecast)) return "invalid_payload";
  if (forecast.length === 0) return "empty_data";
  return null;
}

export function normalizeHourlyForecast({ sourceEntityId, units, forecast }) {
  const arrayReason = invalidArrayReason(forecast);
  if (arrayReason) return { value: null, reason: arrayReason };
  const items = forecast
    .map(validForecastRecord)
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)
    .map(({ record, datetime }) => normalizeCommon({ ...record, datetime }));
  if (items.length === 0) return { value: null, reason: "empty_data" };
  return {
    value: deepFreeze({ source_entity_id: sourceEntityId, units: frozenUnits(units), items }),
    reason: null,
  };
}

function timezoneUnavailable(timeZone) {
  return !isValidTimeZone(timeZone);
}

function dailyEnvelope(sourceEntityId, source, units, items) {
  return deepFreeze({
    source_entity_id: sourceEntityId,
    forecast_source: source,
    units: frozenUnits(units),
    items: items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7),
  });
}

export function normalizeTrueDailyForecast({ sourceEntityId, units, forecast, timeZone }) {
  if (timezoneUnavailable(timeZone)) return { value: null, reason: "timezone_unavailable" };
  const arrayReason = invalidArrayReason(forecast);
  if (arrayReason) return { value: null, reason: arrayReason };
  const items = [];
  for (const candidate of forecast.map(validForecastRecord).filter(Boolean)) {
    const { record, datetime } = candidate;
    items.push({
      date: localDateKey(datetime, timeZone),
      datetime,
      condition: stringOrNull(record.condition),
      temperature_high: finiteOrNull(record.temperature),
      temperature_low: finiteOrNull(record.templow),
      precipitation: finiteOrNull(record.precipitation),
      precipitation_probability: percentOrNull(record.precipitation_probability),
      humidity: percentOrNull(record.humidity),
      pressure: finiteOrNull(record.pressure),
      wind_speed: finiteOrNull(record.wind_speed),
      wind_gust_speed: finiteOrNull(record.wind_gust_speed),
      wind_bearing: finiteOrNull(record.wind_bearing),
      cloud_coverage: percentOrNull(record.cloud_coverage),
      uv_index: finiteOrNull(record.uv_index),
    });
  }
  if (items.length === 0) return { value: null, reason: "empty_data" };
  return { value: dailyEnvelope(sourceEntityId, "daily", units, items), reason: null };
}

function finiteValues(records, selector) {
  return records.map(selector).filter((value) => typeof value === "number" && Number.isFinite(value));
}

function maxOrNull(values) {
  return values.length ? Math.max(...values) : null;
}

function minOrNull(values) {
  return values.length ? Math.min(...values) : null;
}

function averageOrNull(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sumOrNull(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function groupByLocalDate(records, timeZone) {
  const groups = new Map();
  for (const record of records) {
    const key = localDateKey(record.datetime, timeZone);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
}

export function aggregateTwiceDailyForecast({ sourceEntityId, units, forecast, timeZone }) {
  if (timezoneUnavailable(timeZone)) return { value: null, reason: "timezone_unavailable" };
  const arrayReason = invalidArrayReason(forecast);
  if (arrayReason) return { value: null, reason: arrayReason };
  const records = forecast
    .map(validForecastRecord)
    .filter(Boolean)
    .map(({ record, datetime, date }) => ({
      ...normalizeCommon({ ...record, datetime }),
      dateObject: date,
      templow: finiteOrNull(record.templow),
      is_daytime: record.is_daytime === true,
    }))
    .sort((a, b) => a.dateObject - b.dateObject);
  if (records.length === 0) return { value: null, reason: "empty_data" };

  const items = [];
  for (const [date, dayRecords] of groupByLocalDate(records, timeZone)) {
    const representative = dayRecords.find((record) => record.is_daytime) ?? dayRecords[0];
    const highCandidates = finiteValues(dayRecords, (record) => record.temperature);
    const lowCandidates = finiteValues(dayRecords, (record) => record.templow ?? record.temperature);
    items.push({
      date,
      datetime: representative.datetime,
      condition: representative.condition,
      temperature_high: maxOrNull(highCandidates),
      temperature_low: minOrNull(lowCandidates),
      precipitation: sumOrNull(finiteValues(dayRecords, (record) => record.precipitation)),
      precipitation_probability: maxOrNull(finiteValues(dayRecords, (record) => record.precipitation_probability)),
      humidity: averageOrNull(finiteValues(dayRecords, (record) => record.humidity)),
      pressure: averageOrNull(finiteValues(dayRecords, (record) => record.pressure)),
      wind_speed: maxOrNull(finiteValues(dayRecords, (record) => record.wind_speed)),
      wind_gust_speed: maxOrNull(finiteValues(dayRecords, (record) => record.wind_gust_speed)),
      wind_bearing: representative.wind_bearing,
      cloud_coverage: averageOrNull(finiteValues(dayRecords, (record) => record.cloud_coverage)),
      uv_index: maxOrNull(finiteValues(dayRecords, (record) => record.uv_index)),
    });
  }
  return { value: dailyEnvelope(sourceEntityId, "twice_daily", units, items), reason: null };
}

export function aggregateHourlyForecastToDaily({ sourceEntityId, units, hourlyValue, timeZone }) {
  if (timezoneUnavailable(timeZone)) return { value: null, reason: "timezone_unavailable" };
  if (!hourlyValue || !Array.isArray(hourlyValue.items) || hourlyValue.items.length === 0) {
    return { value: null, reason: "empty_data" };
  }
  const records = hourlyValue.items
    .map((record) => {
      const valid = validForecastRecord(record);
      return valid ? { ...record, dateObject: valid.date } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dateObject - b.dateObject);
  if (records.length === 0) return { value: null, reason: "empty_data" };

  const items = [];
  for (const [date, dayRecords] of groupByLocalDate(records, timeZone)) {
    let representative = dayRecords[0];
    let bestDistance = Infinity;
    for (const record of dayRecords) {
      const { hour, minute } = localDateParts(record.datetime, timeZone);
      const distance = Math.abs((hour * 60 + minute) - 720);
      if (distance < bestDistance) {
        bestDistance = distance;
        representative = record;
      }
    }
    items.push({
      date,
      datetime: representative.datetime,
      condition: representative.condition,
      temperature_high: maxOrNull(finiteValues(dayRecords, (record) => record.temperature)),
      temperature_low: minOrNull(finiteValues(dayRecords, (record) => record.temperature)),
      precipitation: sumOrNull(finiteValues(dayRecords, (record) => record.precipitation)),
      precipitation_probability: maxOrNull(finiteValues(dayRecords, (record) => record.precipitation_probability)),
      humidity: averageOrNull(finiteValues(dayRecords, (record) => record.humidity)),
      pressure: averageOrNull(finiteValues(dayRecords, (record) => record.pressure)),
      wind_speed: maxOrNull(finiteValues(dayRecords, (record) => record.wind_speed)),
      wind_gust_speed: maxOrNull(finiteValues(dayRecords, (record) => record.wind_gust_speed)),
      wind_bearing: representative.wind_bearing,
      cloud_coverage: averageOrNull(finiteValues(dayRecords, (record) => record.cloud_coverage)),
      uv_index: maxOrNull(finiteValues(dayRecords, (record) => record.uv_index)),
    });
  }
  return { value: dailyEnvelope(sourceEntityId, "hourly", units, items), reason: null };
}

export function findNextPrecipitation(hourlyValue, { now, timeZone }) {
  if (!isValidTimeZone(timeZone) || !hourlyValue || !Array.isArray(hourlyValue.items)) return null;
  const nowDate = parsedDate(now);
  if (!nowDate) return null;
  const today = localDateKey(nowDate, timeZone);
  const items = [...hourlyValue.items]
    .map((item) => ({ item, date: parsedDate(item?.datetime) }))
    .filter(({ date }) => date)
    .sort((a, b) => a.date - b.date);
  for (const { item, date } of items) {
    if (date < nowDate || localDateKey(date, timeZone) !== today) continue;
    const probability = percentOrNull(item.precipitation_probability);
    const precipitation = finiteOrNull(item.precipitation);
    const qualifies = (probability !== null && probability >= 40)
      || (precipitation !== null && precipitation > 0)
      || PRECIPITATION_CONDITIONS.has(item.condition);
    if (qualifies) return deepFreeze({ datetime: item.datetime, probability });
  }
  return null;
}
