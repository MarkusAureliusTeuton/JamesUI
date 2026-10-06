import { createHouseDevicesProvider } from "./provider.js";

export function create(context, config) {
  return createHouseDevicesProvider(context, config);
}
