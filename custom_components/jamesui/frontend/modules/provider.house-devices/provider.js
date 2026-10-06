import { validateHouseDevicesConfig } from "./config.js";
import { normalizeDevices } from "./normalize.js";

function requireContext(context) {
  if (!context?.capabilities || typeof context.capabilities.register !== "function") throw new TypeError("house devices provider requires capabilities");
  const homeAssistant = context.homeAssistant;
  for (const method of ["connectionState", "getState", "subscribeConnection", "subscribeEntity"]) {
    if (!homeAssistant || typeof homeAssistant[method] !== "function") throw new TypeError(`house devices provider requires homeAssistant.${method}`);
  }
  return context;
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try { Promise.resolve(unsubscribe()).catch(() => {}); } catch { /* best effort */ }
}

function configuredEntityIds(config) {
  const ids = new Set();
  for (const item of config.devices) {
    ids.add(item.primary_entity_id);
    for (const key of ["active", "update_available", "warning", "fault"]) if (item[key]) ids.add(item[key].entity_id);
  }
  return ids;
}

export function createHouseDevicesProvider(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateHouseDevicesConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let capabilityHandle = null;
  let connectionUnsubscribe = null;
  const entityUnsubscribes = new Map();
  const homeAssistant = () => context.homeAssistant;

  const publish = () => {
    if (!capabilityHandle) return;
    if (config.devices.length === 0) {
      capabilityHandle.notConfigured("no_devices");
      return;
    }
    if (homeAssistant().connectionState() !== "connected") {
      capabilityHandle.unavailable("home_assistant_disconnected");
      return;
    }
    capabilityHandle.available(normalizeDevices(config.devices, (entityId) => homeAssistant().getState(entityId)));
  };

  const bindRuntime = () => {
    capabilityHandle = context.capabilities.register("provider.house-devices", "house.devices");
    for (const entityId of configuredEntityIds(config)) {
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
    capabilityHandle?.unregister();
    capabilityHandle = null;
  };

  return Object.freeze({
    mount() { if (destroyed || mounted) return false; mounted = true; bindRuntime(); return true; },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("house devices provider is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateHouseDevicesConfig(nextConfig);
      if (!mounted) { context = validatedContext; config = validatedConfig; return true; }
      unbindRuntime();
      context = validatedContext;
      config = validatedConfig;
      bindRuntime();
      return true;
    },
    destroy() { if (destroyed) return false; destroyed = true; if (mounted) unbindRuntime(); mounted = false; return true; },
  });
}
