import { CORE_ROUTES } from "./routes.js";

export function createRouter({ routes = CORE_ROUTES, initialRoute = "home" } = {}) {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  let currentRouteId = routeById.has(initialRoute) ? initialRoute : routes[0]?.id ?? null;
  const listeners = new Set();

  return {
    get currentRouteId() {
      return currentRouteId;
    },
    get currentRoute() {
      return routeById.get(currentRouteId) ?? null;
    },
    navigate(routeId) {
      const route = routeById.get(routeId);
      if (!route) return false;
      if (routeId === currentRouteId) return true;
      const from = currentRouteId;
      currentRouteId = routeId;
      const change = { from, to: routeId, route };
      for (const listener of [...listeners]) listener(change);
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      listeners.clear();
    },
  };
}
