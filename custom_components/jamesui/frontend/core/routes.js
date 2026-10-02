export const CORE_ROUTES = Object.freeze([
  Object.freeze({ id: "home", label: "Start" }),
  Object.freeze({ id: "house", label: "Haus" }),
  Object.freeze({ id: "climate", label: "Klima" }),
  Object.freeze({ id: "media", label: "Medien" }),
  Object.freeze({ id: "door", label: "Tür" }),
]);

export function getCoreRoute(routeId) {
  return CORE_ROUTES.find((route) => route.id === routeId) ?? null;
}
