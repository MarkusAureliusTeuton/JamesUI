import test from "node:test";
import assert from "node:assert/strict";

import { createHouseQuickWidget } from "../custom_components/jamesui/frontend/modules/widget.house-quick/widget.js";

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    for (const child of children) this.appendChild(child);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  click() {
    for (const listener of [...(this.listeners.get("click") ?? [])]) listener({ type: "click", currentTarget: this });
  }
}

class FakeDocument {
  createElement(tagName) { return new FakeElement(tagName, this); }
  createElementNS(_namespace, tagName) { return new FakeElement(tagName, this); }
}

function target() {
  const document = new FakeDocument();
  return new FakeElement("host", document);
}

function findAll(root, attribute, value = null, out = []) {
  if (root.getAttribute?.(attribute) !== null && (value === null || root.getAttribute(attribute) === value)) out.push(root);
  for (const child of root.children ?? []) findAll(child, attribute, value, out);
  return out;
}

function textOf(node) {
  return [node.textContent, ...(node.children ?? []).map(textOf)].filter(Boolean).join(" ");
}

const available = (capability, value) => ({ capability, status: "available", value, reason: null, provider: "test" });
const unavailable = (capability, reason = "offline") => ({ capability, status: "unavailable", value: null, reason, provider: "test" });

function capabilityHarness(initial = {}) {
  const snapshots = new Map(Object.entries(initial));
  const listeners = new Map();
  return {
    subscribe(capability, listener, { emitCurrent = true } = {}) {
      if (!listeners.has(capability)) listeners.set(capability, new Set());
      listeners.get(capability).add(listener);
      if (emitCurrent) listener(snapshots.get(capability) ?? unavailable(capability));
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        listeners.get(capability)?.delete(listener);
        return true;
      };
    },
    set(capability, snapshot) {
      snapshots.set(capability, snapshot);
      for (const listener of [...(listeners.get(capability) ?? [])]) listener(snapshot);
    },
    activeSubscriptions() {
      return [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
    },
  };
}

function context(capabilities, actionResult = { status: "success" }) {
  const actionCalls = [];
  return {
    value: {
      module: { id: "widget.house-quick" },
      capabilities,
      actions: {
        execute(action) { actionCalls.push(action); return actionResult; },
      },
    },
    actionCalls,
  };
}

function baseSnapshots() {
  return {
    "house.heatingZones": available("house.heatingZones", { version: 1, zones: [
      { id: "living", name: "Wohnen", current_temperature_c: 21.4, target_temperature_c: 22, heating_demand: false, auto_regulation_enabled: true, availability: "available", reason: null },
      { id: "office", name: "Büro", current_temperature_c: 20, target_temperature_c: 21, heating_demand: true, auto_regulation_enabled: false, availability: "available", reason: null },
    ] }),
    "house.lights": available("house.lights", { version: 1, items: [], on_count: 3, total_count: 8, unavailable_count: 0 }),
    "house.ambientLights": available("house.ambientLights", { version: 1, items: [], on_count: 0, total_count: 4, unavailable_count: 0 }),
    "house.devices": available("house.devices", { version: 1, items: [], active_count: 1, update_count: 1, warning_count: 0, fault_count: 0, unreachable_count: 0 }),
  };
}

function energyService({ name = "Haus gesamt", results = [] } = {}) {
  const requests = [];
  const listeners = [];
  let releases = 0;
  return {
    value: Object.freeze({
      version: 1,
      configured_sources: Object.freeze([{ id: "house", name }]),
      subscribe_windows(request, listener) {
        requests.push(request);
        listeners.push(listener);
        listener({ results });
        let active = true;
        return () => { if (!active) return false; active = false; releases += 1; return true; };
      },
    }),
    requests,
    listeners,
    get releases() { return releases; },
  };
}

function buttonsIn(host) {
  return findAll(host, "data-jui-house-quick-button");
}

test("renders an arbitrary configured subset in exact order with multiple heating zones", () => {
  const caps = capabilityHarness(baseSnapshots());
  const ctx = context(caps);
  const widget = createHouseQuickWidget(ctx.value, { buttons: [
    { id: "office", type: "heating_zone", source_id: "office" },
    { id: "lights", type: "lights" },
    { id: "living", type: "heating_zone", source_id: "living" },
  ] });
  const host = target();
  assert.equal(widget.mount(host), true);
  const buttons = buttonsIn(host);
  assert.deepEqual(buttons.map((button) => button.getAttribute("data-jui-house-quick-id")), ["office", "lights", "living"]);
  assert.match(textOf(buttons[0]), /Büro/);
  assert.match(textOf(buttons[1]), /3 von 8 an/);
  assert.equal(buttons[2].getAttribute("data-jui-house-quick-status"), "active");
  widget.destroy();
});

test("binds all configured energy buttons through one per-instance window subscription", () => {
  const service = energyService({ results: [
    { request_id: "energy-15", source_id: "house", window_minutes: 15, current_power_w: 1800, average_power_w: 2000, quality: "full", reason: null },
    { request_id: "energy-60", source_id: "house", window_minutes: 60, current_power_w: 1800, average_power_w: 3600, quality: "full", reason: null },
  ] });
  const caps = capabilityHarness({ ...baseSnapshots(), "house.energy": available("house.energy", service.value) });
  const widget = createHouseQuickWidget(context(caps).value, { buttons: [
    { id: "energy-15", type: "energy", source_id: "house", average_window_minutes: 15, warning_threshold_w: 3000, critical_threshold_w: 5000 },
    { id: "energy-60", type: "energy", source_id: "house", average_window_minutes: 60, warning_threshold_w: 3000, critical_threshold_w: 5000 },
  ] });
  const host = target();
  widget.mount(host);
  assert.equal(service.requests.length, 1);
  assert.deepEqual(service.requests[0].windows, [
    { request_id: "energy-15", source_id: "house", window_minutes: 15 },
    { request_id: "energy-60", source_id: "house", window_minutes: 60 },
  ]);
  const buttons = buttonsIn(host);
  assert.equal(buttons[0].getAttribute("data-jui-house-quick-status"), "neutral");
  assert.equal(buttons[1].getAttribute("data-jui-house-quick-status"), "warning");
  widget.destroy();
  assert.equal(service.releases, 1);
});

test("replaces an energy service cleanly and ignores old energy callbacks", () => {
  const oldService = energyService({ results: [{ request_id: "energy", source_id: "house", window_minutes: 15, current_power_w: 1000, average_power_w: 1000, quality: "full", reason: null }] });
  const nextService = energyService({ results: [{ request_id: "energy", source_id: "house", window_minutes: 15, current_power_w: 4200, average_power_w: 4200, quality: "full", reason: null }] });
  const caps = capabilityHarness({ ...baseSnapshots(), "house.energy": available("house.energy", oldService.value) });
  const widget = createHouseQuickWidget(context(caps).value, { buttons: [
    { id: "energy", type: "energy", source_id: "house", average_window_minutes: 15, warning_threshold_w: 3000, critical_threshold_w: 5000 },
  ] });
  const host = target();
  widget.mount(host);
  assert.equal(buttonsIn(host)[0].getAttribute("data-jui-house-quick-status"), "neutral");
  caps.set("house.energy", available("house.energy", nextService.value));
  assert.equal(oldService.releases, 1);
  assert.equal(nextService.requests.length, 1);
  assert.equal(buttonsIn(host)[0].getAttribute("data-jui-house-quick-status"), "warning");
  oldService.listeners[0]({ results: [{ request_id: "energy", source_id: "house", window_minutes: 15, current_power_w: 9000, average_power_w: 9000, quality: "full", reason: null }] });
  assert.equal(buttonsIn(host)[0].getAttribute("data-jui-house-quick-status"), "warning");
  widget.destroy();
});

test("capability updates rerender only from capability data and sibling failure stays local", () => {
  const caps = capabilityHarness({ ...baseSnapshots(), "house.energy": unavailable("house.energy") });
  const widget = createHouseQuickWidget(context(caps).value, { buttons: [
    { id: "lights", type: "lights" }, { id: "devices", type: "devices" },
  ] });
  const host = target();
  widget.mount(host);
  let buttons = buttonsIn(host);
  assert.match(textOf(buttons[0]), /3 von 8 an/);
  caps.set("house.lights", unavailable("house.lights", "provider_failed"));
  buttons = buttonsIn(host);
  assert.equal(buttons[0].getAttribute("data-jui-house-quick-status"), "warning");
  assert.equal(buttons[1].getAttribute("data-jui-house-quick-status"), "active");
  caps.set("house.lights", available("house.lights", { version: 1, items: [], on_count: 0, total_count: 8, unavailable_count: 0 }));
  assert.match(textOf(buttonsIn(host)[0]), /0 von 8 an/);
  assert.equal(buttonsIn(host)[0].getAttribute("data-jui-house-quick-status"), "neutral");
  widget.destroy();
});

test("direct widget instances keep independent config and local state", () => {
  const caps = capabilityHarness(baseSnapshots());
  const first = createHouseQuickWidget(context(caps).value, { buttons: [{ id: "lights", type: "lights" }] });
  const second = createHouseQuickWidget(context(caps).value, { buttons: [{ id: "devices", type: "devices" }] });
  const hostA = target();
  const hostB = target();
  first.mount(hostA);
  second.mount(hostB);
  assert.equal(buttonsIn(hostA)[0].getAttribute("data-jui-house-quick-id"), "lights");
  assert.equal(buttonsIn(hostB)[0].getAttribute("data-jui-house-quick-id"), "devices");
  assert.match(textOf(buttonsIn(hostA)[0]), /Licht/);
  assert.match(textOf(buttonsIn(hostB)[0]), /Geräte/);
  first.destroy(); second.destroy();
});

test("click dispatches only semantic navigate and rejected navigation has no fallback", () => {
  const caps = capabilityHarness(baseSnapshots());
  const ctx = context(caps, { status: "rejected" });
  const widget = createHouseQuickWidget(ctx.value, { buttons: [
    { id: "living", type: "heating_zone", source_id: "living", navigation: { route: "climate", target_id: "zone:living" } },
  ] });
  const host = target();
  widget.mount(host);
  assert.doesNotThrow(() => buttonsIn(host)[0].click());
  assert.deepEqual(ctx.actionCalls, [{ type: "navigate", route: "climate", target_id: "zone:living" }]);
  widget.destroy();
});

test("update validates before rebinding and destroy releases capability subscriptions", () => {
  const caps = capabilityHarness(baseSnapshots());
  const ctx = context(caps);
  const widget = createHouseQuickWidget(ctx.value, { buttons: [{ id: "lights", type: "lights" }] });
  const host = target();
  widget.mount(host);
  assert.equal(caps.activeSubscriptions(), 5);
  assert.throws(() => widget.update(ctx.value, { buttons: [{ id: "x", type: "energy", source_id: "house", average_window_minutes: 0, warning_threshold_w: 1, critical_threshold_w: 2 }] }), /average_window_minutes/);
  assert.equal(caps.activeSubscriptions(), 5);
  assert.equal(widget.destroy(), true);
  assert.equal(caps.activeSubscriptions(), 0);
  assert.equal(host.children.length, 0);
  assert.equal(widget.destroy(), false);
});
