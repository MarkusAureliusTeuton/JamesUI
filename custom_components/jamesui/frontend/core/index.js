import { createDesignSystem } from "../design/design-system.js";
import { createHomeAssistantAdapter } from "../ha/home-assistant-adapter.js";
import { registerHomeAssistantActionProviders } from "../ha/ha-action-providers.js";
import { createRouter } from "./router.js";
import { CORE_ROUTES } from "./routes.js";
import { createEventBus } from "./event-bus.js";
import { createOverlayService } from "./overlay-service.js";
import { createHealthService } from "./health-service.js";
import { createHostContext } from "./host-context.js";
import { createAppShell } from "./shell.js";
import { createModuleRegistry } from "./module-registry.js";
import { createModuleLoader } from "./module-loader.js";
import { createCapabilityRegistry } from "./capability-registry.js";
import { createActionRegistry } from "./action-registry.js";
import { registerCoreActionProviders } from "./core-action-providers.js";
import { createConfigService } from "./config-service.js";

function defaultOpenUrl(url) {
  if (typeof globalThis.open !== "function") return false;
  return globalThis.open(url, "_blank", "noopener,noreferrer") !== null;
}

export function createJamesUICore({ document = globalThis.document, renderPage, availableRoutes = null, openUrl = defaultOpenUrl } = {}) {
  const health = createHealthService();
  const events = createEventBus({
    onError: ({ type, error }) => {
      health.report("core:event-bus", {
        status: "error",
        message: `Event listener failed: ${type}`,
        error,
      });
    },
  });
  const routes = availableRoutes === null ? CORE_ROUTES : CORE_ROUTES.filter((route) => availableRoutes.includes(route.id));
  const router = createRouter({ routes });
  const overlays = createOverlayService();
  const moduleRegistry = createModuleRegistry();
  const capabilities = createCapabilityRegistry({ moduleRegistry });
  const actions = createActionRegistry({ health });
  const homeAssistant = createHomeAssistantAdapter({
    onSubscriberError: ({ kind, key, error }) => {
      health.report("core:home-assistant-adapter", {
        status: "error",
        message: `Home Assistant ${kind} subscriber failed${key ? `: ${key}` : ""}`,
        error,
      });
    },
  });
  const config = createConfigService({ homeAssistant });
  const designSystem = createDesignSystem({ document });
  const unregisterCoreActions = registerCoreActionProviders({ actions, router, openUrl });
  const unregisterHomeAssistantActions = registerHomeAssistantActionProviders({ actions, homeAssistant });
  const moduleLoader = createModuleLoader({
    registry: moduleRegistry,
    health,
    getContext: ({ id, manifest }) => {
      const context = {
        events,
        overlays,
        capabilities,
        actions,
        module: Object.freeze({ id, type: manifest.type, version: manifest.version }),
      };
      if (manifest.type === "provider" || manifest.type === "action") {
        context.homeAssistant = homeAssistant;
      }
      return Object.freeze(context);
    },
  });
  const hostContext = createHostContext({ events });
  const shell = createAppShell({
    document,
    router,
    overlays,
    health,
    designSystem,
    getContext: () => hostContext.snapshot(),
    renderPage,
    availableRoutes,
  });

  const core = {
    mount(target) {
      return shell.mount(target);
    },
    destroy() {
      moduleLoader.destroyAll();
      unregisterCoreActions();
      unregisterHomeAssistantActions();
      config.destroy();
      homeAssistant.destroy();
      capabilities.destroy();
      actions.destroy();
      shell.destroy();
    },
    navigate(routeId) {
      return router.navigate(routeId);
    },
    getHostContext() {
      return hostContext.snapshot();
    },
    get hass() { return hostContext.get("hass"); },
    set hass(value) {
      homeAssistant.setHass(value);
      hostContext.set("hass", value);
    },
    get narrow() { return hostContext.get("narrow"); },
    set narrow(value) { hostContext.set("narrow", value); },
    get route() { return hostContext.get("route"); },
    set route(value) { hostContext.set("route", value); },
    get panel() { return hostContext.get("panel"); },
    set panel(value) { hostContext.set("panel", value); },
  };

  Object.defineProperties(core, {
    router: { value: router, enumerable: true },
    events: { value: events, enumerable: true },
    overlays: { value: overlays, enumerable: true },
    health: { value: health, enumerable: true },
    moduleRegistry: { value: moduleRegistry, enumerable: true },
    moduleLoader: { value: moduleLoader, enumerable: true },
    capabilities: { value: capabilities, enumerable: true },
    actions: { value: actions, enumerable: true },
    homeAssistant: { value: homeAssistant, enumerable: true },
    config: { value: config, enumerable: true },
  });

  return core;
}
