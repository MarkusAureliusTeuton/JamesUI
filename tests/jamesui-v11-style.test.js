import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const homeSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home.js", import.meta.url),
  "utf8"
);
const dataSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home-data.js", import.meta.url),
  "utf8"
);

test("weather facts stay icon-led without a divider line and current weather uses a richer inline pictogram", () => {
  assert.match(homeSource, /start-v11-current-weather-icon/);
  assert.match(homeSource, /function currentWeatherIcon\(/);
  assert.match(homeSource, /\.start-v9-weather-facts\{[^}]*border-top:0/);
  assert.match(homeSource, /start-v11-moon-main/);
  assert.match(homeSource, /start-v11-moon-phase/);
});

test("calendar and house sit on one framed glass deck over a fading continuation of the alpine image", () => {
  assert.match(homeSource, /class="start-v11-lower-stage"/);
  assert.match(homeSource, /class="start-v11-alpine-bleed"/);
  assert.match(homeSource, /\.start-v11-lower-stage/);
  assert.match(homeSource, /\.start-v9-lower-grid::before/);
  assert.match(homeSource, /linear-gradient\(90deg,transparent,/);
  assert.match(homeSource, /border-radius:18px/);
  assert.match(homeSource, /backdrop-filter:blur\(/);
});

test("house status and favorite scenes use tactile mockup-style buttons", () => {
  assert.match(homeSource, /<button class="start-v9-house-item/);
  assert.match(homeSource, /data-home-target=/);
  assert.match(homeSource, /start-v11-house-chevron/);
  assert.match(homeSource, /start-v11-scene-art/);
  assert.match(homeSource, /sceneArtwork\(/);
  assert.match(homeSource, /\.start-v9-house-item\{[^}]*border-radius:10px/);
  assert.match(homeSource, /\.start-v9-scene\{[^}]*background-image:/);
  assert.match(dataSource, /\[data-home-target\]/);
  assert.match(dataSource, /dataset\.homeTarget/);
});
