import test from "node:test";
import assert from "node:assert/strict";

import {
  SET_DESCRIPTION,
  SET_DUE_DATE,
  SET_DUE_DATETIME,
  UPDATE_TODO_ITEM,
  todoCapabilities,
} from "../custom_components/jamesui/frontend/shared/todo-features.js";

test("exports the exact Home Assistant Todo feature bits once", () => {
  assert.equal(UPDATE_TODO_ITEM, 4);
  assert.equal(SET_DUE_DATE, 16);
  assert.equal(SET_DUE_DATETIME, 32);
  assert.equal(SET_DESCRIPTION, 64);
});

test("derives independent immutable Todo capabilities from supported feature mask", () => {
  assert.deepEqual(todoCapabilities(0), {
    can_update: false,
    can_set_due_date: false,
    can_set_due_datetime: false,
    can_set_description: false,
  });
  const all = todoCapabilities(UPDATE_TODO_ITEM | SET_DUE_DATE | SET_DUE_DATETIME | SET_DESCRIPTION);
  assert.deepEqual(all, {
    can_update: true,
    can_set_due_date: true,
    can_set_due_datetime: true,
    can_set_description: true,
  });
  assert.equal(Object.isFrozen(all), true);
});

test("invalid feature masks normalize safely to no capabilities", () => {
  for (const value of [null, undefined, -1, 1.5, NaN, "64"]) {
    assert.deepEqual(todoCapabilities(value), todoCapabilities(0));
  }
});
