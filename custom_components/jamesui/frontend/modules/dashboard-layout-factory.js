import { create as createHeroDeck } from "./layout.home-hero-deck/index.js";

export function createDashboardHeroLayout(config) {
  return createHeroDeck({}, config);
}
