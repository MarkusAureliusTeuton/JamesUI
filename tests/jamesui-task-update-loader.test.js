import test from "node:test";
import assert from "node:assert/strict";

import { createActionRegistry } from "../custom_components/jamesui/frontend/core/action-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/action.task-update/manifest.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

const entryUrl = new URL("../custom_components/jamesui/frontend/modules/action.task-update/index.js", import.meta.url).href;

function todo(entityId) {
  return { entity_id: entityId, state: "0", attributes: { supported_features: 4 } };
}

test("real task-update action runs through Registry and Loader with clean action ownership", async () => {
  const registry = createModuleRegistry();
  const health = createHealthService();
  registry.register(MANIFEST, { entryUrl });
  const actions = createActionRegistry({ health });
  const homeAssistant = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home") } });
  const loader = createModuleLoader({
    registry,
    health,
    getContext: ({ id, manifest }) => Object.freeze({
      events: {}, overlays: {}, capabilities: {}, actions, homeAssistant,
      module: Object.freeze({ id, type: manifest.type, version: manifest.version }),
    }),
  });

  assert.equal(await loader.load(MANIFEST.id, { config: {} }), true);
  assert.equal(loader.mount(MANIFEST.id, { kind: "action-lifecycle-target" }), true);
  assert.equal(actions.has("task.update"), true);
  assert.equal((await actions.execute({
    type: "task.update",
    source_entity_id: "todo.home",
    uid: "one",
    patch: { status: "completed" },
  })).status, "success");
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  assert.equal(loader.update(MANIFEST.id, {}), true);
  assert.equal(actions.has("task.update"), true);
  assert.equal(await loader.reload(MANIFEST.id), true);
  assert.equal(actions.has("task.update"), true);
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  assert.equal(loader.destroy(MANIFEST.id), true);
  assert.equal(actions.has("task.update"), false);
  assert.equal(loader.isLoaded(MANIFEST.id), false);
  actions.destroy();
});
