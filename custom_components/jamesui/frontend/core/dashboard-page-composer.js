import { createDashboardCatalog, createDashboardCatalogView } from "../modules/dashboard-catalog.js";
import { createDashboardButtonCleanupView } from "../modules/dashboard-button-cleanup.js";
import { removeUnusedDynamicButton } from "../modules/dashboard-resource-usage.js";
import { createDashboardController } from "./dashboard-controller.js";
import { createDashboardEditSession } from "./dashboard-edit-session.js";
import { createDashboardEditorToolbar } from "./dashboard-editor-toolbar.js";
import { createDashboardTouchEditor } from "./dashboard-touch-editor.js";
import { bindDashboardTouchEvents } from "./dashboard-touch-events.js";
import { createDashboardHeroLayout } from "../modules/dashboard-layout-factory.js";
import { createDashboardGrid } from "./dashboard-grid.js";
import { createDashboardWidgetHosts } from "../modules/dashboard-widget-hosts.js";
import { validateDashboardPage } from "./dashboard-config.js";

// Page composition owns one layout instance, one grid and the weather hero.
// Its DOM is independent of the persistent Core shell and navigation.
export function createDashboardPageComposer({ document, moduleLoader, getConfig, configService = null, moduleRegistry = null } = {}) {
  if (!document || typeof document.createElement !== "function") throw new TypeError("Dashboard composer requires document");
  if (!moduleLoader || typeof moduleLoader.load !== "function") throw new TypeError("Dashboard composer requires Module Loader");
  if (typeof getConfig !== "function") throw new TypeError("Dashboard composer requires getConfig");

  let target = null;
  let layout = null;
  let grid = null;
  let hero = null;
  let pageId = null;
  let generation = 0;
  let editor = null, toolbar = null, touch = null, unbindTouch = null, gridRoot = null, catalogView = null, editEntry = null;
  let applyEditorPreview = null;
  let cleanupView = null;

  function destroy() {
    generation += 1;
    unbindTouch?.(); unbindTouch = null;
    touch?.destroy(); touch = null;
    if (toolbar?.root?.parentNode) toolbar.root.parentNode.removeChild(toolbar.root);
    editEntry?.remove(); editEntry = null;
    toolbar = null; editor = null; gridRoot = null; applyEditorPreview = null;
    if (catalogView?.root?.parentNode) catalogView.root.parentNode.removeChild(catalogView.root);
    catalogView = null;
    cleanupView?.root?.remove(); cleanupView = null;
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
      unbindTouch?.(); unbindTouch = null;
      touch?.destroy(); touch = null;
      if (toolbar?.root?.parentNode) toolbar.root.parentNode.removeChild(toolbar.root);
      editEntry?.remove(); editEntry = null;
      toolbar = null; editor = null; gridRoot = null; applyEditorPreview = null;
      if (catalogView?.root?.parentNode) catalogView.root.parentNode.removeChild(catalogView.root);
      catalogView = null;
      cleanupView?.root?.remove(); cleanupView = null;
      grid?.destroy();
      grid = null;
      if (hero) moduleLoader.destroy(hero);
      hero = null;
      layout.destroy();
      layout = null;
    }

    if (page.layout.kind === "hero-deck") {
      layout = createDashboardHeroLayout({ hero_ratio: page.layout.hero_ratio });
      layout.mount(target);
      const heroSlot = layout.getSlot("hero");
      const heroRef = config.pages[pageId].hero_widget_id;
      const definition = heroRef ? config.widget_instances[heroRef] : null;
      if (heroRef && !definition) throw new TypeError(`Missing hero widget instance: ${heroRef}`);
      if (definition) {
        hero = `dashboard:${pageId}:hero`;
        const heroId = hero;
        const loading = moduleLoader.load(definition.module_id, { instanceId: heroId, config: definition.config ?? {} });
        const loaded = await loading;
        if (token !== generation) {
          if (loaded) moduleLoader.destroy(heroId);
          return false;
        }
        if (!loaded || !moduleLoader.mount(heroId, heroSlot)) {
          moduleLoader.destroy(heroId);
          hero = null;
          throw new Error(`Failed to mount dashboard hero widget: ${definition.module_id}`);
        }
      }
      if (token !== generation) return false;
    } else {
      const fullRoot = document.createElement("section");
      fullRoot.setAttribute("data-jui-layout", "fullscreen");
      fullRoot.style.height = "100%";
      fullRoot.style.minHeight = "0";
      target.appendChild(fullRoot);
      layout = {
        getSlot: (name) => name === "content" ? fullRoot : null,
        destroy() { if (fullRoot.parentNode) fullRoot.parentNode.removeChild(fullRoot); },
      };
    }

    const gridHost = layout.getSlot("content");
    const hosts = createDashboardWidgetHosts({
      moduleLoader,
      getConfig: (id) => (editor?.active ? editor.workingConfig() : getConfig()).widget_instances[id],
      getButtonDefinitions: () => (editor?.active ? editor.workingConfig() : getConfig()).dynamic_buttons,
    });
    grid = createDashboardGrid({ document, createItemHost: hosts });
    gridRoot = grid.mount(gridHost);
    grid.render(page.elements, { scroll: page.layout.scroll });
    const activeGrid = grid;
    const ready = await activeGrid.whenReady();
    if (token !== generation) return false;
    if (!ready) throw new Error("Failed to mount one or more dashboard widgets");
    if (configService) attachEditor();
    return true;
  }


  function showHandles() {
    if (!gridRoot) return;
    for (const element of gridRoot.querySelectorAll("[data-jui-dashboard-item]")) {
      const controls = ["data-jui-editor-resize", "data-jui-editor-edit", "data-jui-editor-remove"];
      if (!editor?.active) {
        for (const selector of controls) element.querySelector("[" + selector + "]")?.remove();
        continue;
      }
      element.style.position = "relative";
      if (!element.querySelector("[data-jui-editor-resize]")) {
        const handle = document.createElement("button");
        handle.setAttribute("type", "button");
        handle.setAttribute("data-jui-editor-resize", "");
        handle.setAttribute("aria-label", "Elementgröße ändern");
        handle.textContent = "↘";
        handle.style.position = "absolute";
        handle.style.right = "0";
        handle.style.bottom = "0";
        handle.style.zIndex = "3";
        element.appendChild(handle);
      }
      const id = element.getAttribute("data-jui-dashboard-item");
      const item = editor.snapshot().elements.find((entry) => entry.id === id);
      const addAction = (attr, label, right, action) => {
        if (element.querySelector("[" + attr + "]")) return;
        const button = document.createElement("button");
        button.setAttribute("type", "button");
        button.setAttribute(attr, "");
        button.setAttribute("aria-label", label);
        button.textContent = label;
        button.style.position = "absolute";
        button.style.top = "0";
        button.style.right = right;
        button.style.zIndex = "5";
        button.style.fontSize = "12px";
        button.addEventListener("pointerdown", (event) => event.stopPropagation());
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          try {
            action();
          } catch (error) {
            element.setAttribute("data-jui-editor-action-error", error?.message ?? String(error));
          }
        });
        element.appendChild(button);
      };
      if (item?.kind === "widget") {
        addAction("data-jui-editor-edit", "Bearbeiten", "78px", () => {
          const instance = editor.workingConfig().widget_instances[item.ref_id];
          catalogView.edit(item.id, instance);
        });
      }
      addAction("data-jui-editor-remove", "Entfernen", "0", () => {
        const next = editor.removeElement(id);
        if (next) applyEditorPreview?.(next);
      });
    }
  }

  function attachEditor() {
    if (editor) return;
    const controller = createDashboardController({ configService });
    editor = createDashboardEditSession({
      controller, configService, pageId,
      removeUnusedButton: removeUnusedDynamicButton,
    });
    let renderedInstances = new Map(Object.entries(getConfig().widget_instances)
      .map(([id, definition]) => [id, JSON.stringify(definition)]));
    const preview = (next, { recreateIds = [] } = {}) => {
      const definitions = (editor?.active ? editor.workingConfig() : getConfig()).widget_instances;
      const current = new Map(Object.entries(definitions)
        .map(([id, definition]) => [id, JSON.stringify(definition)]));
      // Undo can change a widget's config without changing its ref_id. Force
      // recreation then too, otherwise the visible runtime remains stale.
      const changed = next.elements.filter((item) => item.kind === "widget" &&
        renderedInstances.get(item.ref_id) !== current.get(item.ref_id)).map((item) => item.id);
      grid.render(next.elements, {
        scroll: next.layout.scroll, recreateIds: [...new Set([...recreateIds, ...changed])],
      });
      renderedInstances = current;
      showHandles();
      toolbar?.refresh();
    };
    applyEditorPreview = preview;
    toolbar = createDashboardEditorToolbar({
      document, session: editor, onChange: preview,
      onAdd: () => catalogView?.open(),
      onCleanup: () => cleanupView?.open(),
    });
    target.appendChild(toolbar.root);
    cleanupView = createDashboardButtonCleanupView({
      document,
      getConfig: () => editor.workingConfig(),
      onRemove: (id) => {
        const next = editor.removeUnusedButtonDefinition(id);
        if (next) preview(next);
        return next !== null;
      },
    });
    target.appendChild(cleanupView.root);
    editEntry = document.createElement("button");
    editEntry.setAttribute("type", "button");
    editEntry.setAttribute("data-jui-dashboard-edit-entry", "");
    editEntry.setAttribute("aria-label", "Startseite bearbeiten");
    editEntry.textContent = "Bearbeiten";
    editEntry.style.position = "absolute";
    editEntry.style.right = "16px";
    editEntry.style.top = "12px";
    editEntry.style.zIndex = "12";
    editEntry.addEventListener("click", () => { toolbar.open(); showHandles(); });
    target.appendChild(editEntry);
    if (moduleRegistry) {
      catalogView = createDashboardCatalogView({
        document, catalog: createDashboardCatalog({ moduleRegistry }),
        getConfig: () => editor.workingConfig(),
        onSelect: (moduleId, plan) => {
          const next = editor.addWidget(moduleId, plan);
          if (next) preview(next);
          return next !== null;
        },
        onEdit: (elementId, moduleId, plan) => {
          const item = editor.snapshot().elements.find((entry) => entry.id === elementId);
          const definition = item ? editor.workingConfig().widget_instances[item.ref_id] : null;
          if (!definition || definition.module_id !== moduleId) {
            throw new Error("Widgettyp wurde während der Bearbeitung geändert");
          }
          const next = editor.updateWidget(elementId, plan);
          if (next) preview(next, { recreateIds: [elementId] });
          return next !== null;
        },
      });
      target.appendChild(catalogView.root);
    }
    touch = createDashboardTouchEditor({ session: editor, onPreview: preview });
    unbindTouch = bindDashboardTouchEvents({
      gridRoot, editor: touch,
      getMetrics: (elementId) => {
        const element = gridRoot.querySelector('[data-jui-dashboard-item="' + elementId + '"]');
        const bounds = element?.getBoundingClientRect?.();
        const elements = editor.active ? editor.snapshot().elements : validateDashboardPage(getConfig(), pageId).elements;
        const item = elements.find((entry) => entry.id === elementId);
        if (!bounds || !item || bounds.width <= 0 || bounds.height <= 0) return null;
        return { columnPixels: bounds.width / item.column_span, rowPixels: bounds.height / item.row_span };
      },
    });
  }

  return Object.freeze({
    mount, render, destroy,
    enterEdit() {
      if (!toolbar) throw new Error("Dashboard editor is not configured");
      toolbar.open(); showHandles();
    },
    get editing() { return editor?.active ?? false; },
  });

}
