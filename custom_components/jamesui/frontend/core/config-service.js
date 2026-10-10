const CONFIG_SECTIONS = Object.freeze([
  "pages",
  "layouts",
  "widget_instances",
  "dynamic_buttons",
  "data_sources",
  "module_settings",
]);

function requireHomeAssistant(homeAssistant) {
  if (!homeAssistant || typeof homeAssistant.callWS !== "function") {
    throw new TypeError("createConfigService requires homeAssistant.callWS");
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isObject(value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) result[key] = cloneValue(item);
    return result;
  }
  throw new TypeError("JamesUI config response contains a non-JSON value");
}

function validateAndCloneConfig(value) {
  if (!isObject(value) || value.schema_version !== 1) {
    throw new TypeError("Invalid JamesUI config response");
  }
  const expected = new Set(["schema_version", ...CONFIG_SECTIONS]);
  const keys = Object.keys(value);
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) {
    throw new TypeError("Invalid JamesUI config response");
  }
  for (const section of CONFIG_SECTIONS) {
    if (!isObject(value[section])) throw new TypeError("Invalid JamesUI config response");
  }
  return cloneValue(value);
}

function extractConfigResponse(response) {
  if (!isObject(response) || !("config" in response)) {
    throw new TypeError("Invalid JamesUI config response");
  }
  return validateAndCloneConfig(response.config);
}

export function createConfigService({ homeAssistant } = {}) {
  requireHomeAssistant(homeAssistant);

  let current = null;
  let currentRevision = null;
  let destroyed = false;
  let operationGeneration = 0;
  let pendingMutation = Promise.resolve();
  let writeQueue = Promise.resolve();
  let queuedWrites = 0;
  const listeners = new Set();

  const requireActive = () => {
    if (destroyed) throw new Error("JamesUI Config Service is destroyed");
  };

  const notify = () => {
    if (current === null) return;
    for (const listener of [...listeners]) {
      try {
        listener(cloneValue(current));
      } catch (_) {
        // Config subscribers are isolated; one UI listener must not block siblings.
      }
    }
  };

  const commitResponse = (response) => {
    const next = extractConfigResponse(response);
    if (response.revision !== undefined &&
        (typeof response.revision !== "string" || !/^[a-f0-9]{64}$/.test(response.revision))) {
      throw new TypeError("Invalid JamesUI configuration revision");
    }
    currentRevision = response.revision ?? null;
    current = next;
    notify();
    return cloneValue(next);
  };

  return {
    async load() {
      requireActive();
      // A read requested after a write must observe that write's final
      // server revision. A delayed write response must never be discarded
      // merely because a later GET raced against it.
      if (queuedWrites > 0) await writeQueue;
      requireActive();
      const requestGeneration = ++operationGeneration;
      const response = await homeAssistant.callWS({ type: "jamesui/config/get" });
      requireActive();
      if (requestGeneration !== operationGeneration) return current === null ? null : cloneValue(current);
      return commitResponse(response);
    },

    snapshot() {
      return current === null ? null : cloneValue(current);
    },

    get revision() { return currentRevision; },

    replace(config) {
      requireActive();
      const requestConfig = validateAndCloneConfig(config);
      queuedWrites += 1;
      // Serialize even direct replace() calls. Each write must use the revision
      // produced by the previous successful write; no parallel CAS requests
      // from this client may overwrite a newer result with an older snapshot.
      const operation = writeQueue.then(async () => {
        requireActive();
        const requestGeneration = ++operationGeneration;
        const request = {
          type: "jamesui/config/replace",
          config: requestConfig,
          ...(currentRevision !== null ? { expected_revision: currentRevision } : {}),
        };
        const response = await homeAssistant.callWS(request);
        requireActive();
        if (requestGeneration !== operationGeneration) return current === null ? null : cloneValue(current);
        return commitResponse(response);
      });
      writeQueue = operation.then(() => undefined, () => undefined);
      return operation.finally(() => { queuedWrites -= 1; });
    },

    // Serialize dashboard edits against the latest committed snapshot. Failed
    // changes leave the local snapshot unchanged; unrelated sections persist.
    update(mutator) {
      requireActive();
      if (typeof mutator !== "function") throw new TypeError("mutator must be a function");
      const operation = pendingMutation.then(async () => {
        requireActive();
        // An edit must be based on all writes already submitted by the
        // caller, including direct replace() operations outside update().
        await writeQueue;
        requireActive();
        if (current === null) throw new Error("JamesUI config must be loaded before update");
        const next = mutator(cloneValue(current));
        if (next === null) return null;
        return this.replace(next);
      });
      pendingMutation = operation.then(() => undefined, () => undefined);
      return operation;
    },

    subscribe(listener, { emitCurrent = true } = {}) {
      requireActive();
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      listeners.add(listener);
      let active = true;
      if (emitCurrent && current !== null) {
        try {
          listener(cloneValue(current));
        } catch (_) {
          // Match normal notification isolation for the initial emission.
        }
      }
      return () => {
        if (!active) return false;
        active = false;
        listeners.delete(listener);
        return true;
      };
    },

    destroy() {
      if (destroyed) return false;
      destroyed = true;
      operationGeneration += 1;
      listeners.clear();
      return true;
    },
  };
}
