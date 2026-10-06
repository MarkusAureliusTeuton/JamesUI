import { createIcon } from "../../icons/icon.js";
import { MANIFEST } from "./manifest.js";
import { validateHouseQuickConfig } from "./config.js";
import { buildHouseQuickModel } from "./model.js";
import { HOUSE_QUICK_STYLES } from "./styles.js";

const STATUS_LABELS = Object.freeze({
  active: "Aktiv",
  warning: "Warnung",
  critical: "Kritisch",
});

function validateContext(context) {
  if (!context || typeof context !== "object") throw new TypeError("House Quick context is required");
  if (!context.capabilities || typeof context.capabilities.subscribe !== "function") {
    throw new TypeError("House Quick requires capabilities");
  }
  if (!context.actions || typeof context.actions.execute !== "function") {
    throw new TypeError("House Quick requires actions");
  }
  if (context.module?.id !== MANIFEST.id) throw new TypeError(`House Quick module id must be ${MANIFEST.id}`);
  return context;
}

function syntheticSnapshot(capability) {
  return Object.freeze({ capability, status: "unavailable", value: null, reason: null, provider: null });
}

function invokeUnsubscribe(unsubscribe) {
  if (typeof unsubscribe !== "function") return;
  try { Promise.resolve(unsubscribe()).catch(() => {}); } catch { /* best effort */ }
}

function element(document, tagName, attribute = null, text = "") {
  const node = document.createElement(tagName);
  if (attribute) node.setAttribute(attribute, "");
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
  let styleNode = null;
  let root = null;
  let capabilityUnsubscribes = [];
  let energyUnsubscribe = null;
  let energyBindingGeneration = 0;
  let energyResults = Object.freeze([]);
  const snapshots = new Map(MANIFEST.requires_capabilities.map((capability) => [capability, syntheticSnapshot(capability)]));

  const snapshot = (capability) => snapshots.get(capability) ?? syntheticSnapshot(capability);

  const dispatchNavigation = (navigation) => {
    if (!navigation || destroyed || !mounted) return false;
    const action = { type: "navigate", route: navigation.route };
    if (navigation.target_id !== undefined) action.target_id = navigation.target_id;
    try {
      const result = context.actions.execute(action);
      Promise.resolve(result).catch(() => {});
      return true;
    } catch {
      return false;
    }
  };

  const render = () => {
    if (!mounted || !root) return;
    const model = buildHouseQuickModel({
      config,
      heating: snapshot("house.heatingZones"),
      lights: snapshot("house.lights"),
      ambientLights: snapshot("house.ambientLights"),
      devices: snapshot("house.devices"),
      energy: snapshot("house.energy"),
      energyResults,
    });

    const nodes = model.map((item) => {
      const button = document.createElement("button");
      button.setAttribute("type", "button");
      button.setAttribute("data-jui-house-quick-button", "");
      button.setAttribute("data-jui-house-quick-id", item.id);
      button.setAttribute("data-jui-house-quick-status", item.status);
      button.setAttribute("data-jui-house-quick-actionable", item.navigation ? "true" : "false");
      if (!item.navigation) button.setAttribute("aria-disabled", "true");

      const iconHost = element(document, "span", "data-jui-house-quick-icon");
      iconHost.appendChild(createIcon(document, item.icon, { size: "lg" }));
      const copy = element(document, "span", "data-jui-house-quick-copy");
      copy.appendChild(element(document, "span", "data-jui-house-quick-label", item.label));
      copy.appendChild(element(document, "span", "data-jui-house-quick-primary", item.primary));
      for (const secondary of item.secondary) {
        copy.appendChild(element(document, "span", "data-jui-house-quick-secondary", secondary));
      }
      const statusLabel = STATUS_LABELS[item.status];
      if (statusLabel) copy.appendChild(element(document, "span", "data-jui-house-quick-status-label", statusLabel));

      button.appendChild(iconHost);
      button.appendChild(copy);
      if (item.navigation) button.addEventListener("click", () => dispatchNavigation(item.navigation));
      return button;
    });
    root.replaceChildren(...nodes);
  };

  const releaseEnergy = () => {
    energyBindingGeneration += 1;
    invokeUnsubscribe(energyUnsubscribe);
    energyUnsubscribe = null;
    energyResults = Object.freeze([]);
  };

  const bindEnergy = () => {
    releaseEnergy();
    if (!mounted || destroyed) return;
    const energyButtons = config.buttons.filter((button) => button.type === "energy");
    const energySnapshot = snapshot("house.energy");
    const service = energySnapshot.status === "available" ? energySnapshot.value : null;
    if (energyButtons.length === 0 || typeof service?.subscribe_windows !== "function") {
      render();
      return;
    }

    const generation = energyBindingGeneration;
    const request = Object.freeze({
      windows: Object.freeze(energyButtons.map((button) => Object.freeze({
        request_id: button.id,
        source_id: button.source_id,
        window_minutes: button.average_window_minutes,
      }))),
    });
    let unsubscribe = null;
    try {
      unsubscribe = service.subscribe_windows(request, (payload) => {
        if (!mounted || destroyed || generation !== energyBindingGeneration) return;
        energyResults = Object.freeze(Array.isArray(payload?.results) ? [...payload.results] : []);
        render();
      });
    } catch {
      render();
      return;
    }
    if (!mounted || destroyed || generation !== energyBindingGeneration) {
      invokeUnsubscribe(unsubscribe);
      return;
    }
    energyUnsubscribe = unsubscribe;
    render();
  };

  const resetSnapshots = () => {
    for (const capability of MANIFEST.requires_capabilities) snapshots.set(capability, syntheticSnapshot(capability));
  };

  const unbindCapabilities = () => {
    releaseEnergy();
    for (const unsubscribe of capabilityUnsubscribes) invokeUnsubscribe(unsubscribe);
    capabilityUnsubscribes = [];
  };

  const bindCapabilities = () => {
    for (const capability of MANIFEST.requires_capabilities) {
      const unsubscribe = context.capabilities.subscribe(capability, (nextSnapshot) => {
        if (!mounted || destroyed) return;
        snapshots.set(capability, nextSnapshot ?? syntheticSnapshot(capability));
        if (capability === "house.energy") bindEnergy();
        else render();
      });
      capabilityUnsubscribes.push(unsubscribe);
    }
  };

  const createDom = (nextTarget) => {
    if (!nextTarget || typeof nextTarget.appendChild !== "function") throw new TypeError("House Quick mount target is invalid");
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
  };

  const removeDom = () => {
    styleNode?.remove();
    root?.remove();
    styleNode = null;
    root = null;
    document = null;
    target = null;
  };

  return Object.freeze({
    mount(nextTarget) {
      if (destroyed || mounted) return false;
      createDom(nextTarget);
      mounted = true;
      bindCapabilities();
      render();
      return true;
    },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("House Quick widget is destroyed");
      const validatedContext = validateContext(nextContext);
      const validatedConfig = validateHouseQuickConfig(nextConfig);
      if (!mounted) {
        context = validatedContext;
        config = validatedConfig;
        return true;
      }
      unbindCapabilities();
      context = validatedContext;
      config = validatedConfig;
      resetSnapshots();
      bindCapabilities();
      render();
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      if (mounted) unbindCapabilities();
      mounted = false;
      removeDom();
      return true;
    },
  });
}
