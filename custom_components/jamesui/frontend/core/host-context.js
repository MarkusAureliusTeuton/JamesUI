const HOST_KEYS = new Set(["hass", "narrow", "route", "panel"]);

export function createHostContext({ events } = {}) {
  const values = { hass: null, narrow: null, route: null, panel: null };

  return {
    set(key, value) {
      if (!HOST_KEYS.has(key)) throw new TypeError(`Unsupported host context key: ${key}`);
      if (Object.is(values[key], value)) return false;
      values[key] = value;
      events?.emit("core:host-context-changed", { key });
      return true;
    },
    get(key) {
      if (!HOST_KEYS.has(key)) return undefined;
      return values[key];
    },
    snapshot() {
      return { ...values };
    },
  };
}
