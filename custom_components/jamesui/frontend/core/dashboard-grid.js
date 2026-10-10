import { GRID_COLUMNS, validateGrid } from "./grid-placement.js";

export const DASHBOARD_GRID_STYLES = `
[data-jui-dashboard-grid] {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: var(--jui-dashboard-row-height, 32px);
  gap: var(--jui-dashboard-gap, 8px);
  align-content: start;
  width: 100%;
  min-width: 0;
  min-height: 0;
}
[data-jui-dashboard-grid][data-jui-scroll="fixed"] {
  height: 100%;
  overflow: hidden;
}
[data-jui-dashboard-grid][data-jui-scroll="vertical"] {
  overflow: visible;
}
[data-jui-dashboard-item] {
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
`;

// This renderer owns geometry and element hosts only. Widget lifecycle and
// button behavior are injected; it does not access Home Assistant or actions.
export function createDashboardGrid({ document, createItemHost = () => {} } = {}) {
  if (!document || typeof document.createElement !== "function") {
    throw new TypeError("Dashboard grid requires a document");
  }
  if (typeof createItemHost !== "function") throw new TypeError("createItemHost must be a function");
  let root = null;
  let styleNode = null;
  let host = null;
  let activeItems = new Map();

  const destroy = () => {
    for (const entry of activeItems.values()) entry.dispose?.();
    activeItems.clear();
    if (root?.parentNode) root.parentNode.removeChild(root);
    if (styleNode?.parentNode) styleNode.parentNode.removeChild(styleNode);
    root = null;
    styleNode = null;
    host = null;
  };

  const render = (elements, { scroll = "fixed", maxRows = null, recreateIds = [] } = {}) => {
    if (!root) throw new Error("Dashboard grid must be mounted");
    if (!["fixed", "vertical"].includes(scroll)) throw new TypeError("invalid grid scroll policy");
    if (!Array.isArray(elements)) throw new TypeError("dashboard elements must be an array");
    const geometry = validateGrid(elements, { columns: GRID_COLUMNS, maxRows });
    const nextIds = new Set(geometry.map((item) => item.id));
    const recreate = new Set(recreateIds);
    for (const [id, entry] of activeItems) {
      if (!nextIds.has(id)) {
        entry.dispose?.();
        if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
        activeItems.delete(id);
      }
    }
    for (const item of elements) {
      const bounds = geometry.find((element) => element.id === item.id);
      let entry = activeItems.get(item.id);
      if (entry && (recreate.has(item.id) || entry.kind !== item.kind || entry.refId !== item.ref_id)) {
        entry.dispose?.();
        if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
        activeItems.delete(item.id);
        entry = null;
      }
      if (!entry) {
        const node = document.createElement("div");
        node.setAttribute("data-jui-dashboard-item", item.id);
        const dispose = createItemHost(node, item) ?? null;
        if (dispose !== null && typeof dispose !== "function") {
          throw new TypeError("createItemHost must return a cleanup function or null");
        }
        entry = { node, dispose, ready: dispose?.ready ?? null, kind: item.kind, refId: item.ref_id };
        activeItems.set(item.id, entry);
        root.appendChild(node);
      }
      entry.node.style.gridColumn = `${bounds.column + 1} / span ${bounds.column_span}`;
      entry.node.style.gridRow = `${bounds.row + 1} / span ${bounds.row_span}`;
    }
    root.setAttribute("data-jui-scroll", scroll);
  };

  const mount = (target) => {
    if (!target || typeof target.appendChild !== "function") {
      throw new TypeError("Dashboard grid requires a mount target");
    }
    if (root) destroy();
    host = target;
    styleNode = document.createElement("style");
    styleNode.textContent = DASHBOARD_GRID_STYLES;
    root = document.createElement("div");
    root.setAttribute("data-jui-dashboard-grid", "");
    host.appendChild(styleNode);
    host.appendChild(root);
    return root;
  };

  // Only widget hosts expose asynchronous readiness. Static hosts are ready immediately.
  // Resolve false when any configured widget failed to load or mount.
  const whenReady = async () => {
    const results = await Promise.all([...activeItems.values()].map((entry) =>
      entry.ready === null ? true : entry.ready));
    return results.every((ready) => ready === true);
  };

  return Object.freeze({ mount, render, whenReady, destroy });
}
