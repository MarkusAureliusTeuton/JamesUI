// Minimal page-local edit toolbar. Gesture-driven drag/resize are attached
// separately; this layer never invokes Home Assistant directly.
export function createDashboardEditorToolbar({ document, session, onChange, onAdd, onCleanup = null } = {}) {
  if (!document || typeof document.createElement !== "function") throw new TypeError("editor toolbar requires document");
  if (!session || typeof session.enter !== "function" || typeof session.finish !== "function" ||
      typeof session.cancel !== "function" || typeof session.reloadAndSave !== "function") {
    throw new TypeError("editor toolbar requires edit session");
  }
  if (onCleanup !== null && typeof onCleanup !== "function") throw new TypeError("onCleanup must be a function or null");
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

  let saving = false;
  const resetError = () => {
    root.removeAttribute("data-jui-editor-save-error");
    errorMessage.hidden = true;
    errorMessage.textContent = "";
    retry.hidden = true;
  };
  const refresh = () => {
    root.hidden = !session.active;
    undo.disabled = saving || !session.canUndo;
    add.disabled = saving;
    finish.disabled = saving;
    cancel.disabled = saving;
    if (cleanup) cleanup.disabled = saving;
    retry.disabled = saving;
  };
  const persist = async (afterConflict = false) => {
    if (saving) return;
    saving = true;
    refresh();
    try {
      const page = afterConflict ? await session.reloadAndSave() : await session.save();
      session.finish();
      root.hidden = true;
      resetError();
      // Render after leaving edit mode to remove stale action handles.
      if (page) onChange(page);
    } catch (error) {
      if (session.active) {
        root.setAttribute("data-jui-editor-save-error", "");
        errorMessage.hidden = false;
        const message = error?.message ?? "Konfiguration konnte nicht gespeichert werden";
        const conflict = error?.code === "config_conflict" || /config_conflict/.test(message);
        errorMessage.textContent = conflict
          ? "Die Konfiguration wurde in einer anderen Sitzung geändert. " +
            "Du kannst den aktuellen Serverstand laden und deine Änderungen erneut prüfen und speichern. " +
            "Bei widersprüchlichen Änderungen bleibt dein Entwurf erhalten."
          : message;
        retry.hidden = !conflict;
      }
    } finally {
      saving = false;
      refresh();
    }
  };

  const add = createAction("+ Hinzufügen", () => onAdd());
  const undo = createAction("Rückgängig", () => {
    if (saving) return;
    const page = session.undo();
    if (page) onChange(page);
    refresh();
  });
  const finish = createAction("Fertig", () => { void persist(); });
  const cancel = createAction("Abbrechen", () => {
    if (saving) return;
    const restored = session.cancel();
    resetError();
    root.hidden = true;
    onChange(restored);
    refresh();
  });
  const cleanup = onCleanup ? createAction("Bereinigen", () => onCleanup()) : null;
  const retry = createAction("Serverstand laden und erneut speichern", () => { void persist(true); });
  retry.setAttribute("data-jui-editor-retry-conflict", "");
  retry.hidden = true;

  const errorMessage = document.createElement("p");
  errorMessage.setAttribute("data-jui-editor-save-error-message", "");
  errorMessage.setAttribute("role", "alert");
  errorMessage.hidden = true;
  root.appendChild(errorMessage);

  return Object.freeze({
    root,
    open() {
      session.enter();
      resetError();
      refresh();
      onChange(session.snapshot());
    },
    refresh,
  });
}
