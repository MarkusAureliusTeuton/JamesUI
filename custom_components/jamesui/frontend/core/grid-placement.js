// Pure placement model for a layout-owned dashboard grid.
// Coordinates are zero-based; no pixel measurements or DOM dependencies.
export const GRID_COLUMNS = 12;

function integer(value, label, min) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new TypeError(`${label} must be an integer >= ${min}`);
  }
  return value;
}

export function normalizeGridItem(item, columns = GRID_COLUMNS) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new TypeError("grid item must be an object");
  }
  if (typeof item.id !== "string" || !item.id.trim()) {
    throw new TypeError("grid item requires a nonempty id");
  }
  integer(columns, "columns", 1);
  const column = integer(item.column, "column", 0);
  const row = integer(item.row, "row", 0);
  const columnSpan = integer(item.column_span, "column_span", 1);
  const rowSpan = integer(item.row_span, "row_span", 1);
  if (column + columnSpan > columns) throw new RangeError("grid item exceeds available columns");
  return Object.freeze({
    id: item.id, column, row, column_span: columnSpan, row_span: rowSpan,
  });
}

export function intersectsGridItems(a, b) {
  return a.column < b.column + b.column_span &&
    b.column < a.column + a.column_span &&
    a.row < b.row + b.row_span &&
    b.row < a.row + a.row_span;
}

export function validateGrid(items, { columns = GRID_COLUMNS, maxRows = null } = {}) {
  if (!Array.isArray(items)) throw new TypeError("grid items must be an array");
  integer(columns, "columns", 1);
  if (maxRows !== null) integer(maxRows, "maxRows", 1);
  const normalized = items.map((item) => normalizeGridItem(item, columns));
  const used = new Set();
  for (let i = 0; i < normalized.length; i += 1) {
    const item = normalized[i];
    if (used.has(item.id)) throw new TypeError(`duplicate grid ID: ${item.id}`);
    used.add(item.id);
    if (maxRows !== null && item.row + item.row_span > maxRows) {
      throw new RangeError(`grid item ${item.id} exceeds available rows`);
    }
    for (let j = 0; j < i; j += 1) {
      if (intersectsGridItems(item, normalized[j])) {
        throw new RangeError(`grid item collision: ${item.id} and ${normalized[j].id}`);
      }
    }
  }
  return normalized;
}

// Preview without mutating inputs. Collided items move only as far downward
// as required; other items retain their exact coordinates, including gaps.
// If a bounded page cannot accommodate the change, return null.
export function previewGridPlacement(items, targetId, nextGeometry, options = {}) {
  const columns = options.columns ?? GRID_COLUMNS;
  const maxRows = options.maxRows ?? null;
  const original = validateGrid(items, { columns, maxRows });
  const selected = original.find((item) => item.id === targetId);
  if (!selected) throw new RangeError(`unknown grid item: ${targetId}`);
  const target = normalizeGridItem({ ...selected, ...nextGeometry, id: targetId }, columns);
  if (maxRows !== null && target.row + target.row_span > maxRows) return null;

  const placements = new Map([[targetId, target]]);
  const remaining = original.filter((item) => item.id !== targetId);
  // Iterate in the original page order, revisiting an item only when pushed.
  // This deterministic downward-only displacement avoids global compaction.
  for (const item of remaining) {
    let candidate = item;
    while ([...placements.values()].some((placed) => intersectsGridItems(placed, candidate))) {
      const obstacleBottom = Math.max(...[...placements.values()]
        .filter((placed) => intersectsGridItems(placed, candidate))
        .map((placed) => placed.row + placed.row_span));
      candidate = Object.freeze({ ...candidate, row: obstacleBottom });
      if (maxRows !== null && candidate.row + candidate.row_span > maxRows) return null;
    }
    placements.set(item.id, candidate);
  }

  // Later displaced neighbors might affect earlier placed ones. Resolve
  // these conflicts without moving the selected target, or reject overflow.
  const others = original.filter((item) => item.id !== targetId);
  const result = [target];
  for (const originalItem of others) {
    let candidate = placements.get(originalItem.id);
    while (result.some((placed) => intersectsGridItems(placed, candidate))) {
      const bottom = Math.max(...result.filter((placed) => intersectsGridItems(placed, candidate))
        .map((placed) => placed.row + placed.row_span));
      candidate = Object.freeze({ ...candidate, row: bottom });
      if (maxRows !== null && candidate.row + candidate.row_span > maxRows) return null;
    }
    result.push(candidate);
  }
  return validateGrid(original.map((item) => result.find((next) => next.id === item.id)),
    { columns, maxRows });
}
