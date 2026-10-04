import test from "node:test";
import assert from "node:assert/strict";

import { conditionPresentation } from "../custom_components/jamesui/frontend/modules/widget.weather-today/model.js";

test("pouring uses the approved heavy-rain copy and alert emphasis", () => {
  assert.deepEqual(conditionPresentation("pouring"), {
    iconId: "weather.heavy-rain",
    label: "Starker Regen",
    emphasis: "alert",
  });
});
