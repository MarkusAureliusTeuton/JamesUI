import { createButton, createDialog, createOverlayFrame } from "../../design/primitives.js";
import {
  addDateKey,
  dateKeyInTimeZone,
  formatZonedTime,
  isDateKey,
  zonedLocalToInstant,
} from "../../shared/zoned-time.js";

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function requireInstanceId(value) {
  if (!nonEmptyString(value)) throw new TypeError("Agenda overlay requires instanceId");
  return value.trim();
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`Agenda overlay requires ${label}`);
  return value;
}

function createText(document, tagName, attribute, text = "") {
  const node = document.createElement(tagName);
  if (attribute) node.setAttribute(attribute, "");
  node.textContent = text;
  return node;
}

function setDisabled(element, disabled) {
  element.disabled = Boolean(disabled);
  if (disabled) element.setAttribute("disabled", "");
  else element.removeAttribute("disabled");
}

function normalizedCapabilities(source) {
  const capabilities = source?.capabilities && typeof source.capabilities === "object"
    ? source.capabilities
    : {};
  return Object.freeze({
    can_update: capabilities.can_update === true,
    can_set_due_date: capabilities.can_set_due_date === true,
    can_set_due_datetime: capabilities.can_set_due_datetime === true,
    can_set_description: capabilities.can_set_description === true,
  });
}

function validTimeZone(timeZone) {
  if (!nonEmptyString(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function parseTime(value) {
  if (typeof value !== "string") return null;
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function freezePatch(patch) {
  if (patch.due) Object.freeze(patch.due);
  return Object.freeze(patch);
}

export function createTaskDraft(task, timeZone) {
  if (!task || typeof task !== "object" || !nonEmptyString(task.title)) {
    throw new TypeError("task draft requires a normalized task");
  }
  if (!validTimeZone(timeZone)) throw new TypeError("task draft requires a valid time zone");

  let dueDate = "";
  let dueTime = "";
  if (task.due?.kind === "date") {
    if (!isDateKey(task.due.value)) throw new TypeError("task has invalid date due");
    dueDate = task.due.value;
  } else if (task.due?.kind === "datetime") {
    dueDate = dateKeyInTimeZone(task.due.value, timeZone) ?? "";
    dueTime = formatZonedTime(task.due.value, timeZone) ?? "";
    if (!dueDate || !dueTime) throw new TypeError("task has invalid datetime due");
  } else if (task.due?.kind !== "none") {
    throw new TypeError("task has invalid due kind");
  }

  return Object.freeze({
    title: task.title,
    due_date: dueDate,
    due_time: dueTime,
    description: typeof task.description === "string" ? task.description : "",
  });
}

function desiredDue(draft, timeZone) {
  const date = typeof draft.due_date === "string" ? draft.due_date.trim() : null;
  const time = typeof draft.due_time === "string" ? draft.due_time.trim() : null;
  if (date === null || time === null) throw new TypeError("task draft due fields must be strings");
  if (!date) {
    if (time) throw new TypeError("task due time requires date");
    return { kind: "none", value: null };
  }
  if (!isDateKey(date)) throw new TypeError("task due date is invalid");
  if (!time) return { kind: "date", value: date };
  const parts = parseTime(time);
  if (!parts) throw new TypeError("task due time is invalid");
  const value = zonedLocalToInstant({ dateKey: date, hour: parts.hour, minute: parts.minute }, timeZone);
  if (!value) throw new TypeError("task due datetime is invalid");
  return { kind: "datetime", value };
}

function dueUnchanged(original, draft, desired, timeZone) {
  const originalDue = original.due ?? { kind: "none", value: null };
  if (originalDue.kind === "none") return desired.kind === "none";
  if (originalDue.kind === "date") return desired.kind === "date" && originalDue.value === desired.value;
  if (originalDue.kind !== "datetime" || desired.kind !== "datetime") return false;

  const originalDate = dateKeyInTimeZone(originalDue.value, timeZone);
  const originalTime = formatZonedTime(originalDue.value, timeZone);
  return originalDate === draft.due_date.trim() && originalTime === draft.due_time.trim();
}

export function buildTaskPatch({ original, draft, capabilities, time_zone: timeZone } = {}) {
  if (!original || typeof original !== "object" || !draft || typeof draft !== "object") {
    throw new TypeError("task patch requires original and draft");
  }
  if (!validTimeZone(timeZone)) throw new TypeError("task patch requires a valid time zone");
  const caps = normalizedCapabilities({ capabilities });
  const patch = {};

  if (typeof draft.title !== "string") throw new TypeError("task title must be a string");
  const nextTitle = draft.title.trim();
  if (!nextTitle) throw new TypeError("task title must not be blank");
  const originalTitle = typeof original.title === "string" ? original.title.trim() : "";
  if (nextTitle !== originalTitle) patch.title = nextTitle;

  const desired = desiredDue(draft, timeZone);
  if (!dueUnchanged(original, draft, desired, timeZone)) {
    if (desired.kind === "date" && !caps.can_set_due_date) {
      throw new TypeError("task source cannot update date due");
    }
    if (desired.kind === "datetime" && !caps.can_set_due_datetime) {
      throw new TypeError("task source cannot update datetime due");
    }
    if (desired.kind === "none" && original.due?.kind === "date" && !caps.can_set_due_date) {
      throw new TypeError("task source cannot clear date due");
    }
    if (desired.kind === "none" && original.due?.kind === "datetime" && !caps.can_set_due_datetime) {
      throw new TypeError("task source cannot clear datetime due");
    }
    patch.due = desired;
  }

  if (typeof draft.description !== "string") throw new TypeError("task description must be a string");
  const originalDescription = typeof original.description === "string" ? original.description : "";
  if (draft.description !== originalDescription) {
    if (!caps.can_set_description) throw new TypeError("task source cannot update description");
    patch.description = draft.description === "" ? null : draft.description;
  }

  if (Object.keys(patch).length && !caps.can_update) {
    throw new TypeError("task source cannot update items");
  }
  return freezePatch(patch);
}

function formatDateKey(dateKey, { weekday = false } = {}) {
  if (!isDateKey(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const formatter = new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    ...(weekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let value = formatter.format(date);
  value = value.replace(/^([A-Za-zÄÖÜäöüß]{2,3})\.,/, "$1,");
  return value;
}

function formatTimedDate(value, timeZone, { weekday = true } = {}) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || !validTimeZone(timeZone)) return null;
  const formatter = new Intl.DateTimeFormat("de-DE", {
    timeZone,
    ...(weekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let result = formatter.format(date);
  result = result.replace(/^([A-Za-zÄÖÜäöüß]{2,3})\.,/, "$1,");
  return result;
}

export function formatEventRange(event, timeZone) {
  if (!event || typeof event !== "object" || !validTimeZone(timeZone)) return null;
  if (event.all_day === true) {
    if (!isDateKey(event.start_date) || !isDateKey(event.end_date) || event.end_date <= event.start_date) return null;
    const lastDay = addDateKey(event.end_date, -1);
    if (event.start_date === lastDay) return `${formatDateKey(event.start_date)} · Ganztägig`;

    const [sy, sm, sd] = event.start_date.split("-").map(Number);
    const [ey, em, ed] = lastDay.split("-").map(Number);
    if (sy === ey && sm === em) {
      const month = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" })
        .format(new Date(Date.UTC(sy, sm - 1, 1, 12)));
      return `${sd}.–${ed}. ${month} ${sy} · Ganztägig`;
    }
    return `${formatDateKey(event.start_date)}–${formatDateKey(lastDay)} · Ganztägig`;
  }

  if (event.all_day === false) {
    const startDate = formatTimedDate(event.start_at, timeZone);
    const endDate = formatTimedDate(event.end_at, timeZone);
    const startTime = formatZonedTime(event.start_at, timeZone);
    const endTime = formatZonedTime(event.end_at, timeZone);
    if (!startDate || !endDate || !startTime || !endTime) return null;
    const startDay = dateKeyInTimeZone(event.start_at, timeZone);
    const endDay = dateKeyInTimeZone(event.end_at, timeZone);
    if (startDay === endDay) return `${startDate} · ${startTime}–${endTime}`;
    return `${startDate} · ${startTime} – ${endDate} · ${endTime}`;
  }
  return null;
}

function agendaOverlayId(instanceId, kind, identity) {
  return `calendar-agenda:${requireInstanceId(instanceId)}:${kind}:${identity}`;
}

function appendCloseButton(document, dialog, onClose) {
  const close = createButton(document, { ariaLabel: "Schließen", variant: "ghost", size: "sm" });
  close.setAttribute("data-jui-agenda-overlay-close", "");
  dialog.actions.appendChild(close);
  close.addEventListener("click", onClose);
  return close;
}

export function createEventDetailOverlay(document, {
  instanceId,
  event,
  presentation = {},
  sourceNames = {},
  timeZone,
  onClose,
} = {}) {
  requireFunction(onClose, "onClose");
  if (!event || typeof event !== "object" || !nonEmptyString(event.title) || !nonEmptyString(event.key)) {
    throw new TypeError("event detail requires a logical event");
  }
  const range = formatEventRange(event, timeZone);
  if (!range) throw new TypeError("event detail requires a valid event range and time zone");

  const root = createOverlayFrame(document);
  root.setAttribute("data-jui-agenda-event-overlay", "");
  root.setAttribute("data-jui-agenda-overlay-id", agendaOverlayId(instanceId, "event", event.key));
  const dialog = createDialog(document, { title: event.title });
  const rangeNode = createText(document, "p", "data-jui-agenda-event-range", range);
  dialog.body.appendChild(rangeNode);

  if (nonEmptyString(presentation.location)) {
    dialog.body.appendChild(createText(document, "p", "data-jui-agenda-event-location", presentation.location.trim()));
  }
  if (nonEmptyString(presentation.description)) {
    dialog.body.appendChild(createText(document, "p", "data-jui-agenda-event-description", presentation.description));
  }

  const sources = createText(document, "div", "data-jui-agenda-event-sources");
  for (const sourceId of Array.isArray(event.provenance) ? event.provenance : []) {
    const name = nonEmptyString(sourceNames[sourceId]) ? sourceNames[sourceId].trim() : sourceId;
    sources.appendChild(createText(document, "span", "data-jui-agenda-event-source", name));
  }
  if (sources.children.length) dialog.body.appendChild(sources);

  const closeButton = appendCloseButton(document, dialog, onClose);
  const backdropListener = (domEvent) => {
    if (domEvent?.target === root) onClose();
  };
  root.addEventListener("click", backdropListener);
  root.appendChild(dialog.root);

  let destroyed = false;
  return Object.freeze({
    root,
    id: root.getAttribute("data-jui-agenda-overlay-id"),
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      closeButton.removeEventListener("click", onClose);
      root.removeEventListener("click", backdropListener);
      return true;
    },
  });
}

function field(document, labelText, input, attribute) {
  const label = createText(document, "label", null, labelText);
  if (attribute) input.setAttribute(attribute, "");
  label.appendChild(input);
  return label;
}

function input(document, type, value = "") {
  const element = document.createElement("input");
  element.setAttribute("type", type);
  element.value = value;
  return element;
}

function feedbackForStatus(status) {
  if (status === "unavailable") return "Aufgabe derzeit nicht verfügbar";
  if (status === "rejected") return "Änderung nicht unterstützt";
  return "Änderung konnte nicht gespeichert werden";
}

export function createTaskEditOverlay(document, {
  instanceId,
  task,
  source,
  timeZone,
  onClose,
  onSave,
} = {}) {
  requireFunction(onClose, "onClose");
  requireFunction(onSave, "onSave");
  if (!task || typeof task !== "object" || !nonEmptyString(task.source_entity_id) || !nonEmptyString(task.uid)) {
    throw new TypeError("task edit requires a normalized task");
  }
  const caps = normalizedCapabilities(source);
  const draft = createTaskDraft(task, timeZone);
  const root = createOverlayFrame(document);
  root.setAttribute("data-jui-agenda-task-overlay", "");
  root.setAttribute("data-jui-agenda-overlay-id", agendaOverlayId(instanceId, "task", `${task.source_entity_id}:${task.uid}`));
  const dialog = createDialog(document, { title: "Aufgabe bearbeiten" });

  dialog.body.appendChild(createText(
    document,
    "p",
    "data-jui-agenda-task-source",
    nonEmptyString(source?.name) ? source.name.trim() : task.source_entity_id,
  ));

  const titleInput = input(document, "text", draft.title);
  titleInput.setAttribute("data-jui-agenda-task-title", "");
  setDisabled(titleInput, !caps.can_update);
  dialog.body.appendChild(field(document, "Titel", titleInput));

  const hasDueCapability = caps.can_update && (caps.can_set_due_date || caps.can_set_due_datetime);
  const dueDateInput = input(document, "date", draft.due_date);
  dueDateInput.setAttribute("data-jui-agenda-task-due-date", "");
  setDisabled(dueDateInput, !hasDueCapability);
  dialog.body.appendChild(field(document, "Fällig am", dueDateInput));

  let dueTimeInput = null;
  if (caps.can_set_due_datetime) {
    dueTimeInput = input(document, "time", draft.due_time);
    dueTimeInput.setAttribute("data-jui-agenda-task-due-time", "");
    setDisabled(dueTimeInput, !caps.can_update);
    dialog.body.appendChild(field(document, "Uhrzeit", dueTimeInput));
  }

  const descriptionInput = document.createElement("textarea");
  descriptionInput.value = draft.description;
  descriptionInput.setAttribute("data-jui-agenda-task-description", "");
  setDisabled(descriptionInput, !(caps.can_update && caps.can_set_description));
  dialog.body.appendChild(field(document, "Beschreibung", descriptionInput));

  const feedback = createText(document, "p", "data-jui-agenda-task-feedback");
  dialog.body.appendChild(feedback);

  const saveButton = createButton(document, { label: "Speichern", variant: "accent", size: "sm" });
  saveButton.setAttribute("data-jui-agenda-task-save", "");
  setDisabled(saveButton, !caps.can_update);
  dialog.actions.appendChild(saveButton);
  const closeButton = appendCloseButton(document, dialog, onClose);
  root.appendChild(dialog.root);

  let destroyed = false;
  let saving = false;
  const readDraft = () => ({
    title: titleInput.value,
    due_date: dueDateInput.value,
    due_time: dueTimeInput?.value ?? "",
    description: descriptionInput.value,
  });

  const saveListener = async () => {
    if (destroyed || saving || !caps.can_update) return;
    feedback.textContent = "";
    let patch;
    try {
      patch = buildTaskPatch({ original: task, draft: readDraft(), capabilities: caps, time_zone: timeZone });
    } catch {
      feedback.textContent = "Eingaben prüfen";
      return;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    saving = true;
    setDisabled(saveButton, true);
    let result;
    try {
      result = await onSave(patch);
    } catch {
      result = { status: "error" };
    }
    saving = false;
    if (!destroyed) setDisabled(saveButton, !caps.can_update);
    if (destroyed) return;
    if (result?.status === "success") {
      onClose();
      return;
    }
    feedback.textContent = feedbackForStatus(result?.status);
  };

  saveButton.addEventListener("click", saveListener);
  const backdropListener = (domEvent) => {
    if (domEvent?.target === root) onClose();
  };
  root.addEventListener("click", backdropListener);

  return Object.freeze({
    root,
    id: root.getAttribute("data-jui-agenda-overlay-id"),
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      saveButton.removeEventListener("click", saveListener);
      closeButton.removeEventListener("click", onClose);
      root.removeEventListener("click", backdropListener);
      return true;
    },
  });
}
