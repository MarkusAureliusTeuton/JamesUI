import { GRID_COLUMNS, validateGrid, previewGridPlacement } from "./grid-placement.js";

// Page-level model only. Persistence stays in the single Config Service.
// Legacy/unconfigured pages are not silently treated as dashboard pages.
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function id(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} requires an ID`);
  return value;
}

export function validateDashboardPage(config, pageId) {
  record(config, "config");
  const pages = record(config.pages, "pages");
  const instances = record(config.widget_instances, "widget_instances");
  const layouts = record(config.layouts, "layouts");
  id(pageId, "page");
  const page = record(pages[pageId], `pages.${pageId}`);
  if (page.kind !== "dashboard") throw new TypeError(`pages.${pageId} is not a dashboard`);
  const layoutId = id(page.layout_id, "layout");
  const layout = record(layouts[layoutId], `layouts.${layoutId}`);
  if (!["hero-deck", "fullscreen"].includes(layout.kind)) throw new TypeError("unsupported dashboard layout");
  if (!["fixed", "vertical"].includes(layout.scroll)) throw new TypeError("invalid dashboard scroll policy");
  if (layout.kind === "hero-deck") {
    const ratio = layout.hero_ratio ?? 0.42;
    if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio < 0.35 || ratio > 0.5) {
      throw new RangeError("hero_ratio must be between 0.35 and 0.50");
    }
  }
  if (!Array.isArray(page.elements)) throw new TypeError("dashboard elements must be an array");
  const geometry = validateGrid(page.elements, { columns: GRID_COLUMNS });
  const elements = page.elements.map((element, index) => {
    record(element, `elements[${index}]`);
    if (element.kind !== "widget" && element.kind !== "button") {
      throw new TypeError(`unsupported dashboard element kind: ${element.kind}`);
    }
    const referenceId = id(element.ref_id, "element reference");
    if (element.kind === "widget") {
      const instance = record(instances[referenceId], `widget_instances.${referenceId}`);
      id(instance.module_id, "widget module");
    } else {
      const definitions = record(config.dynamic_buttons, "dynamic_buttons");
      record(definitions[referenceId], `dynamic_buttons.${referenceId}`);
    }
    return Object.freeze({
      ...geometry[index],
      kind: element.kind,
      ref_id: referenceId,
    });
  });
  return Object.freeze({
    id: pageId,
    layout_id: layoutId,
    layout: Object.freeze({
      kind: layout.kind,
      scroll: layout.scroll,
      hero_ratio: layout.kind === "hero-deck" ? (layout.hero_ratio ?? 0.42) : null,
    }),
    elements: Object.freeze(elements),
  });
}

// Preserve the complete config document and unrelated page/instance settings.
// On failed moves the caller receives null; nothing is persisted.
export function moveDashboardElement(config, pageId, elementId, changes, options = {}) {
  const page = validateDashboardPage(config, pageId);
  const geometry = page.elements.map(({ id, column, row, column_span, row_span }) =>
    ({ id, column, row, column_span, row_span }));
  const proposed = previewGridPlacement(geometry, elementId, changes, {
    columns: GRID_COLUMNS, maxRows: options.maxRows ?? null,
  });
  if (proposed === null) return null;
  const placed = new Map(proposed.map((item) => [item.id, item]));
  const original = config.pages[pageId];
  const elements = original.elements.map((element) => {
    const item = placed.get(element.id);
    return {
      ...element,
      column: item.column, row: item.row,
      column_span: item.column_span, row_span: item.row_span,
    };
  });
  return {
    ...config,
    pages: {
      ...config.pages,
      [pageId]: { ...original, elements },
    },
  };
}

export function createDashboardPageConfig({ pageId, layoutId, layoutKind = "hero-deck" }) {
  id(pageId, "page");
  id(layoutId, "layout");
  if (!["hero-deck", "fullscreen"].includes(layoutKind)) throw new TypeError("unsupported dashboard layout");
  return {
    page: { kind: "dashboard", layout_id: layoutId, elements: [] },
    layout: {
      kind: layoutKind,
      scroll: "fixed",
      ...(layoutKind === "hero-deck" ? { hero_ratio: 0.42 } : {}),
    },
  };
}
