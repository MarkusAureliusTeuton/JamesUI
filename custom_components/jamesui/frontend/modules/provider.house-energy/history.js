function result(quality, averagePowerW, reason) {
  return Object.freeze({ quality, average_power_w: averagePowerW, reason });
}

export function normalizePowerWatts(value, unit) {
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(number)) return null;
  if (unit === "W") return number;
  if (unit === "kW") return number * 1000;
  return null;
}

function sampleTimeMs(sample) {
  if (typeof sample?.lu === "number" && Number.isFinite(sample.lu)) return sample.lu * 1000;
  if (typeof sample?.last_updated === "string") {
    const parsed = Date.parse(sample.last_updated);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sampleState(sample) {
  if (sample && Object.prototype.hasOwnProperty.call(sample, "s")) return sample.s;
  return sample?.state;
}

function powerForSample(sample, unit) {
  const state = sampleState(sample);
  if (state === "unknown" || state === "unavailable") return { kind: "gap", value: null };
  const watts = normalizePowerWatts(state, unit);
  return watts === null ? { kind: "invalid", value: null } : { kind: "value", value: watts };
}

export function timeWeightedAverageWatts(history, { start_ms: startMs, end_ms: endMs, unit } = {}) {
  if (!Array.isArray(history) || history.length === 0) return result("insufficient", null, "history_empty");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return result("insufficient", null, "history_range_invalid");
  }
  if (unit !== "W" && unit !== "kW") return result("insufficient", null, "unit_unsupported");

  const samples = [];
  for (const sample of history) {
    const time = sampleTimeMs(sample);
    if (time === null) return result("insufficient", null, "history_sample_invalid");
    samples.push({ sample, time });
  }
  samples.sort((a, b) => a.time - b.time);

  let startIndex = -1;
  for (let index = 0; index < samples.length; index += 1) {
    if (samples[index].time <= startMs) startIndex = index;
    else break;
  }
  if (startIndex < 0) return result("insufficient", null, "history_start_missing");

  let current = powerForSample(samples[startIndex].sample, unit);
  if (current.kind === "gap") return result("insufficient", null, "history_gap");
  if (current.kind !== "value") return result("insufficient", null, "history_value_invalid");

  let cursor = startMs;
  let weighted = 0;
  for (let index = startIndex + 1; index < samples.length; index += 1) {
    const entry = samples[index];
    if (entry.time <= startMs) {
      current = powerForSample(entry.sample, unit);
      continue;
    }
    if (entry.time >= endMs) break;
    if (current.kind === "gap") return result("insufficient", null, "history_gap");
    if (current.kind !== "value") return result("insufficient", null, "history_value_invalid");
    weighted += current.value * (entry.time - cursor);
    cursor = entry.time;
    current = powerForSample(entry.sample, unit);
  }

  if (current.kind === "gap") return result("insufficient", null, "history_gap");
  if (current.kind !== "value") return result("insufficient", null, "history_value_invalid");
  weighted += current.value * (endMs - cursor);
  return result("full", weighted / (endMs - startMs), null);
}
