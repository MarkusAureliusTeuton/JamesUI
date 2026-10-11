import test from "node:test";
import assert from "node:assert/strict";
import {
  createDashboardPageConfig, validateDashboardPage, moveDashboardElement,
} from "../custom_components/jamesui/frontend/core/dashboard-config.js";

function fixture() {
  const { page, layout } = createDashboardPageConfig({ pageId: "start", layoutId: "start-layout" });
  page.elements = [
    { id: "agenda", kind: "widget", ref_id: "agenda-one", column: 0, row: 0, column_span: 6, row_span: 4 },
    { id: "scene", kind: "button", ref_id: "scene-evening", column: 6, row: 0, column_span: 3, row_span: 2 },
  ];
  return {
    schema_version: 1,
    pages: { start: page, other: { retained: true } },
    layouts: { "start-layout": layout },
    widget_instances: { "agenda-one": { module_id: "widget.calendar-agenda", config: { source: "family" } } },
    dynamic_buttons: { "scene-evening": { name: "Abend", mode: "toggle" } },
    data_sources: { untouched: true },
    module_settings: {},
  };
}

test("Block 14 dashboard config resolves page, layout and independent widget/button refs", () => {
  const page = validateDashboardPage(fixture(), "start");
  assert.equal(page.layout.kind, "hero-deck");
  assert.equal(page.layout.hero_ratio, 0.42);
  assert.equal(page.layout.scroll, "fixed");
  assert.deepEqual(page.elements.map((e) => e.kind), ["widget", "button"]);
  assert.deepEqual(page.elements.map((e) => e.ref_id), ["agenda-one", "scene-evening"]);
});

test("Block 14 dashboard rejects dangling refs and invalid page or geometry", () => {
  const dangling = fixture();
  delete dangling.widget_instances["agenda-one"];
  assert.throws(() => validateDashboardPage(dangling, "start"), /widget_instances/);
  const duplicate = fixture();
  duplicate.pages.start.elements[1].id = "agenda";
  assert.throws(() => validateDashboardPage(duplicate, "start"), /duplicate/);
  const invalidRatio = fixture();
  invalidRatio.layouts["start-layout"].hero_ratio = 0.7;
  assert.throws(() => validateDashboardPage(invalidRatio, "start"), /hero_ratio/);
  const invalidKind = fixture();
  invalidKind.pages.start.elements[0].kind = "unknown";
  assert.throws(() => validateDashboardPage(invalidKind, "start"), /unsupported dashboard element/);
});

test("Block 14 dashboard move changes only page placements; keeps unrelated settings", () => {
  const before = fixture();
  const saved = structuredClone(before);
  const result = moveDashboardElement(before, "start", "agenda", { column: 6 }, { maxRows: 12 });
  assert.deepEqual(before, saved);
  assert.deepEqual(result.pages.start.elements.map((e) => [e.id, e.column, e.row]), [
    ["agenda", 6, 0], ["scene", 6, 4],
  ]);
  assert.deepEqual(result.pages.other, before.pages.other);
  assert.deepEqual(result.widget_instances, before.widget_instances);
  assert.deepEqual(result.data_sources, before.data_sources);
});

test("Block 14 dashboard rejects impossible move without touching config", () => {
  const before = fixture();
  assert.equal(moveDashboardElement(before, "start", "agenda", { column: 6 }, { maxRows: 5 }), null);
  assert.equal(before.pages.start.elements[1].row, 0);
});

test("Block 14 fullscreen layout has no hero but retains fixed scroll", () => {
  const { page, layout } = createDashboardPageConfig({
    pageId: "other", layoutId: "full", layoutKind: "fullscreen",
  });
  const config = fixture();
  config.pages.other = page;
  config.layouts.full = layout;
  const resolved = validateDashboardPage(config, "other");
  assert.equal(resolved.layout.kind, "fullscreen");
  assert.equal(resolved.layout.hero_ratio, null);
  assert.equal(resolved.layout.scroll, "fixed");
});
