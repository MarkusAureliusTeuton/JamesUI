// Binds the layout-owned dashboard hosts to canonical widget module instances.
// The grid owns DOM geometry; this adapter owns only widget lifecycles.
export function createDashboardWidgetHosts({ moduleLoader, getConfig } = {}) {
  if (!moduleLoader || typeof moduleLoader.load !== "function" ||
      typeof moduleLoader.mount !== "function" || typeof moduleLoader.destroy !== "function") {
    throw new TypeError("Dashboard widget hosts require the canonical Module Loader");
  }
  if (typeof getConfig !== "function") throw new TypeError("getConfig must be a function");

  return function createItemHost(node, element) {
    if (element.kind !== "widget") {
      throw new TypeError("Only widget elements can use widget hosts");
    }
    const definition = getConfig(element.ref_id);
    if (!definition || typeof definition.module_id !== "string" || !definition.module_id) {
      throw new TypeError(`Missing widget instance definition: ${element.ref_id}`);
    }
    const instanceId = `dashboard:${element.id}`;
    let alive = true;
    let loaded = false;
    const ready = moduleLoader.load(definition.module_id, {
      instanceId, config: definition.config ?? {},
    }).then((success) => {
      if (!success) return false;
      loaded = true;
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
      if (loaded) moduleLoader.destroy(instanceId);
      else moduleLoader.destroy(instanceId); // Cancel in-flight loading if supported.
    };
  };
}
