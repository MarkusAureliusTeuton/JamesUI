import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardWidgetSetup } from "../custom_components/jamesui/frontend/modules/dashboard-widget-setup.js";

function config() {
  return {
    data_sources: {
      "provider.calendar": { source_entity_ids: ["calendar.work"] },
      "provider.house-lighting": {
        lights: [{ id: "existing", name: "Flur", state: { entity_id: "light.flur" } }],
        ambient_lights: [],
      },
    },
    dynamic_buttons: {
      existing: { name: "Bestehend", mode: "trigger", action: { type: "navigate", route: "home" } },
    },
  };
}

test("catalog weather plans an empty but valid widget without fake sources", () => {
  const setup = buildDashboardWidgetSetup({ moduleId: "widget.weather-today", currentConfig: config() });
  assert.deepEqual(setup, { config: {}, dataSources: {}, dynamicButtons: {} });
});

test("catalog agenda merges explicit real calendar/todo IDs without losing existing sources", () => {
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.calendar-agenda",
    inputs: { calendars: "calendar.work, calendar.family; calendar.family", tasks: "todo.haus" },
    currentConfig: config(),
  });
  assert.equal(setup.config.instance_id, "dashboard-pending");
  assert.deepEqual(setup.config.calendars.map((entry) => entry.entity_id), ["calendar.work", "calendar.family"]);
  assert.deepEqual(setup.config.task_lists.map((entry) => entry.entity_id), ["todo.haus"]);
  assert.deepEqual(setup.dataSources["provider.calendar"].source_entity_ids, ["calendar.work", "calendar.family"]);
  assert.deepEqual(setup.dataSources["provider.tasks"].source_entity_ids, ["todo.haus"]);
});

test("catalog agenda refuses missing or invalid sources instead of adding an unmountable widget", () => {
  for (const inputs of [{}, { calendars: "calendar.X" }, { tasks: "light.foo" }]) {
    assert.throws(() => buildDashboardWidgetSetup({
      moduleId: "widget.calendar-agenda", inputs, currentConfig: config(),
    }), /Entität|Mindestens/);
  }
});

test("catalog House Quick reuses existing light sources and can append explicit unique sources", () => {
  const existing = buildDashboardWidgetSetup({ moduleId: "widget.house-quick", currentConfig: config() });
  assert.deepEqual(existing.config.buttons, [{ id: "lights", type: "lights" }]);
  assert.deepEqual(existing.dataSources, {});
  const added = buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", inputs: { lightEntityId: "light.wohnzimmer" }, currentConfig: config(),
  });
  assert.equal(added.dataSources["provider.house-lighting"].lights.length, 2);
  assert.equal(added.dataSources["provider.house-lighting"].lights[0].id, "existing");
  assert.equal(added.dataSources["provider.house-lighting"].lights[1].state.entity_id, "light.wohnzimmer");
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: { data_sources: {} },
  }), /Lichtentität/);
});

test("catalog dynamic widget uses existing central button or safely creates explicit URL action", () => {
  const existing = buildDashboardWidgetSetup({
    moduleId: "widget.dynamic-buttons", currentConfig: config(), inputs: { existingButtonId: "existing" },
  });
  assert.deepEqual(existing.config.buttons, [{ id: "button-1", button_id: "existing", size: "normal" }]);
  assert.deepEqual(existing.dynamicButtons, {});
  const fresh = buildDashboardWidgetSetup({
    moduleId: "widget.dynamic-buttons", currentConfig: config(),
    inputs: { buttonName: "Haus-Portal", url: "https://example.org/home" },
  });
  assert.equal(fresh.config.buttons[0].button_id, "dashboard-link-1");
  assert.equal(fresh.dynamicButtons["dashboard-link-1"].action.url, "https://example.org/home");
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.dynamic-buttons", currentConfig: config(),
    inputs: { buttonName: "Unsafe", url: "javascript:alert(1)" },
  }), /HTTP/);
});
