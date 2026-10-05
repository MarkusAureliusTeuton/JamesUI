import { HomeAssistantUnavailableError } from "../../custom_components/jamesui/frontend/ha/home-assistant-adapter.js";

export function createFakeHomeAssistantAdapter({
  connectionState = "connected",
  states = {},
  timeZone = "Europe/Berlin",
} = {}) {
  let currentConnectionState = connectionState;
  let currentStates = { ...states };
  let currentTimeZone = timeZone;
  let serviceResult = null;
  let serviceError = null;
  let wsResult = null;
  let wsError = null;
  let subscriptionError = null;
  let deferredSubscription = null;
  const serviceCalls = [];
  const wsCalls = [];
  const subscriptionCalls = [];
  const connectionListeners = new Set();
  const entityListeners = new Map();

  const requireConnected = () => {
    if (currentConnectionState !== "connected") throw new HomeAssistantUnavailableError();
  };

  const visibleState = (entityId) => (
    currentConnectionState === "connected" ? currentStates[entityId] ?? null : null
  );

  const emitEntity = (entityId) => {
    const value = visibleState(entityId);
    for (const listener of entityListeners.get(entityId) ?? []) listener(value);
  };

  const api = {
    serviceCalls,
    wsCalls,
    subscriptionCalls,
    connectionState() { return currentConnectionState; },
    timeZone() { return currentConnectionState === "connected" ? currentTimeZone : null; },
    setTimeZone(value) { currentTimeZone = value; },
    setConnectionState(value) {
      if (value === currentConnectionState) return false;
      currentConnectionState = value;
      for (const listener of [...connectionListeners]) listener(value);
      for (const entityId of entityListeners.keys()) emitEntity(entityId);
      return true;
    },
    setStates(value) {
      const previousIds = new Set(Object.keys(currentStates));
      currentStates = { ...value };
      for (const entityId of new Set([...previousIds, ...Object.keys(currentStates)])) emitEntity(entityId);
    },
    setState(value) {
      currentStates[value.entity_id] = value;
      emitEntity(value.entity_id);
    },
    removeState(entityId) {
      delete currentStates[entityId];
      emitEntity(entityId);
    },
    getState(entityId) { return visibleState(entityId); },
    entities(domain = null) {
      if (currentConnectionState !== "connected") return [];
      const values = Object.values(currentStates);
      return domain === null ? values : values.filter((entry) => entry.entity_id?.startsWith(`${domain}.`));
    },
    subscribeConnection(listener, { emitCurrent = true } = {}) {
      connectionListeners.add(listener);
      if (emitCurrent) listener(currentConnectionState);
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        connectionListeners.delete(listener);
        return true;
      };
    },
    subscribeEntity(entityId, listener, { emitCurrent = true } = {}) {
      if (!entityListeners.has(entityId)) entityListeners.set(entityId, new Set());
      entityListeners.get(entityId).add(listener);
      if (emitCurrent) listener(visibleState(entityId));
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        const listeners = entityListeners.get(entityId);
        listeners?.delete(listener);
        if (listeners?.size === 0) entityListeners.delete(entityId);
        return true;
      };
    },
    activeConnectionSubscriptions() { return connectionListeners.size; },
    activeEntitySubscriptions(entityId = null) {
      if (entityId !== null) return entityListeners.get(entityId)?.size ?? 0;
      return [...entityListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
    },
    setServiceResult(value) { serviceResult = value; serviceError = null; },
    setServiceError(error) { serviceError = error; },
    setWSResult(value) { wsResult = value; wsError = null; },
    setWSError(error) { wsError = error; },
    setSubscriptionError(error) { subscriptionError = error; },
    deferNextSubscription() {
      if (deferredSubscription) throw new Error("subscription is already deferred");
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      deferredSubscription = { promise, resolve };
      return { resolve };
    },
    emitSubscription(index, payload) {
      const record = subscriptionCalls[index];
      if (!record || !record.active) return false;
      record.listener(payload);
      return true;
    },
    async callService(domain, service, data = {}, target = undefined) {
      requireConnected();
      serviceCalls.push({ domain, service, data, target });
      if (serviceError) throw serviceError;
      return serviceResult;
    },
    async callWS(message) {
      requireConnected();
      wsCalls.push(message);
      if (wsError) throw wsError;
      return wsResult;
    },
    async subscribeMessage(listener, message, options = undefined) {
      requireConnected();
      const record = { listener, message, options, unsubscribeCalls: 0, active: true };
      subscriptionCalls.push(record);
      const pending = deferredSubscription;
      deferredSubscription = null;
      if (pending) await pending.promise;
      if (subscriptionError) {
        const error = subscriptionError;
        subscriptionError = null;
        record.active = false;
        throw error;
      }
      let active = true;
      return async () => {
        if (!active) return false;
        active = false;
        record.active = false;
        record.unsubscribeCalls += 1;
        return true;
      };
    },
    listAreas() { return this.callWS({ type: "config/area_registry/list" }); },
    listDevices() { return this.callWS({ type: "config/device_registry/list" }); },
    listEntities() { return this.callWS({ type: "config/entity_registry/list" }); },
  };
  return api;
}
