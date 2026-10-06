import { validateHouseHeatingConfig } from "./config.js";
import { normalizeHeatingZone } from "./normalize.js";

function requireContext(context) {
  if (!context?.capabilities || typeof context.capabilities.register !== "function") {
    throw new TypeError("house heating provider requires capabilities");
  }
  const homeAssistant = context.homeAssistant;
  for (const method of ["connectionState", "getState", "subscribeConnection", "subscribeEntity"]) {
    if (!homeAssistant || typeof homeAssistant[method] !== "function") {
      throw new TypeError(`house heating provider requires homeAssistant.${method}`);
    }
  }
  return context;
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try {
    Promise.resolve(unsubscribe()).catch(() => {});
  } catch {
    // Cleanup is best-effort; stale data is invalidated synchronously.
  }
}

function configuredEntityIds(config) {
  const ids = new Set();
  for (const zone of config.zones) {
    ids.add(zone.current_temperature.entity_id);
    ids.add(zone.target_temperature.entity_id);
    ids.add(zone.heating_demand.entity_id);
    ids.add(zone.auto_regulation_enabled.entity_id);
  }
  return ids;
}

export function createHouseHeatingProvider(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateHouseHeatingConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let capabilityHandle = null;
  let connectionUnsubscribe = null;
  const entityUnsubscribes = new Map();

  const homeAssistant = () => context.homeAssistant;

  const publish = () => {
    if (!capabilityHandle) return;
    if (config.zones.length === 0) {
      capabilityHandle.notConfigured("no_heating_zones");
      return;
    }
    if (homeAssistant().connectionState() !== "connected") {
      capabilityHandle.unavailable("home_assistant_disconnected");
      return;
    }
    const zones = config.zones.map((zone) => normalizeHeatingZone(zone, (entityId) => homeAssistant().getState(entityId)));
    capabilityHandle.available(Object.freeze({ version: 1, zones: Object.freeze(zones) }));
  };

  const bindRuntime = () => {
    capabilityHandle = context.capabilities.register("provider.house-heating", "house.heatingZones");
    for (const entityId of configuredEntityIds(config)) {
      entityUnsubscribes.set(entityId, homeAssistant().subscribeEntity(entityId, publish, { emitCurrent: false }));
    }
    connectionUnsubscribe = homeAssistant().subscribeConnection(publish, { emitCurrent: false });
    publish();
  };

  const unbindRuntime = ({ unregisterCapability = true } = {}) => {
    invokeUnsubscribe(connectionUnsubscribe);
    connectionUnsubscribe = null;
    for (const unsubscribe of entityUnsubscribes.values()) invokeUnsubscribe(unsubscribe);
    entityUnsubscribes.clear();
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
      if (destroyed) throw new Error("house heating provider is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateHouseHeatingConfig(nextConfig);
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
        try { unbindRuntime(); } catch { /* best-effort cleanup of partial next runtime */ }
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
