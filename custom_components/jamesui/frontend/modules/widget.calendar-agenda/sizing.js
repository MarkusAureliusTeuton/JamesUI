function finiteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be a finite non-negative number`);
  return value;
}

function positive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be a finite positive number`);
  return value;
}

export function computeVisibleCapacity({ hostHeight, chromeHeight, rowHeight } = {}) {
  const host = finiteNonNegative(hostHeight, "hostHeight");
  const chrome = finiteNonNegative(chromeHeight, "chromeHeight");
  const row = positive(rowHeight, "rowHeight");
  return Math.max(0, Math.floor((host - chrome) / row));
}

export function visibleRowWindow({ scrollTop, viewportHeight, rowHeight, totalRows } = {}) {
  const scroll = finiteNonNegative(scrollTop, "scrollTop");
  const viewport = finiteNonNegative(viewportHeight, "viewportHeight");
  const row = positive(rowHeight, "rowHeight");
  if (!Number.isInteger(totalRows) || totalRows < 0) throw new RangeError("totalRows must be a non-negative integer");
  if (totalRows === 0 || viewport === 0) {
    return Object.freeze({ first_index: -1, last_index: -1, has_before: false, has_after: false });
  }
  const first = Math.min(totalRows - 1, Math.floor(scroll / row));
  const last = Math.min(totalRows - 1, Math.max(first, Math.ceil((scroll + viewport) / row) - 1));
  return Object.freeze({
    first_index: first,
    last_index: last,
    has_before: first > 0,
    has_after: last < totalRows - 1,
  });
}

export function computeExpandedNoticeHeight({ hostHeight, baseChromeHeight, rowHeight, desiredNoticeHeight } = {}) {
  const host = finiteNonNegative(hostHeight, "hostHeight");
  const chrome = finiteNonNegative(baseChromeHeight, "baseChromeHeight");
  const row = positive(rowHeight, "rowHeight");
  const desired = finiteNonNegative(desiredNoticeHeight, "desiredNoticeHeight");
  const availableWhileKeepingRow = Math.max(0, host - chrome - row);
  return Math.min(desired, availableWhileKeepingRow);
}
