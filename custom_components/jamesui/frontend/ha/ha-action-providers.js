import { HomeAssistantUnavailableError } from "./home-assistant-adapter.js";

const IDENTIFIER = /^[a-z0-9_]+$/;
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validEntityId(value) {
  return typeof value === "string" && ENTITY_ID.test(value);
}

function validIdentifier(value) {
  return typeof value === "string" && IDENTIFIER.test(value);
}

async function executeHomeAssistant(operation) {
  try {
    const value = await operation();
    return { status: "success", value };
  } catch (error) {
    if (error instanceof HomeAssistantUnavailableError) return { status: "unavailable" };
    throw error;
  }
}

export function registerHomeAssistantActionProviders({ actions, homeAssistant } = {}) {
  if (!actions || typeof actions.register !== "function") {
    throw new TypeError("registerHomeAssistantActionProviders requires actions");
  }
  if (!homeAssistant || typeof homeAssistant.callService !== "function") {
    throw new TypeError("registerHomeAssistantActionProviders requires homeAssistant");
  }

  const unregisters = [];
  try {
    unregisters.push(actions.register("entity.toggle", (action) => {
      if (!validEntityId(action.entity_id)) return { status: "rejected" };
      return executeHomeAssistant(() => homeAssistant.callService(
        "homeassistant",
        "toggle",
        {},
        { entity_id: action.entity_id },
      ));
    }));

    unregisters.push(actions.register("ha.service", (action) => {
      if (!validIdentifier(action.domain) || !validIdentifier(action.service)) {
        return { status: "rejected" };
      }
      if (action.data !== undefined && !isPlainObject(action.data)) return { status: "rejected" };
      if (action.target !== undefined && !isPlainObject(action.target)) return { status: "rejected" };
      return executeHomeAssistant(() => homeAssistant.callService(
        action.domain,
        action.service,
        action.data ?? {},
        action.target,
      ));
    }));

    unregisters.push(actions.register("scene.activate", (action) => {
      if (!validEntityId(action.entity_id) || !action.entity_id.startsWith("scene.")) {
        return { status: "rejected" };
      }
      if (action.transition !== undefined && (
        typeof action.transition !== "number"
        || !Number.isFinite(action.transition)
        || action.transition < 0
      )) {
        return { status: "rejected" };
      }
      const data = action.transition === undefined ? {} : { transition: action.transition };
      return executeHomeAssistant(() => homeAssistant.callService(
        "scene",
        "turn_on",
        data,
        { entity_id: action.entity_id },
      ));
    }));
  } catch (error) {
    for (const unregister of unregisters.reverse()) unregister();
    throw error;
  }

  let active = true;
  return () => {
    if (!active) return false;
    active = false;
    for (const unregister of unregisters.reverse()) unregister();
    return true;
  };
}
