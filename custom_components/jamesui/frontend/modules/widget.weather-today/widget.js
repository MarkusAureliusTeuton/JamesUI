import { createIcon } from "../../icons/icon.js";
import { MANIFEST } from "./manifest.js";
import { validateWeatherTodayConfig } from "./config.js";
import { buildHeroModel } from "./model.js";
import { formatDeviceClock, formatDeviceDate } from "./format.js";
import { createForecastOverlay } from "./overlay.js";
import { WEATHER_TODAY_STYLES } from "./styles.js";

const OVERLAY_ID = "widget.weather-today:forecast";

function validateContext(context) {
  if (!context || typeof context !== "object") throw new TypeError("Weather Today context is required");
  if (!context.capabilities || typeof context.capabilities.subscribe !== "function") throw new TypeError("Weather Today requires capabilities");
  if (!context.overlays || typeof context.overlays.open !== "function" || typeof context.overlays.subscribe !== "function") throw new TypeError("Weather Today requires overlays");
  if (context.module?.id !== MANIFEST.id) throw new TypeError(`Weather Today module id must be ${MANIFEST.id}`);
  return context;
}

function validateRuntime(runtime) {
  if (!runtime || typeof runtime.now !== "function" || typeof runtime.setTimeout !== "function" || typeof runtime.clearTimeout !== "function") {
    throw new TypeError("Weather Today runtime is invalid");
  }
  return runtime;
}

function syntheticSnapshot(capability) {
  return Object.freeze({ capability, status: "unavailable", value: null, reason: null, provider: null });
}

function createElement(document, tagName, attribute = null, text = "") {
  const node = document.createElement(tagName);
  if (attribute) node.setAttribute(attribute, "");
  node.textContent = text;
  return node;
}

export function createWeatherTodayWidget(initialContext, initialConfig, runtime) {
  let context = validateContext(initialContext);
  let config = validateWeatherTodayConfig(initialConfig);
  validateRuntime(runtime);

  let mounted = false;
  let destroyed = false;
  let target = null;
  let document = null;
  let styleNode = null;
  let root = null;
  let background = null;
  let dateNode = null;
  let clockNode = null;
  let currentIcon = null;
  let forecastTrigger = null;
  let temperatureNode = null;
  let conditionNode = null;
  let factNodes = new Map();
  let capabilityUnsubscribes = [];
  let overlayUnsubscribe = null;
  let clockHandle = null;
  let overlayController = null;
  let overlayClose = null;
  const snapshots = new Map(MANIFEST.requires_capabilities.map((capability) => [capability, syntheticSnapshot(capability)]));

  const snapshot = (capability) => snapshots.get(capability) ?? syntheticSnapshot(capability);

  const updateIconHost = (host, iconId, size = "md") => {
    host.replaceChildren();
    if (iconId) host.appendChild(createIcon(document, iconId, { size }));
  };

  const renderClock = () => {
    if (!mounted || !dateNode || !clockNode) return;
    const now = runtime.now();
    dateNode.textContent = formatDeviceDate(now);
    clockNode.textContent = formatDeviceClock(now);
  };

  const nextMinuteDelay = (now) => {
    const elapsed = now.getSeconds() * 1000 + now.getMilliseconds();
    return elapsed === 0 ? 60000 : 60000 - elapsed;
  };

  const scheduleClock = () => {
    if (!mounted || destroyed || clockHandle !== null) return;
    const now = runtime.now();
    clockHandle = runtime.setTimeout(() => {
      clockHandle = null;
      if (!mounted || destroyed) return;
      renderClock();
      renderHero();
      scheduleClock();
    }, nextMinuteDelay(now));
  };

  const updateOpenForecast = () => {
    if (!overlayController) return;
    overlayController.update({
      hourlySnapshot: snapshot("weather.hourly"),
      dailySnapshot: snapshot("weather.daily"),
      now: runtime.now(),
    });
  };

  const renderHero = () => {
    if (!mounted || !root) return;
    const model = buildHeroModel({
      currentSnapshot: snapshot("weather.current"),
      dailySnapshot: snapshot("weather.daily"),
      sunSnapshot: snapshot("weather.sun"),
      moonSnapshot: snapshot("weather.moon"),
      atmosphereSnapshot: snapshot("weather.atmosphere"),
      now: runtime.now(),
    });

    if (model.backgroundAsset) background.setAttribute("src", model.backgroundAsset);
    else background.removeAttribute("src");

    updateIconHost(currentIcon, model.condition.iconId, "hero");
    temperatureNode.textContent = model.temperature;
    conditionNode.textContent = model.condition.label;
    conditionNode.setAttribute("data-jui-weather-condition-emphasis", model.condition.emphasis);
    forecastTrigger.setAttribute(
      "aria-label",
      model.temperature === "—" ? "Wetterprognose öffnen" : `Wetterprognose öffnen, aktuell ${model.temperature}`,
    );

    for (const fact of model.facts) {
      const nodes = factNodes.get(fact.key);
      if (!nodes) continue;
      nodes.label.textContent = fact.label;
      nodes.value.textContent = fact.value;
      nodes.root.setAttribute("data-jui-weather-fact-emphasis", fact.emphasis);
      updateIconHost(nodes.icon, fact.iconId, "sm");
    }
    updateOpenForecast();
  };

  const dropForecastReferences = () => {
    const controller = overlayController;
    overlayController = null;
    overlayClose = null;
    controller?.destroy();
  };

  const closeOwnForecast = () => {
    const controller = overlayController;
    const close = overlayClose;
    overlayController = null;
    overlayClose = null;
    close?.();
    controller?.destroy();
  };

  const openForecast = () => {
    if (!mounted || destroyed) return false;
    if (overlayController && context.overlays.current?.id === OVERLAY_ID) {
      updateOpenForecast();
      return true;
    }
    dropForecastReferences();
    const controller = createForecastOverlay(document, { onClose: () => closeOwnForecast() });
    controller.update({
      hourlySnapshot: snapshot("weather.hourly"),
      dailySnapshot: snapshot("weather.daily"),
      now: runtime.now(),
    });
    overlayController = controller;
    try {
      overlayClose = context.overlays.open({ id: OVERLAY_ID, title: "Wetterprognose", content: controller.root });
    } catch (error) {
      dropForecastReferences();
      throw error;
    }
    return true;
  };

  const forecastTriggerListener = () => openForecast();

  const createHeroDom = (nextTarget) => {
    target = nextTarget;
    document = target.ownerDocument;
    if (!document || typeof document.createElement !== "function") throw new TypeError("Weather Today mount target requires ownerDocument");

    styleNode = document.createElement("style");
    styleNode.setAttribute("data-jui-weather-today-style", "");
    styleNode.textContent = WEATHER_TODAY_STYLES;

    root = document.createElement("section");
    root.setAttribute("data-jui-widget", "weather-today");

    background = document.createElement("img");
    background.setAttribute("data-jui-weather-background", "");
    background.setAttribute("alt", "");
    background.setAttribute("aria-hidden", "true");

    const shade = createElement(document, "div", "data-jui-weather-shade");
    const content = createElement(document, "div", "data-jui-weather-content");
    const clockGroup = createElement(document, "div", "data-jui-weather-clock-group");
    dateNode = createElement(document, "div", "data-jui-weather-date");
    clockNode = createElement(document, "div", "data-jui-weather-clock");
    clockGroup.appendChild(dateNode);
    clockGroup.appendChild(clockNode);

    const current = createElement(document, "div", "data-jui-weather-current");
    currentIcon = createElement(document, "div", "data-jui-weather-current-icon");
    forecastTrigger = document.createElement("button");
    forecastTrigger.setAttribute("type", "button");
    forecastTrigger.setAttribute("data-jui-weather-forecast-trigger", "");
    temperatureNode = createElement(document, "span", "data-jui-weather-temperature", "—");
    conditionNode = createElement(document, "span", "data-jui-weather-condition", "Wetterdaten nicht verfügbar");
    forecastTrigger.appendChild(temperatureNode);
    forecastTrigger.appendChild(conditionNode);
    forecastTrigger.addEventListener("click", forecastTriggerListener);
    current.appendChild(currentIcon);
    current.appendChild(forecastTrigger);

    const facts = createElement(document, "div", "data-jui-weather-facts");
    factNodes = new Map();
    for (const key of ["maximum", "minimum", "precipitation", "wind", "sunrise", "sunset", "moon"]) {
      const factRoot = document.createElement("div");
      factRoot.setAttribute("data-jui-weather-fact", "");
      factRoot.setAttribute("data-jui-weather-fact-key", key);
      const icon = createElement(document, "span", "data-jui-weather-fact-icon");
      const text = createElement(document, "span", "data-jui-weather-fact-text");
      const label = createElement(document, "span", "data-jui-weather-fact-label");
      const value = createElement(document, "span", "data-jui-weather-fact-value", "—");
      text.appendChild(label);
      text.appendChild(value);
      factRoot.appendChild(icon);
      factRoot.appendChild(text);
      facts.appendChild(factRoot);
      factNodes.set(key, { root: factRoot, icon, label, value });
    }

    content.appendChild(clockGroup);
    content.appendChild(current);
    content.appendChild(facts);
    root.appendChild(background);
    root.appendChild(shade);
    root.appendChild(content);
    target.appendChild(styleNode);
    target.appendChild(root);
  };

  const teardownCapabilities = () => {
    for (const unsubscribe of capabilityUnsubscribes) unsubscribe();
    capabilityUnsubscribes = [];
  };

  const setupCapabilities = () => {
    for (const capability of MANIFEST.requires_capabilities) {
      capabilityUnsubscribes.push(context.capabilities.subscribe(capability, (nextSnapshot) => {
        snapshots.set(capability, nextSnapshot ?? syntheticSnapshot(capability));
        renderHero();
      }, { emitCurrent: true }));
    }
  };

  const teardownOverlayObserver = () => {
    overlayUnsubscribe?.();
    overlayUnsubscribe = null;
  };

  const setupOverlayObserver = () => {
    overlayUnsubscribe = context.overlays.subscribe((current) => {
      if (overlayController && current?.id !== OVERLAY_ID) dropForecastReferences();
    });
  };

  return Object.freeze({
    mount(nextTarget) {
      if (destroyed) throw new Error("Weather Today widget is destroyed");
      if (mounted) return false;
      if (!nextTarget || typeof nextTarget.appendChild !== "function") throw new TypeError("Weather Today mount target is required");
      createHeroDom(nextTarget);
      mounted = true;
      setupCapabilities();
      setupOverlayObserver();
      renderClock();
      renderHero();
      scheduleClock();
      return true;
    },

    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("Weather Today widget is destroyed");
      const validatedContext = validateContext(nextContext);
      const validatedConfig = validateWeatherTodayConfig(nextConfig);
      if (!mounted) {
        context = validatedContext;
        config = validatedConfig;
        return true;
      }

      const capabilitiesChanged = validatedContext.capabilities !== context.capabilities;
      const overlaysChanged = validatedContext.overlays !== context.overlays;
      if (overlaysChanged) {
        closeOwnForecast();
        teardownOverlayObserver();
      }
      if (capabilitiesChanged) teardownCapabilities();
      context = validatedContext;
      config = validatedConfig;
      if (capabilitiesChanged) setupCapabilities();
      if (overlaysChanged) setupOverlayObserver();
      renderHero();
      return true;
    },

    destroy() {
      if (destroyed) return false;
      destroyed = true;
      mounted = false;
      closeOwnForecast();
      teardownOverlayObserver();
      teardownCapabilities();
      if (clockHandle !== null) {
        runtime.clearTimeout(clockHandle);
        clockHandle = null;
      }
      forecastTrigger?.removeEventListener("click", forecastTriggerListener);
      if (root?.parentNode) root.parentNode.removeChild(root);
      if (styleNode?.parentNode) styleNode.parentNode.removeChild(styleNode);
      target = null;
      document = null;
      root = null;
      styleNode = null;
      background = null;
      dateNode = null;
      clockNode = null;
      currentIcon = null;
      forecastTrigger = null;
      temperatureNode = null;
      conditionNode = null;
      factNodes = new Map();
      return true;
    },
  });
}
