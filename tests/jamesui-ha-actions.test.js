import test from "node:test";
import assert from "node:assert/strict";

import { createActionRegistry } from "../custom_components/jamesui/frontend/core/action-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { registerHomeAssistantActionProviders } from "../custom_components/jamesui/frontend/ha/ha-action-providers.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

function setup() {
  const health = createHealthService();
  const actions = createActionRegistry({ health });
  const homeAssistant = createFakeHomeAssistantAdapter();
  const cleanup = registerHomeAssistantActionProviders({ actions, homeAssistant });
  return { health, actions, homeAssistant, cleanup };
}

test("registers exactly the three HA-backed action providers", () => {
  const { actions, cleanup } = setup();
  for (const type of ["entity.toggle", "ha.service", "scene.activate"]) assert.equal(actions.has(type), true);
  cleanup();
});

test("entity.toggle delegates to homeassistant.toggle with target", async () => {
  const { actions, homeAssistant } = setup();
  const result = await actions.execute({ type: "entity.toggle", entity_id: "light.kitchen" });
  assert.equal(result.status, "success");
  assert.deepEqual(homeAssistant.serviceCalls, [{
    domain: "homeassistant",
    service: "toggle",
    data: {},
    target: { entity_id: "light.kitchen" },
  }]);
});

test("ha.service forwards valid domain service data and target", async () => {
  const { actions, homeAssistant } = setup();
  const data = { brightness_pct: 35 };
  const target = { entity_id: "light.kitchen" };
  const result = await actions.execute({ type: "ha.service", domain: "light", service: "turn_on", data, target });
  assert.equal(result.status, "success");
  assert.deepEqual(homeAssistant.serviceCalls, [{ domain: "light", service: "turn_on", data, target }]);
});

test("scene.activate calls scene.turn_on and includes transition only when supplied", async () => {
  const first = setup();
  assert.equal((await first.actions.execute({ type: "scene.activate", entity_id: "scene.evening" })).status, "success");
  assert.deepEqual(first.homeAssistant.serviceCalls[0], {
    domain: "scene", service: "turn_on", data: {}, target: { entity_id: "scene.evening" },
  });

  const second = setup();
  assert.equal((await second.actions.execute({ type: "scene.activate", entity_id: "scene.cinema", transition: 2.5 })).status, "success");
  assert.deepEqual(second.homeAssistant.serviceCalls[0], {
    domain: "scene", service: "turn_on", data: { transition: 2.5 }, target: { entity_id: "scene.cinema" },
  });
});

test("malformed entity.toggle inputs reject without HA calls", async () => {
  for (const entity_id of [null, "", "light", ".kitchen", "Light.Kitchen", "light.kitchen bad"]) {
    const { actions, homeAssistant } = setup();
    assert.equal((await actions.execute({ type: "entity.toggle", entity_id })).status, "rejected");
    assert.equal(homeAssistant.serviceCalls.length, 0);
  }
});

test("malformed ha.service inputs reject before HA calls", async () => {
  const cases = [
    { domain: "", service: "turn_on" },
    { domain: "light", service: "" },
    { domain: "bad domain", service: "turn_on" },
    { domain: "light", service: "bad service" },
    { domain: "light", service: "turn_on", data: [] },
    { domain: "light", service: "turn_on", data: "bad" },
    { domain: "light", service: "turn_on", target: [] },
    { domain: "light", service: "turn_on", target: "bad" },
  ];
  for (const input of cases) {
    const { actions, homeAssistant } = setup();
    assert.equal((await actions.execute({ type: "ha.service", ...input })).status, "rejected");
    assert.equal(homeAssistant.serviceCalls.length, 0);
  }
});

test("malformed scene inputs reject before HA calls", async () => {
  const cases = [
    { entity_id: "light.not_a_scene" },
    { entity_id: "scene" },
    { entity_id: "scene.bad value" },
    { entity_id: "scene.good", transition: -1 },
    { entity_id: "scene.good", transition: Number.NaN },
    { entity_id: "scene.good", transition: Infinity },
    { entity_id: "scene.good", transition: "2" },
  ];
  for (const input of cases) {
    const { actions, homeAssistant } = setup();
    assert.equal((await actions.execute({ type: "scene.activate", ...input })).status, "rejected");
    assert.equal(homeAssistant.serviceCalls.length, 0);
  }
});

test("disconnected adapter maps all HA actions to unavailable", async () => {
  const { actions, homeAssistant } = setup();
  homeAssistant.setConnectionState("disconnected");
  assert.equal((await actions.execute({ type: "entity.toggle", entity_id: "light.kitchen" })).status, "unavailable");
  assert.equal((await actions.execute({ type: "ha.service", domain: "light", service: "turn_on" })).status, "unavailable");
  assert.equal((await actions.execute({ type: "scene.activate", entity_id: "scene.evening" })).status, "unavailable");
});

test("backend failures normalize to error and Action Registry health", async () => {
  const { actions, homeAssistant, health } = setup();
  const boom = new Error("backend boom");
  homeAssistant.setServiceError(boom);
  const result = await actions.execute({ type: "ha.service", domain: "light", service: "turn_on" });
  assert.equal(result.status, "error");
  assert.equal(result.error, boom);
  const record = health.get("action:ha.service");
  assert.equal(record.status, "error");
  assert.equal(record.error, boom);
});

test("duplicate registration is rejected and cleanup is idempotent", async () => {
  const health = createHealthService();
  const actions = createActionRegistry({ health });
  const homeAssistant = createFakeHomeAssistantAdapter();
  const cleanup = registerHomeAssistantActionProviders({ actions, homeAssistant });
  assert.throws(() => registerHomeAssistantActionProviders({ actions, homeAssistant }), /already registered/);
  assert.equal(cleanup(), true);
  assert.equal(cleanup(), false);
  for (const type of ["entity.toggle", "ha.service", "scene.activate"]) {
    assert.equal((await actions.execute({ type })).status, "unavailable");
  }
});
