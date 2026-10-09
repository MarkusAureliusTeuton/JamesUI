import { validateControlStateConfig } from "./config.js";
import { normalizeControlState } from "./normalize.js";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireContext(context) {
  if (!context?.capabilities || typeof context.capabilities.register !== "function") {
    throw new TypeError("control state provider requires capabilities");
  }
  const homeAssistant = context.homeAssistant;
  for (const method of ["connectionState", "getState", "subscribeEntity", "subscribeConnection"]) {
    if (!homeAssistant || typeof homeAssistant[method] !== "function") {
      throw new TypeError(`control state provider requires homeAssistant.${method}`);
    }
  }
  return context;
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try { Promise.resolve(unsubscribe()).catch(() => {}); } catch { /* best effort */ }
}

function stateSnapshot(sourceId, normalized, revision) {
  return Object.freeze({
    source_id: sourceId,
    status: normalized.status,
    detail: normalized.detail,
    revision,
    reason: normalized.reason,
  });
}

function sameNormalized(a, b) {
  return a.status === b.status && a.detail === b.detail && a.reason === b.reason;
}

export function createControlStateProvider(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateControlStateConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let capabilityHandle = null;
  let connectionUnsubscribe = null;
  let serviceGeneration = 0;
  const sourceRecords = new Map();
  const entityBindings = new Map();
  const consumers = new Set();

  const homeAssistant = () => context.homeAssistant;
  const sourceMap = () => new Map(config.sources.map((source) => [source.id, source]));

  const notifyConsumer = (consumer) => {
    if (!consumer.active || consumer.generation !== serviceGeneration) return;
    const states = consumer.sourceIds.map((sourceId) => sourceRecords.get(sourceId)?.current).filter(Boolean);
    if (states.length !== consumer.sourceIds.length) return;
    try { consumer.listener(Object.freeze({ states: Object.freeze(states) })); } catch { /* isolate consumers */ }
  };

  const updateRecord = (record, entity) => {
    if (!record.active || record.generation !== serviceGeneration) return false;
    const normalized = normalizeControlState(record.source, entity);
    if (sameNormalized(record.normalized, normalized)) return false;
    record.normalized = normalized;
    record.revision += 1;
    record.current = stateSnapshot(record.source.id, normalized, record.revision);
    return true;
  };

  const ensureEntityBinding = (record) => {
    const entityId = record.source.entity_id;
    let binding = entityBindings.get(entityId);
    if (!binding) {
      binding = { records: new Set(), unsubscribe: null };
      entityBindings.set(entityId, binding);
      binding.unsubscribe = homeAssistant().subscribeEntity(entityId, (entity) => {
        const changedConsumers = new Set();
        for (const currentRecord of [...binding.records]) {
          if (!updateRecord(currentRecord, entity)) continue;
          for (const consumer of currentRecord.consumers) changedConsumers.add(consumer);
        }
        for (const consumer of changedConsumers) notifyConsumer(consumer);
      }, { emitCurrent: false });
    }
    binding.records.add(record);
  };

  const releaseEntityBinding = (record) => {
    const entityId = record.source.entity_id;
    const binding = entityBindings.get(entityId);
    if (!binding) return;
    binding.records.delete(record);
    if (binding.records.size !== 0) return;
    invokeUnsubscribe(binding.unsubscribe);
    entityBindings.delete(entityId);
  };

  const createRecord = (source) => {
    const normalized = normalizeControlState(source, homeAssistant().getState(source.entity_id));
    const record = {
      source,
      normalized,
      revision: 0,
      current: stateSnapshot(source.id, normalized, 0),
      consumers: new Set(),
      generation: serviceGeneration,
      active: true,
    };
    sourceRecords.set(source.id, record);
    ensureEntityBinding(record);
    return record;
  };

  const releaseRecord = (record, consumer) => {
    record.consumers.delete(consumer);
    if (record.consumers.size !== 0) return;
    record.active = false;
    releaseEntityBinding(record);
    if (sourceRecords.get(record.source.id) === record) sourceRecords.delete(record.source.id);
  };

  const clearServiceRuntime = () => {
    for (const consumer of consumers) consumer.active = false;
    consumers.clear();
    for (const record of sourceRecords.values()) record.active = false;
    sourceRecords.clear();
    for (const binding of entityBindings.values()) invokeUnsubscribe(binding.unsubscribe);
    entityBindings.clear();
  };

  const validateRequest = (request, configured) => {
    if (!isPlainObject(request) || !Array.isArray(request.source_ids) || request.source_ids.length === 0) {
      throw new TypeError("control state subscription requires non-empty source_ids");
    }
    for (const key of Object.keys(request)) {
      if (key !== "source_ids") throw new TypeError(`control state request contains unsupported field: ${key}`);
    }
    const seen = new Set();
    return Object.freeze(request.source_ids.map((sourceId, index) => {
      if (typeof sourceId !== "string" || sourceId.trim() === "") throw new TypeError(`source_ids[${index}] must be a non-empty string`);
      const id = sourceId.trim();
      if (seen.has(id)) throw new TypeError(`duplicate source_id: ${id}`);
      if (!configured.has(id)) throw new TypeError(`control state source is not configured: ${id}`);
      seen.add(id);
      return id;
    }));
  };

  const makeService = () => {
    const generation = serviceGeneration;
    const configured = sourceMap();
    const configuredSources = Object.freeze(config.sources.map((source) => Object.freeze({ id: source.id })));
    return Object.freeze({
      version: 1,
      configured_sources: configuredSources,
      subscribe(request, listener) {
        if (generation !== serviceGeneration || destroyed || !mounted) throw new Error("control state service is stale");
        if (typeof listener !== "function") throw new TypeError("control state listener must be a function");
        const sourceIds = validateRequest(request, configured);
        const consumer = { active: true, generation, sourceIds, listener };
        consumers.add(consumer);
        for (const sourceId of sourceIds) {
          const source = configured.get(sourceId);
          const record = sourceRecords.get(sourceId) ?? createRecord(source);
          record.consumers.add(consumer);
        }
        notifyConsumer(consumer);
        let active = true;
        return () => {
          if (!active) return false;
          active = false;
          consumer.active = false;
          consumers.delete(consumer);
          for (const sourceId of sourceIds) {
            const record = sourceRecords.get(sourceId);
            if (record) releaseRecord(record, consumer);
          }
          return true;
        };
      },
    });
  };

  const publishTopLevel = () => {
    if (!capabilityHandle) return;
    if (config.sources.length === 0) {
      capabilityHandle.notConfigured("no_control_state_sources");
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
    clearServiceRuntime();
    publishTopLevel();
  };

  const bindRuntime = () => {
    capabilityHandle = context.capabilities.register("provider.control-state", "control.states");
    serviceGeneration += 1;
    publishTopLevel();
    connectionUnsubscribe = homeAssistant().subscribeConnection(() => replaceService(), { emitCurrent: false });
  };

  const unbindRuntime = () => {
    serviceGeneration += 1;
    clearServiceRuntime();
    invokeUnsubscribe(connectionUnsubscribe);
    connectionUnsubscribe = null;
    capabilityHandle?.unregister();
    capabilityHandle = null;
  };

  return Object.freeze({
    mount() {
      if (destroyed || mounted) return false;
      mounted = true;
      try {
        bindRuntime();
        return true;
      } catch (error) {
        mounted = false;
        try { unbindRuntime(); } catch { /* cleanup */ }
        throw error;
      }
    },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("control state provider is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateControlStateConfig(nextConfig);
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
        try { unbindRuntime(); } catch { /* best effort */ }
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
