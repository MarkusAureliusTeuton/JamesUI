import { createButton } from "../../design/primitives.js";
import { createIcon } from "../../icons/icon.js";
import {
  addDateKey,
  dateKeyInTimeZone,
  zonedStartOfDate,
} from "../../shared/zoned-time.js";
import { validateCalendarAgendaConfig } from "./config.js";
import { createDaySwipeTracker } from "./gesture.js";
import { MANIFEST } from "./manifest.js";
import {
  buildAgendaModel,
  buildCalendarRangeRequest,
  collapseCalendarEvents,
} from "./model.js";
import {
  advanceNoticeThreshold,
  buildAdvanceNotices,
  createNoticeDismissalStore,
  eventStartInstant,
} from "./notices.js";
import {
  createEventDetailOverlay,
  createTaskEditOverlay,
} from "./overlay.js";
import { presentationForEvent } from "./presentation.js";
import {
  computeExpandedNoticeHeight,
  computeVisibleCapacity,
  visibleRowWindow,
} from "./sizing.js";
import { CALENDAR_AGENDA_STYLES } from "./styles.js";

export const UNDO_DURATION_MS = 5000;

function validateContext(context) {
  if (!context || typeof context !== "object") throw new TypeError("Agenda context is required");
  if (!context.capabilities || typeof context.capabilities.subscribe !== "function") {
    throw new TypeError("Agenda requires capabilities");
  }
  if (!context.actions || typeof context.actions.execute !== "function") {
    throw new TypeError("Agenda requires actions");
  }
  if (!context.overlays || typeof context.overlays.open !== "function" || typeof context.overlays.subscribe !== "function") {
    throw new TypeError("Agenda requires overlays");
  }
  if (context.module?.id !== MANIFEST.id) throw new TypeError(`Agenda module id must be ${MANIFEST.id}`);
  return context;
}

function validateRuntime(runtime) {
  for (const method of ["now", "setTimeout", "clearTimeout", "createResizeObserver", "measureHeight"]) {
    if (!runtime || typeof runtime[method] !== "function") throw new TypeError(`Agenda runtime requires ${method}`);
  }
  return runtime;
}

function syntheticSnapshot(capability) {
  return Object.freeze({ capability, status: "unavailable", value: null, reason: null, provider: null });
}

function createElement(document, tagName, attribute = null, text = "") {
  const node = document.createElement(tagName);
  if (attribute) node.setAttribute(attribute, "");
  node.textContent = text;
  return node;
}

function taskKey(task) {
  return `${task.source_entity_id}\u0000${task.uid}`;
}

function normalizedNow(runtime) {
  const date = runtime.now();
  const normalized = date instanceof Date ? new Date(date.valueOf()) : new Date(date);
  if (!Number.isFinite(normalized.valueOf())) throw new TypeError("Agenda runtime.now() must return a valid date");
  return normalized;
}

function actionFeedback(status) {
  if (status === "unavailable") return "Aufgabe derzeit nicht verfügbar";
  if (status === "rejected") return "Änderung nicht unterstützt";
  return "Änderung konnte nicht gespeichert werden";
}

function taskFromSnapshot(snapshot, sourceId, uid) {
  const source = snapshot?.sources?.[sourceId];
  if (!source || !Array.isArray(source.items)) return null;
  return source.items.find((item) => item.uid === uid) ?? null;
}

function cloneTaskSnapshotWithOptimism(snapshot, intents) {
  if (!snapshot || !snapshot.sources || intents.size === 0) return snapshot;
  const sources = {};
  for (const [sourceId, source] of Object.entries(snapshot.sources)) {
    const items = Array.isArray(source.items) ? [...source.items] : [];
    for (const [key, intent] of intents) {
      if (intent.task.source_entity_id !== sourceId) continue;
      const index = items.findIndex((item) => taskKey(item) === key);
      if (index >= 0) items[index] = Object.freeze({ ...items[index], status: intent.status });
      else if (intent.status === "needs_action") items.push(Object.freeze({ ...intent.task, status: "needs_action" }));
    }
    sources[sourceId] = Object.freeze({ ...source, items: Object.freeze(items) });
  }
  return Object.freeze({ ...snapshot, sources: Object.freeze(sources) });
}

function configFingerprint(config) {
  return JSON.stringify(config);
}

export function createCalendarAgendaWidget(initialContext, initialConfig, runtime) {
  let context = validateContext(initialContext);
  let config = validateCalendarAgendaConfig(initialConfig);
  validateRuntime(runtime);

  let mounted = false;
  let destroyed = false;
  let target = null;
  let document = null;
  let styleNode = null;
  let root = null;
  let header = null;
  let headerLabel = null;
  let previousButton = null;
  let nextButton = null;
  let statuses = null;
  let noticesHost = null;
  let scrollHost = null;
  let undoHost = null;
  let actionFeedbackNode = null;
  let rowHeight = null;
  let resizeObserver = null;
  let calendarCapabilityUnsubscribe = null;
  let tasksCapabilityUnsubscribe = null;
  let rangeUnsubscribe = null;
  let overlayUnsubscribe = null;
  let schedulerHandle = null;
  let overlayController = null;
  let overlayClose = null;
  let calendarTopSnapshot = syntheticSnapshot("calendar.events");
  let tasksTopSnapshot = syntheticSnapshot("tasks.items");
  let calendarRangeSnapshot = null;
  let selectedDay = null;
  let lastTodayKey = null;
  let lastModel = null;
  let collapsedEvents = [];
  let noticesExpanded = false;
  let noticeStore = null;
  let actionFeedbackText = "";
  let currentNotices = Object.freeze({ all: Object.freeze([]), visible: Object.freeze([]), hidden_count: 0, expanded: false });
  let renderGeneration = 0;
  const optimisticIntents = new Map();
  const undoEntries = new Map();
  const pendingTaskMutations = new Set();

  const activeTaskSnapshot = () => tasksTopSnapshot.status === "available" ? tasksTopSnapshot.value : null;
  const calendarService = () => calendarTopSnapshot.status === "available" ? calendarTopSnapshot.value : null;

  const timeZone = () => (
    calendarRangeSnapshot?.time_zone
    ?? calendarService()?.time_zone
    ?? activeTaskSnapshot()?.time_zone
    ?? null
  );

  const currentTodayKey = () => {
    const zone = timeZone();
    return zone ? dateKeyInTimeZone(normalizedNow(runtime), zone) : null;
  };

  const removeRangeSubscription = () => {
    const unsubscribe = rangeUnsubscribe;
    rangeUnsubscribe = null;
    if (typeof unsubscribe === "function") {
      try { unsubscribe(); } catch { /* stale cleanup is harmless */ }
    }
    calendarRangeSnapshot = null;
  };

  const sourceNames = () => {
    const names = {};
    for (const source of calendarService()?.configured_sources ?? []) names[source.entity_id] = source.name;
    return names;
  };

  const closeOwnOverlay = () => {
    const controller = overlayController;
    const close = overlayClose;
    overlayController = null;
    overlayClose = null;
    close?.();
    controller?.destroy();
  };

  const dropOverlayReferences = () => {
    const controller = overlayController;
    overlayController = null;
    overlayClose = null;
    controller?.destroy();
  };

  const openOverlay = (controller, title) => {
    closeOwnOverlay();
    overlayController = controller;
    try {
      overlayClose = context.overlays.open({ id: controller.id, title, content: controller.root });
    } catch (error) {
      dropOverlayReferences();
      throw error;
    }
  };

  const reconcileOptimisticIntents = () => {
    const snapshot = activeTaskSnapshot();
    if (!snapshot) return;
    for (const [key, intent] of [...optimisticIntents]) {
      const actual = taskFromSnapshot(snapshot, intent.task.source_entity_id, intent.task.uid);
      if (actual?.status === intent.status || (!actual && intent.status === "completed")) {
        optimisticIntents.delete(key);
      }
    }
  };

  const pruneUndoEntries = (nowMs) => {
    let changed = false;
    for (const [key, entry] of [...undoEntries]) {
      if (entry.expires_at_ms <= nowMs) {
        undoEntries.delete(key);
        changed = true;
      }
    }
    return changed;
  };

  const buildCurrentModel = () => {
    const zone = timeZone();
    if (!zone) return null;
    const now = normalizedNow(runtime);
    const todayKey = dateKeyInTimeZone(now, zone);
    if (!todayKey) return null;

    if (lastTodayKey && lastTodayKey !== todayKey && selectedDay === lastTodayKey) selectedDay = todayKey;
    lastTodayKey = todayKey;
    if (!selectedDay) selectedDay = todayKey;

    const effectiveTasks = cloneTaskSnapshotWithOptimism(activeTaskSnapshot(), optimisticIntents);
    const model = buildAgendaModel({
      config,
      today_key: todayKey,
      now: now.toISOString(),
      selected_day: selectedDay,
      calendar_snapshot: calendarRangeSnapshot,
      tasks_snapshot: effectiveTasks,
    });
    if (config.presentation_mode === "day") selectedDay = model.selected_day;
    collapsedEvents = collapseCalendarEvents(calendarRangeSnapshot, config, todayKey);
    if (!noticeStore) {
      noticeStore = createNoticeDismissalStore({ storage: runtime.storage ?? null, instance_id: config.instance_id, now: now.toISOString() });
    }
    noticeStore.prune(now.toISOString());
    currentNotices = config.calendar_enabled
      ? buildAdvanceNotices({
        events: collapsedEvents,
        config,
        time_zone: zone,
        now: now.toISOString(),
        dismissal_store: noticeStore,
        expanded: noticesExpanded,
      })
      : Object.freeze({ all: Object.freeze([]), visible: Object.freeze([]), hidden_count: 0, expanded: noticesExpanded });
    return model;
  };

  const createAgendaRow = (row) => {
    const article = createElement(document, "article", "data-jui-agenda-row");
    article.setAttribute("data-jui-agenda-kind", row.kind);
    const button = document.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("data-jui-agenda-row-button", "");
    button.setAttribute("data-jui-agenda-row-kind", row.kind);
    button.setAttribute("aria-label", row.kind === "task" ? `Aufgabe öffnen: ${row.title}` : `Termin öffnen: ${row.title}`);

    const time = createElement(document, "span", "data-jui-agenda-time", row.time_label ?? "");
    const iconHost = createElement(document, "span", "data-jui-agenda-icon");
    const copy = createElement(document, "span", "data-jui-agenda-copy");
    copy.appendChild(createElement(document, "span", "data-jui-agenda-title", row.title));

    let iconId = null;
    let accent = null;
    let presentation = null;
    if (row.kind === "event") {
      presentation = presentationForEvent(row.event, config);
      iconId = presentation.icon_id;
      accent = presentation.accent;
      if (row.reserve_location_line) {
        copy.appendChild(createElement(document, "span", "data-jui-agenda-location", presentation.location ?? ""));
      }
    } else {
      const taskList = config.task_lists.find((entry) => entry.entity_id === row.task.source_entity_id);
      iconId = taskList?.icon_id ?? "home.task";
      accent = taskList?.accent ?? null;
      if (row.reserve_location_line) copy.appendChild(createElement(document, "span", "data-jui-agenda-location", ""));
    }
    if (iconId) iconHost.appendChild(createIcon(document, iconId, { size: "sm" }));
    if (accent) article.style.setProperty("--jui-agenda-accent", accent);

    button.appendChild(time);
    button.appendChild(iconHost);
    button.appendChild(copy);
    article.appendChild(button);

    if (row.kind === "task") {
      const complete = createButton(document, { ariaLabel: `Aufgabe erledigen: ${row.title}`, variant: "ghost", size: "sm" });
      complete.setAttribute("data-jui-agenda-complete", "");
      complete.appendChild(createIcon(document, "home.task", { size: "sm" }));
      if (pendingTaskMutations.has(taskKey(row.task))) complete.setAttribute("disabled", "");
      const completeListener = () => completeTask(row.task);
      complete.addEventListener("click", completeListener);
      article.appendChild(complete);
    } else {
      article.appendChild(createElement(document, "span", "data-jui-agenda-row-spacer"));
    }

    button.addEventListener("click", () => {
      if (row.kind === "event") openEvent(row.event, presentation ?? presentationForEvent(row.event, config));
      else openTask(row.task);
    });
    return article;
  };

  const updateContinuationMarkers = () => {
    if (!scrollHost || !lastModel || config.presentation_mode === "grouped") return;
    const rows = scrollHost.querySelectorAll("[data-jui-agenda-row]");
    const before = scrollHost.querySelector('[data-jui-agenda-continuation="before"]');
    const after = scrollHost.querySelector('[data-jui-agenda-continuation="after"]');
    if (!before || !after || !rowHeight) return;
    const viewport = Number(scrollHost._juiViewportHeight ?? 0);
    const window = visibleRowWindow({
      scrollTop: Number(scrollHost.scrollTop ?? 0),
      viewportHeight: viewport,
      rowHeight,
      totalRows: rows.length,
    });
    before.hidden = !window.has_before;
    after.hidden = !window.has_after;
  };

  const renderStatuses = (model) => {
    statuses.replaceChildren();
    const add = (text) => statuses.appendChild(createElement(document, "div", "data-jui-agenda-source-notice", text));
    if (config.calendar_enabled && calendarTopSnapshot.status !== "available") add("Kalender derzeit nicht verfügbar");
    if (config.tasks_enabled && tasksTopSnapshot.status !== "available") add("Aufgaben derzeit nicht verfügbar");
    for (const notice of model?.source_notices ?? []) add(`${notice.name} derzeit nicht verfügbar`);
  };

  const renderNotices = () => {
    noticesHost.replaceChildren();
    noticesHost.setAttribute("data-expanded", currentNotices.expanded ? "true" : "false");
    for (const notice of currentNotices.visible) {
      const row = createElement(document, "div", "data-jui-agenda-notice");
      const title = createElement(document, "span", "data-jui-agenda-notice-title", notice.title);
      const dismiss = createButton(document, { ariaLabel: `Hinweis schließen: ${notice.title}`, variant: "ghost", size: "sm" });
      dismiss.setAttribute("data-jui-agenda-notice-dismiss", "");
      dismiss.addEventListener("click", () => {
        noticeStore?.dismiss(notice.logical_event_key, notice.event_start_at);
        renderAndSchedule();
      });
      row.appendChild(title);
      row.appendChild(dismiss);
      noticesHost.appendChild(row);
    }
    if (!currentNotices.expanded && currentNotices.hidden_count > 0) {
      const expand = createButton(document, { label: `+${currentNotices.hidden_count} weitere Hinweise`, variant: "ghost", size: "sm" });
      expand.setAttribute("data-jui-agenda-notice-expand", "");
      expand.addEventListener("click", () => { noticesExpanded = true; renderAndSchedule(); });
      noticesHost.appendChild(expand);
    } else if (currentNotices.expanded && currentNotices.all.length > 2) {
      const collapse = createButton(document, { label: "Hinweise einklappen", variant: "ghost", size: "sm" });
      collapse.setAttribute("data-jui-agenda-notice-expand", "");
      collapse.addEventListener("click", () => { noticesExpanded = false; renderAndSchedule(); });
      noticesHost.appendChild(collapse);
    }
  };

  const renderUndo = () => {
    undoHost.replaceChildren();
    for (const [key, entry] of undoEntries) {
      const item = createElement(document, "div", "data-jui-agenda-undo-entry");
      item.appendChild(createElement(document, "span", null, `${entry.task.title} erledigt`));
      const undo = createButton(document, { label: "Rückgängig", variant: "ghost", size: "sm" });
      undo.setAttribute("data-jui-agenda-undo", "");
      undo.setAttribute("data-jui-agenda-task-key", key);
      undo.addEventListener("click", () => undoTask(key));
      item.appendChild(undo);
      undoHost.appendChild(item);
    }
    actionFeedbackNode.textContent = actionFeedbackText;
    if (actionFeedbackText) undoHost.appendChild(actionFeedbackNode);
  };

  const renderRows = (model) => {
    scrollHost.replaceChildren();
    const before = createElement(document, "div");
    before.setAttribute("data-jui-agenda-continuation", "before");
    before.hidden = true;
    const after = createElement(document, "div");
    after.setAttribute("data-jui-agenda-continuation", "after");
    after.hidden = true;
    scrollHost.appendChild(before);

    for (const section of model.sections) {
      const sectionNode = createElement(document, "section", "data-jui-agenda-section");
      if (config.presentation_mode !== "day") {
        sectionNode.appendChild(createElement(document, "div", "data-jui-agenda-section-title", section.header));
      }
      for (const row of section.rows) sectionNode.appendChild(createAgendaRow(row));
      scrollHost.appendChild(sectionNode);
    }
    if (model.empty_state) scrollHost.appendChild(createElement(document, "div", "data-jui-agenda-empty", model.empty_state));
    scrollHost.appendChild(after);
  };

  const applySizing = (model) => {
    if (!rowHeight) return;
    const hostHeight = Number(runtime.measureHeight(target));
    const baseChrome = Number(runtime.measureHeight(header))
      + Number(runtime.measureHeight(statuses))
      + Number(runtime.measureHeight(undoHost));
    let noticeHeight = Number(runtime.measureHeight(noticesHost));
    if (!Number.isFinite(noticeHeight) || noticeHeight < 0) noticeHeight = 0;
    if (noticesExpanded) {
      noticeHeight = computeExpandedNoticeHeight({
        hostHeight,
        baseChromeHeight: baseChrome,
        rowHeight,
        desiredNoticeHeight: noticeHeight,
      });
      noticesHost.style.setProperty("max-height", `${noticeHeight}px`);
    } else {
      noticesHost.style.removeProperty("max-height");
    }
    const capacity = computeVisibleCapacity({ hostHeight, chromeHeight: baseChrome + noticeHeight, rowHeight });
    root.setAttribute("data-jui-agenda-capacity", String(capacity));
    if (capacity === 0) {
      scrollHost.replaceChildren(createElement(document, "div", "data-jui-agenda-too-small", "Nicht genug Platz"));
      scrollHost._juiViewportHeight = 0;
      return;
    }
    const visibleRows = config.visible_items_mode === "fixed"
      ? Math.min(capacity, config.max_visible_items)
      : capacity;
    const viewportHeight = visibleRows * rowHeight;
    scrollHost._juiViewportHeight = viewportHeight;
    scrollHost.style.setProperty("max-height", `${viewportHeight}px`);
    updateContinuationMarkers();
  };

  const render = () => {
    if (!mounted || destroyed || !root) return;
    renderGeneration += 1;
    const now = normalizedNow(runtime);
    pruneUndoEntries(now.valueOf());
    const model = buildCurrentModel();
    lastModel = model;

    if (config.presentation_mode === "day") {
      previousButton.hidden = false;
      nextButton.hidden = false;
      headerLabel.textContent = model?.sections?.[0]?.header ?? "Agenda";
    } else {
      previousButton.hidden = true;
      nextButton.hidden = true;
      headerLabel.textContent = "Agenda";
    }
    renderStatuses(model);
    renderNotices();
    renderUndo();

    if (!model) {
      scrollHost.replaceChildren(createElement(document, "div", "data-jui-agenda-empty", "Agenda derzeit nicht verfügbar"));
      return;
    }
    renderRows(model);
    applySizing(model);
  };

  const schedulerCandidates = () => {
    const zone = timeZone();
    if (!zone) return [];
    const now = normalizedNow(runtime);
    const nowMs = now.valueOf();
    const result = [];
    const today = dateKeyInTimeZone(now, zone);
    const nextMidnight = today ? zonedStartOfDate(addDateKey(today, 1), zone) : null;
    if (nextMidnight) result.push(new Date(nextMidnight).valueOf());
    for (const value of lastModel?.scheduler_candidates ?? []) result.push(new Date(value).valueOf());
    for (const event of collapsedEvents) {
      const presentation = presentationForEvent(event, config);
      const threshold = advanceNoticeThreshold(event, presentation.advance_notice_days, zone);
      const start = eventStartInstant(event, zone);
      if (threshold) result.push(new Date(threshold).valueOf());
      if (start) result.push(new Date(start).valueOf());
    }
    for (const entry of undoEntries.values()) result.push(entry.expires_at_ms);
    return result.filter((value) => Number.isFinite(value) && value > nowMs);
  };

  const schedule = () => {
    if (!mounted || destroyed) return;
    if (schedulerHandle !== null) {
      runtime.clearTimeout(schedulerHandle);
      schedulerHandle = null;
    }
    const nowMs = normalizedNow(runtime).valueOf();
    const candidates = schedulerCandidates();
    if (!candidates.length) return;
    const next = Math.min(...candidates);
    schedulerHandle = runtime.setTimeout(() => {
      schedulerHandle = null;
      if (!mounted || destroyed) return;
      const previousToday = lastTodayKey;
      const nextToday = currentTodayKey();
      if (previousToday && nextToday && previousToday !== nextToday && config.calendar_enabled) bindCalendarRange();
      renderAndSchedule();
    }, Math.max(0, next - nowMs));
  };

  const renderAndSchedule = () => {
    render();
    schedule();
  };

  const bindCalendarRange = () => {
    removeRangeSubscription();
    if (!mounted || destroyed || !config.calendar_enabled) return;
    const service = calendarService();
    if (!service || typeof service.subscribe_ranges !== "function" || !service.time_zone) return;
    const today = dateKeyInTimeZone(normalizedNow(runtime), service.time_zone);
    if (!today) return;
    const request = buildCalendarRangeRequest(config, today);
    if (!request.ranges.length) return;
    const generation = renderGeneration + 1;
    rangeUnsubscribe = service.subscribe_ranges(request, (snapshot) => {
      if (!mounted || destroyed || calendarService() !== service) return;
      calendarRangeSnapshot = snapshot;
      renderGeneration = Math.max(renderGeneration, generation);
      renderAndSchedule();
    });
  };

  const setupCapabilities = () => {
    if (config.calendar_enabled) {
      calendarCapabilityUnsubscribe = context.capabilities.subscribe("calendar.events", (snapshot) => {
        calendarTopSnapshot = snapshot ?? syntheticSnapshot("calendar.events");
        bindCalendarRange();
        renderAndSchedule();
      }, { emitCurrent: true });
    }
    if (config.tasks_enabled) {
      tasksCapabilityUnsubscribe = context.capabilities.subscribe("tasks.items", (snapshot) => {
        tasksTopSnapshot = snapshot ?? syntheticSnapshot("tasks.items");
        reconcileOptimisticIntents();
        renderAndSchedule();
      }, { emitCurrent: true });
    }
  };

  const teardownCapabilities = () => {
    removeRangeSubscription();
    calendarCapabilityUnsubscribe?.();
    tasksCapabilityUnsubscribe?.();
    calendarCapabilityUnsubscribe = null;
    tasksCapabilityUnsubscribe = null;
    calendarTopSnapshot = syntheticSnapshot("calendar.events");
    tasksTopSnapshot = syntheticSnapshot("tasks.items");
  };

  const setupOverlayObserver = () => {
    overlayUnsubscribe = context.overlays.subscribe((current) => {
      if (overlayController && current?.id !== overlayController.id) dropOverlayReferences();
    });
  };

  const teardownOverlayObserver = () => {
    overlayUnsubscribe?.();
    overlayUnsubscribe = null;
  };

  const openEvent = (event, presentation) => {
    if (!mounted || destroyed) return false;
    const zone = timeZone();
    if (!zone) return false;
    let controller = null;
    controller = createEventDetailOverlay(document, {
      instanceId: config.instance_id,
      event,
      presentation,
      sourceNames: sourceNames(),
      timeZone: zone,
      onClose: () => {
        if (overlayController === controller) closeOwnOverlay();
      },
    });
    openOverlay(controller, event.title);
    return true;
  };

  const openTask = (task) => {
    if (!mounted || destroyed) return false;
    const snapshot = activeTaskSnapshot();
    const source = snapshot?.sources?.[task.source_entity_id];
    const zone = timeZone();
    if (!source || !zone) return false;
    let controller = null;
    controller = createTaskEditOverlay(document, {
      instanceId: config.instance_id,
      task,
      source,
      timeZone: zone,
      onClose: () => {
        if (overlayController === controller) closeOwnOverlay();
      },
      onSave: (patch) => context.actions.execute({
        type: "task.update",
        source_entity_id: task.source_entity_id,
        uid: task.uid,
        patch,
      }),
    });
    openOverlay(controller, task.title);
    return true;
  };

  const completeTask = async (task) => {
    const key = taskKey(task);
    if (!mounted || destroyed || pendingTaskMutations.has(key)) return false;
    pendingTaskMutations.add(key);
    actionFeedbackText = "";
    renderAndSchedule();
    let result;
    try {
      result = await context.actions.execute({
        type: "task.update",
        source_entity_id: task.source_entity_id,
        uid: task.uid,
        patch: { status: "completed" },
      });
    } catch {
      result = { status: "error" };
    }
    pendingTaskMutations.delete(key);
    if (!mounted || destroyed) return false;
    if (result?.status === "success") {
      optimisticIntents.set(key, { status: "completed", task });
      undoEntries.set(key, { task, expires_at_ms: normalizedNow(runtime).valueOf() + UNDO_DURATION_MS });
    } else {
      actionFeedbackText = actionFeedback(result?.status);
    }
    renderAndSchedule();
    return result?.status === "success";
  };

  const undoTask = async (key) => {
    const entry = undoEntries.get(key);
    if (!entry || pendingTaskMutations.has(key) || destroyed) return false;
    pendingTaskMutations.add(key);
    actionFeedbackText = "";
    const task = entry.task;
    let result;
    try {
      result = await context.actions.execute({
        type: "task.update",
        source_entity_id: task.source_entity_id,
        uid: task.uid,
        patch: { status: "needs_action" },
      });
    } catch {
      result = { status: "error" };
    }
    pendingTaskMutations.delete(key);
    if (!mounted || destroyed) return false;
    if (result?.status === "success") {
      undoEntries.delete(key);
      optimisticIntents.set(key, { status: "needs_action", task });
    } else {
      actionFeedbackText = actionFeedback(result?.status);
    }
    renderAndSchedule();
    return result?.status === "success";
  };

  const changeSelectedDay = (delta) => {
    if (!lastModel || config.presentation_mode !== "day") return false;
    const next = addDateKey(selectedDay, delta);
    if (!next || next < lastModel.bounds.start_day || next > lastModel.bounds.end_day) return false;
    selectedDay = next;
    renderAndSchedule();
    return true;
  };

  const swipe = createDaySwipeTracker({
    onPrevious: () => changeSelectedDay(-1),
    onNext: () => changeSelectedDay(1),
  });
  const onPointerDown = (event) => { if (config.presentation_mode === "day") swipe.start(event); };
  const onPointerMove = (event) => { if (config.presentation_mode === "day") swipe.move(event); };
  const onPointerUp = (event) => { if (config.presentation_mode === "day") swipe.end(event); };
  const onPointerCancel = () => swipe.cancel();
  const onScroll = () => updateContinuationMarkers();

  const createDom = (nextTarget) => {
    target = nextTarget;
    document = target.ownerDocument;
    if (!document || typeof document.createElement !== "function") throw new TypeError("Agenda mount target requires ownerDocument");

    styleNode = document.createElement("style");
    styleNode.setAttribute("data-jui-calendar-agenda-style", "");
    styleNode.textContent = CALENDAR_AGENDA_STYLES;
    root = document.createElement("section");
    root.setAttribute("data-jui-widget", "calendar-agenda");
    root.setAttribute("data-jui-agenda-instance", config.instance_id);

    header = createElement(document, "header", "data-jui-agenda-header");
    previousButton = createButton(document, { ariaLabel: "Vorheriger Tag", variant: "ghost", size: "sm" });
    previousButton.setAttribute("data-jui-agenda-day-nav", "previous");
    previousButton.appendChild(createIcon(document, "shell.back", { size: "sm" }));
    headerLabel = createElement(document, "div", "data-jui-agenda-header-label", "Agenda");
    nextButton = createButton(document, { ariaLabel: "Nächster Tag", variant: "ghost", size: "sm" });
    nextButton.setAttribute("data-jui-agenda-day-nav", "next");
    nextButton.textContent = "›";
    previousButton.addEventListener("click", () => changeSelectedDay(-1));
    nextButton.addEventListener("click", () => changeSelectedDay(1));
    header.appendChild(previousButton);
    header.appendChild(headerLabel);
    header.appendChild(nextButton);

    statuses = createElement(document, "div", "data-jui-agenda-statuses");
    noticesHost = createElement(document, "div", "data-jui-agenda-notices");
    scrollHost = createElement(document, "div", "data-jui-agenda-scroll");
    undoHost = createElement(document, "div", "data-jui-agenda-undo-region");
    actionFeedbackNode = createElement(document, "div", "data-jui-agenda-action-feedback");

    scrollHost.addEventListener("pointerdown", onPointerDown);
    scrollHost.addEventListener("pointermove", onPointerMove);
    scrollHost.addEventListener("pointerup", onPointerUp);
    scrollHost.addEventListener("pointercancel", onPointerCancel);
    scrollHost.addEventListener("scroll", onScroll);

    root.appendChild(header);
    root.appendChild(statuses);
    root.appendChild(noticesHost);
    root.appendChild(scrollHost);
    root.appendChild(undoHost);
    target.appendChild(styleNode);
    target.appendChild(root);

    const probe = createElement(document, "div", "data-jui-agenda-row-probe");
    probe.setAttribute("data-jui-agenda-row", "");
    root.appendChild(probe);
    const measured = Number(runtime.measureHeight(probe));
    root.removeChild(probe);
    if (!Number.isFinite(measured) || measured <= 0) throw new RangeError("Agenda row probe must have positive measured height");
    rowHeight = measured;
    root.style.setProperty("--jui-agenda-row-height", `${rowHeight}px`);

    resizeObserver = runtime.createResizeObserver(() => {
      if (mounted && !destroyed) renderAndSchedule();
    });
    if (!resizeObserver || typeof resizeObserver.observe !== "function" || typeof resizeObserver.disconnect !== "function") {
      throw new TypeError("Agenda runtime.createResizeObserver() must return observer");
    }
    resizeObserver.observe(target);
  };

  return Object.freeze({
    mount(nextTarget) {
      if (destroyed) throw new Error("Agenda widget is destroyed");
      if (mounted) return false;
      if (!nextTarget || typeof nextTarget.appendChild !== "function") throw new TypeError("Agenda mount target is required");
      createDom(nextTarget);
      mounted = true;
      noticeStore = createNoticeDismissalStore({
        storage: runtime.storage ?? null,
        instance_id: config.instance_id,
        now: normalizedNow(runtime).toISOString(),
      });
      setupOverlayObserver();
      setupCapabilities();
      renderAndSchedule();
      return true;
    },

    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("Agenda widget is destroyed");
      const validatedContext = validateContext(nextContext);
      const validatedConfig = validateCalendarAgendaConfig(nextConfig);
      if (!mounted) {
        context = validatedContext;
        config = validatedConfig;
        return true;
      }

      const capabilitiesChanged = validatedContext.capabilities !== context.capabilities;
      const overlaysChanged = validatedContext.overlays !== context.overlays;
      const configChanged = configFingerprint(validatedConfig) !== configFingerprint(config);
      if (overlaysChanged || validatedConfig.instance_id !== config.instance_id) closeOwnOverlay();
      if (overlaysChanged) teardownOverlayObserver();
      if (capabilitiesChanged || configChanged) teardownCapabilities();

      context = validatedContext;
      config = validatedConfig;
      root.setAttribute("data-jui-agenda-instance", config.instance_id);
      if (validatedConfig.instance_id !== noticeStore?.instance_id) {
        noticeStore = createNoticeDismissalStore({
          storage: runtime.storage ?? null,
          instance_id: config.instance_id,
          now: normalizedNow(runtime).toISOString(),
        });
      }
      if (config.presentation_mode !== "day") selectedDay = null;
      noticesExpanded = false;
      if (capabilitiesChanged || configChanged) setupCapabilities();
      if (overlaysChanged) setupOverlayObserver();
      renderAndSchedule();
      return true;
    },

    destroy() {
      if (destroyed) return false;
      destroyed = true;
      mounted = false;
      closeOwnOverlay();
      teardownOverlayObserver();
      teardownCapabilities();
      if (schedulerHandle !== null) {
        runtime.clearTimeout(schedulerHandle);
        schedulerHandle = null;
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      swipe.cancel();
      scrollHost?.removeEventListener("pointerdown", onPointerDown);
      scrollHost?.removeEventListener("pointermove", onPointerMove);
      scrollHost?.removeEventListener("pointerup", onPointerUp);
      scrollHost?.removeEventListener("pointercancel", onPointerCancel);
      scrollHost?.removeEventListener("scroll", onScroll);
      if (root?.parentNode) root.parentNode.removeChild(root);
      if (styleNode?.parentNode) styleNode.parentNode.removeChild(styleNode);
      target = null;
      document = null;
      root = null;
      styleNode = null;
      lastModel = null;
      collapsedEvents = [];
      undoEntries.clear();
      optimisticIntents.clear();
      pendingTaskMutations.clear();
      return true;
    },
  });
}
