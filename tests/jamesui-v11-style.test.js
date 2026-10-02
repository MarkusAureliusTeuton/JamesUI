import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const polishSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-v11-polish.js", import.meta.url),
  "utf8"
);
const entrySource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home-entry.js", import.meta.url),
  "utf8"
);

test("weather facts stay icon-led without a divider line and current weather gets a richer cloudy pictogram", () => {
  assert.match(polishSource, /\.start-v9-weather-facts\{border-top:0/);
  assert.match(polishSource, /\.weather-cloudy \.start-v9-weather-symbol/);
  assert.match(polishSource, /background-image:url\("data:image\/svg\+xml/);
});

test("calendar and house share one framed glass deck over a fading continuation of the alpine image", () => {
  assert.match(polishSource, /\.start-v9-lower-grid\{/);
  assert.match(polishSource, /margin:-24px 14px 0/);
  assert.match(polishSource, /border-radius:18px/);
  assert.match(polishSource, /backdrop-filter:blur\(/);
  assert.match(polishSource, /\.start-v9-lower-grid::before/);
  assert.match(polishSource, /linear-gradient\(90deg,transparent,/);
  assert.match(polishSource, /\.alpine-home\[data-atmosphere="clear-day"\]/);
  assert.match(polishSource, /--v11-bleed:url\('\/jamesui_static\/assets\/alpine\/clear-day.webp'\)/);
});

test("house status and favorite scenes use tactile mockup-style surfaces", () => {
  assert.match(polishSource, /\.start-v9-house-item\{/);
  assert.match(polishSource, /border-radius:10px/);
  assert.match(polishSource, /linear-gradient\(180deg,rgba\(255,255,255/);
  assert.match(polishSource, /\.start-v9-scene\{/);
  assert.match(polishSource, /background-image:/);
  assert.match(polishSource, /\.start-v9-scene:nth-child\(2\)/);
});

test("V11 polish is revision-coupled into the existing Start loader", () => {
  assert.match(entrySource, /jamesui-v11-polish\.js/);
  assert.match(entrySource, /polishModuleUrl\.searchParams\.set\("v", revision\)/);
  assert.match(entrySource, /installV11Polish/);
});
