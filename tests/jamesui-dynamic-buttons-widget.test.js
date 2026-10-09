import test from "node:test";
import assert from "node:assert/strict";
import { createDynamicButtonsWidget } from "../custom_components/jamesui/frontend/modules/widget.dynamic-buttons/widget.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const flush = () => new Promise((resolve) => setImmediate(resolve));

class FakeElement {
  constructor(tagName, ownerDocument) { this.tagName = tagName; this.ownerDocument = ownerDocument; this.attributes = new Map(); this.children = []; this.parentNode = null; this.textContent = ""; this.listeners = new Map(); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; for (const child of children) this.appendChild(child); }
  remove() { if (!this.parentNode) return; this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  click() { for (const listener of [...(this.listeners.get("click") ?? [])]) listener({ type: "click", currentTarget: this, preventDefault() {} }); }
}
class FakeDocument { createElement(tag) { return new FakeElement(tag, this); } createElementNS(_ns, tag) { return new FakeElement(tag, this); } }
function host() { const d = new FakeDocument(); return new FakeElement("host", d); }
function findAll(root, attr, value = null, out = []) { if (root.getAttribute?.(attr) !== null && (value === null || root.getAttribute(attr) === value)) out.push(root); for (const c of root.children ?? []) findAll(c, attr, value, out); return out; }
function buttons(root) { return findAll(root, "data-jui-dynamic-button"); }
function buttonById(root, id) { return findAll(root, "data-jui-dynamic-use-id", id)[0]; }
function textOf(node) { return [node.textContent, ...(node.children ?? []).map(textOf)].filter(Boolean).join(" "); }

function toggleDef(timeout_ms = 60) { return { name: "Garage", mode: "toggle", icon: "home.door", timeout_ms, state_source_id: "garage", activate_action: { type: "open" }, deactivate_action: { type: "close" }, presentation: { active: { text: "Offen" }, inactive: { text: "Geschlossen" }, intermediate: { opening: { text: "Öffnet" } } } }; }
function triggerDef(timeout_ms = 60) { return { name: "Alles aus", mode: "trigger", description: "Haus ausschalten", timeout_ms, action: { type: "all.off" } }; }
function resolved({ toggle = true, trigger = true, timeout = 60 } = {}) { const list = []; if (toggle) list.push({ id: "garage-use", button_id: "garage", size: "normal", definition: toggleDef(timeout) }); if (trigger) list.push({ id: "all-off-use", button_id: "all-off", size: "compact", definition: triggerDef(timeout) }); return { buttons: list }; }

function capabilityHarness(service = null) {
  let snapshot = service ? { status: "available", value: service } : { status: "unavailable", value: null, reason: "offline" };
  const listeners = new Set();
  return {
    subscribe(capability, listener, { emitCurrent = true } = {}) { assert.equal(capability, "control.states"); listeners.add(listener); if (emitCurrent) listener(snapshot); let active = true; return () => { if (!active) return false; active = false; listeners.delete(listener); return true; }; },
    set(next) { snapshot = next; for (const fn of [...listeners]) fn(next); },
    count() { return listeners.size; },
  };
}

function stateService(initial = { source_id: "garage", status: "inactive", detail: null, revision: 0, reason: null }) {
  let current = initial; const listeners = new Set(); let releases = 0;
  return {
    value: Object.freeze({ version: 1, configured_sources: Object.freeze([{ id: "garage" }]), subscribe(request, listener) { assert.deepEqual(request.source_ids, ["garage"]); listeners.add(listener); listener({ states: [current] }); let active = true; return () => { if (!active) return false; active = false; listeners.delete(listener); releases += 1; return true; }; } }),
    emit(next) { current = next; for (const fn of [...listeners]) fn({ states: [next] }); },
    get releases() { return releases; }, get listenerCount() { return listeners.size; },
  };
}

function context(caps, execute) { const calls = []; return { value: { module: { id: "widget.dynamic-buttons" }, capabilities: caps, actions: { execute(action) { calls.push(action); return execute(action); } } }, calls }; }

function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

test("renders fixed identity, mode indicator, size, and leaves trigger usable when state capability is unavailable", () => {
  const caps = capabilityHarness(); const ctx = context(caps, () => ({ status: "success" })); const widget = createDynamicButtonsWidget(ctx.value, resolved()); const root = host(); widget.mount(root);
  assert.equal(buttons(root).length, 2);
  assert.equal(buttonById(root, "garage-use").getAttribute("aria-disabled"), "true");
  assert.equal(buttonById(root, "all-off-use").getAttribute("aria-disabled"), null);
  assert.match(textOf(buttonById(root, "garage-use")), /Garage/);
  assert.match(textOf(buttonById(root, "garage-use")), /Toggle/);
  assert.match(textOf(buttonById(root, "all-off-use")), /Aktion/);
  widget.destroy();
});

test("toggle action success stays pending until a newer real target revision arrives", async () => {
  const service = stateService(); const caps = capabilityHarness(service.value); const ctx = context(caps, () => ({ status: "success" })); const widget = createDynamicButtonsWidget(ctx.value, resolved({ trigger: false, timeout: 100 })); const root = host(); widget.mount(root);
  buttonById(root, "garage-use").click(); await flush();
  assert.deepEqual(ctx.calls, [{ type: "open" }]);
  assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "pending");
  service.emit({ source_id: "garage", status: "inactive", detail: null, revision: 0, reason: null });
  assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "pending");
  service.emit({ source_id: "garage", status: "active", detail: null, revision: 1, reason: null });
  assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "idle");
  assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-real-status"), "active");
  widget.destroy();
});

test("real target feedback wins race against a late action result", async () => {
  const service = stateService(); const caps = capabilityHarness(service.value); const action = deferred(); const ctx = context(caps, () => action.promise); const widget = createDynamicButtonsWidget(ctx.value, resolved({ trigger: false, timeout: 100 })); const root = host(); widget.mount(root);
  buttonById(root, "garage-use").click();
  service.emit({ source_id: "garage", status: "active", detail: null, revision: 1, reason: null });
  assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "idle");
  action.resolve({ status: "error" }); await flush();
  assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "idle");
  widget.destroy();
});

test("intermediate stays pending and a newer wrong terminal state fails immediately", async () => {
  const service = stateService(); const caps = capabilityHarness(service.value); const ctx = context(caps, () => ({ status: "success" })); const widget = createDynamicButtonsWidget(ctx.value, resolved({ trigger: false, timeout: 100 })); const root = host(); widget.mount(root);
  buttonById(root, "garage-use").click(); await flush();
  service.emit({ source_id: "garage", status: "intermediate", detail: "opening", revision: 1, reason: null });
  assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "pending"); assert.match(textOf(buttonById(root, "garage-use")), /Öffnet/);
  service.emit({ source_id: "garage", status: "inactive", detail: null, revision: 2, reason: null });
  assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "error");
  widget.destroy();
});

test("toggle timeout and unavailable feedback fail without retry and repeated pending clicks are blocked", async () => {
  const service = stateService(); const caps = capabilityHarness(service.value); const ctx = context(caps, () => ({ status: "success" })); const widget = createDynamicButtonsWidget(ctx.value, resolved({ trigger: false, timeout: 20 })); const root = host(); widget.mount(root);
  const first = buttonById(root, "garage-use"); first.click(); buttonById(root, "garage-use").click(); assert.equal(ctx.calls.length, 1);
  await wait(30); assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "error"); assert.equal(ctx.calls.length, 1); widget.destroy();

  const service2 = stateService(); const caps2 = capabilityHarness(service2.value); const ctx2 = context(caps2, () => ({ status: "success" })); const widget2 = createDynamicButtonsWidget(ctx2.value, resolved({ trigger: false, timeout: 100 })); const root2 = host(); widget2.mount(root2); buttonById(root2, "garage-use").click(); service2.emit({ source_id: "garage", status: "unavailable", detail: null, revision: 1, reason: "offline" }); assert.equal(buttonById(root2, "garage-use").getAttribute("data-jui-dynamic-feedback"), "error"); widget2.destroy();
});

test("action failure aborts toggle before feedback timeout", async () => {
  const service = stateService(); const caps = capabilityHarness(service.value); const ctx = context(caps, () => ({ status: "rejected" })); const widget = createDynamicButtonsWidget(ctx.value, resolved({ trigger: false, timeout: 100 })); const root = host(); widget.mount(root); buttonById(root, "garage-use").click(); await flush(); assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "error"); widget.destroy();
});

test("trigger success is transient, timeout ignores late success, and repeat clicks are blocked", async () => {
  const caps = capabilityHarness(); const ctx = context(caps, () => ({ status: "success" })); const widget = createDynamicButtonsWidget(ctx.value, resolved({ toggle: false, timeout: 100 })); const root = host(); widget.mount(root); buttonById(root, "all-off-use").click(); buttonById(root, "all-off-use").click(); await flush(); assert.equal(ctx.calls.length, 1); assert.equal(buttonById(root, "all-off-use").getAttribute("data-jui-dynamic-feedback"), "success"); await wait(680); assert.equal(buttonById(root, "all-off-use").getAttribute("data-jui-dynamic-feedback"), "idle"); widget.destroy();

  const late = deferred(); const caps2 = capabilityHarness(); const ctx2 = context(caps2, () => late.promise); const widget2 = createDynamicButtonsWidget(ctx2.value, resolved({ toggle: false, timeout: 20 })); const root2 = host(); widget2.mount(root2); buttonById(root2, "all-off-use").click(); await wait(30); assert.equal(buttonById(root2, "all-off-use").getAttribute("data-jui-dynamic-feedback"), "error"); late.resolve({ status: "success" }); await flush(); assert.equal(buttonById(root2, "all-off-use").getAttribute("data-jui-dynamic-feedback"), "error"); widget2.destroy();
});

test("service replacement during pending loses acknowledgement continuity safely", async () => {
  const first = stateService(); const second = stateService({ source_id: "garage", status: "active", detail: null, revision: 0, reason: null }); const caps = capabilityHarness(first.value); const ctx = context(caps, () => ({ status: "success" })); const widget = createDynamicButtonsWidget(ctx.value, resolved({ trigger: false, timeout: 100 })); const root = host(); widget.mount(root); buttonById(root, "garage-use").click(); await flush(); caps.set({ status: "available", value: second.value }); assert.equal(first.releases, 1); assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-feedback"), "error"); assert.equal(buttonById(root, "garage-use").getAttribute("data-jui-dynamic-real-status"), "active"); widget.destroy();
});

test("two instances share real feedback but keep pending local", async () => {
  const service = stateService(); const caps = capabilityHarness(service.value); const pending = deferred(); const ctxA = context(caps, () => pending.promise); const ctxB = context(caps, () => ({ status: "success" })); const a = createDynamicButtonsWidget(ctxA.value, resolved({ trigger: false, timeout: 100 })); const b = createDynamicButtonsWidget(ctxB.value, resolved({ trigger: false, timeout: 100 })); const hostA = host(); const hostB = host(); a.mount(hostA); b.mount(hostB); buttonById(hostA, "garage-use").click(); assert.equal(buttonById(hostA, "garage-use").getAttribute("data-jui-dynamic-feedback"), "pending"); assert.equal(buttonById(hostB, "garage-use").getAttribute("data-jui-dynamic-feedback"), "idle"); service.emit({ source_id: "garage", status: "active", detail: null, revision: 1, reason: null }); assert.equal(buttonById(hostA, "garage-use").getAttribute("data-jui-dynamic-real-status"), "active"); assert.equal(buttonById(hostB, "garage-use").getAttribute("data-jui-dynamic-real-status"), "active"); pending.resolve({ status: "success" }); await flush(); a.destroy(); b.destroy();
});

test("update validates before rebinding and destroy releases subscriptions/timers", () => {
  const service = stateService(); const caps = capabilityHarness(service.value); const ctx = context(caps, () => ({ status: "success" })); const widget = createDynamicButtonsWidget(ctx.value, resolved()); const root = host(); widget.mount(root); assert.equal(caps.count(), 1); assert.equal(service.listenerCount, 1); assert.throws(() => widget.update(ctx.value, { buttons: [{ id: "bad" }] }), /button_id|resolved/); assert.equal(service.listenerCount, 1); assert.equal(widget.destroy(), true); assert.equal(caps.count(), 0); assert.equal(service.listenerCount, 0); assert.equal(root.children.length, 0); assert.equal(widget.destroy(), false);
});
