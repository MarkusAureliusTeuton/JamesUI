const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function validTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone.trim() }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function asDate(value) {
  const date = value instanceof Date ? new Date(value.valueOf()) : new Date(value);
  return Number.isFinite(date.valueOf()) ? date : null;
}

function localParts(value, timeZone) {
  const date = asDate(value);
  if (!date || !validTimeZone(timeZone)) return null;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone.trim(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.create(null);
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function sameLocalParts(a, b) {
  return a.year === b.year
    && a.month === b.month
    && a.day === b.day
    && a.hour === b.hour
    && a.minute === b.minute
    && a.second === b.second;
}

function wallTimeValue(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function isDateKey(value) {
  if (typeof value !== "string") return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day;
}

export function addDateKey(dateKey, days) {
  if (!isDateKey(dateKey) || !Number.isInteger(days)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function dateKeyInTimeZone(value, timeZone) {
  const parts = localParts(value, timeZone);
  if (!parts) return null;
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatZonedTime(isoInstant, timeZone) {
  const parts = localParts(isoInstant, timeZone);
  if (!parts) return null;
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function zonedLocalToInstant(
  { dateKey, hour = 0, minute = 0, second = 0 } = {},
  timeZone,
) {
  if (!isDateKey(dateKey) || !validTimeZone(timeZone)) return null;
  for (const [value, max] of [[hour, 23], [minute, 59], [second, 59]]) {
    if (!Number.isInteger(value) || value < 0 || value > max) return null;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const desired = { year, month, day, hour, minute, second };
  const naiveUtc = wallTimeValue(desired);
  const offsets = new Set();

  for (let deltaHours = -36; deltaHours <= 36; deltaHours += 6) {
    const probeMs = naiveUtc + deltaHours * 60 * 60 * 1000;
    const parts = localParts(new Date(probeMs), timeZone);
    if (!parts) continue;
    offsets.add(wallTimeValue(parts) - probeMs);
  }

  const exactCandidates = [];
  const compatibleGapCandidates = [];
  for (const offset of offsets) {
    const candidateMs = naiveUtc - offset;
    const candidate = new Date(candidateMs);
    const projected = localParts(candidate, timeZone);
    if (!projected) continue;
    if (sameLocalParts(projected, desired)) {
      exactCandidates.push(candidate);
      continue;
    }
    const wallDelta = wallTimeValue(projected) - naiveUtc;
    if (wallDelta > 0) compatibleGapCandidates.push({ candidate, wallDelta });
  }

  if (exactCandidates.length) {
    exactCandidates.sort((a, b) => a - b);
    return exactCandidates[0].toISOString();
  }
  if (!compatibleGapCandidates.length) return null;
  compatibleGapCandidates.sort((a, b) => a.wallDelta - b.wallDelta || a.candidate - b.candidate);
  return compatibleGapCandidates[0].candidate.toISOString();
}

export function zonedStartOfDate(dateKey, timeZone) {
  return zonedLocalToInstant({ dateKey }, timeZone);
}

export function shiftInstantByLocalDays(isoInstant, days, timeZone) {
  if (!Number.isInteger(days)) return null;
  const parts = localParts(isoInstant, timeZone);
  if (!parts) return null;
  const shiftedDate = addDateKey(`${parts.year}-${pad(parts.month)}-${pad(parts.day)}`, days);
  if (!shiftedDate) return null;
  return zonedLocalToInstant({
    dateKey: shiftedDate,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }, timeZone);
}
