import { resolveDynamicButtonInstance } from "./widget.dynamic-buttons/config.js";

// Binds the layout-owned dashboard hosts to canonical widget module instances.
// The grid owns DOM geometry; this adapter owns only widget lifecycles.
export function createDashboardWidgetHosts({ moduleLoader, getConfig, getButtonDefinitions = null } = {}) {
  if (!moduleLoader || typeof moduleLoader.load !== "function" ||
      typeof moduleLoader.mount !== "function" || typeof moduleLoader.destroy !== "function") {
    throw new TypeError("Dashboard widget hosts require the canonical Module Loader");
  }
  if (typeof getConfig !== "function") throw new TypeError("getConfig must be a function");

  if (getButtonDefinitions !== null && typeof getButtonDefinitions !== "function") {
    throw new TypeError("getButtonDefinitions must be a function");
  }

  return function createItemHost(node, element) {
    let definition;
    if (element.kind === "widget") {
      definition = getConfig(element.ref_id);
      if (!definition || typeof definition.module_id !== "string" || !definition.module_id) {
        throw new TypeError(`Missing widget instance definition: ${element.ref_id}`);
      }
    } else if (element.kind === "button") {
      if (!getButtonDefinitions) throw new TypeError("Dashboard buttons require central definitions");
      definition = {
        module_id: "widget.dynamic-buttons",
        config: resolveDynamicButtonInstance({
          definitions: getButtonDefinitions(),
          instance: { buttons: [{ id: element.id, button_id: element.ref_id, size: element.size ?? "normal" }] },
        }),
      };
    } else {
      throw new TypeError(`Unsupported dashboard element kind: ${element.kind}`);
    }
    const instanceId = `dashboard:${element.id}`;
    let alive = true;
    const ready = moduleLoader.load(definition.module_id, {
      instanceId, config: definition.config ?? {},
    }).then((success) => {
      if (!success) return false;
      if (!alive) {
        moduleLoader.destroy(instanceId);
        return false;
      }
      const mounted = moduleLoader.mount(instanceId, node);
      if (!mounted) moduleLoader.destroy(instanceId);
      return mounted;
    }).catch(() => false);
    node.setAttribute("data-jui-widget-instance", element.ref_id);
    // Keep async failures from turning unhandled; UI remains the owning grid host.
    void ready;
    return () => {
      alive = false;
      moduleLoader.destroy(instanceId); // Also cancels in-flight loading.
    };
  };
}
