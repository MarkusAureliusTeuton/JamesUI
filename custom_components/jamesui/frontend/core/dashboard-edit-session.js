import { moveDashboardElement, validateDashboardPage } from "./dashboard-config.js";

// Session state is detached from persisted config. Only commit writes.
export function createDashboardEditSession({ controller, configService, pageId, maxRows = null } = {}) {
  if (!controller || typeof controller.previewMove !== "function" || typeof controller.move !== "function") {
    throw new TypeError("edit session requires Dashboard Controller");
  }
  if (!configService || typeof configService.snapshot !== "function") {
    throw new TypeError("edit session requires Config Service");
  }
  if (typeof pageId !== "string" || !pageId) throw new TypeError("pageId is required");
  let working = null;
  let history = [];
  let active = false;
  let busy = false;
  let baseline = null;

  const ensureActive = () => { if (!active) throw new Error("Dashboard editor is not active"); };
  const page = () => validateDashboardPage(working, pageId);
  return Object.freeze({
    enter() {
      if (active) return page();
      const config = configService.snapshot();
      if (!config) throw new Error("JamesUI config must be loaded");
      validateDashboardPage(config, pageId);
      working = config;
      baseline = config;
      history = [];
      active = true;
      return page();
    },
    get active() { return active; },
    get canUndo() { return history.length > 0; },
    snapshot() { ensureActive(); return page(); },
    workingConfig() { ensureActive(); return structuredClone(working); },
    move(elementId, geometry) {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      const next = moveDashboardElement(working, pageId, elementId, geometry, { maxRows });
      if (next === null) return null;
      history.push(working);
      working = next;
      return page();
    },
    addWidget(moduleId, { config = {}, dataSources = {}, dynamicButtons = {}, instanceIdConfigKey = null, columnSpan = 4, rowSpan = 3 } = {}) {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      if (typeof moduleId !== "string" || !moduleId.startsWith("widget.")) throw new TypeError("invalid widget module");
      if (!Number.isInteger(columnSpan) || columnSpan < 1 || columnSpan > 12 ||
          !Number.isInteger(rowSpan) || rowSpan < 1) throw new TypeError("invalid widget size");
      const base = moduleId.replace(/[^a-z0-9-]/gi, "-");
      let i = 1;
      while (working.widget_instances[base + "-" + i] ||
             working.pages[pageId].elements.some((item) => item.id === base + "-" + i)) i += 1;
      const id = base + "-" + i;
      const elements = page().elements;
      let row = 0, column = 0, found = false;
      // First-fit across all 12 columns before moving downward. Using only
      // column 0 stacked widgets vertically despite free grid space.
      while (maxRows === null || row + rowSpan <= maxRows) {
        for (let candidate = 0; candidate <= 12 - columnSpan; candidate += 1) {
          const overlaps = elements.some((item) =>
            candidate < item.column + item.column_span &&
            candidate + columnSpan > item.column &&
            row < item.row + item.row_span &&
            row + rowSpan > item.row);
          if (!overlaps) { column = candidate; found = true; break; }
        }
        if (found) break;
        row += 1;
      }
      if (!found) return null;
      for (const buttonId of Object.keys(dynamicButtons)) {
        if (buttonId in working.dynamic_buttons) throw new Error(`Button-Definition existiert bereits: ${buttonId}`);
      }
      const instanceConfig = structuredClone(config);
      if (instanceIdConfigKey !== null) {
        if (instanceIdConfigKey !== "instance_id") throw new TypeError("unsupported instance ID config key");
        instanceConfig[instanceIdConfigKey] = id;
      }
      history.push(working);
      working = {
        ...working,
        data_sources: { ...working.data_sources, ...structuredClone(dataSources) },
        dynamic_buttons: { ...working.dynamic_buttons, ...structuredClone(dynamicButtons) },
        widget_instances: { ...working.widget_instances,
          [id]: { module_id: moduleId, config: instanceConfig } },
        pages: { ...working.pages,
          [pageId]: { ...working.pages[pageId], elements: [
            ...working.pages[pageId].elements,
            { id, kind: "widget", ref_id: id, column, row,
              column_span: columnSpan, row_span: rowSpan },
          ] } },
      };
      return page();
    },
    updateWidget(elementId, { config, dataSources = {}, dynamicButtons = {}, instanceIdConfigKey = null } = {}) {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      const element = page().elements.find((item) => item.id === elementId);
      if (!element || element.kind !== "widget") throw new TypeError("Widget zum Bearbeiten nicht gefunden");
      if (!config || typeof config !== "object" || Array.isArray(config)) throw new TypeError("Widget-Konfiguration fehlt");
      const refs = Object.values(working.pages).reduce((count, candidate) =>
        count + (candidate.hero_widget_id === element.ref_id ? 1 : 0) +
        (candidate.elements ?? []).filter((item) => item.kind === "widget" && item.ref_id === element.ref_id).length, 0);
      if (refs !== 1) throw new Error("Gemeinsam genutzte Widget-Instanz kann nicht direkt bearbeitet werden");
      const instance = working.widget_instances[element.ref_id];
      if (!instance) throw new TypeError("Widget-Instanz ist nicht vorhanden");
      for (const id of Object.keys(dynamicButtons)) {
        if (id in working.dynamic_buttons) throw new Error(`Button-Definition existiert bereits: ${id}`);
      }
      const instanceConfig = structuredClone(config);
      if (instanceIdConfigKey !== null) {
        if (instanceIdConfigKey !== "instance_id") throw new TypeError("unsupported instance ID config key");
        instanceConfig.instance_id = element.ref_id;
      }
      history.push(working);
      working = {
        ...working,
        data_sources: { ...working.data_sources, ...structuredClone(dataSources) },
        dynamic_buttons: { ...working.dynamic_buttons, ...structuredClone(dynamicButtons) },
        widget_instances: { ...working.widget_instances,
          [element.ref_id]: { ...instance, config: instanceConfig } },
      };
      return page();
    },
    removeElement(elementId) {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      const element = page().elements.find((item) => item.id === elementId);
      if (!element) return null;
      const elements = working.pages[pageId].elements.filter((item) => item.id !== elementId);
      const widgetInstances = { ...working.widget_instances };
      if (element.kind === "widget") {
        const stillReferenced = Object.entries(working.pages).some(([id, candidate]) =>
          candidate.hero_widget_id === element.ref_id ||
          (id === pageId ? elements : candidate.elements ?? []).some((item) =>
            item.kind === "widget" && item.ref_id === element.ref_id));
        if (!stillReferenced) delete widgetInstances[element.ref_id];
      }
      history.push(working);
      working = {
        ...working,
        widget_instances: widgetInstances,
        pages: { ...working.pages,
          [pageId]: { ...working.pages[pageId], elements } },
      };
      // Shared provider sources and centrally registered button definitions are
      // never implicitly deleted when a tile is removed.
      return page();
    },
    undo() {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      if (!history.length) return null;
      working = history.pop();
      return page();
    },
    async save() {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      busy = true;
      try {
        // Replay only the edited page placements onto the current serialized
        // Config Service snapshot; preserve unrelated latest config sections.
        const desired = page();
        const result = await configService.update((latest) => {
          const previous = validateDashboardPage(latest, pageId);
          const original = validateDashboardPage(baseline, pageId);
          if (previous.elements.length !== original.elements.length ||
              previous.elements.some((item, index) =>
                item.id !== original.elements[index].id ||
                item.ref_id !== original.elements[index].ref_id ||
                item.kind !== original.elements[index].kind ||
                item.column !== original.elements[index].column ||
                item.row !== original.elements[index].row ||
                item.column_span !== original.elements[index].column_span ||
                item.row_span !== original.elements[index].row_span)) {
            throw new Error("Dashboard changed externally during editing");
          }
          const instanceChanges = Object.fromEntries(
            Object.entries(working.widget_instances).filter(([id, value]) =>
              JSON.stringify(value) !== JSON.stringify(baseline.widget_instances[id])));
          const instanceRemovals = Object.keys(baseline.widget_instances).filter(
            (id) => !(id in working.widget_instances));
          for (const id of [...Object.keys(instanceChanges), ...instanceRemovals]) {
            if (JSON.stringify(latest.widget_instances[id]) !== JSON.stringify(baseline.widget_instances[id])) {
              throw new Error(`Widget-Instanz wurde extern geändert: ${id}`);
            }
          }
          const instances = { ...latest.widget_instances, ...structuredClone(instanceChanges) };
          for (const id of instanceRemovals) {
            const referenced = Object.entries(latest.pages).some(([otherPageId, otherPage]) =>
              otherPageId !== pageId && (otherPage.hero_widget_id === id ||
                (otherPage.elements ?? []).some((item) => item.kind === "widget" && item.ref_id === id)));
            if (referenced) throw new Error(`Widget-Instanz wird extern verwendet: ${id}`);
            delete instances[id];
          }
          const sourceChanges = Object.fromEntries(
            Object.entries(working.data_sources).filter(([id, value]) =>
              JSON.stringify(value) !== JSON.stringify(baseline.data_sources[id])));
          const buttonChanges = Object.fromEntries(
            Object.entries(working.dynamic_buttons).filter(([id, value]) =>
              JSON.stringify(value) !== JSON.stringify(baseline.dynamic_buttons[id])));
          for (const id of Object.keys(sourceChanges)) {
            if (JSON.stringify(latest.data_sources[id]) !== JSON.stringify(baseline.data_sources[id])) {
              throw new Error(`Datenquelle wurde extern geändert: ${id}`);
            }
          }
          for (const id of Object.keys(buttonChanges)) {
            if (JSON.stringify(latest.dynamic_buttons[id]) !== JSON.stringify(baseline.dynamic_buttons[id])) {
              throw new Error(`Button wurde extern geändert: ${id}`);
            }
          }
          return {
            ...latest,
            data_sources: { ...latest.data_sources, ...sourceChanges },
            dynamic_buttons: { ...latest.dynamic_buttons, ...buttonChanges },
            widget_instances: instances,
            pages: { ...latest.pages,
              [pageId]: { ...latest.pages[pageId],
                elements: structuredClone(working.pages[pageId].elements) } },
          };
        });
        if (result !== null) {
          working = result;
          baseline = result;
          history = [];
        }
        return result === null ? null : page();
      } finally {
        busy = false;
      }
    },
    cancel() {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      const restored = validateDashboardPage(baseline, pageId);
      active = false;
      working = null;
      history = [];
      baseline = null;
      return restored;
    },
    finish() {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      active = false;
      working = null;
      history = [];
      baseline = null;
    },
  });
}
