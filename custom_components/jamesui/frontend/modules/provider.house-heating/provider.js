import { validateHouseHeatingConfig } from "./config.js";
import { normalizeHeatingZone } from "./normalize.js";

function requireContext(context) {
  if (!context?.capabilities || typeof context.capabilities.register !== "function") throw new TypeError("house heating provider requires capabilities");
  for (const method of ["connectionState", "getState", "subscribeEntity", "subscribeConnection"]) {
    if (!context.homeAssistant || typeof context.homeAssistant[method] !== "function") throw new TypeError(`house heating provider requires homeAssistant.${method}`);
  }
  return context;
}
function invoke(unsubscribe) {
  try { unsubscribe?.(); } catch { /* cleanup is best effort */ }
}

export function createHouseHeatingProvider(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateHouseHeatingConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let handle = null;
  let connectionUnsubscribe = null;
  const entityUnsubscribes = new Map();

  const publish = () => {
    if (!mounted || !handle) return;
    if (config.zones.length === 0) { handle.notConfigured("no_heating_zones"); return; }
    if (context.homeAssistant.connectionState() !== "connected") { handle.unavailable("home_assistant_disconnected"); return; }
    const zones = Object.freeze(config.zones.map((zone) => normalizeHeatingZone(zone, (id) => context.homeAssistant.getState(id))));
    handle.available(Object.freeze({ version: 1, zones }));
  };

  const unbindSubscriptions = () => {
    invoke(connectionUnsubscribe); connectionUnsubscribe = null;
    for (const unsubscribe of entityUnsubscribes.values()) invoke(unsubscribe);
    entityUnsubscribes.clear();
  };

  const bindSubscriptions = () => {
    const ids = new Set();
    for (const zone of config.zones) {
      ids.add(zone.current_temperature.entity_id);
      ids.add(zone.target_temperature.entity_id);
      ids.add(zone.heating_demand.entity_id);
      ids.add(zone.auto_regulation_enabled.entity_id);
    }
    for (const id of ids) {
      entityUnsubscribes.set(id, context.homeAssistant.subscribeEntity(id, () => publish(), { emitCurrent: false }));
    }
    connectionUnsubscribe = context.homeAssistant.subscribeConnection(() => publish(), { emitCurrent: false });
  };

  const registerHandle = () => { handle = context.capabilities.register("provider.house-heating", "house.heatingZones"); };

  return Object.freeze({
    mount() {
      if (destroyed || mounted) return false;
      mounted = true;
      registerHandle();
      bindSubscriptions();
      publish();
      return true;
    },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("house heating provider is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateHouseHeatingConfig(nextConfig);
      if (!mounted) { context = validatedContext; config = validatedConfig; return true; }
      const sameRegistry = validatedContext.capabilities === context.capabilities;
      const replacementHandle = sameRegistry
        ? null
        : validatedContext.capabilities.register("provider.house-heating", "house.heatingZones");
      const previousHandle = handle;
      unbindSubscriptions();
      context = validatedContext;
      config = validatedConfig;
      if (!sameRegistry) handle = replacementHandle;
      bindSubscriptions();
      publish();
      if (!sameRegistry) previousHandle?.unregister();
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      unbindSubscriptions();
      handle?.unregister();
      handle = null;
      mounted = false;
      return true;
    },
  });
}
