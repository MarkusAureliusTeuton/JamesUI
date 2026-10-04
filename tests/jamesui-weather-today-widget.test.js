import test from "node:test";
import assert from "node:assert/strict";

import { createOverlayService } from "../custom_components/jamesui/frontend/core/overlay-service.js";
import { createWeatherTodayWidget } from "../custom_components/jamesui/frontend/modules/widget.weather-today/widget.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const CAPS = ["weather.current", "weather.daily", "weather.hourly", "weather.sun", "weather.moon", "weather.atmosphere"];
const available = (capability, value) => ({ capability, status: "available", value, reason: null, provider: "provider.weather" });
const unavailable = (capability, reason = null) => ({ capability, status: "unavailable", value: null, reason, provider: "provider.weather" });

function initialSnapshots() {
  return new Map([
    ["weather.current", available("weather.current", { time_zone: "Europe/Berlin", condition: "sunny", temperature: 18, temperature_unit: "°C", wind_speed: 8, wind_speed_unit: "km/h", next_precipitation_at: null, next_precipitation_probability: null })],
    ["weather.daily", available("weather.daily", { time_zone: "Europe/Berlin", units: { temperature: "°C" }, items: [{ date: "2026-10-04", condition: "sunny", temperature_high: 20, temperature_low: 9, precipitation_probability: 10 }] })],
    ["weather.hourly", available("weather.hourly", { time_zone: "Europe/Berlin", units: { temperature: "°C" }, items: [{ datetime: "2026-10-04T09:00:00Z", condition: "sunny", temperature: 19, precipitation_probability: 5 }] })],
    ["weather.sun", available("weather.sun", { time_zone: "Europe/Berlin", next_rising: "2026-10-04T05:15:00Z", next_setting: "2026-10-04T16:45:00Z" })],
    ["weather.moon", available("weather.moon", { phase: "waxing_gibbous", illumination_percent: 72 })],
    ["weather.atmosphere", available("weather.atmosphere", { scene_key: "clear-day" })],
  ]);
}

function fakeCapabilities(seed = initialSnapshots()) {
  const listeners = new Map();
  const subscriptions = [];
  const unsubscriptions = [];
  return {
    subscriptions,
    unsubscriptions,
    get(capability) { return seed.get(capability) ?? unavailable(capability); },
    subscribe(capability, listener, { emitCurrent = true } = {}) {
      subscriptions.push(capability);
      if (!listeners.has(capability)) listeners.set(capability, new Set());
      listeners.get(capability).add(listener);
      if (emitCurrent) listener(this.get(capability));
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        listeners.get(capability)?.delete(listener);
        unsubscriptions.push(capability);
        return true;
      };
    },
    publish(capability, snapshot) {
      seed.set(capability, snapshot);
      for (const listener of listeners.get(capability) ?? []) listener(snapshot);
    },
  };
}

function fakeRuntime(now = new Date(2026, 9, 4, 10, 34, 20, 250)) {
  let current = new Date(now);
  const scheduled = [];
  const cleared = [];
  return {
    scheduled,
    cleared,
    now: () => new Date(current),
    setNow(value) { current = new Date(value); },
    setTimeout(callback, ms) { const handle = { callback, ms, active: true }; scheduled.push(handle); return handle; },
    clearTimeout(handle) { if (handle) { handle.active = false; cleared.push(handle); } },
  };
}

function context(capabilities, overlays = createOverlayService()) {
  return {
    events: {}, actions: {}, capabilities, overlays,
    module: { id: "widget.weather-today", type: "widget", version: "1.0.0" },
  };
}

test("mount creates one stable semantic hero, six subscriptions and one aligned clock timeout", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const capabilities = fakeCapabilities();
  const overlays = createOverlayService();
  const runtime = fakeRuntime();
  const widget = createWeatherTodayWidget(context(capabilities, overlays), {}, runtime);

  assert.equal(widget.mount(target), true);
  assert.equal(widget.mount(target), false);
  const root = target.querySelector('[data-jui-widget="weather-today"]');
  assert.ok(root);
  assert.equal(target.querySelectorAll('style[data-jui-weather-today-style=""]').length, 1);
  assert.deepEqual(capabilities.subscriptions, CAPS);
  assert.equal(runtime.scheduled.length, 1);
  assert.equal(runtime.scheduled[0].ms, 39750);
  assert.equal(root.querySelector('[data-jui-weather-clock=""]').textContent, "10:34");
  assert.match(root.querySelector('[data-jui-weather-date=""]').textContent, /Sonntag/i);
  assert.equal(root.querySelector('[data-jui-weather-temperature=""]').textContent, "18 °C");
  assert.equal(root.querySelector('[data-jui-weather-condition=""]').textContent, "Sonnig");
  assert.equal(root.querySelectorAll('[data-jui-weather-fact=""]').length, 7);
  assert.equal(root.querySelector('[data-jui-weather-background=""]').getAttribute("src"), "/jamesui_static/assets/alpine/clear-day.webp");

  widget.destroy();
});

test("capability updates mutate the existing hero and neutralize unknown atmosphere without replacing root", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const capabilities = fakeCapabilities();
  const widget = createWeatherTodayWidget(context(capabilities), {}, fakeRuntime());
  widget.mount(target);
  const root = target.querySelector('[data-jui-widget="weather-today"]');
  const trigger = root.querySelector('[data-jui-weather-forecast-trigger=""]');

  capabilities.publish("weather.current", available("weather.current", { time_zone: "Europe/Berlin", condition: "rainy", temperature: 11.5, temperature_unit: "°C", wind_speed: null, wind_gust_speed: null, wind_speed_unit: "km/h", next_precipitation_at: "2026-10-04T12:00:00Z", next_precipitation_probability: 70 }));
  capabilities.publish("weather.atmosphere", available("weather.atmosphere", { scene_key: "unknown-new" }));

  assert.equal(target.querySelector('[data-jui-widget="weather-today"]'), root);
  assert.equal(root.querySelector('[data-jui-weather-forecast-trigger=""]'), trigger);
  assert.equal(root.querySelector('[data-jui-weather-temperature=""]').textContent, "11,5 °C");
  assert.equal(root.querySelector('[data-jui-weather-condition=""]').textContent, "Regen");
  assert.equal(root.querySelector('[data-jui-weather-background=""]').getAttribute("src"), null);
  widget.destroy();
});

test("temperature remains an accessible forecast trigger and opens caller-owned live DOM content", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const capabilities = fakeCapabilities();
  const overlays = createOverlayService();
  const widget = createWeatherTodayWidget(context(capabilities, overlays), {}, fakeRuntime());
  widget.mount(target);
  const root = target.querySelector('[data-jui-widget="weather-today"]');
  const trigger = root.querySelector('[data-jui-weather-forecast-trigger=""]');
  assert.equal(trigger.tagName, "BUTTON");
  assert.equal(trigger.getAttribute("type"), "button");
  assert.match(trigger.getAttribute("aria-label"), /Wetterprognose öffnen/);

  trigger.dispatchEvent({ type: "click", target: trigger });
  assert.equal(overlays.current.id, "widget.weather-today:forecast");
  assert.equal(overlays.current.content.nodeType, 1);
  const overlayRoot = overlays.current.content;
  assert.equal(root.parentNode, target);

  capabilities.publish("weather.hourly", available("weather.hourly", { time_zone: "Europe/Berlin", units: { temperature: "°C" }, items: [{ datetime: "2026-10-04T10:00:00Z", condition: "rainy", temperature: 15, precipitation_probability: 80 }] }));
  assert.equal(overlays.current.content, overlayRoot);
  assert.equal(overlayRoot.querySelectorAll('[data-jui-weather-forecast-hour=""]').length, 1);
  widget.destroy();
});

test("forecast still opens when current weather is unavailable but forecast data exists", () => {
  const snapshots = initialSnapshots();
  snapshots.set("weather.current", unavailable("weather.current", "source_unavailable"));
  const capabilities = fakeCapabilities(snapshots);
  const overlays = createOverlayService();
  const document = createFakeDocument();
  const target = document.createElement("div");
  const widget = createWeatherTodayWidget(context(capabilities, overlays), {}, fakeRuntime());
  widget.mount(target);
  const trigger = target.querySelector('[data-jui-weather-forecast-trigger=""]');
  assert.equal(target.querySelector('[data-jui-weather-temperature=""]').textContent, "—");
  assert.equal(trigger.getAttribute("aria-label"), "Wetterprognose öffnen");
  trigger.dispatchEvent({ type: "click", target: trigger });
  assert.equal(overlays.current.id, "widget.weather-today:forecast");
  widget.destroy();
});

test("clock callback reschedules from fresh time and repeated updates do not multiply timers or subscriptions", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const capabilities = fakeCapabilities();
  const overlays = createOverlayService();
  const runtime = fakeRuntime();
  const ctx = context(capabilities, overlays);
  const widget = createWeatherTodayWidget(ctx, {}, runtime);
  widget.mount(target);
  const first = runtime.scheduled[0];
  runtime.setNow(new Date(2026, 9, 4, 10, 35, 0, 0));
  first.callback();
  assert.equal(runtime.scheduled.length, 2);
  assert.equal(runtime.scheduled[1].ms, 60000);
  assert.equal(target.querySelector('[data-jui-weather-clock=""]').textContent, "10:35");

  widget.update(ctx, {});
  widget.update(ctx, {});
  assert.equal(capabilities.subscriptions.length, 6);
  assert.equal(runtime.scheduled.length, 2);
  widget.destroy();
});

test("update atomically rebinds changed registries/services while protecting a newer unrelated overlay", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const oldCaps = fakeCapabilities();
  const newCaps = fakeCapabilities();
  const oldOverlays = createOverlayService();
  const newOverlays = createOverlayService();
  const runtime = fakeRuntime();
  const widget = createWeatherTodayWidget(context(oldCaps, oldOverlays), {}, runtime);
  widget.mount(target);
  target.querySelector('[data-jui-weather-forecast-trigger=""]').dispatchEvent({ type: "click" });
  assert.equal(oldOverlays.current.id, "widget.weather-today:forecast");

  assert.throws(() => widget.update(context(newCaps, newOverlays), { bad: true }), TypeError);
  assert.equal(oldCaps.unsubscriptions.length, 0);
  assert.equal(oldOverlays.current.id, "widget.weather-today:forecast");

  widget.update(context(newCaps, newOverlays), {});
  assert.equal(oldCaps.unsubscriptions.length, 6);
  assert.equal(newCaps.subscriptions.length, 6);
  assert.equal(oldOverlays.current, null);

  const unrelated = document.createElement("div");
  newOverlays.open({ id: "unrelated", content: unrelated });
  widget.destroy();
  assert.equal(newOverlays.current.id, "unrelated");
});

test("destroy removes all owned resources and is idempotent", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const capabilities = fakeCapabilities();
  const overlays = createOverlayService();
  const runtime = fakeRuntime();
  const widget = createWeatherTodayWidget(context(capabilities, overlays), {}, runtime);
  widget.mount(target);
  target.querySelector('[data-jui-weather-forecast-trigger=""]').dispatchEvent({ type: "click" });
  assert.equal(widget.destroy(), true);
  assert.equal(widget.destroy(), false);
  assert.equal(capabilities.unsubscriptions.length, 6);
  assert.equal(runtime.cleared.length, 1);
  assert.equal(target.querySelector('[data-jui-widget="weather-today"]'), null);
  assert.equal(target.querySelectorAll('style[data-jui-weather-today-style=""]').length, 0);
  assert.equal(overlays.current, null);
});
