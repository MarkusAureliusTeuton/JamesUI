import { createDashboardPageComposer } from "../core/dashboard-page-composer.js";
import { createDashboardCatalog, createDashboardCatalogView } from "./dashboard-catalog.js";
import { createDashboardButtonCleanupView } from "./dashboard-button-cleanup.js";
import { removeUnusedDynamicButton } from "./dashboard-resource-usage.js";
import { createDashboardHeroLayout } from "./dashboard-layout-factory.js";
import { createDashboardWidgetHosts } from "./dashboard-widget-hosts.js";

// This is the Block-14 module assembly boundary. Core receives contracts,
// never imports individual widgets or their resource management.
const INTEGRATIONS = Object.freeze({
  createDashboardCatalog,
  createDashboardCatalogView,
  createDashboardButtonCleanupView,
  removeUnusedDynamicButton,
  createDashboardHeroLayout,
  createDashboardWidgetHosts,
});

export function createConfiguredDashboardPageComposer(options = {}) {
  return createDashboardPageComposer({ ...options, integrations: INTEGRATIONS });
}
