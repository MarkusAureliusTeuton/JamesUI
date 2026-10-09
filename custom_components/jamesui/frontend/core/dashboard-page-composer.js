import { create as createHeroDeck } from "../modules/layout.home-hero-deck/index.js";
import { createDashboardGrid } from "./dashboard-grid.js";
import { createDashboardWidgetHosts } from "./dashboard-widget-hosts.js";
import { validateDashboardPage } from "./dashboard-config.js";

// Page composition owns one layout instance, one grid and the weather hero.
// Its DOM is independent of the persistent Core shell and navigation.
export function createDashboardPageComposer({ document, moduleLoader, getConfig } = {}) {
  if (!document || typeof document.createElement !== "function") throw new TypeError("Dashboard composer requires document");
  if (!moduleLoader || typeof moduleLoader.load !== "function") throw new TypeError("Dashboard composer requires Module Loader");
  if (typeof getConfig !== "function") throw new TypeError("Dashboard composer requires getConfig");

  let target = null;
  let layout = null;
  let grid = null;
  let hero = null;
  let pageId = null;
  let generation = 0;

  function destroy() {
    generation += 1;
    grid?.destroy();
    grid = null;
    if (hero) moduleLoader.destroy(hero);
    hero = null;
    layout?.destroy();
    layout = null;
    target = null;
    pageId = null;
  }

  function mount(nextTarget, nextPageId) {
    if (!nextTarget || typeof nextTarget.appendChild !== "function") throw new TypeError("Dashboard composer requires mount target");
    destroy();
    target = nextTarget;
    pageId = nextPageId;
    return render();
  }

  async function render() {
    if (!target) throw new Error("Dashboard composer must be mounted");
    const config = getConfig();
    const page = validateDashboardPage(config, pageId);
    const token = ++generation;
    // A change of layout invalidates all previous element mounts.
    if (layout) {
      grid?.destroy();
      grid = null;
      if (hero) moduleLoader.destroy(hero);
      hero = null;
      layout.destroy();
      layout = null;
    }

    if (page.layout.kind === "hero-deck") {
      layout = createHeroDeck({}, { hero_ratio: page.layout.hero_ratio });
      layout.mount(target);
      const heroSlot = layout.getSlot("hero");
      const definition = config.widget_instances[config.pages[pageId].hero_widget_id];
      if (definition) {
        hero = `dashboard:${pageId}:hero`;
        const heroId = hero;
        const loaded = await moduleLoader.load(definition.module_id, { instanceId: heroId, config: definition.config ?? {} });
        if (token !== generation) {
          if (loaded) moduleLoader.destroy(heroId);
          return false;
        }
        if (loaded) moduleLoader.mount(heroId, heroSlot);
      }
      if (token !== generation) return false;
    } else {
      layout = {
        getSlot: (name) => name === "content" ? target : null,
        destroy() {},
      };
    }

    const gridHost = layout.getSlot("content");
    const hosts = createDashboardWidgetHosts({
      moduleLoader,
      getConfig: (id) => getConfig().widget_instances[id],
      getButtonDefinitions: () => getConfig().dynamic_buttons,
    });
    grid = createDashboardGrid({ document, createItemHost: hosts });
    grid.mount(gridHost);
    grid.render(page.elements, { scroll: page.layout.scroll });
    return true;
  }

  return Object.freeze({ mount, render, destroy });
}
