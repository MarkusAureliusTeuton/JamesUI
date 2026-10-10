function requireDependency(value, name) {
  if (!value) throw new TypeError(`createModuleLoader requires ${name}`);
}

function moduleHealthId(id) {
  return `module:${id}`;
}

function errorMessage(id, phase) {
  return `Module ${id} failed during ${phase}`;
}

function validateLifecycle(instance) {
  if (!instance || typeof instance !== "object" || typeof instance.then === "function") return false;
  return ["mount", "update", "destroy"].every((method) => typeof instance[method] === "function");
}

export function buildModuleImportUrl(entryUrl, version, reloadGeneration = 0) {
  const hashIndex = entryUrl.indexOf("#");
  const hash = hashIndex >= 0 ? entryUrl.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? entryUrl.slice(0, hashIndex) : entryUrl;
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);
  params.set("v", version);
  if (reloadGeneration > 0) params.set("r", String(reloadGeneration));
  else params.delete("r");
  const serialized = params.toString();
  return `${path}${serialized ? `?${serialized}` : ""}${hash}`;
}

export function createModuleLoader({
  registry,
  health,
  importer = (url) => import(url),
  getContext = () => Object.freeze({}),
} = {}) {
  requireDependency(registry, "registry");
  requireDependency(health, "health");
  if (typeof importer !== "function") throw new TypeError("importer must be a function");
  if (typeof getContext !== "function") throw new TypeError("getContext must be a function");

  const runtimes = new Map();
  const reloadGenerations = new Map();
  const pendingLoads = new Map();

  const reportError = (id, phase, error) => {
    health.report(moduleHealthId(id), {
      status: "error",
      message: errorMessage(id, phase),
      error,
    });
  };
  const clearError = (id) => health.clear(moduleHealthId(id));

  const loader = {
    async load(id, { config = {}, instanceId = id } = {}) {
      if (typeof instanceId !== "string" || !instanceId.trim()) throw new TypeError("instanceId must be non-empty");
      if (runtimes.has(instanceId)) return runtimes.get(instanceId).moduleId === id;
      const pending = pendingLoads.get(instanceId);
      if (pending) return pending.moduleId === id ? pending.promise : false;
      const record = registry.get(id);
      if (!record) {
        reportError(id, "load", new Error(`Module is not registered: ${id}`));
        return false;
      }
      if (instanceId !== id && record.manifest.type !== "widget" && record.manifest.type !== "layout") {
        reportError(instanceId, "load", new Error("Only widgets/layouts can use separate instance IDs"));
        return false;
      }
      const generation = reloadGenerations.get(instanceId) ?? 0;
      const url = buildModuleImportUrl(record.entryUrl, record.manifest.version, generation);
      // Each import owns its own cancellation token. Destroying an in-flight
      // import must not block a new load with the same instance ID, or allow
      // the stale task to replace/destroy the newly installed runtime.
      const loadRecord = { moduleId: id, cancelled: false, promise: null };
      const task = (async () => {
        try {
          const definition = await importer(url);
          if (loadRecord.cancelled) return false;
          if (!definition || typeof definition.create !== "function") {
            throw new TypeError(`Module ${id} must export create(context, config)`);
          }
          const contextRequest = Object.freeze({ id, instanceId, manifest: record.manifest });
          const instance = definition.create(getContext(contextRequest), config);
          if (!validateLifecycle(instance)) {
            throw new TypeError(`Module ${id} must return synchronous mount/update/destroy lifecycle methods`);
          }
          if (loadRecord.cancelled) {
            try { instance.destroy(); } catch (_) { /* teardown best effort */ }
            return false;
          }
          runtimes.set(instanceId, { moduleId: id, instance, config, target: null, manifest: record.manifest });
          clearError(instanceId);
          return true;
        } catch (error) {
          if (!loadRecord.cancelled) {
            // A stale cancelled import must never destroy or mark unhealthy a
            // replacement that has already mounted under the same instance ID.
            reportError(instanceId, "load", error);
          }
          return false;
        }
      })();
      loadRecord.promise = task;
      pendingLoads.set(instanceId, loadRecord);
      try { return await task; }
      finally {
        if (pendingLoads.get(instanceId) === loadRecord) pendingLoads.delete(instanceId);
      }
    },

    mount(id, target) {
      const runtime = runtimes.get(id);
      if (!runtime) return false;
      try {
        const mounted = runtime.instance.mount(target);
        if (mounted === false) {
          reportError(id, "mount", new Error("Module lifecycle mount returned false"));
          return false;
        }
        runtime.target = target;
        clearError(id);
        return true;
      } catch (error) {
        reportError(id, "mount", error);
        return false;
      }
    },

    update(id, nextConfig) {
      const runtime = runtimes.get(id);
      if (!runtime) return false;
      try {
        const contextRequest = Object.freeze({ id: runtime.moduleId, instanceId: id, manifest: runtime.manifest });
        const updated = runtime.instance.update(getContext(contextRequest), nextConfig);
        if (updated === false) {
          reportError(id, "update", new Error("Module lifecycle update returned false"));
          return false;
        }
        runtime.config = nextConfig;
        clearError(id);
        return true;
      } catch (error) {
        reportError(id, "update", error);
        return false;
      }
    },

    destroy(id) {
      const runtime = runtimes.get(id);
      if (!runtime) {
        const pending = pendingLoads.get(id);
        if (pending) {
          pending.cancelled = true;
          pendingLoads.delete(id);
          return true;
        }
        return false;
      }
      runtimes.delete(id);
      try {
        runtime.instance.destroy();
        clearError(id);
        return true;
      } catch (error) {
        reportError(id, "destroy", error);
        return false;
      }
    },

    async reload(id) {
      const runtime = runtimes.get(id);
      if (!runtime) return false;
      const { config, target, moduleId } = runtime;
      if (!loader.destroy(id)) return false;
      reloadGenerations.set(id, (reloadGenerations.get(id) ?? 0) + 1);
      if (!await loader.load(moduleId, { instanceId: id, config })) return false;
      if (target !== null && !loader.mount(id, target)) {
        // A failed remount must not leave a loaded, detached runtime behind.
        // Keep the failure visible after the teardown clears the old health record.
        const failure = health.get(moduleHealthId(id))?.error ??
          new Error("Reloaded module refused mount");
        loader.destroy(id);
        reportError(id, "reload", failure);
        return false;
      }
      clearError(id);
      return true;
    },

    destroyAll() {
      for (const id of [...pendingLoads.keys()]) loader.destroy(id);
      for (const id of [...runtimes.keys()]) loader.destroy(id);
    },

    isLoaded(id) {
      return runtimes.has(id);
    },
  };

  return loader;
}
