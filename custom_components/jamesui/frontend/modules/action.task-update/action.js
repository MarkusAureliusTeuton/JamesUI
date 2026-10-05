import { HomeAssistantUnavailableError } from "../../ha/home-assistant-adapter.js";
import {
  SET_DESCRIPTION,
  SET_DUE_DATE,
  SET_DUE_DATETIME,
  UPDATE_TODO_ITEM,
} from "../../shared/todo-features.js";
import { isDateKey } from "../../shared/zoned-time.js";
import { validateTaskUpdateConfig } from "./config.js";

const TODO_ENTITY_ID = /^todo\.[a-z0-9_]+$/;
const TIMED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const PATCH_KEYS = new Set(["title", "status", "due", "description"]);
const ACTION_KEYS = new Set(["type", "source_entity_id", "uid", "patch"]);
const STATUSES = new Set(["needs_action", "completed"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validTimedInstant(value) {
  return typeof value === "string" && TIMED_ISO.test(value) && Number.isFinite(new Date(value).valueOf());
}

function normalizeAction(action) {
  if (!isPlainObject(action)) return null;
  for (const key of Object.keys(action)) if (!ACTION_KEYS.has(key)) return null;
  if (action.type !== "task.update") return null;
  if (typeof action.source_entity_id !== "string" || !TODO_ENTITY_ID.test(action.source_entity_id)) return null;
  if (typeof action.uid !== "string" || !action.uid.trim()) return null;
  if (!isPlainObject(action.patch)) return null;
  const keys = Object.keys(action.patch);
  if (!keys.length || keys.some((key) => !PATCH_KEYS.has(key))) return null;

  const patch = {};
  if (Object.hasOwn(action.patch, "title")) {
    if (typeof action.patch.title !== "string" || !action.patch.title.trim()) return null;
    patch.title = action.patch.title.trim();
  }
  if (Object.hasOwn(action.patch, "status")) {
    if (!STATUSES.has(action.patch.status)) return null;
    patch.status = action.patch.status;
  }
  if (Object.hasOwn(action.patch, "description")) {
    if (action.patch.description !== null && typeof action.patch.description !== "string") return null;
    patch.description = action.patch.description;
  }
  if (Object.hasOwn(action.patch, "due")) {
    const due = action.patch.due;
    if (!isPlainObject(due)) return null;
    const dueKeys = Object.keys(due);
    if (dueKeys.some((key) => key !== "kind" && key !== "value") || !Object.hasOwn(due, "kind") || !Object.hasOwn(due, "value")) return null;
    if (due.kind === "date") {
      if (!isDateKey(due.value)) return null;
      patch.due = Object.freeze({ kind: "date", value: due.value });
    } else if (due.kind === "datetime") {
      if (!validTimedInstant(due.value)) return null;
      patch.due = Object.freeze({ kind: "datetime", value: due.value });
    } else if (due.kind === "none") {
      if (due.value !== null) return null;
      patch.due = Object.freeze({ kind: "none", value: null });
    } else {
      return null;
    }
  }

  return Object.freeze({
    source_entity_id: action.source_entity_id,
    uid: action.uid.trim(),
    patch: Object.freeze(patch),
  });
}

function supportedFeatures(entity) {
  const value = entity?.attributes?.supported_features;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function hasFeature(mask, feature) {
  return (mask & feature) !== 0;
}

function dueKind(value) {
  if (isDateKey(value)) return "date";
  if (validTimedInstant(value)) return "datetime";
  if (value === undefined || value === null) return "none";
  return "invalid";
}

async function unavailableSafe(operation) {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof HomeAssistantUnavailableError) return { ok: false, unavailable: true };
    throw error;
  }
}

function requireContext(context) {
  if (!context?.actions || typeof context.actions.register !== "function") {
    throw new TypeError("task-update action requires actions registry");
  }
  const homeAssistant = context.homeAssistant;
  for (const method of ["connectionState", "getState", "callService", "callWS"]) {
    if (!homeAssistant || typeof homeAssistant[method] !== "function") {
      throw new TypeError(`task-update action requires homeAssistant.${method}`);
    }
  }
  return context;
}

function createHandler(homeAssistant) {
  return async (rawAction) => {
    const normalized = normalizeAction(rawAction);
    if (!normalized) return { status: "rejected" };
    if (homeAssistant.connectionState() !== "connected") return { status: "unavailable" };

    const entity = homeAssistant.getState(normalized.source_entity_id);
    if (!entity || entity.state === "unknown" || entity.state === "unavailable") {
      return { status: "unavailable" };
    }
    const features = supportedFeatures(entity);
    if (!hasFeature(features, UPDATE_TODO_ITEM)) return { status: "rejected" };

    const data = { item: normalized.uid };
    if (Object.hasOwn(normalized.patch, "title")) data.rename = normalized.patch.title;
    if (Object.hasOwn(normalized.patch, "status")) data.status = normalized.patch.status;
    if (Object.hasOwn(normalized.patch, "description")) {
      if (!hasFeature(features, SET_DESCRIPTION)) return { status: "rejected" };
      data.description = normalized.patch.description;
    }

    if (Object.hasOwn(normalized.patch, "due")) {
      const due = normalized.patch.due;
      if (due.kind === "date") {
        if (!hasFeature(features, SET_DUE_DATE)) return { status: "rejected" };
        data.due_date = due.value;
      } else if (due.kind === "datetime") {
        if (!hasFeature(features, SET_DUE_DATETIME)) return { status: "rejected" };
        data.due_datetime = due.value;
      } else {
        const listed = await unavailableSafe(() => homeAssistant.callWS({
          type: "todo/item/list",
          entity_id: normalized.source_entity_id,
        }));
        if (!listed.ok) return { status: "unavailable" };
        const items = Array.isArray(listed.value?.items) ? listed.value.items : [];
        const currentItem = items.find((item) => typeof item?.uid === "string" && item.uid.trim() === normalized.uid);
        if (!currentItem) return { status: "rejected" };
        const currentKind = dueKind(currentItem.due);
        if (currentKind === "date") {
          if (!hasFeature(features, SET_DUE_DATE)) return { status: "rejected" };
          data.due_date = null;
        } else if (currentKind === "datetime") {
          if (!hasFeature(features, SET_DUE_DATETIME)) return { status: "rejected" };
          data.due_datetime = null;
        } else if (currentKind === "none") {
          if (Object.keys(data).length === 1) return { status: "success", value: { noop: true } };
        } else {
          return { status: "rejected" };
        }
      }
    }

    const service = await unavailableSafe(() => homeAssistant.callService(
      "todo",
      "update_item",
      data,
      { entity_id: normalized.source_entity_id },
    ));
    if (!service.ok) return { status: "unavailable" };
    return { status: "success", value: service.value };
  };
}

function registerFor(context) {
  return context.actions.register("task.update", createHandler(context.homeAssistant));
}

export function createTaskUpdateAction(initialContext, initialConfig) {
  let context = requireContext(initialContext);
  let config = validateTaskUpdateConfig(initialConfig);
  let unregister = null;
  let mounted = false;
  let destroyed = false;

  return Object.freeze({
    mount() {
      if (destroyed || mounted) return false;
      mounted = true;
      unregister = registerFor(context);
      return true;
    },
    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("task-update action is destroyed");
      const validatedContext = requireContext(nextContext);
      const validatedConfig = validateTaskUpdateConfig(nextConfig);
      if (!mounted) {
        context = validatedContext;
        config = validatedConfig;
        return true;
      }

      const previousContext = context;
      const previousConfig = config;
      const actionsChanged = validatedContext.actions !== previousContext.actions;
      const homeAssistantChanged = validatedContext.homeAssistant !== previousContext.homeAssistant;

      if (!actionsChanged && !homeAssistantChanged) {
        context = validatedContext;
        config = validatedConfig;
        return true;
      }

      if (actionsChanged) {
        const nextUnregister = registerFor(validatedContext);
        unregister?.();
        context = validatedContext;
        config = validatedConfig;
        unregister = nextUnregister;
        return true;
      }

      const previousUnregister = unregister;
      previousUnregister?.();
      unregister = null;
      try {
        const nextUnregister = registerFor(validatedContext);
        context = validatedContext;
        config = validatedConfig;
        unregister = nextUnregister;
        return true;
      } catch (error) {
        context = previousContext;
        config = previousConfig;
        unregister = registerFor(previousContext);
        throw error;
      }
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      unregister?.();
      unregister = null;
      mounted = false;
      return true;
    },
  });
}
