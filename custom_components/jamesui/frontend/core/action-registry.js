export const ACTION_RESULT_STATUSES = Object.freeze([
  "success",
  "unavailable",
  "rejected",
  "error",
]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function result(status, type, value = null, error = null) {
  return Object.freeze({ status, type, value, error });
}

function normalizeType(action) {
  return action && typeof action === "object" && !Array.isArray(action) && typeof action.type === "string"
    ? action.type
    : null;
}

export function createActionRegistry({ health = null } = {}) {
  const providers = new Map();
  let destroyed = false;

  const reportError = (type, error) => {
    if (!health || !type) return;
    health.report(`action:${type}`, {
      status: "error",
      message: `Action ${type} failed`,
      error,
    });
  };

  const clearError = (type) => {
    if (health && type) health.clear(`action:${type}`);
  };

  return {
    register(type, handler) {
      if (!nonEmptyString(type)) throw new TypeError("action type must be a non-empty string");
      if (typeof handler !== "function") throw new TypeError("action handler must be a function");
      if (destroyed) throw new Error("Action Registry is destroyed");
      if (providers.has(type)) throw new TypeError(`action provider already registered: ${type}`);
      providers.set(type, handler);
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        if (providers.get(type) !== handler) return false;
        providers.delete(type);
        return true;
      };
    },

    unregister(type) {
      return providers.delete(type);
    },

    has(type) {
      return providers.has(type);
    },

    async execute(action, context = Object.freeze({})) {
      const type = normalizeType(action);
      if (!action || typeof action !== "object" || Array.isArray(action) || !nonEmptyString(type)) {
        return result("rejected", type, null, null);
      }

      const handler = providers.get(type);
      if (!handler) {
        clearError(type);
        return result("unavailable", type, null, null);
      }

      try {
        const providerResult = await handler(action, context);
        if (!providerResult || typeof providerResult !== "object" || Array.isArray(providerResult) || !ACTION_RESULT_STATUSES.includes(providerResult.status)) {
          const error = new TypeError(`Action provider ${type} returned an invalid result`);
          reportError(type, error);
          return result("error", type, null, error);
        }

        const value = Object.prototype.hasOwnProperty.call(providerResult, "value")
          ? providerResult.value
          : null;
        const error = Object.prototype.hasOwnProperty.call(providerResult, "error")
          ? providerResult.error
          : null;

        if (providerResult.status === "error") {
          reportError(type, error);
        } else {
          clearError(type);
        }
        return result(providerResult.status, type, value, error);
      } catch (error) {
        reportError(type, error);
        return result("error", type, null, error);
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      providers.clear();
    },
  };
}
