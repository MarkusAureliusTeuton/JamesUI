import { createHouseHeatingProvider } from "./provider.js";

export function create(context, config) {
  return createHouseHeatingProvider(context, config);
}
