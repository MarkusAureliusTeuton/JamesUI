export function create(context, config) {
  let target = null;
  let currentConfig = config;
  return {
    mount(nextTarget) {
      target = nextTarget;
      target.events.push(["layout", "mount", currentConfig.value ?? null, context.marker ?? null]);
    },
    update(nextContext, nextConfig) {
      currentConfig = nextConfig;
      target?.events.push(["layout", "update", currentConfig.value ?? null, nextContext.marker ?? null]);
    },
    destroy() {
      target?.events.push(["layout", "destroy"]);
      target = null;
    },
  };
}
