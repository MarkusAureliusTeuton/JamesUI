import { createWeatherTodayWidget } from "./widget.js";

const runtime = Object.freeze({
  now: () => new Date(),
  setTimeout: (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
});

export function create(context, config) {
  return createWeatherTodayWidget(context, config, runtime);
}
