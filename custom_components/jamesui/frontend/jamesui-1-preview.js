import { createJamesUICore } from "./core/index.js";
import { createConfiguredDashboardPageComposer } from "./modules/dashboard-composition.js";
import { createDashboardPageConfig } from "./core/dashboard-config.js";
import { createDashboardProviderCoordinator } from "./modules/dashboard-provider-coordinator.js";
import { MANIFEST as WEATHER } from "./modules/widget.weather-today/manifest.js";
import { MANIFEST as AGENDA } from "./modules/widget.calendar-agenda/manifest.js";
import { MANIFEST as HOUSE } from "./modules/widget.house-quick/manifest.js";
import { MANIFEST as BUTTONS } from "./modules/widget.dynamic-buttons/manifest.js";

import { MANIFEST as WEATHER_PROVIDER } from "./modules/provider.weather/manifest.js";
import { MANIFEST as CALENDAR_PROVIDER } from "./modules/provider.calendar/manifest.js";
import { MANIFEST as TASKS_PROVIDER } from "./modules/provider.tasks/manifest.js";
import { MANIFEST as HEATING_PROVIDER } from "./modules/provider.house-heating/manifest.js";
import { MANIFEST as LIGHTING_PROVIDER } from "./modules/provider.house-lighting/manifest.js";
import { MANIFEST as DEVICES_PROVIDER } from "./modules/provider.house-devices/manifest.js";
import { MANIFEST as ENERGY_PROVIDER } from "./modules/provider.house-energy/manifest.js";
import { MANIFEST as CONTROL_PROVIDER } from "./modules/provider.control-state/manifest.js";

// Explicit opt-in preview. Neither the r11 panel nor its bootstrap imports this.
export function createJamesUI1Preview({ document = globalThis.document } = {}) {
  const core = createJamesUICore({ document, availableRoutes: ["home"] });
  const composer = createConfiguredDashboardPageComposer({
    document, moduleLoader: core.moduleLoader, moduleRegistry: core.moduleRegistry,
    configService: core.config, getConfig: () => core.config.snapshot(),
  });
  const registered = [
    [WEATHER, "./modules/widget.weather-today/index.js"],
    [AGENDA, "./modules/widget.calendar-agenda/index.js"],
    [HOUSE, "./modules/widget.house-quick/index.js"],
    [BUTTONS, "./modules/widget.dynamic-buttons/index.js"],
    [WEATHER_PROVIDER, "./modules/provider.weather/index.js"],
    [CALENDAR_PROVIDER, "./modules/provider.calendar/index.js"],
    [TASKS_PROVIDER, "./modules/provider.tasks/index.js"],
    [HEATING_PROVIDER, "./modules/provider.house-heating/index.js"],
    [LIGHTING_PROVIDER, "./modules/provider.house-lighting/index.js"],
    [DEVICES_PROVIDER, "./modules/provider.house-devices/index.js"],
    [ENERGY_PROVIDER, "./modules/provider.house-energy/index.js"],
    [CONTROL_PROVIDER, "./modules/provider.control-state/index.js"],
  ];
  for (const [manifest, relative] of registered) {
    core.moduleRegistry.register(manifest, {
      entryUrl: new URL(relative, import.meta.url).href,
    });
  }
  let mounted = false;
  let providerUnsubscribe = null;
  let providerTarget = null;
  const providers = createDashboardProviderCoordinator({
    registered, moduleLoader: core.moduleLoader, getTarget: () => providerTarget,
  });
  return Object.freeze({
    async mount(target) {
      if (mounted) throw new Error("Preview is already mounted");
      await core.config.load();
      let config = core.config.snapshot();
      if (!config.pages.home) {
        // Initialize only the missing page and layout; preserve all migrated settings.
        // This is an intentionally empty, editable dashboard, never a fake HA binding.
        const layoutId = "jamesui-next-home";
        if (config.layouts[layoutId]) {
          throw new Error("Cannot initialize home dashboard: reserved layout ID already exists");
        }
        const initial = createDashboardPageConfig({ pageId: "home", layoutId });
        config = await core.config.replace({
          ...config,
          pages: { ...config.pages, home: initial.page },
          layouts: { ...config.layouts, [layoutId]: initial.layout },
        });
      }
      if (config.pages.home.kind !== "dashboard") {
        throw new Error("JamesUI Next home page is not a dashboard; existing configuration was preserved.");
      }
      try {
        // Provider instances are driven by the same canonical config as the editor.
        // Changes activate immediately after a committed Config Store update.
        providerTarget = target;
        await providers.sync(config);
        core.mount(target);
        const page = target.querySelector('[data-role="page-region"]') ??
          target.querySelector("main");
        if (!page) throw new Error("Preview shell has no page host");
        await composer.mount(page, "home");
        mounted = true;
        providerUnsubscribe = core.config.subscribe((next) => {
          void providers.sync(next).then((success) => {
            if (success) core.health.clear("preview:providers");
          }).catch((error) => {
            core.health.report("preview:providers", {
              status: "error", message: "Configured provider activation failed", error,
            });
          });
        }, { emitCurrent: false });
        return true;
      } catch (error) {
        providerUnsubscribe?.();
        providerUnsubscribe = null;
        composer.destroy();
        providers.destroy();
        core.moduleLoader.destroyAll();
        throw error;
      }
    },
    destroy() {
      providerUnsubscribe?.();
      providerUnsubscribe = null;
      composer.destroy();
      providers.destroy();
      providerTarget = null;
      core.destroy();
      mounted = false;
    },
    get core() { return core; },
  });
}
