import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardWidgetHosts } from "../custom_components/jamesui/frontend/core/dashboard-widget-hosts.js";
import { createDashboardGrid } from "../custom_components/jamesui/frontend/core/dashboard-grid.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const item = (id, ref_id, column) => ({
  id, kind: "widget", ref_id, column, row: 0, column_span: 5, row_span: 3,
});

test("Block 14 mounts multiple widget instances through the same canonical loader", async () => {
  const calls = [];
  const loader = {
    async load(moduleId, options) {
      calls.push(["load", moduleId, options.instanceId, options.config.calendar]);
      return true;
    },
    mount(id, node) { calls.push(["mount", id, node.getAttribute("data-jui-widget-instance")]); return true; },
    destroy(id) { calls.push(["destroy", id]); return true; },
  };
  const document = createFakeDocument();
  const grid = createDashboardGrid({
    document,
    createItemHost: createDashboardWidgetHosts({
      moduleLoader: loader,
      getConfig: (id) => ({
        module_id: "widget.calendar-agenda",
        config: { calendar: id },
      }),
    }),
  });
  grid.mount(document.createElement("div"));
  grid.render([item("one", "calendar-family", 0), item("two", "calendar-work", 6)]);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls.filter((call) => call[0] === "load"), [
    ["load", "widget.calendar-agenda", "dashboard:one", "calendar-family"],
    ["load", "widget.calendar-agenda", "dashboard:two", "calendar-work"],
  ]);
  assert.deepEqual(calls.filter((call) => call[0] === "mount").map((call) => call[1]),
    ["dashboard:one", "dashboard:two"]);
  grid.render([item("two", "calendar-work", 6)]);
  assert.ok(calls.some((call) => call[0] === "destroy" && call[1] === "dashboard:one"));
  grid.destroy();
  assert.ok(calls.some((call) => call[0] === "destroy" && call[1] === "dashboard:two"));
});

test("Block 14 disposed hosts do not mount when slow module load resolves", async () => {
  let resume;
  const calls = [];
  const loader = {
    load() { return new Promise((resolve) => { resume = resolve; }); },
    mount() { calls.push("mount"); return true; },
    destroy(id) { calls.push(["destroy", id]); return true; },
  };
  const document = createFakeDocument();
  const grid = createDashboardGrid({
    document,
    createItemHost: createDashboardWidgetHosts({
      moduleLoader: loader,
      getConfig: () => ({ module_id: "widget.calendar-agenda" }),
    }),
  });
  grid.mount(document.createElement("div"));
  grid.render([item("slow", "agenda", 0)]);
  grid.destroy();
  resume(true);
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(!calls.includes("mount"));
});

test("Block 14 widget host rejects missing definitions instead of showing fake content", () => {
  const host = createDashboardWidgetHosts({
    moduleLoader: { load() {}, mount() {}, destroy() {} },
    getConfig: () => null,
  });
  const document = createFakeDocument();
  assert.throws(() => host(document.createElement("div"), item("unknown", "missing", 0)), /Missing widget/);
});
