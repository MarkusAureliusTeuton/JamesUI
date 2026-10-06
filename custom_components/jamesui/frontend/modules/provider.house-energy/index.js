import { createHouseEnergyProvider } from "./provider.js";

export function create(context, config) {
  return createHouseEnergyProvider(context, config);
}
