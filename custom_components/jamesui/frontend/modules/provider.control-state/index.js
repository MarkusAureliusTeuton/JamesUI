import { createControlStateProvider } from "./provider.js";

export function create(context, config) {
  return createControlStateProvider(context, config);
}
