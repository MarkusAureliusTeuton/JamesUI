import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HOME_BACKGROUND_SCENES,
  resolveHomeAtmosphere,
} from "../custom_components/jamesui/frontend/jamesui-home.js";

const homeSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home.js", import.meta.url),
  "utf8"
);
const apiSource = readFileSync(
  new URL("../custom_components/jamesui/api.py", import.meta.url),
  "utf8"
);

test("manual background mode overrides automatic weather and day period", () => {
  const manual = resolveHomeAtmosphere("sunny", "day", {
    mode: "manual",
    scene: "cloudy-night",
  });
  assert.equal(manual.key, "cloudy-night");
  assert.equal(manual.tone, "night");
  assert.equal(manual.weatherClass, "cloudy");
  assert.match(manual.asset, /cloudy-night\.webp$/);
});

test("automatic background mode remains the default and invalid manual scenes fall back safely", () => {
  assert.equal(resolveHomeAtmosphere("rainy", "day").key, "rain-day");
  assert.equal(resolveHomeAtmosphere("sunny", "night", { mode: "manual", scene: "does-not-exist" }).key, "clear-night");
});

test("exposes the eight approved manual Alpine background scenes", () => {
  assert.deepEqual(
    HOME_BACKGROUND_SCENES.map((scene) => scene.key),
    ["clear-day", "cloudy-day", "rain-day", "snow-day", "fog", "dusk", "clear-night", "cloudy-night"]
  );
  assert.ok(HOME_BACKGROUND_SCENES.every((scene) => scene.label && scene.asset.endsWith(".webp")));
});

test("Start settings hook into the existing config flow instead of a parallel settings system", () => {
  assert.match(homeSource, /_homeSettingsPage/);
  assert.match(homeSource, /_saveHomeConfig/);
  assert.match(homeSource, /data-config-background-mode/);
  assert.match(homeSource, /data-config-background-scene/);
  assert.match(apiSource, /background_mode/);
  assert.match(apiSource, /background_scene/);
  assert.match(apiSource, /clear-day/);
  assert.match(apiSource, /cloudy-night/);
});

test("r7 keeps photo visibility by using a restrained overlay instead of the old near-black veil", () => {
  assert.doesNotMatch(homeSource, /rgba\(8,10,11,\.84\)/);
  assert.doesNotMatch(homeSource, /rgba\(8,9,10,\.88\)/);
  assert.match(homeSource, /alpine-atmosphere/);
});
