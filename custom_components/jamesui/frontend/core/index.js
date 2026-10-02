import { createRouter } from "./router.js";
import { createEventBus } from "./event-bus.js";
import { createOverlayService } from "./overlay-service.js";
import { createHealthService } from "./health-service.js";
import { createHostContext } from "./host-context.js";
import { createAppShell } from "./shell.js";
import { createModuleRegistry } from "./module-registry.js";
import { createModuleLoader } from "./module-loader.js";

export function createJamesUICore({ document = globalThis.document, renderPage } = {}) {
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
  const router = createRouter();
  const overlays = createOverlayService();
  const moduleRegistry = createModuleRegistry();
  const moduleLoader = createModuleLoader({
    registry: moduleRegistry,
    health,
    getContext: () => Object.freeze({ events, overlays }),
  });
  const hostContext = createHostContext({ events });
  const shell = createAppShell({
    document,
    router,
    overlays,
    health,
    getContext: () => hostContext.snapshot(),
    renderPage,
  });

  const core = {
    mount(target) {
      return shell.mount(target);
    },
    destroy() {
      moduleLoader.destroyAll();
      shell.destroy();
    },
    navigate(routeId) {
      return router.navigate(routeId);
    },
    getHostContext() {
      return hostContext.snapshot();
    },
    get hass() { return hostContext.get("hass"); },
    set hass(value) { hostContext.set("hass", value); },
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
  });

  return core;
}
