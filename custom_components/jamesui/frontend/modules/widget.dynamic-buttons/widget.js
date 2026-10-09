import { createIcon } from "../../icons/icon.js";
import { MANIFEST } from "./manifest.js";
import { validateResolvedDynamicButtonConfig } from "./config.js";
import { buildDynamicButtonModel, toggleIntent } from "./model.js";
import { DYNAMIC_BUTTON_STYLES } from "./styles.js";

const SUCCESS_FEEDBACK_MS = 650;
const ERROR_FEEDBACK_MS = 1500;
const TERMINAL = new Set(["active", "inactive"]);

function validateContext(context) {
  if (!context || typeof context !== "object") throw new TypeError("Dynamic Buttons context is required");
  if (!context.capabilities || typeof context.capabilities.subscribe !== "function") throw new TypeError("Dynamic Buttons requires capabilities");
  if (!context.actions || typeof context.actions.execute !== "function") throw new TypeError("Dynamic Buttons requires actions");
  if (context.module?.id !== MANIFEST.id) throw new TypeError(`Dynamic Buttons module id must be ${MANIFEST.id}`);
  return context;
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try { Promise.resolve(unsubscribe()).catch(() => {}); } catch { /* best effort */ }
}

function unavailableState(sourceId, reason = "control_states_unavailable") {
  return Object.freeze({ source_id: sourceId, status: "unavailable", detail: null, revision: -1, reason });
}

function validStateRecord(value) {
  return value && typeof value === "object"
    && typeof value.source_id === "string"
    && ["active", "inactive", "intermediate", "unavailable"].includes(value.status)
    && Number.isInteger(value.revision) && value.revision >= 0;
}

function element(document, tag, attribute = null, text = "") {
  const node = document.createElement(tag);
  if (attribute) node.setAttribute(attribute, "");
  node.textContent = text;
  return node;
}

export function createDynamicButtonsWidget(initialContext, initialConfig) {
  let context = validateContext(initialContext);
  let config = validateResolvedDynamicButtonConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let target = null;
  let document = null;
  let styleNode = null;
  let root = null;
  let capabilityUnsubscribe = null;
  let stateUnsubscribe = null;
  let boundService = null;
  let bindingGeneration = 0;
  let sourceStates = new Map();
  let interactions = new Map();

  const buildInteractions = () => new Map(config.buttons.map((use) => [use.id, { token: 0, state: "idle", timer: null, baseline_revision: null, target_status: null }]));
  const useMap = () => new Map(config.buttons.map((use) => [use.id, use]));
  interactions = buildInteractions();

  const toggleSourceIds = () => [...new Set(config.buttons.filter((use) => use.definition.mode === "toggle").map((use) => use.definition.state_source_id))];

  const clearRuntimeTimer = (runtime) => {
    if (runtime?.timer !== null && runtime?.timer !== undefined) globalThis.clearTimeout(runtime.timer);
    if (runtime) runtime.timer = null;
  };

  const render = () => {
    if (!mounted || !root) return;
    const nodes = config.buttons.map((use) => {
      const runtime = interactions.get(use.id) ?? { state: "idle" };
      const sourceState = use.definition.mode === "toggle"
        ? sourceStates.get(use.definition.state_source_id) ?? unavailableState(use.definition.state_source_id)
        : null;
      const model = buildDynamicButtonModel({ use, sourceState, interaction: runtime });
      const button = document.createElement("button");
      button.setAttribute("type", "button");
      button.setAttribute("data-jui-dynamic-button", "");
      button.setAttribute("data-jui-dynamic-use-id", model.id);
      button.setAttribute("data-jui-dynamic-button-id", model.button_id);
      button.setAttribute("data-jui-dynamic-mode", model.mode);
      button.setAttribute("data-jui-dynamic-size", model.size);
      button.setAttribute("data-jui-dynamic-real-status", model.real_status);
      button.setAttribute("data-jui-dynamic-feedback", model.feedback);
      if (model.disabled) button.setAttribute("aria-disabled", "true");
      if (model.mode === "toggle") button.setAttribute("aria-pressed", model.active ? "true" : "false");

      const iconHost = element(document, "span", "data-jui-dynamic-icon");
      if (model.icon) iconHost.appendChild(createIcon(document, model.icon, { size: "lg" }));
      const copy = element(document, "span", "data-jui-dynamic-copy");
      copy.appendChild(element(document, "span", "data-jui-dynamic-name", model.name));
      if (model.secondary) copy.appendChild(element(document, "span", "data-jui-dynamic-secondary", model.secondary));
      const indicator = element(document, "span", "data-jui-dynamic-mode-indicator", model.mode === "toggle" ? "Toggle" : "Aktion");
      button.appendChild(iconHost);
      button.appendChild(copy);
      button.appendChild(indicator);
      button.addEventListener("click", () => activate(use.id));
      return button;
    });
    root.replaceChildren(...nodes);
  };

  const setIdle = (useId, token) => {
    const runtime = interactions.get(useId);
    if (!runtime || runtime.token !== token) return false;
    clearRuntimeTimer(runtime);
    runtime.state = "idle";
    runtime.baseline_revision = null;
    runtime.target_status = null;
    render();
    return true;
  };

  const transientFeedback = (useId, token, state, duration) => {
    const runtime = interactions.get(useId);
    if (!runtime || runtime.token !== token) return false;
    clearRuntimeTimer(runtime);
    runtime.state = state;
    runtime.baseline_revision = null;
    runtime.target_status = null;
    render();
    runtime.timer = globalThis.setTimeout(() => {
      if (!mounted || destroyed) return;
      const current = interactions.get(useId);
      if (!current || current.token !== token || current.state !== state) return;
      setIdle(useId, token);
    }, duration);
    return true;
  };

  const failOperation = (useId, token) => transientFeedback(useId, token, "error", ERROR_FEEDBACK_MS);
  const succeedTrigger = (useId, token) => transientFeedback(useId, token, "success", SUCCESS_FEEDBACK_MS);

  const beginPending = (useId, timeoutMs, extra = {}) => {
    const runtime = interactions.get(useId);
    if (!runtime || runtime.state !== "idle") return null;
    clearRuntimeTimer(runtime);
    runtime.token += 1;
    runtime.state = "pending";
    runtime.baseline_revision = extra.baseline_revision ?? null;
    runtime.target_status = extra.target_status ?? null;
    const token = runtime.token;
    runtime.timer = globalThis.setTimeout(() => {
      if (!mounted || destroyed) return;
      const current = interactions.get(useId);
      if (!current || current.token !== token || current.state !== "pending") return;
      failOperation(useId, token);
    }, timeoutMs);
    render();
    return token;
  };

  const evaluateFeedback = (sourceId, nextState) => {
    for (const use of config.buttons) {
      if (use.definition.mode !== "toggle" || use.definition.state_source_id !== sourceId) continue;
      const runtime = interactions.get(use.id);
      if (!runtime || runtime.state !== "pending") continue;
      if (nextState.revision <= runtime.baseline_revision) continue;
      if (nextState.status === runtime.target_status) {
        setIdle(use.id, runtime.token);
      } else if (nextState.status === "intermediate") {
        render();
      } else if (TERMINAL.has(nextState.status) || nextState.status === "unavailable") {
        failOperation(use.id, runtime.token);
      }
    }
  };

  const applyStatePayload = (payload, generation) => {
    if (!mounted || destroyed || generation !== bindingGeneration) return;
    if (!Array.isArray(payload?.states)) return;
    for (const record of payload.states) {
      if (!validStateRecord(record) || !sourceStates.has(record.source_id)) continue;
      sourceStates.set(record.source_id, Object.freeze({ ...record }));
      evaluateFeedback(record.source_id, record);
    }
    render();
  };

  const failPendingToggles = () => {
    for (const use of config.buttons) {
      if (use.definition.mode !== "toggle") continue;
      const runtime = interactions.get(use.id);
      if (runtime?.state === "pending") failOperation(use.id, runtime.token);
    }
  };

  const releaseStateService = ({ failPending = false } = {}) => {
    bindingGeneration += 1;
    if (failPending) failPendingToggles();
    invokeUnsubscribe(stateUnsubscribe);
    stateUnsubscribe = null;
    boundService = null;
  };

  const resetSourcesUnavailable = (reason = "control_states_unavailable") => {
    sourceStates = new Map(toggleSourceIds().map((sourceId) => [sourceId, unavailableState(sourceId, reason)]));
  };

  const bindStateService = (service) => {
    if (service === boundService) return;
    releaseStateService({ failPending: boundService !== null });
    resetSourcesUnavailable();
    const sourceIds = toggleSourceIds();
    if (sourceIds.length === 0 || typeof service?.subscribe !== "function") { render(); return; }
    boundService = service;
    const generation = bindingGeneration;
    let unsubscribe = null;
    try {
      unsubscribe = service.subscribe(Object.freeze({ source_ids: Object.freeze(sourceIds) }), (payload) => applyStatePayload(payload, generation));
    } catch {
      boundService = null;
      render();
      return;
    }
    if (!mounted || destroyed || generation !== bindingGeneration) {
      invokeUnsubscribe(unsubscribe);
      return;
    }
    stateUnsubscribe = unsubscribe;
    render();
  };

  const handleCapability = (snapshot) => {
    if (!mounted || destroyed) return;
    const nextService = snapshot?.status === "available" && typeof snapshot.value?.subscribe === "function" ? snapshot.value : null;
    if (nextService) {
      bindStateService(nextService);
      return;
    }
    const hadService = boundService !== null;
    releaseStateService({ failPending: hadService });
    resetSourcesUnavailable(snapshot?.reason ?? "control_states_unavailable");
    render();
  };

  const bindCapability = () => {
    resetSourcesUnavailable();
    capabilityUnsubscribe = context.capabilities.subscribe("control.states", handleCapability);
  };

  const unbindCapability = () => {
    releaseStateService({ failPending: false });
    invokeUnsubscribe(capabilityUnsubscribe);
    capabilityUnsubscribe = null;
  };

  const actionResult = (useId, token, mode, result) => {
    const runtime = interactions.get(useId);
    if (!runtime || runtime.token !== token || runtime.state !== "pending") return;
    if (result?.status === "success") {
      if (mode === "trigger") succeedTrigger(useId, token);
      return;
    }
    failOperation(useId, token);
  };

  const executeAction = (use, token, action) => {
    let result;
    try {
      result = context.actions.execute(action);
    } catch {
      failOperation(use.id, token);
      return;
    }
    Promise.resolve(result).then(
      (next) => actionResult(use.id, token, use.definition.mode, next),
      () => failOperation(use.id, token),
    );
  };

  const activate = (useId) => {
    if (!mounted || destroyed) return false;
    const use = useMap().get(useId);
    const runtime = interactions.get(useId);
    if (!use || !runtime || runtime.state !== "idle") return false;
    if (use.definition.mode === "trigger") {
      const token = beginPending(use.id, use.definition.timeout_ms);
      if (token === null) return false;
      executeAction(use, token, use.definition.action);
      return true;
    }

    const sourceState = sourceStates.get(use.definition.state_source_id) ?? unavailableState(use.definition.state_source_id);
    const intent = toggleIntent(use.definition, sourceState);
    if (!intent) return false;
    const token = beginPending(use.id, use.definition.timeout_ms, { baseline_revision: sourceState.revision, target_status: intent.target_status });
    if (token === null) return false;
    executeAction(use, token, intent.action);
    return true;
  };

  const clearInteractions = () => {
    for (const runtime of interactions.values()) clearRuntimeTimer(runtime);
    interactions.clear();
  };

  const createDom = (nextTarget) => {
    if (!nextTarget || typeof nextTarget.appendChild !== "function") throw new TypeError("Dynamic Buttons mount target is invalid");
    target = nextTarget;
    document = target.ownerDocument;
    if (!document || typeof document.createElement !== "function") throw new TypeError("Dynamic Buttons mount target requires ownerDocument");
    styleNode = document.createElement("style");
    styleNode.setAttribute("data-jui-dynamic-buttons-style", "");
    styleNode.textContent = DYNAMIC_BUTTON_STYLES;
    root = document.createElement("section");
    root.setAttribute("data-jui-widget", "dynamic-buttons");
    target.appendChild(styleNode);
    target.appendChild(root);
  };

  const removeDom = () => {
    styleNode?.remove(); root?.remove(); styleNode = null; root = null; document = null; target = null;
  };

  return Object.freeze({
    mount(nextTarget) {
      if (destroyed || mounted) return false;
      createDom(nextTarget);
      mounted = true;
      bindCapability();
      render();
      return true;
    },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("Dynamic Buttons widget is destroyed");
      const validatedContext = validateContext(nextContext);
      const validatedConfig = validateResolvedDynamicButtonConfig(nextConfig);
      if (!mounted) { context = validatedContext; config = validatedConfig; clearInteractions(); interactions = buildInteractions(); resetSourcesUnavailable(); return true; }
      unbindCapability();
      clearInteractions();
      context = validatedContext;
      config = validatedConfig;
      interactions = buildInteractions();
      resetSourcesUnavailable();
      bindCapability();
      render();
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      if (mounted) unbindCapability();
      clearInteractions();
      mounted = false;
      removeDom();
      return true;
    },
  });
}
