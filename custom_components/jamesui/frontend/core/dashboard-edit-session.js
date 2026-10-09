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

  const ensureActive = () => { if (!active) throw new Error("Dashboard editor is not active"); };
  const page = () => validateDashboardPage(working, pageId);
  return Object.freeze({
    enter() {
      if (active) return page();
      const config = configService.snapshot();
      if (!config) throw new Error("JamesUI config must be loaded");
      validateDashboardPage(config, pageId);
      working = config;
      history = [];
      active = true;
      return page();
    },
    get active() { return active; },
    get canUndo() { return history.length > 0; },
    snapshot() { ensureActive(); return page(); },
    move(elementId, geometry) {
      ensureActive();
      if (busy) throw new Error("Dashboard editor is saving");
      const next = moveDashboardElement(working, pageId, elementId, geometry, { maxRows });
      if (next === null) return null;
      history.push(working);
      working = next;
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
          if (previous.elements.length !== desired.elements.length ||
              previous.elements.some((item, index) =>
                item.id !== desired.elements[index].id ||
                item.ref_id !== desired.elements[index].ref_id ||
                item.kind !== desired.elements[index].kind)) {
            throw new Error("Dashboard changed externally during editing");
          }
          return {
            ...latest,
            pages: {
              ...latest.pages,
              [pageId]: {
                ...latest.pages[pageId],
                elements: latest.pages[pageId].elements.map((item, index) => ({
                  ...item,
                  column: desired.elements[index].column,
                  row: desired.elements[index].row,
                  column_span: desired.elements[index].column_span,
                  row_span: desired.elements[index].row_span,
                })),
              },
            },
          };
        });
        if (result !== null) {
          working = result;
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
