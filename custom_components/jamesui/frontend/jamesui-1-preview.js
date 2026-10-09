import { createJamesUICore } from "./core/index.js";
import { createDashboardPageComposer } from "./core/dashboard-page-composer.js";
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
  const composer = createDashboardPageComposer({
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
  const activeProviders = [];
  return Object.freeze({
    async mount(target) {
      if (mounted) throw new Error("Preview is already mounted");
      await core.config.load();
      const config = core.config.snapshot();
      if (!config?.pages?.home || config.pages.home.kind !== "dashboard") {
        throw new Error("No configured JamesUI 1.0 dashboard. Existing r11 data is not auto-migrated.");
      }
      try {
      // Provider definitions come from the canonical persisted data_sources section.
      // Missing entries remain unavailable; never invent Home Assistant entity bindings.
      for (const [manifest] of registered) {
        if (manifest.type !== "provider") continue;
        const source = config.data_sources[manifest.id];
        if (!source) continue;
        const instanceConfig = source.config ?? source;
        if (!await core.moduleLoader.load(manifest.id, { config: instanceConfig })) {
          throw new Error(`Unable to load configured provider: ${manifest.id}`);
        }
        if (!core.moduleLoader.mount(manifest.id, target)) {
          throw new Error(`Unable to mount configured provider: ${manifest.id}`);
        }
        activeProviders.push(manifest.id);
      }
      core.mount(target);
      const page = target.querySelector('[data-role="page-region"]') ??
        target.querySelector("main");
      if (!page) throw new Error("Preview shell has no page host");
      await composer.mount(page, "home");
      mounted = true;
      return true;
      } catch (error) {
        composer.destroy();
        for (const id of activeProviders.splice(0)) core.moduleLoader.destroy(id);
        throw error;
      }
    },
    destroy() {
      composer.destroy();
      for (const id of activeProviders.splice(0)) core.moduleLoader.destroy(id);
      core.destroy();
      mounted = false;
    },
    get core() { return core; },
  });
}
