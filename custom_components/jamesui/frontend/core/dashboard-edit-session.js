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
    addWidget(moduleId, { config = {}, columnSpan = 4, rowSpan = 3 } = {}) {
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
      let row = 0;
      while (elements.some((item) => item.column < columnSpan &&
          item.row < row + rowSpan && item.row + item.row_span > row)) row += 1;
      if (maxRows !== null && row + rowSpan > maxRows) return null;
      history.push(working);
      working = {
        ...working,
        widget_instances: { ...working.widget_instances,
          [id]: { module_id: moduleId, config: structuredClone(config) } },
        pages: { ...working.pages,
          [pageId]: { ...working.pages[pageId], elements: [
            ...working.pages[pageId].elements,
            { id, kind: "widget", ref_id: id, column: 0, row,
              column_span: columnSpan, row_span: rowSpan },
          ] } },
      };
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
                item.kind !== original.elements[index].kind)) {
            throw new Error("Dashboard changed externally during editing");
          }
          const added = Object.fromEntries(
            Object.entries(working.widget_instances).filter(([id]) =>
              !(id in baseline.widget_instances)));
          if (Object.keys(added).some((id) => id in latest.widget_instances)) {
            throw new Error("Widget instance ID changed externally");
          }
          return {
            ...latest,
            widget_instances: { ...latest.widget_instances, ...added },
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
    finish() {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      active = false;
      working = null;
      history = [];
    },
  });
}
