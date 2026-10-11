import test from "node:test";
import assert from "node:assert/strict";
import {
  isDynamicButtonReferenced,
  listUnusedDynamicButtons,
  removeUnusedDynamicButton,
} from "../custom_components/jamesui/frontend/modules/dashboard-resource-usage.js";
import { createDashboardButtonCleanupView } from "../custom_components/jamesui/frontend/modules/dashboard-button-cleanup.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const setup = () => ({
  pages: {
    home: { elements: [{ id: "scene", kind: "button", ref_id: "used-on-page" }] },
    another: { elements: [] },
  },
  widget_instances: {
    controls: { module_id: "widget.dynamic-buttons",
      config: { buttons: [{ id: "light", button_id: "used-by-widget", size: "normal" }] } },
    agenda: { module_id: "widget.calendar-agenda", config: {} },
  },
  dynamic_buttons: {
    "used-on-page": { name: "Szene" },
    "used-by-widget": { name: "Licht" },
    "orphan": { name: "Nicht verwendet" },
  },
});
test("unused button detection respects direct page buttons and all widget instances", () => {
  const config = setup();
  assert.equal(isDynamicButtonReferenced(config, "used-on-page"), true);
  assert.equal(isDynamicButtonReferenced(config, "used-by-widget"), true);
  assert.equal(isDynamicButtonReferenced(config, "orphan"), false);
  assert.deepEqual(listUnusedDynamicButtons(config), [{ id: "orphan", name: "Nicht verwendet" }]);
  assert.throws(() => removeUnusedDynamicButton(config, "used-on-page"), /noch verwendet/);
  assert.throws(() => removeUnusedDynamicButton(config, "used-by-widget"), /noch verwendet/);
  assert.equal(removeUnusedDynamicButton(config, "missing"), null);
  const cleaned = removeUnusedDynamicButton(config, "orphan");
  assert.equal(cleaned.dynamic_buttons.orphan, undefined);
  assert.ok(config.dynamic_buttons.orphan, "Original config must never be mutated");
  assert.ok(cleaned.dynamic_buttons["used-on-page"]);
  assert.ok(cleaned.dynamic_buttons["used-by-widget"]);
});

test("cleanup dialog lists only unreferenced definitions and delegates explicit deletion", () => {
  const document = createFakeDocument();
  let config = setup();
  const removed = [];
  const view = createDashboardButtonCleanupView({
    document,
    getConfig: () => config,
    onRemove(id) {
      removed.push(id);
      config = removeUnusedDynamicButton(config, id);
      return true;
    },
  });
  view.open();
  assert.equal(view.root.hidden, false);
  assert.equal(view.root.querySelector('[data-jui-cleanup-remove="used-on-page"]'), null);
  assert.equal(view.root.querySelector('[data-jui-cleanup-remove="used-by-widget"]'), null);
  view.root.querySelector('[data-jui-cleanup-remove="orphan"]').dispatchEvent("click");
  assert.deepEqual(removed, ["orphan"]);
  assert.ok(view.root.querySelector("[data-jui-cleanup-empty]"));
  view.close();
  assert.equal(view.root.hidden, true);
});
