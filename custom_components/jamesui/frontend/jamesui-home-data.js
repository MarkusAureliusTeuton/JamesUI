function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseCalendarDate(value) {
  if (!value) return null;
  if (isDateOnly(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfLocalDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function addLocalDays(value, days) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeEvent(calendarEntityId, event) {
  const start = parseCalendarDate(event?.start);
  const end = parseCalendarDate(event?.end);
  if (!start || !end || end <= start) return null;
  const title = String(event?.summary || "Termin").trim() || "Termin";
  const allDay = isDateOnly(event?.start) && isDateOnly(event?.end);
  const location = String(event?.location || "").trim();
  const id = event?.uid
    ? `${calendarEntityId}:${event.uid}:${start.toISOString()}`
    : `${calendarEntityId}:${title}:${start.toISOString()}:${end.toISOString()}`;
  return {
    id,
    calendarEntityId,
    title,
    start,
    end,
    allDay,
    location,
  };
}

export function normalizeCalendarEvents(eventsByEntity, now = new Date()) {
  if (!eventsByEntity || typeof eventsByEntity !== "object") return [];
  const rangeStart = startOfLocalDay(now);
  const rangeEnd = addLocalDays(rangeStart, 8);
  const seen = new Set();
  const result = [];

  for (const [calendarEntityId, events] of Object.entries(eventsByEntity)) {
    if (!calendarEntityId.startsWith("calendar.") || !Array.isArray(events)) continue;
    for (const event of events) {
      const normalized = normalizeEvent(calendarEntityId, event);
      if (!normalized) continue;
      if (normalized.end <= rangeStart || normalized.start >= rangeEnd) continue;
      const key = [
        calendarEntityId,
        normalized.title,
        normalized.start.toISOString(),
        normalized.end.toISOString(),
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(normalized);
    }
  }

  return result.sort((a, b) => {
    const byStart = a.start - b.start;
    if (byStart) return byStart;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.title.localeCompare(b.title, "de");
  });
}

function sceneModels(states) {
  if (!states || typeof states !== "object") return [];
  return Object.entries(states)
    .filter(([entityId, entity]) => entityId.startsWith("scene.") && entity?.state !== "unavailable")
    .map(([entityId, entity]) => ({
      entityId,
      name: entity?.attributes?.friendly_name || entityId.split(".")[1]?.replaceAll("_", " ") || entityId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de") || a.entityId.localeCompare(b.entityId));
}

export function resolveFavoriteScenes(states, configuredIds = []) {
  const all = sceneModels(states);
  const byId = new Map(all.map((scene) => [scene.entityId, scene]));
  const chosen = [];
  const used = new Set();

  for (const entityId of Array.isArray(configuredIds) ? configuredIds : []) {
    const scene = byId.get(entityId);
    if (!scene || used.has(entityId)) continue;
    chosen.push(scene);
    used.add(entityId);
    if (chosen.length === 4) return chosen;
  }

  for (const scene of all) {
    if (used.has(scene.entityId)) continue;
    chosen.push(scene);
    used.add(scene.entityId);
    if (chosen.length === 4) break;
  }

  return chosen;
}

export async function activateScene(panel, entityId) {
  if (!entityId?.startsWith("scene.") || !panel?._hass?.callService) return false;
  try {
    await panel._hass.callService("scene", "turn_on", { entity_id: entityId });
    return true;
  } catch (error) {
    console.error("JamesUI: scene activation failed", entityId, error);
    return false;
  }
}

function calendarEntityIds(panel) {
  return Object.keys(panel?._hass?.states || {})
    .filter((entityId) => entityId.startsWith("calendar."))
    .sort();
}

function calendarWindow(now = new Date()) {
  const start = startOfLocalDay(now);
  return {
    key: `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`,
    start,
    end: addLocalDays(start, 8),
  };
}

async function cleanupCalendarSubscriptions(panel) {
  const state = panel?._jamesHomeDataState;
  if (!state) return;
  const unsubscribers = [...state.unsubscribers.values()];
  state.unsubscribers.clear();
  state.signature = "";
  for (const unsubscribe of unsubscribers) {
    try {
      await Promise.resolve(unsubscribe?.());
    } catch (_) {}
  }
}

function updateCalendarModel(panel) {
  panel._jamesHomeCalendarEvents = normalizeCalendarEvents(
    panel._jamesHomeDataState?.eventsByEntity || {},
    new Date()
  );
}

async function ensureCalendarSubscriptions(panel) {
  const connection = panel?._hass?.connection;
  const state = panel?._jamesHomeDataState;
  if (!connection?.subscribeMessage || !state) return;

  const ids = calendarEntityIds(panel);
  const window = calendarWindow();
  const signature = `${window.key}|${ids.join(",")}`;
  if (signature === state.signature) return;

  await cleanupCalendarSubscriptions(panel);
  state.signature = signature;
  state.eventsByEntity = {};
  updateCalendarModel(panel);
  if (!ids.length) return;

  for (const entityId of ids) {
    try {
      const unsubscribe = await connection.subscribeMessage(
        (payload) => {
          const events = Array.isArray(payload?.events)
            ? payload.events
            : Array.isArray(payload?.event?.events)
              ? payload.event.events
              : [];
          state.eventsByEntity[entityId] = events;
          updateCalendarModel(panel);
          if (panel._page === "home") panel.render?.();
        },
        {
          type: "calendar/event/subscribe",
          entity_id: entityId,
          start: window.start.toISOString(),
          end: window.end.toISOString(),
        }
      );
      if (typeof unsubscribe === "function") state.unsubscribers.set(entityId, unsubscribe);
    } catch (error) {
      console.warn("JamesUI: calendar subscription failed", entityId, error);
      state.eventsByEntity[entityId] = [];
      updateCalendarModel(panel);
    }
  }
}

function refreshSceneModels(panel) {
  const states = panel?._hass?.states || {};
  panel._jamesHomeAllScenes = sceneModels(states);
  panel._jamesHomeScenes = resolveFavoriteScenes(states, panel?._config?.home_scene_entities || []);
  panel._activateHomeScene = (entityId) => activateScene(panel, entityId);
}

export function installHomeDataExperience() {
  if (typeof customElements === "undefined") return false;
  const Panel = customElements.get("jamesui-panel");
  if (!Panel || Panel.prototype.__jamesHomeDataInstalled) return Boolean(Panel);

  const originalRender = Panel.prototype.render;
  const originalDisconnected = Panel.prototype.disconnectedCallback;

  Panel.prototype.render = function (...args) {
    if (!this._jamesHomeDataState) {
      this._jamesHomeDataState = {
        eventsByEntity: {},
        unsubscribers: new Map(),
        signature: "",
      };
      this._jamesHomeCalendarEvents = [];
    }
    refreshSceneModels(this);
    const result = originalRender.apply(this, args);
    ensureCalendarSubscriptions(this).catch((error) => {
      console.warn("JamesUI: calendar data refresh failed", error);
    });
    return result;
  };

  Panel.prototype.disconnectedCallback = function (...args) {
    cleanupCalendarSubscriptions(this).catch(() => {});
    return originalDisconnected?.apply(this, args);
  };

  Panel.prototype.__jamesHomeDataInstalled = true;
  return true;
}
