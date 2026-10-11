import { listUnusedDynamicButtons } from "./dashboard-resource-usage.js";

// User-initiated cleanup. No automatic deletion when removing a dashboard tile.
export function createDashboardButtonCleanupView({ document, getConfig, onRemove } = {}) {
  if (!document?.createElement || typeof getConfig !== "function" || typeof onRemove !== "function") {
    throw new TypeError("Cleanup view requires document, current config and remove callback");
  }
  const root = document.createElement("section");
  root.setAttribute("data-jui-button-cleanup", "");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Nicht verwendete Buttondefinitionen");
  root.hidden = true;
  root.style.position = "absolute";
  root.style.inset = "0";
  root.style.zIndex = "31";
  root.style.overflow = "auto";
  root.style.padding = "24px";
  root.style.color = "var(--jui-color-text, white)";
  root.style.background = "var(--jui-color-surface, #11151e)";

  const redraw = () => {
    root.replaceChildren();
    const title = document.createElement("h2");
    title.textContent = "Ungenutzte Buttondefinitionen";
    root.appendChild(title);
    const explanation = document.createElement("p");
    explanation.textContent = "Nur Buttondefinitionen ohne Referenz in einer Seite oder Widgetinstanz können entfernt werden. Datenquellen bleiben unverändert. Änderungen werden erst mit Fertig gespeichert.";
    root.appendChild(explanation);
    const close = document.createElement("button");
    close.setAttribute("type", "button");
    close.textContent = "Schließen";
    close.addEventListener("click", () => { root.hidden = true; });
    root.appendChild(close);
    const unused = listUnusedDynamicButtons(getConfig());
    if (unused.length === 0) {
      const info = document.createElement("p");
      info.setAttribute("data-jui-cleanup-empty", "");
      info.textContent = "Keine ungenutzten Buttondefinitionen vorhanden";
      root.appendChild(info);
    }
    for (const candidate of unused) {
      const item = document.createElement("div");
      item.setAttribute("data-jui-cleanup-item", candidate.id);
      const label = document.createElement("span");
      label.textContent = candidate.name + " (" + candidate.id + ")";
      item.appendChild(label);
      const remove = document.createElement("button");
      remove.setAttribute("type", "button");
      remove.setAttribute("data-jui-cleanup-remove", candidate.id);
      remove.textContent = "Definition entfernen";
      remove.addEventListener("click", () => {
        try {
          if (onRemove(candidate.id) === false) throw new Error("Definition konnte nicht entfernt werden");
          redraw();
        } catch (error) {
          failure.textContent = error?.message ?? "Definition konnte nicht entfernt werden";
          failure.hidden = false;
        }
      });
      item.appendChild(remove);
      root.appendChild(item);
    }
    const failure = document.createElement("p");
    failure.setAttribute("data-jui-cleanup-error", "");
    failure.setAttribute("role", "alert");
    failure.hidden = true;
    root.appendChild(failure);
  };
  return Object.freeze({
    root,
    open() { redraw(); root.hidden = false; },
    close() { root.hidden = true; },
  });
}
