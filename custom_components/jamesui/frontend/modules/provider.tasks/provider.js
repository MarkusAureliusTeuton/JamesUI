import { todoCapabilities } from "../../shared/todo-features.js";
import { validateTasksProviderConfig } from "./config.js";
import { normalizeTodoItems } from "./normalize.js";

const EMPTY_ITEMS = Object.freeze([]);
const UNAVAILABLE_STATES = new Set(["unknown", "unavailable"]);

function requireContext(context) {
  if (!context?.capabilities || typeof context.capabilities.register !== "function") {
    throw new TypeError("tasks provider requires capabilities");
  }
  const homeAssistant = context.homeAssistant;
  for (const method of [
    "connectionState", "timeZone", "getState", "subscribeConnection", "subscribeEntity", "subscribeMessage",
  ]) {
    if (!homeAssistant || typeof homeAssistant[method] !== "function") {
      throw new TypeError(`tasks provider requires homeAssistant.${method}`);
    }
  }
  return context;
}

function sourceName(entityId, state) {
  const value = state?.attributes?.friendly_name;
  return typeof value === "string" && value.trim() ? value.trim() : entityId;
}

function supportedFeatures(state) {
  const value = state?.attributes?.supported_features;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function sourceAvailability(state) {
  if (!state) return { status: "unavailable", reason: "source_missing" };
  if (UNAVAILABLE_STATES.has(state.state)) return { status: "unavailable", reason: "source_unavailable" };
  return { status: "available", reason: null };
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try {
    Promise.resolve(unsubscribe()).catch(() => {});
  } catch {
    // Cleanup is best-effort; generation guards already make stale callbacks inert.
  }
}

function frozenSource(record) {
  const features = supportedFeatures(record.state);
  return Object.freeze({
    status: record.status,
    reason: record.reason,
    name: sourceName(record.entityId, record.state),
    supported_features: features,
    capabilities: todoCapabilities(features),
    items: record.status === "available" ? record.items : EMPTY_ITEMS,
  });
}

function semanticSnapshot(value) {
  if (!value) return null;
  const sources = {};
  for (const [entityId, source] of Object.entries(value.sources)) {
    sources[entityId] = {
      status: source.status,
      reason: source.reason,
      name: source.name,
      supported_features: source.supported_features,
      capabilities: source.capabilities,
      items: source.items,
    };
  }
  return JSON.stringify({ version: value.version, time_zone: value.time_zone, sources });
}

export function createTasksProvider(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateTasksProviderConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let capabilityHandle = null;
  let connectionUnsubscribe = null;
  let generation = 0;
  let lastSemantic = null;
  const entityUnsubscribes = new Map();
  const sourceRecords = new Map();

  const homeAssistant = () => context.homeAssistant;

  const stopRemote = (record) => {
    record.subscribeToken += 1;
    const unsubscribe = record.remoteUnsubscribe;
    record.remoteUnsubscribe = null;
    invokeUnsubscribe(unsubscribe);
  };

  const markTopLevelInitializing = () => {
    lastSemantic = null;
    capabilityHandle?.unavailable("initializing");
  };

  const buildValue = () => {
    const sources = {};
    for (const entityId of config.source_entity_ids) {
      const record = sourceRecords.get(entityId);
      if (!record) return null;
      sources[entityId] = frozenSource(record);
    }
    return Object.freeze({
      version: 1,
      time_zone: homeAssistant().timeZone(),
      sources: Object.freeze(sources),
    });
  };

  const publishIfReady = () => {
    if (!capabilityHandle || !mounted || destroyed) return;
    if (config.source_entity_ids.length === 0) {
      lastSemantic = null;
      capabilityHandle.notConfigured("no_task_sources");
      return;
    }
    if (homeAssistant().connectionState() !== "connected") {
      lastSemantic = null;
      capabilityHandle.unavailable("home_assistant_disconnected");
      return;
    }
    if (!homeAssistant().timeZone()) {
      lastSemantic = null;
      capabilityHandle.unavailable("timezone_unavailable");
      return;
    }
    if (config.source_entity_ids.some((entityId) => sourceRecords.get(entityId)?.status === "pending")) {
      markTopLevelInitializing();
      return;
    }
    const value = buildValue();
    if (!value) return;
    const nextSemantic = semanticSnapshot(value);
    if (nextSemantic === lastSemantic) return;
    lastSemantic = nextSemantic;
    capabilityHandle.available(value);
  };

  const markSourceUnavailable = (record, reason, { stop = false } = {}) => {
    if (!record.active) return;
    if (stop) stopRemote(record);
    record.status = "unavailable";
    record.reason = reason;
    record.items = EMPTY_ITEMS;
    publishIfReady();
  };

  const startRemote = (record) => {
    if (!record.active || destroyed || !mounted) return;
    const availability = sourceAvailability(record.state);
    if (availability.status !== "available") {
      markSourceUnavailable(record, availability.reason, { stop: true });
      return;
    }

    stopRemote(record);
    record.status = "pending";
    record.reason = null;
    record.items = EMPTY_ITEMS;
    markTopLevelInitializing();

    const token = record.subscribeToken;
    const currentGeneration = generation;
    const onPayload = (payload) => {
      if (!record.active || record.subscribeToken !== token || generation !== currentGeneration || destroyed) return;
      if (!payload || !Array.isArray(payload.items)) {
        markSourceUnavailable(record, "fetch_failed");
        return;
      }
      record.status = "available";
      record.reason = null;
      record.items = normalizeTodoItems(record.entityId, payload.items);
      publishIfReady();
    };

    Promise.resolve(homeAssistant().subscribeMessage(onPayload, {
      type: "todo/item/subscribe",
      entity_id: record.entityId,
    })).then((unsubscribe) => {
      if (!record.active || record.subscribeToken !== token || generation !== currentGeneration || destroyed) {
        invokeUnsubscribe(unsubscribe);
        return;
      }
      record.remoteUnsubscribe = unsubscribe;
    }).catch(() => {
      if (!record.active || record.subscribeToken !== token || generation !== currentGeneration || destroyed) return;
      markSourceUnavailable(record, "subscription_failed");
    });
  };

  const handleEntityState = (entityId, nextState) => {
    const record = sourceRecords.get(entityId);
    if (!record || !record.active) return;
    const previousAvailability = sourceAvailability(record.state);
    const previousName = sourceName(entityId, record.state);
    const previousFeatures = supportedFeatures(record.state);
    record.state = nextState ?? null;
    const nextAvailability = sourceAvailability(record.state);
    const nextName = sourceName(entityId, record.state);
    const nextFeatures = supportedFeatures(record.state);

    if (nextAvailability.status !== "available") {
      markSourceUnavailable(record, nextAvailability.reason, { stop: true });
      return;
    }
    if (previousAvailability.status !== "available") {
      startRemote(record);
      return;
    }
    if (record.status === "unavailable") {
      startRemote(record);
      return;
    }
    if (previousName !== nextName || previousFeatures !== nextFeatures) publishIfReady();
  };

  const createRecords = () => {
    sourceRecords.clear();
    for (const entityId of config.source_entity_ids) {
      sourceRecords.set(entityId, {
        entityId,
        state: homeAssistant().getState(entityId),
        status: "pending",
        reason: null,
        items: EMPTY_ITEMS,
        subscribeToken: 0,
        remoteUnsubscribe: null,
        active: true,
      });
    }
  };

  const startSources = () => {
    for (const record of sourceRecords.values()) {
      const availability = sourceAvailability(record.state);
      if (availability.status === "available") startRemote(record);
      else {
        record.status = "unavailable";
        record.reason = availability.reason;
        record.items = EMPTY_ITEMS;
      }
    }
    publishIfReady();
  };

  const bindRuntime = () => {
    capabilityHandle = context.capabilities.register("provider.tasks", "tasks.items");
    generation += 1;
    lastSemantic = null;
    createRecords();

    for (const [entityId, record] of sourceRecords) {
      entityUnsubscribes.set(entityId, homeAssistant().subscribeEntity(
        entityId,
        (state) => handleEntityState(entityId, state),
        { emitCurrent: false },
      ));
      record.state = homeAssistant().getState(entityId);
    }

    connectionUnsubscribe = homeAssistant().subscribeConnection((nextState) => {
      if (!mounted || destroyed) return;
      generation += 1;
      lastSemantic = null;
      for (const record of sourceRecords.values()) {
        stopRemote(record);
        record.items = EMPTY_ITEMS;
        record.state = nextState === "connected" ? homeAssistant().getState(record.entityId) : null;
        if (nextState === "connected") {
          const availability = sourceAvailability(record.state);
          record.status = availability.status === "available" ? "pending" : "unavailable";
          record.reason = availability.reason;
        } else {
          record.status = "unavailable";
          record.reason = "home_assistant_disconnected";
        }
      }
      if (nextState !== "connected") {
        publishIfReady();
        return;
      }
      startSources();
    }, { emitCurrent: false });

    if (config.source_entity_ids.length === 0) {
      publishIfReady();
      return;
    }
    if (homeAssistant().connectionState() !== "connected" || !homeAssistant().timeZone()) {
      publishIfReady();
      return;
    }
    startSources();
  };

  const unbindRuntime = ({ unregisterCapability = true } = {}) => {
    generation += 1;
    lastSemantic = null;
    invokeUnsubscribe(connectionUnsubscribe);
    connectionUnsubscribe = null;
    for (const unsubscribe of entityUnsubscribes.values()) invokeUnsubscribe(unsubscribe);
    entityUnsubscribes.clear();
    for (const record of sourceRecords.values()) {
      record.active = false;
      stopRemote(record);
    }
    sourceRecords.clear();
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
      if (destroyed) throw new Error("tasks provider is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateTasksProviderConfig(nextConfig);
      if (!mounted) {
        context = validatedContext;
        config = validatedConfig;
        return true;
      }
      const previousContext = context;
      const previousConfig = config;
      unbindRuntime();
      context = validatedContext;
      config = validatedConfig;
      try {
        bindRuntime();
        return true;
      } catch (error) {
        // A partially bound replacement must not leave stale subscriptions or
        // disable a previously healthy provider. Restore the last valid config.
        try { unbindRuntime(); } catch { /* Best-effort cleanup of the attempted binding. */ }
        context = previousContext;
        config = previousConfig;
        bindRuntime();
        throw error;
      }
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
