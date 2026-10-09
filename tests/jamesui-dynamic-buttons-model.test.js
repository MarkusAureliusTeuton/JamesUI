import test from "node:test";
import assert from "node:assert/strict";
import { toggleIntent, buildDynamicButtonModel } from "../custom_components/jamesui/frontend/modules/widget.dynamic-buttons/model.js";

const toggle = Object.freeze({
  name: "Garage", mode: "toggle", icon: "home.door", timeout_ms: 5000, state_source_id: "garage",
  activate_action: Object.freeze({ type: "open" }), deactivate_action: Object.freeze({ type: "close" }),
  presentation: Object.freeze({
    active: Object.freeze({ text: "Offen" }), inactive: Object.freeze({ text: "Geschlossen" }),
    intermediate: Object.freeze({ opening: Object.freeze({ text: "Öffnet", icon: "home.shutter" }) }),
  }),
});
const use = Object.freeze({ id: "g1", button_id: "garage", size: "normal", definition: toggle });

test("toggle intent follows only terminal real state", () => {
  assert.deepEqual(toggleIntent(toggle, { status: "inactive" }), { action: toggle.activate_action, target_status: "active" });
  assert.deepEqual(toggleIntent(toggle, { status: "active" }), { action: toggle.deactivate_action, target_status: "inactive" });
  assert.equal(toggleIntent(toggle, { status: "intermediate" }), null);
  assert.equal(toggleIntent(toggle, { status: "unavailable" }), null);
});

test("keeps fixed name and maps terminal/intermediate/unavailable presentation", () => {
  const active = buildDynamicButtonModel({ use, sourceState: { status: "active", detail: null }, interaction: { state: "idle" } });
  assert.equal(active.name, "Garage"); assert.equal(active.secondary, "Offen"); assert.equal(active.real_status, "active"); assert.equal(active.active, true);
  const moving = buildDynamicButtonModel({ use, sourceState: { status: "intermediate", detail: "opening" }, interaction: { state: "pending" } });
  assert.equal(moving.secondary, "Öffnet"); assert.equal(moving.icon, "home.shutter"); assert.equal(moving.disabled, true);
  const unavailable = buildDynamicButtonModel({ use, sourceState: { status: "unavailable", detail: null }, interaction: { state: "idle" } });
  assert.equal(unavailable.secondary, "Nicht verfügbar"); assert.equal(unavailable.disabled, true);
});

test("trigger description is neutral and feedback is transient presentation only", () => {
  const triggerUse = { id: "t1", button_id: "all", size: "compact", definition: { name: "Alles aus", mode: "trigger", icon: null, description: "Haus ausschalten", action: { type: "x" }, timeout_ms: 5000 } };
  assert.equal(buildDynamicButtonModel({ use: triggerUse, interaction: { state: "idle" } }).secondary, "Haus ausschalten");
  assert.equal(buildDynamicButtonModel({ use: triggerUse, interaction: { state: "pending" } }).secondary, "Wird ausgeführt …");
  assert.equal(buildDynamicButtonModel({ use: triggerUse, interaction: { state: "success" } }).secondary, "Erledigt");
  assert.equal(buildDynamicButtonModel({ use: triggerUse, interaction: { state: "error" } }).secondary, "Fehler");
});
