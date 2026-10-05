import { createCalendarAgendaWidget } from "./widget.js";

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const runtime = Object.freeze({
  now: () => new Date(),
  setTimeout: (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
  storage: browserStorage(),
  createResizeObserver(callback) {
    if (typeof globalThis.ResizeObserver === "function") return new globalThis.ResizeObserver(callback);
    return Object.freeze({ observe() {}, disconnect() {} });
  },
  measureHeight(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return 0;
    return element.getBoundingClientRect().height;
  },
});

export function create(context, config) {
  return createCalendarAgendaWidget(context, config, runtime);
}
