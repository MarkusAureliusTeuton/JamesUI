import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardCatalog, createDashboardCatalogView } from "../custom_components/jamesui/frontend/modules/dashboard-catalog.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("Block 14 catalog shows registered widget modules only", () => {
  const registry = { get(id) {
    if (id === "widget.calendar-agenda" || id === "widget.house-quick") return { manifest: { type: "widget" } };
    return null;
  } };
  const catalog = createDashboardCatalog({ moduleRegistry: registry });
  assert.deepEqual(catalog.entries().map((item) => item.module_id), [
    "widget.calendar-agenda", "widget.house-quick",
  ]);
});

test("Block 14 catalog selection emits module identity and closes", () => {
  const document = createFakeDocument();
  const selected = [];
  const catalog = createDashboardCatalog({ moduleRegistry: {
    get: (id) => id === "widget.calendar-agenda" ? { manifest: { type: "widget" } } : null,
  } });
  const view = createDashboardCatalogView({ document, catalog, onSelect: (id) => selected.push(id) });
  assert.equal(view.root.hidden, true);
  view.open();
  assert.equal(view.root.hidden, false);
  view.root.children[1].dispatchEvent("click");
  assert.deepEqual(selected, ["widget.calendar-agenda"]);
  assert.equal(view.root.hidden, true);
});
