import test from "node:test";
import assert from "node:assert/strict";
import { createJamesUI1Preview } from "../custom_components/jamesui/frontend/jamesui-1-preview.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

test("Block 14 preview registers actual widget modules but never mounts r11", () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  const ids = preview.core.moduleRegistry.list().map((item) => item.manifest.id);
  assert.deepEqual(ids, [
    "widget.weather-today", "widget.calendar-agenda",
    "widget.house-quick", "widget.dynamic-buttons",
  ]);
  assert.equal(preview.core.config.snapshot(), null);
  preview.destroy();
});

test("Block 14 opt-in preview refuses empty schema without substituting fake data", async () => {
  const document = createFakeDocument();
  const preview = createJamesUI1Preview({ document });
  // No Home Assistant transport or dashboard config supplied.
  // The preview should reject, not fall back to legacy markup.
  await assert.rejects(() => preview.mount(document.createElement("main")));
  preview.destroy();
});
