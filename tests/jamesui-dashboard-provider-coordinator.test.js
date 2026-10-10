import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardProviderCoordinator } from "../custom_components/jamesui/frontend/modules/dashboard-provider-coordinator.js";

const manifests = [
  [{ id: "provider.weather", type: "provider" }],
  [{ id: "provider.calendar", type: "provider" }],
  [{ id: "provider.tasks", type: "provider" }],
  [{ id: "widget.calendar-agenda", type: "widget" }],
];
const source = (entries = {}) => ({ data_sources: entries });
function harness({ load = null, mount = null, update = null } = {}) {
  const calls = [];
  const moduleLoader = {
    async load(id, options) {
      calls.push(["load", id, options.config]);
      return load ? load(id, options) : true;
    },
    mount(id, target) {
      calls.push(["mount", id, target]);
      return mount ? mount(id, target) : true;
    },
    update(id, config) {
      calls.push(["update", id, config]);
      return update ? update(id, config) : true;
    },
    destroy(id) { calls.push(["destroy", id]); return true; },
  };
  const target = {};
  const coordinator = createDashboardProviderCoordinator({
    registered: manifests, moduleLoader, getTarget: () => target,
  });
  return { calls, target, coordinator };
}

test("coordinator mounts only configured providers and accepts legacy weather mapping", async () => {
  const { calls, target, coordinator } = harness();
  assert.equal(await coordinator.sync(source({
    weather: { entity_id: "weather.home" },
    "provider.calendar": { source_entity_ids: ["calendar.family"] },
  })), true);
  assert.deepEqual(calls.filter((entry) => entry[0] === "mount"), [
    ["mount", "provider.weather", target], ["mount", "provider.calendar", target],
  ]);
  assert.deepEqual(calls.filter((entry) => entry[0] === "load").map((entry) => entry[1]),
    ["provider.weather", "provider.calendar"]);
  assert.equal(await coordinator.sync(source({
    weather: { entity_id: "weather.home" },
    "provider.calendar": { source_entity_ids: ["calendar.family"] },
  })), true);
  assert.equal(calls.filter((entry) => entry[0] === "load").length, 2, "Identical sources are not reloaded");
  coordinator.destroy();
  assert.deepEqual(calls.filter((entry) => entry[0] === "destroy").map((entry) => entry[1]),
    ["provider.weather", "provider.calendar"]);
});

test("committed source changes update providers and absent sources are removed", async () => {
  const { calls, coordinator } = harness();
  await coordinator.sync(source({ "provider.calendar": { source_entity_ids: ["calendar.family"] } }));
  await coordinator.sync(source({
    "provider.calendar": { source_entity_ids: ["calendar.family", "calendar.work"] },
    "provider.tasks": { source_entity_ids: ["todo.home"] },
  }));
  assert.deepEqual(calls.filter((entry) => entry[0] === "update"), [
    ["update", "provider.calendar", { source_entity_ids: ["calendar.family", "calendar.work"] }],
  ]);
  assert.ok(calls.some((entry) => entry[0] === "mount" && entry[1] === "provider.tasks"));
  await coordinator.sync(source({ "provider.tasks": { source_entity_ids: ["todo.home"] } }));
  assert.ok(calls.some((entry) => entry[0] === "destroy" && entry[1] === "provider.calendar"));
  coordinator.destroy();
});

test("failed initial load or explicit provider update refusal never claims successful sync", async () => {
  const failing = harness({ load: async (id) => id !== "provider.calendar" });
  await assert.rejects(() => failing.coordinator.sync(source({
    "provider.calendar": { source_entity_ids: ["calendar.bad"] },
  })), /Unable to load configured provider: provider.calendar/);
  assert.ok(failing.calls.some((entry) => entry[0] === "destroy" && entry[1] === "provider.calendar"));
  failing.coordinator.destroy();

  const updateFails = harness({ update: () => false });
  await updateFails.coordinator.sync(source({ "provider.weather": { entity_id: "weather.a" } }));
  await assert.rejects(() => updateFails.coordinator.sync(source({
    "provider.weather": { entity_id: "weather.b" },
  })), /Unable to update configured provider/);
  await updateFails.coordinator.sync(source({ "provider.weather": { entity_id: "weather.a" } }));
  assert.equal(updateFails.calls.filter((entry) => entry[0] === "update").length, 1,
    "Rejected update does not become the accepted baseline");
  updateFails.coordinator.destroy();
});

test("destroy prevents late async provider mount and future config sync", async () => {
  let resume;
  const { calls, coordinator } = harness({
    load: () => new Promise((resolve) => { resume = resolve; }),
  });
  const pending = coordinator.sync(source({ "provider.weather": { entity_id: "weather.home" } }));
  for (let i = 0; i < 5 && !resume; i++) await Promise.resolve();
  assert.equal(typeof resume, "function");
  assert.equal(coordinator.destroy(), true);
  resume(true);
  assert.equal(await pending, false);
  assert.deepEqual(calls.filter((entry) => entry[0] === "mount"), []);
  assert.ok(calls.some((entry) => entry[0] === "destroy" && entry[1] === "provider.weather"));
  assert.equal(await coordinator.sync(source({ "provider.calendar": { source_entity_ids: [] } })), false);
});
