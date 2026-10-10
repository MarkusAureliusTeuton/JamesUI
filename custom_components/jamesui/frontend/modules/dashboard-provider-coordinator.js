// Block 14 integration only: keep installed providers aligned with committed
// Config Store sources. The Core stays unaware of provider IDs and schemas.
export function createDashboardProviderCoordinator({ registered, moduleLoader, getTarget } = {}) {
  if (!Array.isArray(registered) || !moduleLoader ||
      ["load", "mount", "update", "destroy"].some((method) => typeof moduleLoader[method] !== "function") ||
      typeof getTarget !== "function") {
    throw new TypeError("Provider coordinator requires registry, module loader and mount target");
  }

  const providers = registered.filter(([manifest]) => manifest?.type === "provider").map(([manifest]) => manifest.id);
  const applied = new Map();
  let stopped = false;
  let queue = Promise.resolve();

  const desiredSources = (config) => {
    if (!config || !config.data_sources || typeof config.data_sources !== "object") {
      throw new TypeError("Provider coordinator requires configured data sources");
    }
    return Object.fromEntries(providers.map((id) => {
      const source = config.data_sources[id] ??
        (id === "provider.weather" ? config.data_sources.weather : undefined);
      return [id, source === undefined || source === null ? null : structuredClone(source.config ?? source)];
    }));
  };

  const reconcile = async (next) => {
    if (stopped) return false;
    const errors = [];
    for (const id of providers) {
      if (stopped) return false;
      const config = next[id];
      const previous = applied.get(id);
      try {
        if (config === null) {
          if (previous !== undefined) {
            const removed = moduleLoader.destroy(id);
            applied.delete(id);
            if (!removed) throw new Error(`Unable to destroy removed provider: ${id}`);
          }
          continue;
        }
        if (previous !== undefined && JSON.stringify(previous) === JSON.stringify(config)) continue;
        if (previous !== undefined) {
          if (!moduleLoader.update(id, config)) {
            throw new Error(`Unable to update configured provider: ${id}`);
          }
          applied.set(id, config);
          continue;
        }
        const loaded = await moduleLoader.load(id, { config });
        if (stopped) {
          moduleLoader.destroy(id);
          return false;
        }
        if (!loaded) {
          moduleLoader.destroy(id);
          throw new Error(`Unable to load configured provider: ${id}`);
        }
        if (!moduleLoader.mount(id, getTarget())) {
          moduleLoader.destroy(id);
          throw new Error(`Unable to mount configured provider: ${id}`);
        }
        applied.set(id, config);
      } catch (error) {
        if (stopped) return false;
        // A faulty provider must not prevent a subsequent independent source
        // from being loaded, updated or removed. Failed entries retain their
        // previous applied baseline and are eligible for a later retry.
        errors.push(error instanceof Error ? error :
          new Error(`Provider ${id} failed: ${String(error)}`));
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, errors.map((error) => error.message).join("; "));
    }
    return true;
  };

  return Object.freeze({
    sync(config) {
      if (stopped) return Promise.resolve(false);
      // Snapshot at enqueue time: rapid edits must resolve in commit order.
      const desired = desiredSources(config);
      const task = queue.then(() => reconcile(desired));
      queue = task.then(() => undefined, () => undefined);
      return task;
    },
    destroy() {
      if (stopped) return false;
      stopped = true;
      for (const id of applied.keys()) moduleLoader.destroy(id);
      applied.clear();
      return true;
    },
  });
}
