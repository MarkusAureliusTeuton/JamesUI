function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function snapshot(capability, status, value, reason, provider) {
  return Object.freeze({ capability, status, value, reason, provider });
}

function syntheticUnavailable(capability) {
  return snapshot(capability, "unavailable", null, null, null);
}

export function createCapabilityRegistry({ moduleRegistry, onSubscriberError = null } = {}) {
  if (!moduleRegistry) throw new TypeError("createCapabilityRegistry requires moduleRegistry");
  if (onSubscriberError !== null && typeof onSubscriberError !== "function") {
    throw new TypeError("onSubscriberError must be a function or null");
  }

  const providers = new Map();
  const listeners = new Map();
  let destroyed = false;

  const notify = (capability, nextSnapshot) => {
    const current = listeners.get(capability);
    if (!current) return;
    for (const listener of [...current]) {
      try {
        listener(nextSnapshot);
      } catch (error) {
        onSubscriberError?.({ capability, error });
      }
    }
  };

  const registry = {
    register(moduleId, capability) {
      requireNonEmptyString(moduleId, "moduleId");
      requireNonEmptyString(capability, "capability");
      if (destroyed) throw new Error("Capability Registry is destroyed");
      if (moduleRegistry.getCapabilityProvider(capability) !== moduleId) {
        throw new TypeError(`module is not the declaration owner for capability: ${capability}`);
      }
      if (providers.has(capability)) {
        throw new TypeError(`capability provider already active: ${capability}`);
      }

      const record = {
        moduleId,
        current: snapshot(capability, "unavailable", null, null, moduleId),
        active: true,
      };
      providers.set(capability, record);

      const publish = (status, value = null, reason = null) => {
        if (!record.active || providers.get(capability) !== record) return false;
        record.current = snapshot(capability, status, value, reason, moduleId);
        notify(capability, record.current);
        return true;
      };

      return Object.freeze({
        available(value) {
          return publish("available", value, null);
        },
        unavailable(reason = null) {
          return publish("unavailable", null, reason);
        },
        notConfigured(reason = null) {
          return publish("not_configured", null, reason);
        },
        unregister() {
          if (!record.active || providers.get(capability) !== record) return false;
          record.active = false;
          providers.delete(capability);
          notify(capability, syntheticUnavailable(capability));
          return true;
        },
      });
    },

    get(capability) {
      requireNonEmptyString(capability, "capability");
      return providers.get(capability)?.current ?? syntheticUnavailable(capability);
    },

    subscribe(capability, listener, { emitCurrent = true } = {}) {
      requireNonEmptyString(capability, "capability");
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      if (destroyed) throw new Error("Capability Registry is destroyed");
      let current = listeners.get(capability);
      if (!current) {
        current = new Set();
        listeners.set(capability, current);
      }
      current.add(listener);
      if (emitCurrent) {
        try {
          listener(registry.get(capability));
        } catch (error) {
          onSubscriberError?.({ capability, error });
        }
      }
      let subscribed = true;
      return () => {
        if (!subscribed) return false;
        subscribed = false;
        const set = listeners.get(capability);
        set?.delete(listener);
        if (set?.size === 0) listeners.delete(capability);
        return true;
      };
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const record of providers.values()) record.active = false;
      providers.clear();
      listeners.clear();
    },
  };

  return registry;
}
