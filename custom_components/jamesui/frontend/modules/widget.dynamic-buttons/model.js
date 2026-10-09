const IDLE = Object.freeze({ state: "idle" });

export function toggleIntent(definition, sourceState) {
  if (!definition || definition.mode !== "toggle" || !sourceState) return null;
  if (sourceState.status === "inactive") return Object.freeze({ action: definition.activate_action, target_status: "active" });
  if (sourceState.status === "active") return Object.freeze({ action: definition.deactivate_action, target_status: "inactive" });
  return null;
}

function statePresentation(definition, sourceState) {
  if (!sourceState) return null;
  if (sourceState.status === "active") return definition.presentation?.active ?? null;
  if (sourceState.status === "inactive") return definition.presentation?.inactive ?? null;
  if (sourceState.status === "intermediate") return definition.presentation?.intermediate?.[sourceState.detail] ?? null;
  return null;
}

export function buildDynamicButtonModel({ use, sourceState = null, interaction = IDLE } = {}) {
  if (!use?.definition) throw new TypeError("Dynamic Button model requires resolved use");
  const definition = use.definition;
  const feedback = interaction?.state ?? "idle";
  if (definition.mode === "trigger") {
    const secondary = feedback === "pending" ? "Wird ausgeführt …"
      : feedback === "success" ? "Erledigt"
      : feedback === "error" ? "Fehler"
      : definition.description ?? null;
    return Object.freeze({
      id: use.id,
      button_id: use.button_id,
      size: use.size,
      mode: "trigger",
      name: definition.name,
      icon: definition.icon,
      secondary,
      real_status: "inactive",
      active: false,
      feedback,
      disabled: feedback !== "idle",
    });
  }

  const realStatus = sourceState?.status ?? "unavailable";
  const presentation = statePresentation(definition, sourceState);
  let secondary = presentation?.text ?? null;
  if (realStatus === "unavailable") secondary = "Nicht verfügbar";
  else if (realStatus === "intermediate" && !secondary) secondary = "In Ausführung …";
  else if (feedback === "error") secondary = "Fehler";
  else if (feedback === "pending" && realStatus !== "intermediate" && !secondary) secondary = "Wird ausgeführt …";

  return Object.freeze({
    id: use.id,
    button_id: use.button_id,
    size: use.size,
    mode: "toggle",
    name: definition.name,
    icon: presentation?.icon ?? definition.icon,
    secondary,
    real_status: realStatus,
    active: realStatus === "active",
    feedback,
    disabled: feedback !== "idle" || (realStatus !== "active" && realStatus !== "inactive"),
  });
}
