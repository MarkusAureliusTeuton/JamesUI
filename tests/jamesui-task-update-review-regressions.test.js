import test from "node:test";
import assert from "node:assert/strict";

import { createActionRegistry } from "../custom_components/jamesui/frontend/core/action-registry.js";
import { createTaskUpdateAction } from "../custom_components/jamesui/frontend/modules/action.task-update/action.js";
import { createFakeHomeAssistantAdapter } from "./helpers/fake-home-assistant-adapter.js";

function todo(entityId) {
  return { entity_id: entityId, state: "0", attributes: { supported_features: 4 } };
}

test("failed migration to a conflicting action registry leaves the original task.update provider intact", async () => {
  const firstActions = createActionRegistry();
  const secondActions = createActionRegistry();
  const homeAssistant = createFakeHomeAssistantAdapter({ states: { "todo.home": todo("todo.home") } });
  const releaseConflict = secondActions.register("task.update", async () => ({ status: "success" }));
  const module = createTaskUpdateAction({ actions: firstActions, homeAssistant }, {});

  assert.equal(module.mount(null), true);
  assert.equal(firstActions.has("task.update"), true);
  assert.equal(secondActions.has("task.update"), true);

  assert.throws(
    () => module.update({ actions: secondActions, homeAssistant }, {}),
    /task\.update|registered|provider/i,
  );

  assert.equal(firstActions.has("task.update"), true);
  assert.equal(secondActions.has("task.update"), true);
  const result = await firstActions.execute({
    type: "task.update",
    source_entity_id: "todo.home",
    uid: "one",
    patch: { status: "completed" },
  });
  assert.equal(result.status, "success");

  assert.equal(module.destroy(), true);
  releaseConflict();
  firstActions.destroy();
  secondActions.destroy();
});
