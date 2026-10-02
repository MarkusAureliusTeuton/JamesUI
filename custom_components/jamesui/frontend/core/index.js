import { createRouter } from "./router.js";
import { createEventBus } from "./event-bus.js";
import { createOverlayService } from "./overlay-service.js";
import { createHealthService } from "./health-service.js";
import { createHostContext } from "./host-context.js";
import { createAppShell } from "./shell.js";

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
  const hostContext = createHostContext({ events });
  const shell = createAppShell({
    document,
    router,
    overlays,
    health,
    getContext: () => hostContext.snapshot(),
    renderPage,
  });

  return {
    router,
    events,
    overlays,
    health,
    mount(target) {
      return shell.mount(target);
    },
    destroy() {
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
}
