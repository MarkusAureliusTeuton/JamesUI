import { createJamesUICore } from "./core/index.js";
import { createDashboardPageComposer } from "./core/dashboard-page-composer.js";
import { MANIFEST as WEATHER } from "./modules/widget.weather-today/manifest.js";
import { MANIFEST as AGENDA } from "./modules/widget.calendar-agenda/manifest.js";
import { MANIFEST as HOUSE } from "./modules/widget.house-quick/manifest.js";
import { MANIFEST as BUTTONS } from "./modules/widget.dynamic-buttons/manifest.js";

// Explicit opt-in preview. Neither the r11 panel nor its bootstrap imports this.
export function createJamesUI1Preview({ document = globalThis.document } = {}) {
  const core = createJamesUICore({ document });
  const composer = createDashboardPageComposer({
    document, moduleLoader: core.moduleLoader, moduleRegistry: core.moduleRegistry,
    configService: core.config, getConfig: () => core.config.snapshot(),
  });
  const registered = [
    [WEATHER, "./modules/widget.weather-today/index.js"],
    [AGENDA, "./modules/widget.calendar-agenda/index.js"],
    [HOUSE, "./modules/widget.house-quick/index.js"],
    [BUTTONS, "./modules/widget.dynamic-buttons/index.js"],
  ];
  for (const [manifest, relative] of registered) {
    core.moduleRegistry.register(manifest, {
      entryUrl: new URL(relative, import.meta.url).href,
    });
  }
  let mounted = false;
  return Object.freeze({
    async mount(target) {
      if (mounted) throw new Error("Preview is already mounted");
      await core.config.load();
      const config = core.config.snapshot();
      if (!config?.pages?.home || config.pages.home.kind !== "dashboard") {
        throw new Error("No configured JamesUI 1.0 dashboard. Existing r11 data is not auto-migrated.");
      }
      core.mount(target);
      const page = target.querySelector('[data-role="page-region"]') ??
        target.querySelector("main");
      if (!page) throw new Error("Preview shell has no page host");
      await composer.mount(page, "home");
      mounted = true;
      return true;
    },
    destroy() {
      composer.destroy();
      core.destroy();
      mounted = false;
    },
    get core() { return core; },
  });
}
