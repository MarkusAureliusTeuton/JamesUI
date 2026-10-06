import { validateHouseLightingConfig } from "./config.js";
import { normalizeLightGroup } from "./normalize.js";

function requireContext(context) {
  if (!context?.capabilities || typeof context.capabilities.register !== "function") {
    throw new TypeError("house lighting provider requires capabilities");
  }
  const homeAssistant = context.homeAssistant;
  for (const method of ["connectionState", "getState", "subscribeConnection", "subscribeEntity"]) {
    if (!homeAssistant || typeof homeAssistant[method] !== "function") {
      throw new TypeError(`house lighting provider requires homeAssistant.${method}`);
    }
  }
  return context;
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try { Promise.resolve(unsubscribe()).catch(() => {}); } catch { /* best effort */ }
}

function sourceIds(config) {
  return new Set([...config.lights, ...config.ambient_lights].map((item) => item.state.entity_id));
}

export function createHouseLightingProvider(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateHouseLightingConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let lightsHandle = null;
  let ambientHandle = null;
  let connectionUnsubscribe = null;
  const entityUnsubscribes = new Map();

  const homeAssistant = () => context.homeAssistant;

  const publishGroup = (handle, items, emptyReason) => {
    if (items.length === 0) {
      handle.notConfigured(emptyReason);
      return;
    }
    if (homeAssistant().connectionState() !== "connected") {
      handle.unavailable("home_assistant_disconnected");
      return;
    }
    handle.available(normalizeLightGroup(items, (entityId) => homeAssistant().getState(entityId)));
  };

  const publish = () => {
    if (!lightsHandle || !ambientHandle) return;
    publishGroup(lightsHandle, config.lights, "no_light_sources");
    publishGroup(ambientHandle, config.ambient_lights, "no_ambient_light_sources");
  };

  const bindRuntime = () => {
    lightsHandle = context.capabilities.register("provider.house-lighting", "house.lights");
    ambientHandle = context.capabilities.register("provider.house-lighting", "house.ambientLights");
    for (const entityId of sourceIds(config)) {
      entityUnsubscribes.set(entityId, homeAssistant().subscribeEntity(entityId, publish, { emitCurrent: false }));
    }
    connectionUnsubscribe = homeAssistant().subscribeConnection(publish, { emitCurrent: false });
    publish();
  };

  const unbindRuntime = () => {
    invokeUnsubscribe(connectionUnsubscribe);
    connectionUnsubscribe = null;
    for (const unsubscribe of entityUnsubscribes.values()) invokeUnsubscribe(unsubscribe);
    entityUnsubscribes.clear();
    lightsHandle?.unregister();
    ambientHandle?.unregister();
    lightsHandle = null;
    ambientHandle = null;
  };

  return Object.freeze({
    mount() {
      if (destroyed || mounted) return false;
      mounted = true;
      bindRuntime();
      return true;
    },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("house lighting provider is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateHouseLightingConfig(nextConfig);
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
