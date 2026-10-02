function nonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function connectionStateFor(hass) {
  if (!hass) return "unavailable";
  if (typeof hass.connected === "boolean") {
    return hass.connected ? "connected" : "disconnected";
  }
  return hass.connection ? "connected" : "unavailable";
}

function statesFor(hass) {
  return hass?.states && typeof hass.states === "object" ? hass.states : {};
}

function domainEntities(states, domain) {
  const prefix = `${domain}.`;
  return Object.values(states)
    .filter((entity) => entity?.entity_id?.startsWith(prefix))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
}

function sameEntityList(previous, next) {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index] !== next[index]) return false;
  }
  return true;
}

export class HomeAssistantUnavailableError extends Error {
  constructor(message = "Home Assistant is unavailable") {
    super(message);
    this.name = "HomeAssistantUnavailableError";
  }
}

export function createHomeAssistantAdapter({ onSubscriberError = null } = {}) {
  if (onSubscriberError !== null && typeof onSubscriberError !== "function") {
    throw new TypeError("onSubscriberError must be a function or null");
  }

  let currentHass = null;
  let destroyed = false;
  const entityListeners = new Map();
  const domainListeners = new Map();
  const connectionListeners = new Set();

  const reportSubscriberError = (kind, key, error) => {
    onSubscriberError?.({ kind, key, error });
  };

  const notifySet = (listeners, value, kind, key) => {
    if (!listeners) return;
    for (const listener of [...listeners]) {
      try {
        listener(value);
      } catch (error) {
        reportSubscriberError(kind, key, error);
      }
    }
  };

  const addListener = (collection, key, listener) => {
    let listeners = collection.get(key);
    if (!listeners) {
      listeners = new Set();
      collection.set(key, listeners);
    }
    listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return false;
      active = false;
      const current = collection.get(key);
      current?.delete(listener);
      if (current?.size === 0) collection.delete(key);
      return true;
    };
  };

  const adapter = {
    setHass(nextHass) {
      if (destroyed) return false;
      const previousHass = currentHass;
      const previousStates = statesFor(previousHass);
      const nextStates = statesFor(nextHass);
      const previousConnection = connectionStateFor(previousHass);
      const nextConnection = connectionStateFor(nextHass);
      currentHass = nextHass ?? null;

      for (const [entityId, listeners] of entityListeners) {
        const previous = previousStates[entityId] ?? null;
        const next = nextStates[entityId] ?? null;
        if (previous !== next) notifySet(listeners, next, "entity", entityId);
      }

      for (const [domain, listeners] of domainListeners) {
        const previous = domainEntities(previousStates, domain);
        const next = domainEntities(nextStates, domain);
        if (!sameEntityList(previous, next)) notifySet(listeners, next, "domain", domain);
      }

      if (previousConnection !== nextConnection) {
        notifySet(connectionListeners, nextConnection, "connection", null);
      }
      return previousHass !== currentHass;
    },

    connectionState() {
      return connectionStateFor(currentHass);
    },

    getState(entityId) {
      nonEmptyString(entityId, "entityId");
      return statesFor(currentHass)[entityId] ?? null;
    },

    entities(domain = null) {
      const states = statesFor(currentHass);
      if (domain === null) {
        return Object.values(states).sort((a, b) => a.entity_id.localeCompare(b.entity_id));
      }
      nonEmptyString(domain, "domain");
      return domainEntities(states, domain);
    },

    subscribeEntity(entityId, listener, { emitCurrent = true } = {}) {
      if (destroyed) throw new Error("Home Assistant Adapter is destroyed");
      nonEmptyString(entityId, "entityId");
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      const unsubscribe = addListener(entityListeners, entityId, listener);
      if (emitCurrent) notifySet(new Set([listener]), adapter.getState(entityId), "entity", entityId);
      return unsubscribe;
    },

    subscribeDomain(domain, listener, { emitCurrent = true } = {}) {
      if (destroyed) throw new Error("Home Assistant Adapter is destroyed");
      nonEmptyString(domain, "domain");
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      const unsubscribe = addListener(domainListeners, domain, listener);
      if (emitCurrent) notifySet(new Set([listener]), adapter.entities(domain), "domain", domain);
      return unsubscribe;
    },

    subscribeConnection(listener, { emitCurrent = true } = {}) {
      if (destroyed) throw new Error("Home Assistant Adapter is destroyed");
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      connectionListeners.add(listener);
      let active = true;
      if (emitCurrent) notifySet(new Set([listener]), adapter.connectionState(), "connection", null);
      return () => {
        if (!active) return false;
        active = false;
        connectionListeners.delete(listener);
        return true;
      };
    },

    destroy() {
      if (destroyed) return false;
      destroyed = true;
      currentHass = null;
      entityListeners.clear();
      domainListeners.clear();
      connectionListeners.clear();
      return true;
    },
  };

  return adapter;
}
