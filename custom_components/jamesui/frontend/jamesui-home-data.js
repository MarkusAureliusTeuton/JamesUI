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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  return { id, calendarEntityId, title, start, end, allDay, location };
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
      const key = [calendarEntityId, normalized.title, normalized.start.toISOString(), normalized.end.toISOString()].join("|");
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

function formatOverlayEvent(event) {
  const start = event?.start instanceof Date ? event.start : new Date(event?.start);
  if (Number.isNaN(start.getTime())) return "–";
  const day = start.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  return event?.allDay ? `${day} · Ganztägig` : `${day} · ${start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

export function renderSceneOverlay(scenes = []) {
  return `
    <div class="start-v9-overlay" data-home-overlay>
      <div class="start-v9-overlay-scrim" data-close-home-overlay></div>
      <section class="start-v9-overlay-panel">
        <header><div><span>SZENEN</span><h2>Alle Szenen</h2></div><button data-close-home-overlay>×</button></header>
        <div class="start-v9-overlay-scenes">
          ${scenes.length ? scenes.map((scene) => `<button data-overlay-scene="${escapeHtml(scene.entityId)}"><span>✦</span><strong>${escapeHtml(scene.name)}</strong></button>`).join("") : `<div class="start-v9-overlay-empty">Keine Szenen eingerichtet</div>`}
        </div>
      </section>
    </div>`;
}

export function renderCalendarOverlay(events = []) {
  return `
    <div class="start-v9-overlay" data-home-overlay>
      <div class="start-v9-overlay-scrim" data-close-home-overlay></div>
      <section class="start-v9-overlay-panel start-v9-calendar-overlay">
        <header><div><span>KALENDER</span><h2>Termine</h2></div><button data-close-home-overlay>×</button></header>
        <div class="start-v9-overlay-events">
          ${events.length ? events.map((event) => `<article><time>${escapeHtml(formatOverlayEvent(event))}</time><div><strong>${escapeHtml(event.title || "Termin")}</strong>${event.location ? `<small>${escapeHtml(event.location)}</small>` : ""}</div></article>`).join("") : `<div class="start-v9-overlay-empty">Keine Kalenderdaten</div>`}
        </div>
      </section>
    </div>`;
}

function calendarEntityIds(panel) {
  return Object.keys(panel?._hass?.states || {}).filter((entityId) => entityId.startsWith("calendar.")).sort();
}

function calendarWindow(now = new Date()) {
  const start = startOfLocalDay(now);
  return { key: `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`, start, end: addLocalDays(start, 8) };
}

async function cleanupCalendarSubscriptions(panel) {
  const state = panel?._jamesHomeDataState;
  if (!state) return;
  const unsubscribers = [...state.unsubscribers.values()];
  state.unsubscribers.clear();
  state.signature = "";
  for (const unsubscribe of unsubscribers) {
    try { await Promise.resolve(unsubscribe?.()); } catch (_) {}
  }
}

function updateCalendarModel(panel) {
  panel._jamesHomeCalendarEvents = normalizeCalendarEvents(panel._jamesHomeDataState?.eventsByEntity || {}, new Date());
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
          const events = Array.isArray(payload?.events) ? payload.events : Array.isArray(payload?.event?.events) ? payload.event.events : [];
          state.eventsByEntity[entityId] = events;
          updateCalendarModel(panel);
          if (panel._page === "home") panel.render?.();
        },
        { type: "calendar/event/subscribe", entity_id: entityId, start: window.start.toISOString(), end: window.end.toISOString() }
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

const START_V9_RUNTIME_STYLES = `
  .app-shell.start-v9-shell{grid-template-rows:minmax(0,1fr) 88px;background:#070809}
  .app-shell.start-v9-shell>.topbar{display:none}
  .app-shell.start-v9-shell>.content{padding:0;overflow-y:auto;background:#070809}
  .app-shell.start-v9-shell>.menu-scrim{inset:0 0 88px}
  .app-shell.start-v9-shell>.app-menu{top:22px;right:26px}
  .bottom-nav{border-top:1px solid rgba(255,255,255,.07);background:rgba(9,10,11,.92);backdrop-filter:blur(18px);padding:9px clamp(26px,5vw,94px) 11px}
  .bottom-nav button{color:rgba(224,220,213,.48);font-weight:520;letter-spacing:.015em;transition:color .16s ease,transform .16s ease}
  .bottom-nav button::before{top:auto;bottom:2px;width:24px;height:2px;background:transparent}
  .bottom-nav .nav-icon{font-size:19px;transition:transform .16s ease,color .16s ease}
  .bottom-nav button.active{color:rgba(247,242,234,.92)}
  .bottom-nav button.active::before{background:#d8b58a}
  .bottom-nav button.active .nav-icon{color:#d8b58a;transform:translateY(-2px)}
  .start-v9-overlay{position:absolute;inset:0;z-index:85;display:grid;place-items:center;padding:4vw}
  .start-v9-overlay-scrim{position:absolute;inset:0;background:rgba(3,4,5,.76);backdrop-filter:blur(14px)}
  .start-v9-overlay-panel{position:relative;z-index:1;width:min(760px,94%);max-height:82vh;overflow:auto;padding:24px;border:1px solid rgba(255,255,255,.10);border-radius:24px;background:#111315;box-shadow:0 28px 90px rgba(0,0,0,.48)}
  .start-v9-overlay-panel>header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
  .start-v9-overlay-panel>header span{color:#d8b58a;font-size:9px;letter-spacing:.14em}.start-v9-overlay-panel>header h2{margin:4px 0 0;font-size:28px;font-weight:330}
  .start-v9-overlay-panel>header button{width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.05);font-size:21px;cursor:pointer}
  .start-v9-overlay-scenes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.start-v9-overlay-scenes>button{display:flex;align-items:center;gap:11px;min-height:54px;padding:0 14px;border:0;border-radius:12px;background:rgba(255,255,255,.035);text-align:left;cursor:pointer}.start-v9-overlay-scenes>button span{color:#d8b58a}
  .start-v9-overlay-events{display:flex;flex-direction:column}.start-v9-overlay-events article{display:grid;grid-template-columns:130px 1fr;gap:16px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.065)}.start-v9-overlay-events time{color:rgba(235,230,220,.55);font-size:10px}.start-v9-overlay-events article>div{display:flex;flex-direction:column;gap:3px}.start-v9-overlay-events strong{font-size:12px}.start-v9-overlay-events small{color:rgba(235,230,220,.45);font-size:9px}.start-v9-overlay-empty{padding:22px 0;color:rgba(235,230,220,.5);font-size:11px}
  .app-menu>[data-start-settings]{border-top:1px solid var(--line)}
  @media(max-width:900px){.app-shell.start-v9-shell{grid-template-rows:minmax(0,1fr) 78px}.app-shell.start-v9-shell>.menu-scrim{inset:0 0 78px}}
  @media(max-width:620px){.start-v9-overlay-scenes{grid-template-columns:1fr}.start-v9-overlay-events article{grid-template-columns:96px 1fr}}
`;

function ensureRuntimeStyle(root) {
  if (!root || root.querySelector("style[data-start-v9-runtime]")) return;
  const style = document.createElement("style");
  style.dataset.startV9Runtime = "";
  style.textContent = START_V9_RUNTIME_STYLES;
  root.append(style);
}

function injectStartSettingsIntoMenu(panel) {
  const menu = panel?.shadowRoot?.querySelector(".app-menu");
  if (!menu || menu.querySelector("[data-start-settings]")) return;
  const status = menu.querySelector(".menu-status");
  if (!status) return;
  status.insertAdjacentHTML("afterend", `<button data-start-settings><span>⚙</span><div><strong>Einstellungen</strong><small>Start, Datenquellen und Lieblingsszenen</small></div><b>›</b></button>`);
}

function appendActiveOverlay(panel) {
  const shell = panel?.shadowRoot?.querySelector(".app-shell");
  if (!shell || !panel?._jamesHomeOverlay) return;
  const html = panel._jamesHomeOverlay === "scenes"
    ? renderSceneOverlay(panel._jamesHomeAllScenes || [])
    : panel._jamesHomeOverlay === "calendar"
      ? renderCalendarOverlay(panel._jamesHomeCalendarEvents || [])
      : "";
  if (html) shell.insertAdjacentHTML("beforeend", html);
}

function bindStartRuntime(panel) {
  const root = panel?.shadowRoot;
  if (!root) return;
  const isPlainHome = panel._page === "home" && !panel._settings;
  root.querySelector(".app-shell")?.classList.toggle("start-v9-shell", isPlainHome);
  ensureRuntimeStyle(root);
  if (!isPlainHome) return;

  root.querySelector("[data-start-menu]")?.addEventListener("click", () => panel._toggleAppMenu?.());
  if (panel._appMenu) injectStartSettingsIntoMenu(panel);
  root.querySelector("[data-start-settings]")?.addEventListener("click", () => panel._toggleSettings?.());
  root.querySelector("[data-home-house-more]")?.addEventListener("click", () => panel._setPage?.("house"));

  root.querySelectorAll("[data-home-scene]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (await activateScene(panel, button.dataset.homeScene)) {
        button.classList.add("activated");
        window.setTimeout(() => button.classList.remove("activated"), 650);
      }
    });
  });

  root.querySelector("[data-home-scenes-more]")?.addEventListener("click", () => {
    panel._jamesHomeOverlay = "scenes";
    panel.render?.();
  });
  root.querySelector("[data-home-calendar-more]")?.addEventListener("click", () => {
    panel._jamesHomeOverlay = "calendar";
    panel.render?.();
  });

  root.querySelectorAll("[data-close-home-overlay]").forEach((node) => node.addEventListener("click", () => {
    panel._jamesHomeOverlay = null;
    panel.render?.();
  }));
  root.querySelectorAll("[data-overlay-scene]").forEach((button) => button.addEventListener("click", async () => {
    if (await activateScene(panel, button.dataset.overlayScene)) panel._jamesHomeOverlay = null;
    panel.render?.();
  }));
}

export function installHomeDataExperience() {
  if (typeof customElements === "undefined") return false;
  const Panel = customElements.get("jamesui-panel");
  if (!Panel || Panel.prototype.__jamesHomeDataInstalled) return Boolean(Panel);

  const originalRender = Panel.prototype.render;
  const originalDisconnected = Panel.prototype.disconnectedCallback;

  Panel.prototype.render = function (...args) {
    if (!this._jamesHomeDataState) {
      this._jamesHomeDataState = { eventsByEntity: {}, unsubscribers: new Map(), signature: "" };
      this._jamesHomeCalendarEvents = [];
    }
    refreshSceneModels(this);
    const result = originalRender.apply(this, args);
    appendActiveOverlay(this);
    bindStartRuntime(this);
    ensureCalendarSubscriptions(this).catch((error) => console.warn("JamesUI: calendar data refresh failed", error));
    return result;
  };

  Panel.prototype.disconnectedCallback = function (...args) {
    cleanupCalendarSubscriptions(this).catch(() => {});
    return originalDisconnected?.apply(this, args);
  };

  Panel.prototype.__jamesHomeDataInstalled = true;
  return true;
}
