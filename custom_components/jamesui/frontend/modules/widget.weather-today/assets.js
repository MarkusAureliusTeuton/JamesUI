const ROOT = "/jamesui_static/assets/alpine/";

export const ALPINE_SCENE_ASSETS = Object.freeze({
  "clear-day": `${ROOT}clear-day.webp`,
  "cloudy-day": `${ROOT}cloudy-day.webp`,
  "rain-day": `${ROOT}rain-day.webp`,
  "snow-day": `${ROOT}snow-day.webp`,
  fog: `${ROOT}fog.webp`,
  dusk: `${ROOT}dusk.webp`,
  "clear-night": `${ROOT}clear-night.webp`,
  "cloudy-night": `${ROOT}cloudy-night.webp`,
});

export function alpineAssetForScene(sceneKey) {
  return typeof sceneKey === "string" && Object.prototype.hasOwnProperty.call(ALPINE_SCENE_ASSETS, sceneKey)
    ? ALPINE_SCENE_ASSETS[sceneKey]
    : null;
}
