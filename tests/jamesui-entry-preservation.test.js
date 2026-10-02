import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ENTRY_SOURCE = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-entry.js", import.meta.url),
  "utf8"
);

function root(children = []) {
  return {
    children,
    querySelectorAll(selector) {
      if (selector === "*") return this.children;
      if (selector === "jamesui-panel") {
        return this.children.filter((child) => child.tagName === "JAMESUI-PANEL");
      }
      return [];
    },
  };
}

function element(tagName, shadowRoot = null) {
  return { tagName: tagName.toUpperCase(), shadowRoot };
}

function createHarness({ currentScript = "http://example.test/jamesui_static/jamesui-entry.js?v=baseline-token", documentChildren = [] } = {}) {
  const appendedScripts = [];
  const errors = [];
  const documentRoot = root(documentChildren);
  const document = {
    ...documentRoot,
    currentScript: { src: currentScript },
    createElement(tagName) {
      assert.equal(tagName, "script");
      return {
        tagName: "SCRIPT",
        src: "",
        type: "",
        async: true,
        listeners: new Map(),
        addEventListener(type, callback) {
          this.listeners.set(type, callback);
        },
      };
    },
    head: {
      appendChild(script) {
        appendedScripts.push(script);
      },
    },
  };
  const window = { location: { origin: "http://example.test" } };
  const context = vm.createContext({
    window,
    document,
    URL,
    Object,
    Set,
    console: { error: (...args) => errors.push(args) },
  });
  vm.runInContext(ENTRY_SOURCE, context, { filename: "jamesui-entry.js" });
  return { window, document, appendedScripts, errors };
}

test("finds JamesUI panels through nested shadow roots", () => {
  const panel = element("jamesui-panel");
  const nestedHost = element("nested-host", root([panel]));
  const outerHost = element("outer-host", root([nestedHost]));
  const { window } = createHarness({ documentChildren: [outerHost] });

  const panels = window.__jamesUIFindPanels();
  assert.equal(panels.length, 1);
  assert.equal(panels[0], panel);
});

test("replays predefined Home Assistant panel properties after runtime load", () => {
  const panel = element("jamesui-panel");
  const expected = {
    hass: { states: {} },
    narrow: true,
    route: { path: "home" },
    panel: { title: "JamesUI" },
  };
  Object.assign(panel, expected);
  const received = {};
  const prototype = {};
  for (const property of Object.keys(expected)) {
    Object.defineProperty(prototype, property, {
      set(value) { received[property] = value; },
      configurable: true,
    });
  }
  const { appendedScripts } = createHarness({ documentChildren: [panel] });
  Object.setPrototypeOf(panel, prototype);

  appendedScripts[0].listeners.get("load")();

  assert.deepEqual(received, expected);
  for (const property of Object.keys(expected)) {
    assert.equal(Object.prototype.hasOwnProperty.call(panel, property), false);
  }
});

test("propagates the entry revision to the first runtime script", () => {
  const { appendedScripts } = createHarness({
    currentScript: "http://example.test/jamesui_static/jamesui-entry.js?v=baseline-token",
  });

  assert.equal(appendedScripts.length, 1);
  const runtimeUrl = new URL(appendedScripts[0].src);
  assert.equal(runtimeUrl.searchParams.get("v"), "baseline-token");
});

test("logs runtime load failure without throwing the shell harness", () => {
  const { appendedScripts, errors } = createHarness();
  const runtimeUrl = appendedScripts[0].src;

  assert.doesNotThrow(() => appendedScripts[0].listeners.get("error")());
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], "JamesUI: stable panel script could not be loaded");
  assert.equal(errors[0][1], runtimeUrl);
});
