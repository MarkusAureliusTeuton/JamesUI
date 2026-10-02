import { HomeAssistantUnavailableError } from "../../custom_components/jamesui/frontend/ha/home-assistant-adapter.js";

export function createFakeHomeAssistantAdapter({ connectionState = "connected", states = {} } = {}) {
  let currentConnectionState = connectionState;
  let currentStates = { ...states };
  let serviceResult = null;
  let serviceError = null;
  let wsResult = null;
  let wsError = null;
  const serviceCalls = [];
  const wsCalls = [];
  const subscriptionCalls = [];

  const requireConnected = () => {
    if (currentConnectionState !== "connected") throw new HomeAssistantUnavailableError();
  };

  return {
    serviceCalls,
    wsCalls,
    subscriptionCalls,
    connectionState() { return currentConnectionState; },
    setConnectionState(value) { currentConnectionState = value; },
    setStates(value) { currentStates = { ...value }; },
    getState(entityId) { return currentStates[entityId] ?? null; },
    entities(domain = null) {
      const values = Object.values(currentStates);
      return domain === null ? values : values.filter((entry) => entry.entity_id?.startsWith(`${domain}.`));
    },
    setServiceResult(value) { serviceResult = value; serviceError = null; },
    setServiceError(error) { serviceError = error; },
    setWSResult(value) { wsResult = value; wsError = null; },
    setWSError(error) { wsError = error; },
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
      const record = { listener, message, options, unsubscribeCalls: 0 };
      subscriptionCalls.push(record);
      let active = true;
      return async () => {
        if (!active) return false;
        active = false;
        record.unsubscribeCalls += 1;
        return true;
      };
    },
    listAreas() { return this.callWS({ type: "config/area_registry/list" }); },
    listDevices() { return this.callWS({ type: "config/device_registry/list" }); },
    listEntities() { return this.callWS({ type: "config/entity_registry/list" }); },
  };
}
