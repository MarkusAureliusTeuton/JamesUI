// Minimal page-local edit toolbar. Gesture-driven drag/resize are attached
// separately; this layer never invokes Home Assistant directly.
export function createDashboardEditorToolbar({ document, session, onChange, onAdd } = {}) {
  if (!document || typeof document.createElement !== "function") throw new TypeError("editor toolbar requires document");
  if (!session || typeof session.enter !== "function" || typeof session.finish !== "function") {
    throw new TypeError("editor toolbar requires edit session");
  }
  if (typeof onChange !== "function" || typeof onAdd !== "function") {
    throw new TypeError("editor toolbar requires onChange and onAdd callbacks");
  }
  const root = document.createElement("div");
  root.setAttribute("data-jui-editor-toolbar", "");
  root.hidden = true;
  const createAction = (label, action) => {
    const node = document.createElement("button");
    node.setAttribute("type", "button");
    node.textContent = label;
    node.addEventListener("click", action);
    root.appendChild(node);
    return node;
  };
  const add = createAction("+ Hinzufügen", () => onAdd());
  const undo = createAction("Rückgängig", () => {
    const page = session.undo();
    if (page) onChange(page);
    refresh();
  });
  const finish = createAction("Fertig", async () => {
    if (saving) return;
    saving = true;
    refresh();
    try {
      const page = await session.save();
      session.finish();
      root.removeAttribute("data-jui-editor-save-error");
      root.hidden = true;
      // Re-render *after* leaving edit mode: no stale resize/edit/delete
      // controls should remain over the ordinary interactive widgets.
      if (page) onChange(page);
    } catch {
      // Keep editing and the unsaved layout intact for an explicit retry.
      if (session.active) root.setAttribute("data-jui-editor-save-error", "");
    } finally {
      saving = false;
      refresh();
    }
  });
  let saving = false;
  const refresh = () => {
    root.hidden = !session.active;
    undo.disabled = saving || !session.canUndo;
    add.disabled = saving;
    finish.disabled = saving;
  };
  return Object.freeze({
    root,
    open() { session.enter(); root.removeAttribute("data-jui-editor-save-error"); refresh(); onChange(session.snapshot()); },
    refresh,
  });
}
