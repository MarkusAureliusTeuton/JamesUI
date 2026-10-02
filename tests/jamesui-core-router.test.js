import test from "node:test";
import assert from "node:assert/strict";

import { CORE_ROUTES, getCoreRoute } from "../custom_components/jamesui/frontend/core/routes.js";
import { createRouter } from "../custom_components/jamesui/frontend/core/router.js";

test("exposes the canonical ordered JamesUI Core routes", () => {
  assert.deepEqual(
    CORE_ROUTES.map(({ id, label }) => [id, label]),
    [
      ["home", "Start"],
      ["house", "Haus"],
      ["climate", "Klima"],
      ["media", "Medien"],
      ["door", "Tür"],
    ],
  );
  assert.equal(getCoreRoute("house"), CORE_ROUTES[1]);
  assert.equal(getCoreRoute("unknown"), null);
  assert.equal(Object.isFrozen(CORE_ROUTES), true);
});

test("starts at home and emits only real valid route changes", () => {
  const router = createRouter();
  const changes = [];
  const unsubscribe = router.subscribe((change) => changes.push(change));

  assert.equal(router.currentRouteId, "home");
  assert.equal(router.currentRoute.id, "home");

  assert.equal(router.navigate("house"), true);
  assert.equal(router.currentRouteId, "house");
  assert.deepEqual(changes, [
    {
      from: "home",
      to: "house",
      route: { id: "house", label: "Haus" },
    },
  ]);

  assert.equal(router.navigate("house"), true);
  assert.equal(changes.length, 1);

  assert.equal(router.navigate("unknown"), false);
  assert.equal(router.currentRouteId, "house");
  assert.equal(changes.length, 1);

  unsubscribe();
  assert.equal(router.navigate("climate"), true);
  assert.equal(changes.length, 1);
});

test("destroy removes existing subscribers", () => {
  const router = createRouter();
  let calls = 0;
  router.subscribe(() => { calls += 1; });

  router.destroy();
  assert.equal(router.navigate("house"), true);
  assert.equal(calls, 0);
});
