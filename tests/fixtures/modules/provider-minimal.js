export function create(context, config) {
  let target = null;
  let currentConfig = config;
  return {
    mount(nextTarget) {
      target = nextTarget;
      target.events.push(["provider", "mount", currentConfig.value ?? null, context.marker ?? null]);
    },
    update(nextContext, nextConfig) {
      currentConfig = nextConfig;
      target?.events.push(["provider", "update", currentConfig.value ?? null, nextContext.marker ?? null]);
    },
    destroy() {
      target?.events.push(["provider", "destroy"]);
      target = null;
    },
  };
}
