import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HOME_BACKGROUND_SCENES,
  resolveConfiguredAtmosphere,
  renderBackgroundSettings,
} from "../custom_components/jamesui/frontend/jamesui-home-background.js";

const backgroundSource = readFileSync(
  new URL("../custom_components/jamesui/frontend/jamesui-home-background.js", import.meta.url),
  "utf8"
);
const apiSource = readFileSync(
  new URL("../custom_components/jamesui/api.py", import.meta.url),
  "utf8"
);

const autoAtmosphere = {
  key: "clear-day",
  asset: "/jamesui_static/assets/alpine/clear-day.webp",
  tone: "day",
  weatherClass: "clear",
};

test("manual background mode overrides the automatic scene without changing weather data", () => {
  const manual = resolveConfiguredAtmosphere(autoAtmosphere, {
    background_mode: "manual",
    background_scene: "cloudy-night",
  });
  assert.equal(manual.key, "cloudy-night");
  assert.equal(manual.tone, "night");
  assert.equal(manual.weatherClass, "cloudy");
  assert.match(manual.asset, /cloudy-night\.webp$/);
});

test("automatic mode is the default and invalid manual scenes fall back safely", () => {
  assert.deepEqual(resolveConfiguredAtmosphere(autoAtmosphere, {}), autoAtmosphere);
  assert.deepEqual(
    resolveConfiguredAtmosphere(autoAtmosphere, { background_mode: "manual", background_scene: "does-not-exist" }),
    autoAtmosphere
  );
});

test("exposes the eight approved manual Alpine background scenes", () => {
  assert.deepEqual(
    HOME_BACKGROUND_SCENES.map((scene) => scene.key),
    ["clear-day", "cloudy-day", "rain-day", "snow-day", "fog", "dusk", "clear-night", "cloudy-night"]
  );
  assert.ok(HOME_BACKGROUND_SCENES.every((scene) => scene.label && scene.asset.endsWith(".webp")));
});

test("renders a dedicated background save action at the end of the background settings", () => {
  const html = renderBackgroundSettings({ background_mode: "manual", background_scene: "fog" });
  assert.match(html, /data-config-background-mode/);
  assert.match(html, /value="manual" selected/);
  assert.match(html, /data-config-background-scene/);
  assert.match(html, /value="fog" selected/);
  assert.match(html, /Automatisch/);
  assert.match(html, /Bewölkte Nacht/);
  assert.match(html, /data-save-background/);
  assert.match(html, /Hintergrund speichern/);
});

test("background settings save independently from the entity mapping save path", () => {
  assert.match(backgroundSource, /_homeSettingsPage/);
  assert.match(backgroundSource, /data-save-background/);
  assert.match(backgroundSource, /saveBackgroundConfig/);
  assert.doesNotMatch(backgroundSource, /originalSaveHomeConfig/);
  assert.match(backgroundSource, /jamesui\/config\/update/);
  assert.match(apiSource, /background_mode/);
  assert.match(apiSource, /background_scene/);
});

test("manual scene selector updates its preview immediately before persistence", () => {
  assert.match(backgroundSource, /data-config-background-scene/);
  assert.match(backgroundSource, /alpine-background-preview/);
  assert.match(backgroundSource, /addEventListener\("change"/);
});

test("r7 replaces the old near-black veil with a restrained photo overlay", () => {
  assert.doesNotMatch(backgroundSource, /rgba\(8,10,11,\.84\)/);
  assert.doesNotMatch(backgroundSource, /rgba\(8,9,10,\.88\)/);
  assert.match(backgroundSource, /rgba\(8,10,11,\.46\)/);
  assert.match(backgroundSource, /rgba\(8,9,10,\.62\)/);
});
