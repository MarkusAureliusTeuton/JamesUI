import test from "node:test";
import assert from "node:assert/strict";
import {
  GRID_COLUMNS, normalizeGridItem, validateGrid,
  previewGridPlacement,
} from "../custom_components/jamesui/frontend/core/grid-placement.js";

const item = (id, column, row, column_span = 3, row_span = 2) =>
  ({ id, column, row, column_span, row_span });

test("Block 14 grid has 12 columns and validates exact logical bounds", () => {
  assert.equal(GRID_COLUMNS, 12);
  assert.deepEqual(normalizeGridItem(item("one", 9, 0)), item("one", 9, 0));
  assert.throws(() => normalizeGridItem(item("outside", 10, 0)), RangeError);
  assert.throws(() => normalizeGridItem(item("negative", -1, 0)), TypeError);
  assert.throws(() => normalizeGridItem(item("fraction", 1.5, 0)), TypeError);
  assert.throws(() => normalizeGridItem(item("zero", 0, 0, 0)), TypeError);
  assert.throws(() => validateGrid([item("dup", 0, 0), item("dup", 6, 0)]), /duplicate/);
  assert.throws(() => validateGrid([item("first", 0, 0), item("second", 2, 1)]), /collision/);
  assert.throws(() => validateGrid([item("too-tall", 0, 3)], { maxRows: 4 }), /rows/);
});

test("Block 14 local reflow preserves unaffected elements, deliberate gaps, and original inputs", () => {
  const items = [item("a", 0, 0), item("b", 3, 0), item("c", 6, 5)];
  const before = structuredClone(items);
  const result = previewGridPlacement(items, "a", { column: 3, row: 0 }, { maxRows: 10 });
  assert.deepEqual(result, [
    item("a", 3, 0),
    item("b", 3, 2),
    item("c", 6, 5),
  ]);
  assert.deepEqual(items, before);
});

test("Block 14 rejected move does not alter saved grid", () => {
  const items = [item("a", 0, 0), item("b", 3, 0)];
  assert.equal(previewGridPlacement(items, "a", { column: 3 }, { maxRows: 3 }), null);
  assert.deepEqual(items[0], item("a", 0, 0));
  assert.throws(() => previewGridPlacement(items, "missing", { column: 0 }), /unknown/);
});

test("Block 14 resize keeps width and height independent and validates bounded rows", () => {
  const items = [item("agenda", 0, 0, 6, 3), item("status", 6, 0, 6, 2)];
  const resized = previewGridPlacement(items, "agenda", { column_span: 8, row_span: 4 }, { maxRows: 9 });
  assert.deepEqual(resized, [
    item("agenda", 0, 0, 8, 4),
    item("status", 6, 4, 6, 2),
  ]);
});

test("Block 14 repeated placement is deterministic", () => {
  const items = [item("a", 0, 0), item("b", 3, 0), item("c", 3, 2)];
  const first = previewGridPlacement(items, "a", { column: 3 }, { maxRows: 12 });
  const second = previewGridPlacement(items, "a", { column: 3 }, { maxRows: 12 });
  assert.deepEqual(first, second);
  validateGrid(first, { maxRows: 12 });
});
