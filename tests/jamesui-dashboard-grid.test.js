import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardGrid } from "../custom_components/jamesui/frontend/core/dashboard-grid.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const item = (id, column, row, column_span = 3, row_span = 2, kind = "widget", ref_id = id) =>
  ({ id, column, row, column_span, row_span, kind, ref_id });

test("Block 14 dashboard grid renders logical positions in one twelve-column host", () => {
  const document = createFakeDocument();
  const target = document.createElement("section");
  const calls = [];
  const grid = createDashboardGrid({
    document,
    createItemHost(node, element) {
      calls.push(["mount", element.id]);
      node.appendChild(document.createElement("article"));
      return () => calls.push(["destroy", element.id]);
    },
  });
  grid.mount(target);
  grid.render([item("agenda", 0, 0, 6, 5), item("light", 6, 0)]);
  const root = target.querySelector("[data-jui-dashboard-grid]");
  assert.ok(root);
  const agenda = root.querySelector('[data-jui-dashboard-item="agenda"]');
  assert.equal(agenda.style.gridColumn, "1 / span 6");
  assert.equal(agenda.style.gridRow, "1 / span 5");
  const light = root.querySelector('[data-jui-dashboard-item="light"]');
  assert.equal(light.style.gridColumn, "7 / span 3");
  assert.deepEqual(calls, [["mount", "agenda"], ["mount", "light"]]);

  grid.render([item("agenda", 3, 4, 6, 5)]);
  assert.equal(root.querySelector('[data-jui-dashboard-item="agenda"]'), agenda);
  assert.equal(agenda.style.gridColumn, "4 / span 6");
  assert.equal(root.querySelector('[data-jui-dashboard-item="light"]'), null);
  assert.deepEqual(calls.at(-1), ["destroy", "light"]);
  grid.destroy();
  assert.deepEqual(calls.at(-1), ["destroy", "agenda"]);
  assert.equal(root.parentNode, null);
});

test("Block 14 grid rejects overlaps without destroying current content", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const grid = createDashboardGrid({ document });
  grid.mount(target);
  grid.render([item("a", 0, 0), item("b", 6, 0)]);
  const before = target.querySelector('[data-jui-dashboard-item="a"]');
  assert.throws(() => grid.render([item("a", 0, 0), item("b", 2, 1)]), /collision/);
  assert.equal(target.querySelector('[data-jui-dashboard-item="a"]'), before);
  grid.destroy();
});

test("Block 14 grid replaces a changed module reference and supports vertical layout", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const disposed = [];
  const grid = createDashboardGrid({
    document,
    createItemHost(_node, item) { return () => disposed.push(item.ref_id); },
  });
  grid.mount(target);
  grid.render([item("control", 0, 0, 4, 2, "button", "old")]);
  const first = target.querySelector('[data-jui-dashboard-item="control"]');
  grid.render([item("control", 0, 0, 4, 2, "button", "new")], { scroll: "vertical" });
  assert.deepEqual(disposed, ["old"]);
  assert.notEqual(target.querySelector('[data-jui-dashboard-item="control"]'), first);
  assert.equal(target.querySelector("[data-jui-dashboard-grid]").getAttribute("data-jui-scroll"), "vertical");
  grid.destroy();
});

test("editing one widget remounts only that runtime, not every configured dashboard item", () => {
  const document = createFakeDocument();
  const target = document.createElement("div");
  const events = [];
  const grid = createDashboardGrid({
    document,
    createItemHost(_node, element) {
      events.push("mount:" + element.id);
      return () => events.push("destroy:" + element.id);
    },
  });
  grid.mount(target);
  const elements = [item("agenda", 0, 0), item("heating", 4, 0)];
  grid.render(elements);
  const oldAgenda = target.querySelector('[data-jui-dashboard-item="agenda"]');
  const oldHeating = target.querySelector('[data-jui-dashboard-item="heating"]');
  grid.render(elements, { recreateIds: ["agenda"] });
  assert.notEqual(target.querySelector('[data-jui-dashboard-item="agenda"]'), oldAgenda);
  assert.equal(target.querySelector('[data-jui-dashboard-item="heating"]'), oldHeating);
  assert.deepEqual(events, [
    "mount:agenda", "mount:heating", "destroy:agenda", "mount:agenda",
  ]);
  grid.destroy();
  assert.equal(events.filter((event) => event === "destroy:heating").length, 1);
});
