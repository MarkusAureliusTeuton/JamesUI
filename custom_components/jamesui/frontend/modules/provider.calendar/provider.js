import { isDateKey, zonedStartOfDate } from "../../shared/zoned-time.js";
import { validateCalendarProviderConfig } from "./config.js";
import { normalizeCalendarEvents } from "./normalize.js";

const EMPTY_EVENTS = Object.freeze([]);
const UNAVAILABLE_STATES = new Set(["unknown", "unavailable"]);

function requireContext(context) {
  if (!context?.capabilities || typeof context.capabilities.register !== "function") {
    throw new TypeError("calendar provider requires capabilities");
  }
  const homeAssistant = context.homeAssistant;
  for (const method of [
    "connectionState", "timeZone", "getState", "subscribeConnection", "subscribeEntity", "subscribeMessage",
  ]) {
    if (!homeAssistant || typeof homeAssistant[method] !== "function") {
      throw new TypeError(`calendar provider requires homeAssistant.${method}`);
    }
  }
  return context;
}

function sourceName(entityId, state) {
  const value = state?.attributes?.friendly_name;
  return typeof value === "string" && value.trim() ? value.trim() : entityId;
}

function sourceAvailability(state) {
  if (!state) return { status: "unavailable", reason: "source_missing" };
  if (UNAVAILABLE_STATES.has(state.state)) return { status: "unavailable", reason: "source_unavailable" };
  return { status: "available", reason: null };
}

function freezeSourceSnapshot(record) {
  return Object.freeze({
    status: record.status,
    reason: record.reason,
    events: record.status === "available" ? record.events : EMPTY_EVENTS,
  });
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try {
    Promise.resolve(unsubscribe()).catch(() => {});
  } catch {
    // Cleanup is best-effort; stale data is already invalidated synchronously.
  }
}

function validRange(range, configuredSources) {
  if (!range || typeof range !== "object" || Array.isArray(range)) {
    throw new TypeError("calendar range must be an object");
  }
  const { entity_id: entityId, start_date: startDate, end_date: endDate } = range;
  if (typeof entityId !== "string" || !configuredSources.has(entityId)) {
    throw new TypeError("calendar range source must be configured");
  }
  if (!isDateKey(startDate) || !isDateKey(endDate)) {
    throw new TypeError("calendar range dates must be YYYY-MM-DD");
  }
  if (endDate <= startDate) throw new RangeError("calendar range end_date must be after start_date");
  return Object.freeze({ entity_id: entityId, start_date: startDate, end_date: endDate });
}

export function createCalendarProvider(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateCalendarProviderConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let capabilityHandle = null;
  let connectionUnsubscribe = null;
  const entityUnsubscribes = new Map();
  const sourceStates = new Map();
  const rangeRecords = new Map();
  let serviceGeneration = 0;

  const homeAssistant = () => context.homeAssistant;
  const configuredSourceSet = () => new Set(config.source_entity_ids);
  const rangeKey = (range) => `${range.entity_id}\u0000${range.start_date}\u0000${range.end_date}`;

  const notifyConsumer = (consumer) => {
    if (!consumer.active || !consumer.ready || consumer.generation !== serviceGeneration) return;
    if (consumer.records.some((record) => record.status === "pending")) return;
    const sources = {};
    for (const record of consumer.records) {
      sources[record.entityId] = freezeSourceSnapshot(record);
    }
    const snapshot = Object.freeze({
      time_zone: homeAssistant().timeZone(),
      sources: Object.freeze(sources),
    });
    try {
      consumer.listener(snapshot);
    } catch {
      // One consumer cannot break provider updates for siblings.
    }
  };

  const notifyRecord = (record) => {
    for (const consumer of [...record.consumers]) notifyConsumer(consumer);
  };

  const stopRemote = (record) => {
    record.setupToken += 1;
    const unsubscribe = record.remoteUnsubscribe;
    record.remoteUnsubscribe = null;
    invokeUnsubscribe(unsubscribe);
  };

  const setUnavailable = (record, reason, { stop = false } = {}) => {
    if (!record.active) return;
    if (stop) stopRemote(record);
    record.status = "unavailable";
    record.reason = reason;
    record.events = EMPTY_EVENTS;
    notifyRecord(record);
  };

  const startRemote = (record) => {
    if (!record.active || record.consumers.size === 0) return;
    const availability = sourceAvailability(sourceStates.get(record.entityId));
    if (availability.status !== "available") {
      setUnavailable(record, availability.reason, { stop: true });
      return;
    }

    stopRemote(record);
    record.status = "pending";
    record.reason = null;
    record.events = EMPTY_EVENTS;
    const token = record.setupToken;
    const generation = serviceGeneration;
    const start = zonedStartOfDate(record.startDate, record.timeZone);
    const end = zonedStartOfDate(record.endDate, record.timeZone);
    if (!start || !end) {
      setUnavailable(record, "timezone_unavailable");
      return;
    }

    const onPayload = (payload) => {
      if (!record.active || record.setupToken !== token || generation !== serviceGeneration) return;
      if (!payload || !Array.isArray(payload.events)) {
        setUnavailable(record, "fetch_failed");
        return;
      }
      record.status = "available";
      record.reason = null;
      record.events = normalizeCalendarEvents(record.entityId, payload.events);
      notifyRecord(record);
    };

    Promise.resolve(homeAssistant().subscribeMessage(onPayload, {
      type: "calendar/event/subscribe",
      entity_id: record.entityId,
      start,
      end,
    })).then((unsubscribe) => {
      if (!record.active || record.setupToken !== token || generation !== serviceGeneration) {
        invokeUnsubscribe(unsubscribe);
        return;
      }
      record.remoteUnsubscribe = unsubscribe;
    }).catch(() => {
      if (!record.active || record.setupToken !== token || generation !== serviceGeneration) return;
      setUnavailable(record, "subscription_failed");
    });
  };

  const releaseRecord = (record, consumer) => {
    record.consumers.delete(consumer);
    if (record.consumers.size !== 0) return;
    record.active = false;
    stopRemote(record);
    if (rangeRecords.get(record.key) === record) rangeRecords.delete(record.key);
  };

  const clearRanges = () => {
    for (const record of rangeRecords.values()) {
      record.active = false;
      stopRemote(record);
      record.consumers.clear();
    }
    rangeRecords.clear();
  };

  const makeService = () => {
    const generation = serviceGeneration;
    const timeZone = homeAssistant().timeZone();
    const configuredSources = Object.freeze(config.source_entity_ids.map((entityId) => Object.freeze({
      entity_id: entityId,
      name: sourceName(entityId, sourceStates.get(entityId)),
    })));
    const allowed = configuredSourceSet();

    return Object.freeze({
      version: 1,
      time_zone: timeZone,
      configured_sources: configuredSources,
      subscribe_ranges(request, listener) {
        if (generation !== serviceGeneration || destroyed || !mounted) {
          throw new Error("calendar range service is stale");
        }
        if (typeof listener !== "function") throw new TypeError("calendar range listener must be a function");
        if (!request || typeof request !== "object" || Array.isArray(request) || !Array.isArray(request.ranges) || request.ranges.length === 0) {
          throw new TypeError("calendar range request requires ranges");
        }
        const normalizedRanges = request.ranges.map((range) => validRange(range, allowed));
        const requestedSources = new Set();
        for (const range of normalizedRanges) {
          if (requestedSources.has(range.entity_id)) {
            throw new TypeError(`duplicate calendar range source: ${range.entity_id}`);
          }
          requestedSources.add(range.entity_id);
        }

        const consumer = {
          active: true,
          ready: false,
          generation,
          listener,
          records: [],
        };
        for (const range of normalizedRanges) {
          const key = rangeKey(range);
          let record = rangeRecords.get(key);
          let created = false;
          if (!record) {
            record = {
              key,
              entityId: range.entity_id,
              startDate: range.start_date,
              endDate: range.end_date,
              timeZone,
              status: "pending",
              reason: null,
              events: EMPTY_EVENTS,
              consumers: new Set(),
              active: true,
              setupToken: 0,
              remoteUnsubscribe: null,
            };
            rangeRecords.set(key, record);
            created = true;
          }
          record.consumers.add(consumer);
          consumer.records.push(record);
          if (created) startRemote(record);
        }
        consumer.ready = true;
        notifyConsumer(consumer);

        let active = true;
        return () => {
          if (!active) return false;
          active = false;
          consumer.active = false;
          for (const record of consumer.records) releaseRecord(record, consumer);
          consumer.records.length = 0;
          return true;
        };
      },
    });
  };

  const publishTopLevel = () => {
    if (!capabilityHandle) return;
    if (config.source_entity_ids.length === 0) {
      capabilityHandle.notConfigured("no_calendar_sources");
      return;
    }
    if (homeAssistant().connectionState() !== "connected") {
      capabilityHandle.unavailable("home_assistant_disconnected");
      return;
    }
    if (!homeAssistant().timeZone()) {
      capabilityHandle.unavailable("timezone_unavailable");
      return;
    }
    capabilityHandle.available(makeService());
  };

  const replaceService = () => {
    serviceGeneration += 1;
    clearRanges();
    publishTopLevel();
  };

  const handleSourceState = (entityId, nextState) => {
    const previous = sourceStates.get(entityId) ?? null;
    sourceStates.set(entityId, nextState ?? null);
    const previousName = sourceName(entityId, previous);
    const nextName = sourceName(entityId, nextState);
    if (previousName !== nextName) {
      replaceService();
      return;
    }
    for (const record of rangeRecords.values()) {
      if (record.entityId !== entityId || !record.active) continue;
      const availability = sourceAvailability(nextState);
      if (availability.status !== "available") {
        setUnavailable(record, availability.reason, { stop: true });
      } else if (record.status === "unavailable") {
        startRemote(record);
      }
    }
  };

  const bindRuntime = () => {
    capabilityHandle = context.capabilities.register("provider.calendar", "calendar.events");
    for (const entityId of config.source_entity_ids) {
      sourceStates.set(entityId, homeAssistant().getState(entityId));
      entityUnsubscribes.set(entityId, homeAssistant().subscribeEntity(
        entityId,
        (state) => handleSourceState(entityId, state),
        { emitCurrent: false },
      ));
    }
    connectionUnsubscribe = homeAssistant().subscribeConnection((nextState) => {
      if (!mounted) return;
      if (nextState === "connected") {
        for (const entityId of config.source_entity_ids) sourceStates.set(entityId, homeAssistant().getState(entityId));
      }
      replaceService();
    }, { emitCurrent: false });
    serviceGeneration += 1;
    publishTopLevel();
  };

  const unbindRuntime = ({ unregisterCapability = true } = {}) => {
    serviceGeneration += 1;
    clearRanges();
    invokeUnsubscribe(connectionUnsubscribe);
    connectionUnsubscribe = null;
    for (const unsubscribe of entityUnsubscribes.values()) invokeUnsubscribe(unsubscribe);
    entityUnsubscribes.clear();
    sourceStates.clear();
    if (unregisterCapability) capabilityHandle?.unregister();
    capabilityHandle = null;
  };

  return Object.freeze({
    mount() {
      if (destroyed || mounted) return false;
      mounted = true;
      bindRuntime();
      return true;
    },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("calendar provider is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateCalendarProviderConfig(nextConfig);
      if (!mounted) {
        context = validatedContext;
        config = validatedConfig;
        return true;
      }
      unbindRuntime();
      context = validatedContext;
      config = validatedConfig;
      bindRuntime();
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      if (mounted) unbindRuntime();
      mounted = false;
      return true;
    },
  });
}
