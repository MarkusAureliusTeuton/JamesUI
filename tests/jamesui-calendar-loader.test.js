import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";
import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.calendar/manifest.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

const entryUrl = new URL(
  "../custom_components/jamesui/frontend/modules/provider.calendar/index.js",
  import.meta.url,
).href;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function calendar(entityId, name) {
  return { entity_id: entityId, state: "off", attributes: { friendly_name: name } };
}

test("real calendar provider runs through Registry and Loader without Core changes", async () => {
  const registry = createModuleRegistry();
  const health = createHealthService();
  registry.register(MANIFEST, { entryUrl });
  assert.equal(registry.getCapabilityProvider("calendar.events"), MANIFEST.id);
  const capabilities = createCapabilityRegistry({ moduleRegistry: registry });
  const homeAssistant = createFakeHomeAssistantAdapter({
    states: { "calendar.family": calendar("calendar.family", "Familie") },
  });
  const loader = createModuleLoader({
    registry,
    health,
    getContext: ({ id, manifest }) => Object.freeze({
      events: {}, overlays: {}, actions: {}, capabilities, homeAssistant,
      module: Object.freeze({ id, type: manifest.type, version: manifest.version }),
    }),
  });

  assert.equal(await loader.load(MANIFEST.id, { config: { source_entity_ids: ["calendar.family"] } }), true);
  assert.equal(loader.mount(MANIFEST.id, { kind: "provider-lifecycle-target" }), true);
  assert.equal(capabilities.get("calendar.events").status, "available");
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  const seen = [];
  capabilities.get("calendar.events").value.subscribe_ranges({ ranges: [{
    entity_id: "calendar.family",
    start_date: "2026-10-04",
    end_date: "2026-10-05",
  }] }, (snapshot) => seen.push(snapshot));
  await flush();
  homeAssistant.emitSubscription(0, { events: [{
    start: "2026-10-04",
    end: "2026-10-05",
    summary: "Familientag",
  }] });
  assert.equal(seen.at(-1).sources["calendar.family"].events[0].title, "Familientag");

  assert.equal(loader.update(MANIFEST.id, { source_entity_ids: ["calendar.family"] }), true);
  assert.equal(capabilities.get("calendar.events").status, "available");
  assert.equal(await loader.reload(MANIFEST.id), true);
  assert.equal(capabilities.get("calendar.events").status, "available");
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  assert.equal(loader.destroy(MANIFEST.id), true);
  assert.equal(loader.isLoaded(MANIFEST.id), false);
  assert.equal(capabilities.get("calendar.events").provider, null);
  capabilities.destroy();
});
