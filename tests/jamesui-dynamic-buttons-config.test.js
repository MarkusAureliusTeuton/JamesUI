import test from "node:test";
import assert from "node:assert/strict";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/widget.dynamic-buttons/manifest.js";
import {
  validateDynamicButtonDefinitions,
  validateDynamicButtonInstanceConfig,
  resolveDynamicButtonInstance,
} from "../custom_components/jamesui/frontend/modules/widget.dynamic-buttons/config.js";

function definitions() {
  return {
    garage: {
      name: "Garage", mode: "toggle", icon: "home.door", state_source_id: "garage",
      activate_action: { type: "ha.service", domain: "cover", service: "open_cover", target: { entity_id: "cover.garage" } },
      deactivate_action: { type: "ha.service", domain: "cover", service: "close_cover", target: { entity_id: "cover.garage" } },
      presentation: { active: { text: "Offen" }, inactive: { text: "Geschlossen" }, intermediate: { opening: { text: "Öffnet" } } },
    },
    all_off: { name: "Alles aus", mode: "trigger", description: "Haus ausschalten", action: { type: "ha.service", domain: "homeassistant", service: "turn_off" } },
  };
}

test("declares control.states dependency without providing capabilities", () => {
  assert.deepEqual(MANIFEST, {
    id: "widget.dynamic-buttons", type: "widget", version: "1.0.0", core_api: "1.x",
    depends_on: [], requires_capabilities: ["control.states"], provides_capabilities: [],
    config_schema: "widget.dynamic-buttons/v1",
  });
});

test("validates and deeply freezes central definitions with default timeout", () => {
  const input = definitions();
  const config = validateDynamicButtonDefinitions(input);
  assert.equal(config.garage.timeout_ms, 5000);
  assert.equal(config.all_off.timeout_ms, 5000);
  assert.equal(Object.isFrozen(config.garage.activate_action.target), true);
  input.garage.activate_action.domain = "changed";
  assert.equal(config.garage.activate_action.domain, "cover");
});

test("accepts arbitrary generic action payload but validates action type and semantic icons", () => {
  const input = definitions();
  input.all_off.action = { type: "future.action", nested: { list: [1, true, "x"] } };
  assert.equal(validateDynamicButtonDefinitions(input).all_off.action.type, "future.action");
  input.all_off.action = { type: "" };
  assert.throws(() => validateDynamicButtonDefinitions(input), /type/);
  input.all_off.action = { type: "x" }; input.all_off.icon = "home.missing";
  assert.throws(() => validateDynamicButtonDefinitions(input), /icon/);
});

test("enforces mode-specific fields and one presentation line contract", () => {
  const badToggle = definitions(); badToggle.garage.action = { type: "x" };
  assert.throws(() => validateDynamicButtonDefinitions(badToggle), /unsupported field/);
  const badTrigger = definitions(); badTrigger.all_off.state_source_id = "x";
  assert.throws(() => validateDynamicButtonDefinitions(badTrigger), /unsupported field/);
  const badPresentation = definitions(); badPresentation.garage.presentation.active.detail = "extra";
  assert.throws(() => validateDynamicButtonDefinitions(badPresentation), /unsupported field/);
});

test("validates independent uses and resolves repeated central buttons", () => {
  const instance = validateDynamicButtonInstanceConfig({ buttons: [
    { id: "a", button_id: "garage", size: "normal" },
    { id: "b", button_id: "garage", size: "wide" },
    { id: "c", button_id: "all_off", size: "compact" },
  ] });
  assert.deepEqual(instance.buttons.map((x) => x.size), ["normal", "wide", "compact"]);
  const resolved = resolveDynamicButtonInstance({ definitions: definitions(), instance });
  assert.equal(resolved.buttons[0].definition.name, "Garage");
  assert.equal(resolved.buttons[1].definition.name, "Garage");
  assert.equal(Object.isFrozen(resolved.buttons), true);
});

test("rejects missing references duplicate local ids and invalid sizes", () => {
  assert.throws(() => validateDynamicButtonInstanceConfig({ buttons: [{ id: "a", button_id: "x", size: "huge" }] }), /size/);
  assert.throws(() => validateDynamicButtonInstanceConfig({ buttons: [{ id: "a", button_id: "x", size: "normal" }, { id: "a", button_id: "x", size: "normal" }] }), /duplicate/);
  assert.throws(() => resolveDynamicButtonInstance({ definitions: definitions(), instance: { buttons: [{ id: "a", button_id: "missing", size: "normal" }] } }), /missing/);
});
