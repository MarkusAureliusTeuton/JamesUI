import { moveDashboardElement, validateDashboardPage } from "./dashboard-config.js";

// Config Service is the sole persistence owner. The orchestrator resolves the
// latest loaded snapshot for each edit and never persists unsuccessful previews.
export function createDashboardController({ configService } = {}) {
  if (!configService ||
    typeof configService.snapshot !== "function" ||
    typeof configService.update !== "function") {
    throw new TypeError("Dashboard controller requires the canonical Config Service");
  }

  return Object.freeze({
    getPage(pageId) {
      const current = configService.snapshot();
      if (current === null) throw new Error("JamesUI config must be loaded");
      return validateDashboardPage(current, pageId);
    },

    previewMove(pageId, elementId, geometry, options = {}) {
      const current = configService.snapshot();
      if (current === null) throw new Error("JamesUI config must be loaded");
      const next = moveDashboardElement(current, pageId, elementId, geometry, options);
      return next === null ? null : validateDashboardPage(next, pageId);
    },

    // No write on impossible moves. The mutator runs inside Config Service's
    // serialized edit queue, not against an out-of-date preview snapshot.
    async move(pageId, elementId, geometry, options = {}) {
      const result = await configService.update((latest) =>
        moveDashboardElement(latest, pageId, elementId, geometry, options));
      return result === null ? null : validateDashboardPage(result, pageId);
    },
  });
}
