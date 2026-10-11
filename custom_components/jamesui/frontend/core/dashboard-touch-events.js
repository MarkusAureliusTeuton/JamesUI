// Connect DOM pointer events to the dashboard edit gesture model.
// Capture is scoped to each grid item; resize is limited to its explicit handle.
export function bindDashboardTouchEvents({ gridRoot, editor, getMetrics } = {}) {
  if (!gridRoot || typeof gridRoot.addEventListener !== "function") throw new TypeError("gridRoot required");
  if (!editor || typeof editor.pointerDown !== "function") throw new TypeError("touch editor required");
  if (typeof getMetrics !== "function") throw new TypeError("getMetrics required");

  const getItem = (node) => {
    let current = node;
    while (current && current !== gridRoot) {
      const id = current.getAttribute?.("data-jui-dashboard-item");
      if (id) return { id, node: current };
      current = current.parentNode;
    }
    return null;
  };
  let dragging = null;

  const down = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const selected = getItem(event.target);
    if (!selected) return;
    const metrics = getMetrics(selected.id);
    if (!metrics) return;
    const resize = event.target?.getAttribute?.("data-jui-editor-resize") !== null &&
      event.target?.getAttribute?.("data-jui-editor-resize") !== undefined;
    if (editor.pointerDown({
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      elementId: selected.id, mode: resize ? "resize" : "move",
      columnPixels: metrics.columnPixels, rowPixels: metrics.rowPixels,
    })) dragging = { pointerId: event.pointerId };
  };
  const move = (event) => {
    if (dragging?.pointerId !== event.pointerId) return;
    editor.pointerMove({ pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  };
  const up = (event) => {
    if (dragging?.pointerId !== event.pointerId) return;
    editor.pointerUp({ pointerId: event.pointerId });
    dragging = null;
  };
  const cancel = () => { dragging = null; editor.pointerCancel(); };
  gridRoot.addEventListener("pointerdown", down);
  gridRoot.addEventListener("pointermove", move);
  gridRoot.addEventListener("pointerup", up);
  gridRoot.addEventListener("pointercancel", cancel);
  return () => {
    cancel();
    gridRoot.removeEventListener("pointerdown", down);
    gridRoot.removeEventListener("pointermove", move);
    gridRoot.removeEventListener("pointerup", up);
    gridRoot.removeEventListener("pointercancel", cancel);
  };
}
