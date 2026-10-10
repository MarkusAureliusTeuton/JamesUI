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

test("catalog weather requires explicit weather entity and preserves optional source fields", () => {
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.weather-today", currentConfig: config(),
  }), /Wetter-Entität/);
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.weather-today",
    currentConfig: config(),
    inputs: { weatherEntityId: "weather.home", moonEntityId: "sensor.moon_phase" },
  });
  assert.deepEqual(setup, {
    config: {}, dataSources: { "provider.weather": {
      entity_id: "weather.home", moon_entity_id: "sensor.moon_phase",
    } }, dynamicButtons: {},
  });
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.weather-today", currentConfig: config(),
    inputs: { weatherEntityId: "sensor.not_weather" },
  }), /weather/);
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
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: config(),
    inputs: { lightEntityId: "sensor.temperature" },
  }), /light/);
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

test("catalog House Quick configures an ambient light without mixing the two lighting groups", () => {
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: config(),
    inputs: { houseType: "ambient_lights", lightEntityId: "light.ambient" },
  });
  assert.deepEqual(setup.config.buttons, [{ id: "ambient_lights", type: "ambient_lights" }]);
  assert.equal(setup.dataSources["provider.house-lighting"].lights.length, 1);
  assert.equal(setup.dataSources["provider.house-lighting"].ambient_lights[0].state.entity_id, "light.ambient");
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: config(),
    inputs: { houseType: "ambient_lights", lightEntityId: "light.flur" },
  }), /anderen Lichtgruppe/);
});

test("catalog House Quick maps heating zone to explicit KNX/HA entity bindings", () => {
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: config(),
    inputs: {
      houseType: "heating_zone", sourceName: "Wohnzimmer",
      currentTemperature: "sensor.raum_ist", targetTemperature: "sensor.raum_soll",
      heatingDemand: "binary_sensor.heizbedarf", autoRegulation: "binary_sensor.heizung_auto",
    },
  });
  assert.deepEqual(setup.config.buttons, [{
    id: "heating", type: "heating_zone", source_id: "dashboard-zone-1",
  }]);
  const zone = setup.dataSources["provider.house-heating"].zones[0];
  assert.equal(zone.auto_regulation_enabled.entity_id, "binary_sensor.heizung_auto");
  assert.equal(zone.heating_demand.entity_id, "binary_sensor.heizbedarf");
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: config(),
    inputs: { houseType: "heating_zone", sourceName: "Wohnzimmer", currentTemperature: "sensor.raum_ist" },
  }), /Solltemperatur/);
});

test("catalog House Quick creates a single device with explicit fault/update status bindings", () => {
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: config(),
    inputs: {
      houseType: "devices", sourceName: "Lüftung", primaryEntity: "switch.ventilation",
      activeEntity: "binary_sensor.ventilation_active",
      updateEntity: "binary_sensor.ventilation_update",
      faultEntity: "binary_sensor.ventilation_fault",
    },
  });
  assert.deepEqual(setup.config.buttons, [{ id: "devices", type: "devices" }]);
  const device = setup.dataSources["provider.house-devices"].devices[0];
  assert.equal(device.primary_entity_id, "switch.ventilation");
  assert.equal(device.fault.entity_id, "binary_sensor.ventilation_fault");
  assert.ok(!("warning" in device));
});

test("catalog energy uses configurable warning and critical thresholds, rejects inverted levels", () => {
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: config(),
    inputs: { houseType: "energy", sourceName: "Haus", powerEntity: "sensor.hausverbrauch",
      averageWindow: "30", warningThreshold: "3000", criticalThreshold: "5000" },
  });
  assert.deepEqual(setup.config.buttons, [{
    id: "energy", type: "energy", source_id: "dashboard-energy-1",
    average_window_minutes: 30, warning_threshold_w: 3000, critical_threshold_w: 5000,
  }]);
  assert.equal(setup.dataSources["provider.house-energy"].sources[0].power.entity_id, "sensor.hausverbrauch");
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: config(),
    inputs: { houseType: "energy", sourceName: "Haus", powerEntity: "sensor.hausverbrauch",
      averageWindow: "15", warningThreshold: "5000", criticalThreshold: "3000" },
  }), /Kritische Schwelle/);
});

test("catalog Dynamic Buttons configures a true state-backed HA toggle", () => {
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.dynamic-buttons",
    currentConfig: config(),
    inputs: { buttonKind: "toggle", buttonName: "Wohnzimmerlicht", toggleEntity: "light.wohnzimmer" },
  });
  assert.deepEqual(setup.config.buttons, [{ id: "button-1", button_id: "dashboard-toggle-1", size: "normal" }]);
  assert.deepEqual(setup.dataSources["provider.control-state"].sources[0].active_values, ["on"]);
  assert.deepEqual(setup.dataSources["provider.control-state"].sources[0].inactive_values, ["off"]);
  assert.equal(setup.dataSources["provider.control-state"].sources[0].entity_id, "light.wohnzimmer");
  const definition = setup.dynamicButtons["dashboard-toggle-1"];
  assert.equal(definition.mode, "toggle");
  assert.equal(definition.state_source_id, "dashboard-toggle-state-1");
  assert.deepEqual(definition.activate_action, { type: "entity.toggle", entity_id: "light.wohnzimmer" });
  assert.deepEqual(definition.deactivate_action, { type: "entity.toggle", entity_id: "light.wohnzimmer" });
});

test("catalog Dynamic Buttons reuses matching on/off state mappings", () => {
  const existing = config();
  existing.data_sources["provider.control-state"] = {
    sources: [{
      id: "existing-state", entity_id: "switch.ventilation",
      active_values: ["on"], inactive_values: ["off"],
    }],
  };
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.dynamic-buttons", currentConfig: existing,
    inputs: { buttonKind: "toggle", buttonName: "Lüftung", toggleEntity: "switch.ventilation" },
  });
  assert.deepEqual(setup.dataSources, {});
  assert.equal(setup.dynamicButtons["dashboard-toggle-1"].state_source_id, "existing-state");
});

test("catalog refuses control-state toggle on read-only or malformed HA entities", () => {
  for (const toggleEntity of ["sensor.temperature", "binary_sensor.motion", "Switch.Bad", "light."]) {
    assert.throws(() => buildDashboardWidgetSetup({
      moduleId: "widget.dynamic-buttons", currentConfig: config(),
      inputs: { buttonKind: "toggle", buttonName: "Test", toggleEntity },
    }), /schaltbare/);
  }
});

function existingHeating({ shared = false } = {}) {
  const row = {
    id: "zone-living", name: "Wohnzimmer",
    current_temperature: { entity_id: "sensor.living_actual", attribute: "temperature" },
    target_temperature: { entity_id: "sensor.living_target" },
    heating_demand: { entity_id: "binary_sensor.living_demand" },
    auto_regulation_enabled: {
      entity_id: "binary_sensor.living_auto",
      true_values: ["1"], false_values: ["0"],
    },
  };
  const button = {
    id: "heating", type: "heating_zone", source_id: "zone-living",
    icon: "house", navigation: { route: "home" },
  };
  return {
    data_sources: { "provider.house-heating": { zones: [row] } },
    widget_instances: {
      first: { module_id: "widget.house-quick", config: { buttons: [button] } },
      ...(shared ? { second: { module_id: "widget.house-quick",
        config: { buttons: [{ id: "other", type: "heating_zone", source_id: "zone-living" }] } } } : {}),
    },
    dynamic_buttons: {},
    priorWidgetConfig: { buttons: [button] },
  };
}

function heatingInputs(overrides = {}) {
  return {
    houseType: "heating_zone", sourceName: "Wohnzimmer",
    currentTemperature: "sensor.living_actual", targetTemperature: "sensor.living_target",
    heatingDemand: "binary_sensor.living_demand", autoRegulation: "binary_sensor.living_auto",
    ...overrides,
  };
}

test("editing unchanged heating zone reuses the original source without extra provider writes", () => {
  const current = existingHeating();
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: current,
    priorWidgetConfig: current.priorWidgetConfig,
    inputs: heatingInputs(),
  });
  assert.deepEqual(setup.dataSources, {});
  assert.deepEqual(setup.config.buttons, current.priorWidgetConfig.buttons);
});

test("editing uniquely used heating zone changes the existing source ID in place and preserves bindings", () => {
  const current = existingHeating();
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: current,
    priorWidgetConfig: current.priorWidgetConfig,
    inputs: heatingInputs({ targetTemperature: "sensor.living_target_new" }),
  });
  assert.equal(setup.dataSources["provider.house-heating"].zones.length, 1);
  const zone = setup.dataSources["provider.house-heating"].zones[0];
  assert.equal(zone.id, "zone-living");
  assert.equal(zone.target_temperature.entity_id, "sensor.living_target_new");
  assert.equal(zone.current_temperature.attribute, "temperature");
  assert.deepEqual(zone.auto_regulation_enabled.true_values, ["1"]);
  assert.equal(setup.config.buttons[0].source_id, "zone-living");
  assert.equal(setup.config.buttons[0].navigation.route, "home");
  assert.equal(current.data_sources["provider.house-heating"].zones[0].target_temperature.entity_id,
    "sensor.living_target", "Current config cannot be mutated before Save");
});

test("editing a heating zone shared by another widget forks its source without changing the other widget", () => {
  const current = existingHeating({ shared: true });
  const setup = buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: current,
    priorWidgetConfig: current.priorWidgetConfig,
    inputs: heatingInputs({ targetTemperature: "sensor.living_new" }),
  });
  const zones = setup.dataSources["provider.house-heating"].zones;
  assert.equal(zones.length, 2);
  assert.equal(zones[0].id, "zone-living");
  assert.equal(zones[0].target_temperature.entity_id, "sensor.living_target");
  assert.equal(zones[1].id, "dashboard-zone-1");
  assert.equal(zones[1].target_temperature.entity_id, "sensor.living_new");
  assert.equal(setup.config.buttons[0].source_id, "dashboard-zone-1");
  assert.equal(setup.config.buttons[0].navigation.route, "home");
  assert.equal(current.widget_instances.second.config.buttons[0].source_id, "zone-living");
});

test("editing a missing heating source refuses to fabricate a replacement", () => {
  const current = existingHeating();
  current.data_sources["provider.house-heating"].zones = [];
  assert.throws(() => buildDashboardWidgetSetup({
    moduleId: "widget.house-quick", currentConfig: current,
    priorWidgetConfig: current.priorWidgetConfig,
    inputs: heatingInputs(),
  }), /Bisherige Heizungszone/);
});
