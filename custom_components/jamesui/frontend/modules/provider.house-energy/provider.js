import { readHouseSourceNumber } from "../../shared/house-source.js";
import { validateHouseEnergyConfig } from "./config.js";
import { normalizePowerWatts, timeWeightedAverageWatts } from "./history.js";

const REFRESH_MS = 60_000;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function requireContext(context) {
  if (!context?.capabilities || typeof context.capabilities.register !== "function") throw new TypeError("house energy provider requires capabilities");
  const homeAssistant = context.homeAssistant;
  for (const method of ["connectionState", "getState", "subscribeConnection", "subscribeEntity", "callWS"]) {
    if (!homeAssistant || typeof homeAssistant[method] !== "function") throw new TypeError(`house energy provider requires homeAssistant.${method}`);
  }
  return context;
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try { Promise.resolve(unsubscribe()).catch(() => {}); } catch { /* best effort */ }
}

function validateWindowRequest(request, sourceMap) {
  if (!isPlainObject(request)) throw new TypeError("energy window request must be a plain object");
  const allowed = new Set(["request_id", "source_id", "window_minutes"]);
  for (const key of Object.keys(request)) {
    if (!allowed.has(key)) throw new TypeError(`energy window request contains unsupported field: ${key}`);
  }
  const requestId = nonEmptyString(request.request_id, "request_id");
  const sourceId = nonEmptyString(request.source_id, "source_id");
  if (!sourceMap.has(sourceId)) throw new TypeError(`energy source is not configured: ${sourceId}`);
  const windowMinutes = Number(request.window_minutes);
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) throw new TypeError("window_minutes must be a positive finite number");
  return Object.freeze({ request_id: requestId, source_id: sourceId, window_minutes: windowMinutes });
}

function freezeResult(record, requestId) {
  return Object.freeze({ request_id: requestId, ...record.result });
}

export function createHouseEnergyProvider(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateHouseEnergyConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let capabilityHandle = null;
  let connectionUnsubscribe = null;
  const entityUnsubscribes = new Map();
  const windowRecords = new Map();
  let serviceGeneration = 0;

  const homeAssistant = () => context.homeAssistant;
  const sourceMap = () => new Map(config.sources.map((source) => [source.id, source]));
  const windowKey = (request) => `${request.source_id}\u0000${request.window_minutes}`;

  const currentPower = (source) => {
    const state = homeAssistant().getState(source.power.entity_id);
    const raw = readHouseSourceNumber(state, source.power);
    if (raw.status !== "available") return { quality: "unavailable", current_power_w: null, unit: null, reason: raw.reason };
    const unit = state?.attributes?.unit_of_measurement;
    const watts = normalizePowerWatts(raw.value, unit);
    if (watts === null) return { quality: "unavailable", current_power_w: null, unit, reason: "unit_unsupported" };
    return { quality: "available", current_power_w: watts, unit, reason: null };
  };

  const notifyConsumer = (consumer) => {
    if (!consumer.active || consumer.generation !== serviceGeneration) return;
    if (consumer.entries.some((entry) => entry.record.result === null)) return;
    const results = consumer.entries.map((entry) => freezeResult(entry.record, entry.request.request_id));
    try { consumer.listener(Object.freeze({ results: Object.freeze(results) })); } catch { /* isolate consumers */ }
  };

  const notifyRecord = (record) => {
    for (const consumer of [...record.consumers]) notifyConsumer(consumer);
  };

  const setResult = (record, result) => {
    if (!record.active) return;
    record.result = Object.freeze({
      source_id: record.sourceId,
      window_minutes: record.windowMinutes,
      current_power_w: result.current_power_w,
      average_power_w: result.average_power_w,
      quality: result.quality,
      reason: result.reason,
    });
    notifyRecord(record);
  };

  const refreshRecord = (record) => {
    if (!record.active || record.generation !== serviceGeneration) return;
    const source = sourceMap().get(record.sourceId);
    if (!source) return;
    const token = ++record.token;
    const current = currentPower(source);
    if (current.quality !== "available") {
      setResult(record, { current_power_w: null, average_power_w: null, quality: "unavailable", reason: current.reason });
      return;
    }

    setResult(record, {
      current_power_w: current.current_power_w,
      average_power_w: null,
      quality: "insufficient",
      reason: "history_pending",
    });

    const endMs = Date.now();
    const startMs = endMs - record.windowMinutes * 60_000;
    const message = {
      type: "history/history_during_period",
      start_time: new Date(startMs).toISOString(),
      end_time: new Date(endMs).toISOString(),
      entity_ids: [source.power.entity_id],
      include_start_time_state: true,
      significant_changes_only: false,
      minimal_response: true,
      no_attributes: true,
    };

    Promise.resolve().then(() => homeAssistant().callWS(message)).then((payload) => {
      if (!record.active || record.generation !== serviceGeneration || record.token !== token) return;
      const history = Array.isArray(payload?.[source.power.entity_id]) ? payload[source.power.entity_id] : [];
      const average = timeWeightedAverageWatts(history, { start_ms: startMs, end_ms: endMs, unit: current.unit });
      setResult(record, {
        current_power_w: current.current_power_w,
        average_power_w: average.average_power_w,
        quality: average.quality,
        reason: average.reason,
      });
    }).catch(() => {
      if (!record.active || record.generation !== serviceGeneration || record.token !== token) return;
      setResult(record, {
        current_power_w: current.current_power_w,
        average_power_w: null,
        quality: "insufficient",
        reason: "history_fetch_failed",
      });
    });
  };

  const createRecord = (request) => {
    const record = {
      key: windowKey(request),
      sourceId: request.source_id,
      windowMinutes: request.window_minutes,
      generation: serviceGeneration,
      active: true,
      token: 0,
      result: null,
      consumers: new Set(),
      timer: null,
    };
    windowRecords.set(record.key, record);
    record.timer = globalThis.setInterval(() => refreshRecord(record), REFRESH_MS);
    refreshRecord(record);
    return record;
  };

  const releaseRecord = (record, consumer) => {
    record.consumers.delete(consumer);
    if (record.consumers.size !== 0) return;
    record.active = false;
    record.token += 1;
    if (record.timer !== null) globalThis.clearInterval(record.timer);
    record.timer = null;
    if (windowRecords.get(record.key) === record) windowRecords.delete(record.key);
  };

  const clearRecords = () => {
    for (const record of windowRecords.values()) {
      record.active = false;
      record.token += 1;
      if (record.timer !== null) globalThis.clearInterval(record.timer);
      record.timer = null;
      record.consumers.clear();
    }
    windowRecords.clear();
  };

  const makeService = () => {
    const generation = serviceGeneration;
    const sources = Object.freeze(config.sources.map((source) => Object.freeze({ id: source.id, name: source.name })));
    const allowedSources = sourceMap();
    return Object.freeze({
      version: 1,
      configured_sources: sources,
      subscribe_windows(request, listener) {
        if (generation !== serviceGeneration || destroyed || !mounted) throw new Error("house energy service is stale");
        if (typeof listener !== "function") throw new TypeError("energy window listener must be a function");
        if (!isPlainObject(request) || !Array.isArray(request.windows) || request.windows.length === 0) {
          throw new TypeError("energy window request requires windows");
        }
        const requests = request.windows.map((item) => validateWindowRequest(item, allowedSources));
        const requestIds = new Set();
        for (const item of requests) {
          if (requestIds.has(item.request_id)) throw new TypeError(`duplicate energy request_id: ${item.request_id}`);
          requestIds.add(item.request_id);
        }
        const consumer = { active: true, generation, listener, entries: [] };
        for (const item of requests) {
          const key = windowKey(item);
          const record = windowRecords.get(key) ?? createRecord(item);
          record.consumers.add(consumer);
          consumer.entries.push({ request: item, record });
        }
        notifyConsumer(consumer);
        let active = true;
        return () => {
          if (!active) return false;
          active = false;
          consumer.active = false;
          for (const entry of consumer.entries) releaseRecord(entry.record, consumer);
          consumer.entries.length = 0;
          return true;
        };
      },
    });
  };

  const publishTopLevel = () => {
    if (!capabilityHandle) return;
    if (config.sources.length === 0) {
      capabilityHandle.notConfigured("no_energy_sources");
      return;
    }
    if (homeAssistant().connectionState() !== "connected") {
      capabilityHandle.unavailable("home_assistant_disconnected");
      return;
    }
    capabilityHandle.available(makeService());
  };

  const replaceService = () => {
    serviceGeneration += 1;
    clearRecords();
    publishTopLevel();
  };

  const handleSourceChange = (entityId) => {
    for (const record of windowRecords.values()) {
      const source = sourceMap().get(record.sourceId);
      if (source?.power.entity_id === entityId) refreshRecord(record);
    }
  };

  const bindRuntime = () => {
    capabilityHandle = context.capabilities.register("provider.house-energy", "house.energy");
    const ids = new Set(config.sources.map((source) => source.power.entity_id));
    for (const entityId of ids) {
      entityUnsubscribes.set(entityId, homeAssistant().subscribeEntity(entityId, () => handleSourceChange(entityId), { emitCurrent: false }));
    }
    connectionUnsubscribe = homeAssistant().subscribeConnection(() => replaceService(), { emitCurrent: false });
    serviceGeneration += 1;
    publishTopLevel();
  };

  const unbindRuntime = () => {
    serviceGeneration += 1;
    clearRecords();
    invokeUnsubscribe(connectionUnsubscribe);
    connectionUnsubscribe = null;
    for (const unsubscribe of entityUnsubscribes.values()) invokeUnsubscribe(unsubscribe);
    entityUnsubscribes.clear();
    capabilityHandle?.unregister();
    capabilityHandle = null;
  };

  return Object.freeze({
    mount() { if (destroyed || mounted) return false; mounted = true; bindRuntime(); return true; },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("house energy provider is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateHouseEnergyConfig(nextConfig);
      if (!mounted) { context = validatedContext; config = validatedConfig; return true; }
      const previousContext = context;
      const previousConfig = config;
      unbindRuntime();
      context = validatedContext;
      config = validatedConfig;
      try {
        bindRuntime();
        return true;
      } catch (error) {
        try { unbindRuntime(); } catch { /* best-effort cleanup of partial next runtime */ }
        context = previousContext;
        config = previousConfig;
        bindRuntime();
        throw error;
      }
    },
    destroy() { if (destroyed) return false; destroyed = true; if (mounted) unbindRuntime(); mounted = false; return true; },
  });
}
