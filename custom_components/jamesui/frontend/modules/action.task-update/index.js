import { createTaskUpdateAction } from "./action.js";

export function create(context, config) {
  return createTaskUpdateAction(context, config);
}
