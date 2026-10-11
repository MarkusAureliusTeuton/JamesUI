import test from "node:test";
import assert from "node:assert/strict";

import { createHealthService } from "../custom_components/jamesui/frontend/core/health-service.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { MANIFEST } from "../custom_components/jamesui/frontend/modules/layout.home-hero-deck/manifest.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const entryUrl = new URL(
  "../custom_components/jamesui/frontend/modules/layout.home-hero-deck/index.js",
  import.meta.url,
).href;

const SLOT_NAMES = ["hero", "content"];

test("real home hero deck runs through Registry and Loader without Core changes", async () => {
  const registry = createModuleRegistry();
  const health = createHealthService();
  const loader = createModuleLoader({ registry, health });
  registry.register(MANIFEST, { entryUrl });

  assert.equal(await loader.load(MANIFEST.id, { config: { hero_ratio: 0.35 } }), true);
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  const document = createFakeDocument();
  const target = document.createElement("main");
  assert.equal(loader.mount(MANIFEST.id, target), true);

  const firstRoot = target.querySelector('[data-jui-layout="home-hero-deck"]');
  assert.ok(firstRoot);
  assert.equal(firstRoot.style.getPropertyValue("--jui-home-hero-ratio"), "35%");
  const firstSlots = new Map(SLOT_NAMES.map((name) => [
    name,
    firstRoot.querySelector(`[data-jui-layout-slot="${name}"]`),
  ]));
  for (const slot of firstSlots.values()) assert.ok(slot);

  assert.equal(loader.update(MANIFEST.id, { hero_ratio: 0.50 }), true);
  assert.equal(firstRoot.style.getPropertyValue("--jui-home-hero-ratio"), "50%");
  for (const name of SLOT_NAMES) {
    assert.equal(firstRoot.querySelector(`[data-jui-layout-slot="${name}"]`), firstSlots.get(name));
  }

  assert.equal(await loader.reload(MANIFEST.id), true);
  const secondRoot = target.querySelector('[data-jui-layout="home-hero-deck"]');
  assert.ok(secondRoot);
  assert.notEqual(secondRoot, firstRoot);
  assert.equal(firstRoot.parentNode, null);
  assert.equal(secondRoot.style.getPropertyValue("--jui-home-hero-ratio"), "50%");
  assert.equal(target.querySelectorAll('[data-jui-layout="home-hero-deck"]').length, 1);
  for (const name of SLOT_NAMES) {
    assert.notEqual(secondRoot.querySelector(`[data-jui-layout-slot="${name}"]`), firstSlots.get(name));
  }
  assert.equal(health.get(`module:${MANIFEST.id}`), null);

  assert.equal(loader.destroy(MANIFEST.id), true);
  assert.equal(loader.isLoaded(MANIFEST.id), false);
  assert.equal(target.querySelector('[data-jui-layout="home-hero-deck"]'), null);
});
