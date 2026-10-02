export function create(context, config) {
  let target = null;
  let currentConfig = config;
  return {
    mount(nextTarget) {
      target = nextTarget;
      target.events.push(["widget", "mount", currentConfig.value ?? null, context.marker ?? null]);
    },
    update(nextContext, nextConfig) {
      currentConfig = nextConfig;
      target?.events.push(["widget", "update", currentConfig.value ?? null, nextContext.marker ?? null]);
    },
    destroy() {
      target?.events.push(["widget", "destroy"]);
      target = null;
    },
  };
}
