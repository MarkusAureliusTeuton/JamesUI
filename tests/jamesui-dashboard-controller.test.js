import test from "node:test";
import assert from "node:assert/strict";
import { createConfigService } from "../custom_components/jamesui/frontend/core/config-service.js";
import { createDashboardController } from "../custom_components/jamesui/frontend/core/dashboard-controller.js";

const element = (id, ref_id, kind, column, row, column_span, row_span) => ({
  id, ref_id, kind, column, row, column_span, row_span,
});

function initial() {
  return {
    schema_version: 1,
    pages: {
      start: {
        kind: "dashboard", layout_id: "deck",
        elements: [
          element("agenda", "agenda-one", "widget", 0, 0, 6, 3),
          element("light", "light-one", "button", 6, 0, 3, 2),
        ],
      },
    },
    layouts: { deck: { kind: "hero-deck", scroll: "fixed", hero_ratio: 0.42 } },
    widget_instances: { "agenda-one": { module_id: "widget.calendar-agenda" } },
    dynamic_buttons: { "light-one": { name: "Licht", mode: "toggle" } },
    data_sources: { preserved: { some: "configuration" } },
    module_settings: {},
  };
}

function setup() {
  let remote = initial();
  const calls = [];
  const adapter = {
    async callWS(message) {
      calls.push(message);
      if (message.type === "jamesui/config/get") return { config: structuredClone(remote) };
      if (message.type === "jamesui/config/replace") {
        remote = structuredClone(message.config);
        return { config: structuredClone(remote) };
      }
      throw new Error("unexpected WS command");
    },
  };
  const configService = createConfigService({ homeAssistant: adapter });
  return { configService, controller: createDashboardController({ configService }), calls };
}

test("Block 14 controller requires loaded config and canonical service", async () => {
  assert.throws(() => createDashboardController({ configService: {} }), /Config Service/);
  const { configService, controller } = setup();
  assert.throws(() => controller.getPage("start"), /loaded/);
  await configService.load();
  assert.equal(controller.getPage("start").layout.hero_ratio, 0.42);
});

test("Block 14 preview never writes; valid move saves just once", async () => {
  const { configService, controller, calls } = setup();
  await configService.load();
  const preview = controller.previewMove("start", "agenda", { column: 6 }, { maxRows: 10 });
  assert.deepEqual(preview.elements.map((e) => [e.id, e.column, e.row]), [
    ["agenda", 6, 0], ["light", 6, 3],
  ]);
  assert.equal(calls.length, 1);
  assert.equal(configService.snapshot().pages.start.elements[0].column, 0);
  await controller.move("start", "agenda", { column: 6 }, { maxRows: 10 });
  assert.equal(calls.length, 2);
  assert.equal(configService.snapshot().pages.start.elements[0].column, 6);
  assert.deepEqual(configService.snapshot().data_sources, initial().data_sources);
});

test("Block 14 rejected placement performs no remote write", async () => {
  const { configService, controller, calls } = setup();
  await configService.load();
  assert.equal(await controller.move("start", "agenda", { column: 6 }, { maxRows: 4 }), null);
  assert.equal(calls.length, 1);
  assert.equal(configService.snapshot().pages.start.elements[0].column, 0);
});

test("Block 14 subsequent moves compose against latest committed coordinates", async () => {
  const { configService, controller } = setup();
  await configService.load();
  await Promise.all([
    controller.move("start", "agenda", { row: 4 }, { maxRows: 15 }),
    controller.move("start", "light", { row: 8 }, { maxRows: 15 }),
  ]);
  const current = controller.getPage("start");
  assert.deepEqual(current.elements.map((e) => [e.id, e.row]), [
    ["agenda", 4], ["light", 8],
  ]);
});
