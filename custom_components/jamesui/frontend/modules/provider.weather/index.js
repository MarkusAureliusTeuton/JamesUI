import { createWeatherProvider } from "./provider.js";

const runtime = Object.freeze({
  now: () => new Date(),
  setInterval: (callback, milliseconds) => globalThis.setInterval(callback, milliseconds),
  clearInterval: (handle) => globalThis.clearInterval(handle),
});

export function create(context, config) {
  return createWeatherProvider(context, config, runtime);
}
