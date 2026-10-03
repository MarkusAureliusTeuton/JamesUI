import { deepFreeze } from "./normalize.js";

export const MOON_PHASES = Object.freeze([
  "new_moon",
  "waxing_crescent",
  "first_quarter",
  "waxing_gibbous",
  "full_moon",
  "waning_gibbous",
  "last_quarter",
  "waning_crescent",
]);

const PHASE_SET = new Set(MOON_PHASES);
const PI = Math.PI;
const RAD = PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const EARTH_OBLIQUITY = RAD * 23.4397;
const SUN_DISTANCE_KM = 149598000;

function toJulian(date) {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function toDays(date) {
  return toJulian(date) - J2000;
}

function rightAscension(longitude, latitude) {
  return Math.atan2(
    Math.sin(longitude) * Math.cos(EARTH_OBLIQUITY) - Math.tan(latitude) * Math.sin(EARTH_OBLIQUITY),
    Math.cos(longitude),
  );
}

function declination(longitude, latitude) {
  return Math.asin(
    Math.sin(latitude) * Math.cos(EARTH_OBLIQUITY)
      + Math.cos(latitude) * Math.sin(EARTH_OBLIQUITY) * Math.sin(longitude),
  );
}

function solarMeanAnomaly(days) {
  return RAD * (357.5291 + 0.98560028 * days);
}

function eclipticLongitude(meanAnomaly) {
  const center = RAD * (
    1.9148 * Math.sin(meanAnomaly)
      + 0.02 * Math.sin(2 * meanAnomaly)
      + 0.0003 * Math.sin(3 * meanAnomaly)
  );
  const perihelion = RAD * 102.9372;
  return meanAnomaly + center + perihelion + PI;
}

function sunCoords(days) {
  const meanAnomaly = solarMeanAnomaly(days);
  const longitude = eclipticLongitude(meanAnomaly);
  return {
    dec: declination(longitude, 0),
    ra: rightAscension(longitude, 0),
  };
}

function moonCoords(days) {
  const longitudeMean = RAD * (218.316 + 13.176396 * days);
  const meanAnomaly = RAD * (134.963 + 13.064993 * days);
  const meanDistance = RAD * (93.272 + 13.229350 * days);
  const longitude = longitudeMean + RAD * 6.289 * Math.sin(meanAnomaly);
  const latitude = RAD * 5.128 * Math.sin(meanDistance);
  const distance = 385001 - 20905 * Math.cos(meanAnomaly);
  return {
    ra: rightAscension(longitude, latitude),
    dec: declination(longitude, latitude),
    dist: distance,
  };
}

function moonIllumination(date) {
  const days = toDays(date);
  const sun = sunCoords(days);
  const moon = moonCoords(days);
  const separation = Math.acos(
    Math.sin(sun.dec) * Math.sin(moon.dec)
      + Math.cos(sun.dec) * Math.cos(moon.dec) * Math.cos(sun.ra - moon.ra),
  );
  const incidence = Math.atan2(
    SUN_DISTANCE_KM * Math.sin(separation),
    moon.dist - SUN_DISTANCE_KM * Math.cos(separation),
  );
  const angle = Math.atan2(
    Math.cos(sun.dec) * Math.sin(sun.ra - moon.ra),
    Math.sin(sun.dec) * Math.cos(moon.dec)
      - Math.cos(sun.dec) * Math.sin(moon.dec) * Math.cos(sun.ra - moon.ra),
  );
  return {
    fraction: (1 + Math.cos(incidence)) / 2,
    cycle: 0.5 + 0.5 * incidence * (angle < 0 ? -1 : 1) / PI,
  };
}

function normalizeCycle(cycle) {
  if (typeof cycle !== "number" || !Number.isFinite(cycle)) throw new TypeError("cycle must be finite");
  return ((cycle % 1) + 1) % 1;
}

export function phaseBucketFromCycle(cycle) {
  const normalized = normalizeCycle(cycle);
  const index = Math.floor((normalized + 1 / 16) * 8) % 8;
  return MOON_PHASES[index];
}

export function calculateMoon(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.valueOf())) {
    throw new TypeError("date must be a valid Date");
  }
  const illumination = moonIllumination(date);
  const cycle = normalizeCycle(illumination.cycle);
  return deepFreeze({
    phase: phaseBucketFromCycle(cycle),
    illumination_percent: Math.min(100, Math.max(0, illumination.fraction * 100)),
    waxing: cycle <= 0.5,
  });
}

function recognizedPhase(entity) {
  if (!entity || typeof entity.entity_id !== "string" || !entity.entity_id.startsWith("sensor.")) return null;
  return PHASE_SET.has(entity.state) ? entity.state : null;
}

export function resolveMoon({ now, configuredEntityId = null, sensorEntities = [] }) {
  const calculated = calculateMoon(now);
  const entities = Array.isArray(sensorEntities) ? [...sensorEntities] : [];
  let sourceIssue = null;

  if (configuredEntityId) {
    const configured = entities.find((entity) => entity?.entity_id === configuredEntityId) ?? null;
    const configuredPhase = recognizedPhase(configured);
    if (configuredPhase) {
      return deepFreeze({
        phase: configuredPhase,
        illumination_percent: calculated.illumination_percent,
        waxing: calculated.waxing,
        phase_source: "home_assistant",
        illumination_source: "calculated",
        source_entity_id: configuredEntityId,
        source_issue: null,
      });
    }
    sourceIssue = configured ? "configured_source_invalid" : "configured_source_missing";
  }

  const discovered = entities
    .filter((entity) => recognizedPhase(entity))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id))[0] ?? null;
  if (discovered) {
    return deepFreeze({
      phase: discovered.state,
      illumination_percent: calculated.illumination_percent,
      waxing: calculated.waxing,
      phase_source: "home_assistant",
      illumination_source: "calculated",
      source_entity_id: discovered.entity_id,
      source_issue: sourceIssue,
    });
  }

  return deepFreeze({
    phase: calculated.phase,
    illumination_percent: calculated.illumination_percent,
    waxing: calculated.waxing,
    phase_source: "calculated",
    illumination_source: "calculated",
    source_entity_id: null,
    source_issue: sourceIssue,
  });
}
