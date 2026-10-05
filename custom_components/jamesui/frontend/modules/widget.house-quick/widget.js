import { createIcon } from "../../icons/icon.js";
import { MANIFEST } from "./manifest.js";
import { validateHouseQuickConfig } from "./config.js";
import { buildHouseQuickModel } from "./model.js";
import { HOUSE_QUICK_STYLES } from "./styles.js";

function validateContext(context) {
  if (!context || typeof context !== "object") throw new TypeError("House Quick context is required");
  if (!context.capabilities || typeof context.capabilities.subscribe !== "function") throw new TypeError("House Quick requires capabilities");
  if (!context.actions || typeof context.actions.execute !== "function") throw new TypeError("House Quick requires actions");
  if (context.module?.id !== MANIFEST.id) throw new TypeError(`House Quick module id must be ${MANIFEST.id}`);
  return context;
}

function syntheticSnapshot(capability) {
  return Object.freeze({ capability, status: "unavailable", value: null, reason: null, provider: null });
}

function createTextNode(document, attribute, text = "") {
  const node = document.createElement("span");
  node.setAttribute(attribute, "");
  node.textContent = text;
  return node;
}

export function createHouseQuickWidget(initialContext, initialConfig) {
  let context = validateContext(initialContext);
  let config = validateHouseQuickConfig(initialConfig);
  let mounted = false;
  let destroyed = false;
  let target = null;
  let document = null;
  let root = null;
  let styleNode = null;
  let capabilityUnsubscribes = [];
  let energyUnsubscribe = null;
  let energyService = null;
  let energyResults = [];
  const snapshots = new Map(MANIFEST.requires_capabilities.map((capability) => [capability, syntheticSnapshot(capability)]));

  const snapshotValue = (capability) => {
    const current = snapshots.get(capability) ?? syntheticSnapshot(capability);
    return current.status === "available" ? current.value : null;
  };

  const teardownEnergy = () => {
    energyUnsubscribe?.();
    energyUnsubscribe = null;
    energyService = null;
    energyResults = [];
  };

  const energyButtons = () => config.buttons.filter((button) => button.type === "energy");

  const render = () => {
    if (!mounted || !root) return;
    const model = buildHouseQuickModel({
      config,
      heating: snapshotValue("house.heatingZones"),
      lights: snapshotValue("house.lights"),
      ambientLights: snapshotValue("house.ambientLights"),
      devices: snapshotValue("house.devices"),
      energyResults,
    });
    const nodes = model.map((item) => {
      const button = document.createElement("button");
      button.setAttribute("type", "button");
      button.setAttribute("data-jui-house-quick-button", "");
      button.setAttribute("data-jui-house-quick-button-id", item.id);
      button.setAttribute("data-jui-house-quick-button-type", item.type);
      button.setAttribute("data-jui-house-quick-status", item.status);
      const iconHost = document.createElement("span");
      iconHost.setAttribute("data-jui-house-quick-icon", "");
      iconHost.appendChild(createIcon(document, item.icon, { size: "lg" }));
      const text = document.createElement("span");
      text.setAttribute("data-jui-house-quick-text", "");
      text.appendChild(createTextNode(document, "data-jui-house-quick-label", item.label));
      text.appendChild(createTextNode(document, "data-jui-house-quick-primary", item.primary));
      if (item.secondary) text.appendChild(createTextNode(document, "data-jui-house-quick-secondary", item.secondary));
      button.appendChild(iconHost);
      button.appendChild(text);
      const aria = [item.label, item.primary, item.secondary].filter(Boolean).join(", ");
      button.setAttribute("aria-label", aria);
      if (item.navigation) {
        button.addEventListener("click", () => {
          const action = { type: "navigate", route: item.navigation.route };
          if (item.navigation.target_id) action.target_id = item.navigation.target_id;
          Promise.resolve(context.actions.execute(action)).catch(() => {});
        });
      } else {
        button.setAttribute("disabled", "");
      }
      return button;
    });
    root.replaceChildren(...nodes);
  };

  const syncEnergy = () => {
    const snapshot = snapshots.get("house.energy") ?? syntheticSnapshot("house.energy");
    const nextService = snapshot.status === "available" ? snapshot.value : null;
    const buttons = energyButtons();
    if (energyService === nextService && energyUnsubscribe && buttons.length > 0) return;
    teardownEnergy();
    if (!nextService || typeof nextService.subscribe_windows !== "function" || buttons.length === 0) {
      render();
      return;
    }
    energyService = nextService;
    const names = new Map((nextService.configured_sources ?? []).map((source) => [source.id, source.name]));
    const windows = buttons.map((button) => Object.freeze({ request_id: button.id, source_id: button.source_id, window_minutes: button.average_window_minutes }));
    energyUnsubscribe = nextService.subscribe_windows({ windows }, (payload) => {
      energyResults = Object.freeze((payload?.results ?? []).map((result) => Object.freeze({ ...result, source_name: names.get(result.source_id) ?? result.source_id })));
      render();
    });
    render();
  };

  const onCapability = (capability, nextSnapshot) => {
    snapshots.set(capability, nextSnapshot ?? syntheticSnapshot(capability));
    if (capability === "house.energy") syncEnergy();
    else render();
  };

  const teardownCapabilities = () => {
    for (const unsubscribe of capabilityUnsubscribes) unsubscribe();
    capabilityUnsubscribes = [];
    teardownEnergy();
  };

  const setupCapabilities = () => {
    for (const capability of MANIFEST.requires_capabilities) {
      capabilityUnsubscribes.push(context.capabilities.subscribe(
        capability,
        (nextSnapshot) => onCapability(capability, nextSnapshot),
        { emitCurrent: true },
      ));
    }
  };

  const resetSnapshots = () => {
    for (const capability of MANIFEST.requires_capabilities) snapshots.set(capability, syntheticSnapshot(capability));
  };

  return Object.freeze({
    mount(nextTarget) {
      if (destroyed) throw new Error("House Quick widget is destroyed");
      if (mounted) return false;
      if (!nextTarget || typeof nextTarget.appendChild !== "function") throw new TypeError("House Quick mount target is required");
      target = nextTarget;
      document = target.ownerDocument;
      if (!document || typeof document.createElement !== "function") throw new TypeError("House Quick mount target requires ownerDocument");
      styleNode = document.createElement("style");
      styleNode.setAttribute("data-jui-house-quick-style", "");
      styleNode.textContent = HOUSE_QUICK_STYLES;
      root = document.createElement("section");
      root.setAttribute("data-jui-widget", "house-quick");
      target.appendChild(styleNode);
      target.appendChild(root);
      mounted = true;
      setupCapabilities();
      render();
      return true;
    },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("House Quick widget is destroyed");
      const validatedContext = validateContext(nextContext);
      const validatedConfig = validateHouseQuickConfig(nextConfig);
      if (!mounted) { context = validatedContext; config = validatedConfig; return true; }
      const capabilitiesChanged = validatedContext.capabilities !== context.capabilities;
      if (capabilitiesChanged) {
        teardownCapabilities();
        resetSnapshots();
      } else {
        teardownEnergy();
      }
      context = validatedContext;
      config = validatedConfig;
      if (capabilitiesChanged) setupCapabilities();
      else syncEnergy();
      render();
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      mounted = false;
      teardownCapabilities();
      if (root?.parentNode) root.parentNode.removeChild(root);
      if (styleNode?.parentNode) styleNode.parentNode.removeChild(styleNode);
      target = null;
      document = null;
      root = null;
      styleNode = null;
      return true;
    },
  });
}
