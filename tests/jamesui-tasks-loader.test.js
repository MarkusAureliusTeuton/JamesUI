import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.tasks/manifest.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

const entryUrl = new URL("../custom_components/jamesui/frontend/modules/provider.tasks/index.js", import.meta.url).href;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function todo(entityId) {
  return { entity_id: entityId, state: "0", attributes: { friendly_name: "Aufgaben", supported_features: 4 } };
}

test("real tasks provider runs through Registry and Loader with clean capability ownership", async () => {
  const registry = createModuleRegistry();
  const health = createHealthService();
  registry.register(MANIFEST, { entryUrl });
  assert.equal(registry.getCapabilityProvider("tasks.items"), MANIFEST.id);
  const capabilities = createCapabilityRegistry({ moduleRegistry: registry });
  const homeAssistant = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home") } });
  const loader = createModuleLoader({
    registry,
    health,
    getContext: ({ id, manifest }) => Object.freeze({
      events: {}, overlays: {}, actions: {}, capabilities, homeAssistant,
      module: Object.freeze({ id, type: manifest.type, version: manifest.version }),
    }),
  });

  assert.equal(await loader.load(MANIFEST.id, { config: { source_entity_ids: ["todo.home"] } }), true);
  assert.equal(loader.mount(MANIFEST.id, { kind: "provider-lifecycle-target" }), true);
  await flush();
  homeAssistant.emitSubscription(0, { items: [{ uid: "one", summary: "Eine Aufgabe", status: "needs_action" }] });
  assert.equal(capabilities.get("tasks.items").status, "available");
  assert.equal(capabilities.get("tasks.items").value.sources["todo.home"].items[0].uid, "one");
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  assert.equal(loader.update(MANIFEST.id, { source_entity_ids: ["todo.home"] }), true);
  assert.equal(await loader.reload(MANIFEST.id), true);
  assert.equal(health.get(`module:${MANIFEST.id}`), null);
  assert.equal(loader.destroy(MANIFEST.id), true);
  assert.equal(capabilities.get("tasks.items").provider, null);
  capabilities.destroy();
});
