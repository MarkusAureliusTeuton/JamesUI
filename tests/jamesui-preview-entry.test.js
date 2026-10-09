import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-1-preview-entry.js", import.meta.url),
  "utf8",
);

test("preview panel preserves HA properties assigned before asynchronous bootstrap", () => {
  const registered = new Map();
  class HTMLElement {
    attachShadow() { this.shadowRoot = { ownerDocument: {}, replaceChildren() {} }; }
  }
  const context = vm.createContext({
    HTMLElement,
    customElements: {
      get: (name) => registered.get(name),
      define: (name, value) => registered.set(name, value),
    },
    document: { createElement: () => ({ style: {} }) },
  });
  vm.runInContext(source, context);
  const Panel = registered.get("jamesui-1-preview-panel");
  assert.ok(Panel);
  const panel = new Panel();
  const hass = { states: {} };
  const route = { path: "home" };
  const metadata = { title: "JamesUI" };
  panel.hass = hass;
  panel.narrow = true;
  panel.route = route;
  panel.panel = metadata;
  assert.equal(panel._hass, hass);
  assert.equal(panel._narrow, true);
  assert.equal(panel._route, route);
  assert.equal(panel._panel, metadata);
  const received = {};
  panel._preview = {
    core: Object.fromEntries(["hass", "narrow", "route", "panel"].map((key) => [
      key, null,
    ])),
  };
  for (const key of ["hass", "narrow", "route", "panel"]) {
    Object.defineProperty(panel._preview.core, key, { set(value) { received[key] = value; } });
  }
  panel.narrow = false;
  panel.route = route;
  panel.panel = metadata;
  panel.hass = hass;
  assert.equal(received.narrow, false);
  assert.equal(received.route, route);
  assert.equal(received.panel, metadata);
  assert.equal(received.hass, hass);
});
