import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { MANIFEST as WEATHER_MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.weather/manifest.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/widget.weather-today/manifest.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const providerEntryUrl = new URL(
  "../custom_components/jamesui/frontend/modules/provider.weather/index.js",
  import.meta.url,
).href;
const widgetEntryUrl = new URL(
  "../custom_components/jamesui/frontend/modules/widget.weather-today/index.js",
  import.meta.url,
).href;

function activateWeatherCapabilities(capabilities) {
  const values = new Map([
    ["weather.current", {
      time_zone: "Europe/Berlin",
      condition: "sunny",
      temperature: 18,
      temperature_unit: "°C",
      wind_speed: 8,
      wind_gust_speed: null,
      wind_speed_unit: "km/h",
      next_precipitation_at: null,
      next_precipitation_probability: null,
    }],
    ["weather.daily", {
      time_zone: "Europe/Berlin",
      units: { temperature: "°C" },
      items: [{ date: "2026-10-04", condition: "sunny", temperature_high: 20, temperature_low: 9, precipitation_probability: 10 }],
    }],
    ["weather.hourly", {
      time_zone: "Europe/Berlin",
      units: { temperature: "°C" },
      items: [{ datetime: "2099-10-04T09:00:00Z", condition: "sunny", temperature: 19, precipitation_probability: 5 }],
    }],
    ["weather.sun", {
      time_zone: "Europe/Berlin",
      next_rising: "2099-10-04T05:15:00Z",
      next_setting: "2099-10-04T16:45:00Z",
    }],
    ["weather.moon", { phase: "waxing_gibbous", illumination_percent: 72 }],
    ["weather.atmosphere", { scene_key: "clear-day" }],
  ]);

  const handles = [];
  for (const capability of MANIFEST.requires_capabilities) {
    const handle = capabilities.register(WEATHER_MANIFEST.id, capability);
    handle.available(values.get(capability));
    handles.push(handle);
  }
  return handles;
}

function trackingView(capabilities) {
  let activeSubscriptions = 0;
  return {
    get activeSubscriptions() { return activeSubscriptions; },
    get(capability) { return capabilities.get(capability); },
    subscribe(capability, listener, options) {
      activeSubscriptions += 1;
      const unsubscribe = capabilities.subscribe(capability, listener, options);
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        const removed = unsubscribe();
        if (removed) activeSubscriptions -= 1;
        return removed;
      };
    },
  };
}

test("real Weather Today runs through Registry and Loader with declared weather capabilities", async () => {
  const registry = createModuleRegistry();
  registry.register(WEATHER_MANIFEST, { entryUrl: providerEntryUrl });
  for (const capability of MANIFEST.requires_capabilities) {
    assert.equal(registry.getCapabilityProvider(capability), WEATHER_MANIFEST.id);
  }
  registry.register(MANIFEST, { entryUrl: widgetEntryUrl });

  const capabilities = createCapabilityRegistry({ moduleRegistry: registry });
  const providerHandles = activateWeatherCapabilities(capabilities);
  const trackedCapabilities = trackingView(capabilities);
  const overlays = createOverlayService();
  const health = createHealthService();
  const loader = createModuleLoader({
    registry,
    health,
    getContext: ({ id, manifest }) => Object.freeze({
      events: {},
      overlays,
      capabilities: trackedCapabilities,
      actions: {},
      module: Object.freeze({ id, type: manifest.type, version: manifest.version }),
    }),
  });

  assert.equal(await loader.load(MANIFEST.id, { config: {} }), true);
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  const document = createFakeDocument();
  const page = document.createElement("main");
  const heroTarget = document.createElement("section");
  heroTarget.setAttribute("data-jui-layout-slot", "hero");
  page.appendChild(heroTarget);

  assert.equal(loader.mount(MANIFEST.id, heroTarget), true);
  const firstRoot = heroTarget.querySelector('[data-jui-widget="weather-today"]');
  assert.ok(firstRoot);
  assert.equal(trackedCapabilities.activeSubscriptions, 6);

  const firstTrigger = firstRoot.querySelector('[data-jui-weather-forecast-trigger=""]');
  firstTrigger.dispatchEvent({ type: "click", target: firstTrigger });
  assert.equal(overlays.current?.id, "widget.weather-today:forecast");

  assert.equal(loader.update(MANIFEST.id, {}), true);
  assert.equal(heroTarget.querySelector('[data-jui-widget="weather-today"]'), firstRoot);
  assert.equal(trackedCapabilities.activeSubscriptions, 6);

  assert.equal(await loader.reload(MANIFEST.id), true);
  const secondRoot = heroTarget.querySelector('[data-jui-widget="weather-today"]');
  assert.ok(secondRoot);
  assert.notEqual(secondRoot, firstRoot);
  assert.equal(firstRoot.parentNode, null);
  assert.equal(overlays.current, null);
  assert.equal(trackedCapabilities.activeSubscriptions, 6);
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  const secondTrigger = secondRoot.querySelector('[data-jui-weather-forecast-trigger=""]');
  secondTrigger.dispatchEvent({ type: "click", target: secondTrigger });
  assert.equal(overlays.current?.id, "widget.weather-today:forecast");

  assert.equal(loader.destroy(MANIFEST.id), true);
  assert.equal(loader.isLoaded(MANIFEST.id), false);
  assert.equal(heroTarget.querySelector('[data-jui-widget="weather-today"]'), null);
  assert.equal(overlays.current, null);
  assert.equal(trackedCapabilities.activeSubscriptions, 0);

  for (const handle of providerHandles) handle.unregister();
  capabilities.destroy();
});

test("capability activation cannot bypass Module Registry declaration ownership", () => {
  const registry = createModuleRegistry();
  registry.register(MANIFEST, { entryUrl: widgetEntryUrl });
  const capabilities = createCapabilityRegistry({ moduleRegistry: registry });

  assert.throws(
    () => capabilities.register(WEATHER_MANIFEST.id, "weather.current"),
    /declaration owner/,
  );

  capabilities.destroy();
});
