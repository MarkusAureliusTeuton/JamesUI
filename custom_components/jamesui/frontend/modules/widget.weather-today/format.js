const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  const date = value instanceof Date ? new Date(value.valueOf()) : new Date(value);
  return Number.isFinite(date.valueOf()) ? date : null;
}

export function normalizeDisplayTimeZone(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const timeZone = value.trim();
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone }).format(new Date(0));
    return timeZone;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

function validIsoInstant(value) {
  if (typeof value !== "string") return null;
  const instant = value.trim();
  if (!ISO_INSTANT_PATTERN.test(instant)) return null;
  const date = validDate(instant);
  return date ? { instant, date } : null;
}

export function formatDeviceClock(now) {
  const date = validDate(now);
  if (!date) throw new TypeError("device clock requires a valid date");
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDeviceDate(now) {
  const date = validDate(now);
  if (!date) throw new TypeError("device date requires a valid date");
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatMeasurement(value, unit = null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const formatted = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
  return typeof unit === "string" && unit.trim() !== "" ? `${formatted} ${unit.trim()}` : formatted;
}

export function formatZonedTime(instant, timeZone) {
  const normalizedTimeZone = normalizeDisplayTimeZone(timeZone);
  const parsed = validIsoInstant(instant);
  if (!normalizedTimeZone || !parsed) return null;
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: normalizedTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed.date);
}

export function dateKeyInTimeZone(instant, timeZone) {
  const normalizedTimeZone = normalizeDisplayTimeZone(timeZone);
  const date = validDate(instant);
  if (!normalizedTimeZone || !date) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function nextDateKey(dateKey) {
  if (!DATE_KEY_PATTERN.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1, 12));
  if (!Number.isFinite(date.valueOf())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function formatForecastDay(dateKey, now, timeZone) {
  const normalizedTimeZone = normalizeDisplayTimeZone(timeZone);
  if (!normalizedTimeZone || typeof dateKey !== "string" || !DATE_KEY_PATTERN.test(dateKey)) return null;
  const today = dateKeyInTimeZone(now, normalizedTimeZone);
  if (!today) return null;
  if (dateKey === today) return "Heute";
  if (dateKey === nextDateKey(today)) return "Morgen";
  const [year, month, day] = dateKey.split("-").map(Number);
  const abstractDay = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "UTC" }).format(abstractDay);
}
