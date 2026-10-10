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
      if (definition.module_id === "widget.dynamic-buttons" &&
          definition.config?.buttons?.some((item) => !item.definition)) {
        if (!getButtonDefinitions) throw new TypeError("Dynamic Buttons require central definitions");
        definition = {
          ...definition,
          config: resolveDynamicButtonInstance({
            definitions: getButtonDefinitions(), instance: definition.config,
          }),
        };
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
    const showFailure = () => {
      if (!alive) return;
      node.setAttribute("data-jui-widget-error", "");
      node.textContent = "Widget konnte nicht geladen werden";
    };
    const ready = moduleLoader.load(definition.module_id, {
      instanceId, config: definition.config ?? {},
    }).then((success) => {
      // dispose() already cancels this host's pending import. A late result
      // belongs to the old host and must never touch the newly mounted
      // runtime that may now reuse exactly the same instance ID.
      if (!alive) return false;
      if (!success) {
        showFailure();
        return false;
      }
      const mounted = moduleLoader.mount(instanceId, node);
      if (!mounted) {
        moduleLoader.destroy(instanceId);
        showFailure();
      }
      return mounted;
    }).catch(() => {
      if (!alive) return false;
      moduleLoader.destroy(instanceId);
      showFailure();
      return false;
    });
    node.setAttribute("data-jui-widget-instance", element.ref_id);
    // Keep async failures from turning unhandled; UI remains the owning grid host.
    void ready;
    const dispose = () => {
      alive = false;
      moduleLoader.destroy(instanceId); // Also cancels in-flight loading.
    };
    // Expose readiness to the layout without changing the cleanup contract.
    // A dashboard must not report successful startup while a widget is still loading.
    dispose.ready = ready;
    return dispose;
  };
}
