import { createTasksProvider } from "./provider.js";

export function create(context, config) {
  return createTasksProvider(context, config);
}
