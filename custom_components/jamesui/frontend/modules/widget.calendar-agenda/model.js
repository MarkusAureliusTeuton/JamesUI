import {
  addDateKey,
  dateKeyInTimeZone,
  formatZonedTime,
  isDateKey,
  zonedStartOfDate,
} from "../../shared/zoned-time.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeTitle(value) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE")
    : "";
}

function canonicalInstant(value) {
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
}

function sourceLookahead(config, calendar) {
  return calendar.lookahead_days ?? config.lookahead_days;
}

function rangeStart(config, todayKey) {
  return config.presentation_mode === "day"
    ? addDateKey(todayKey, -config.lookback_days)
    : todayKey;
}

function overallLookahead(config) {
  if (!config.calendar_enabled || config.calendars.length === 0) return config.lookahead_days;
  return Math.max(...config.calendars.map((calendar) => sourceLookahead(config, calendar)));
}

function maxAdvance(calendar) {
  return Math.max(
    calendar.advance_notice_days ?? 0,
    ...calendar.rules.map((rule) => rule.advance_notice_days ?? 0),
  );
}

export function buildCalendarRangeRequest(config, todayKey) {
  if (!isDateKey(todayKey)) throw new TypeError("todayKey must be YYYY-MM-DD");
  if (!config?.calendar_enabled) return deepFreeze({ ranges: [] });
  const startDate = rangeStart(config, todayKey);
  const ranges = config.calendars.map((calendar) => {
    const retrievalDays = Math.max(sourceLookahead(config, calendar), maxAdvance(calendar));
    return {
      entity_id: calendar.entity_id,
      start_date: startDate,
      end_date: addDateKey(todayKey, retrievalDays + 1),
    };
  });
  return deepFreeze({ ranges });
}

export function logicalEventKey(event) {
  if (!event || typeof event !== "object") throw new TypeError("event is required");
  const title = normalizeTitle(event.title);
  if (!title) throw new TypeError("event title is required");
  if (event.all_day === true && isDateKey(event.start_date) && isDateKey(event.end_date)) {
    return JSON.stringify([title, event.start_date, event.end_date, true]);
  }
  if (event.all_day === false) {
    const start = canonicalInstant(event.start_at);
    const end = canonicalInstant(event.end_at);
    if (start && end) return JSON.stringify([title, start, end, false]);
  }
  throw new TypeError("event has invalid time representation");
}

function eventOverlapsRange(event, startDate, endDate, timeZone) {
  if (event.all_day) return event.start_date < endDate && event.end_date > startDate;
  const startInstant = zonedStartOfDate(startDate, timeZone);
  const endInstant = zonedStartOfDate(endDate, timeZone);
  if (!startInstant || !endInstant) return false;
  return new Date(event.start_at).valueOf() < new Date(endInstant).valueOf()
    && new Date(event.end_at).valueOf() > new Date(startInstant).valueOf();
}

function canonicalEvent(event) {
  if (event.all_day) {
    return {
      title: event.title,
      all_day: true,
      start_date: event.start_date,
      end_date: event.end_date,
      start_at: null,
      end_at: null,
    };
  }
  return {
    title: event.title,
    all_day: false,
    start_date: null,
    end_date: null,
    start_at: canonicalInstant(event.start_at),
    end_at: canonicalInstant(event.end_at),
  };
}

export function collapseCalendarEvents(snapshot, config, todayKey) {
  if (!config?.calendar_enabled || !snapshot || typeof snapshot !== "object") return deepFreeze([]);
  if (!isDateKey(todayKey)) throw new TypeError("todayKey must be YYYY-MM-DD");
  const sources = snapshot.sources && typeof snapshot.sources === "object" ? snapshot.sources : {};
  const startDate = rangeStart(config, todayKey);
  const groups = new Map();

  for (const calendar of config.calendars) {
    const source = sources[calendar.entity_id];
    if (!source || source.status !== "available" || !Array.isArray(source.events)) continue;
    const normalEnd = addDateKey(todayKey, sourceLookahead(config, calendar) + 1);
    for (const event of source.events) {
      let key;
      try {
        key = logicalEventKey(event);
      } catch {
        continue;
      }
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          ...canonicalEvent(event),
          provenance: [],
          normal_contributors: [],
          normal_ranges: {},
          source_variants: {},
        };
        groups.set(key, group);
      }
      if (!group.provenance.includes(calendar.entity_id)) group.provenance.push(calendar.entity_id);
      group.source_variants[calendar.entity_id] = {
        occurrence_id: event.occurrence_id ?? null,
        description: event.description ?? null,
        location: event.location ?? null,
      };
      if (eventOverlapsRange(event, startDate, normalEnd, snapshot.time_zone)) {
        if (!group.normal_contributors.includes(calendar.entity_id)) group.normal_contributors.push(calendar.entity_id);
        group.normal_ranges[calendar.entity_id] = { start_date: startDate, end_date: normalEnd };
      }
    }
  }

  return deepFreeze([...groups.values()]);
}

export function projectEventForDay(event, dayKey, timeZone) {
  if (!event || !isDateKey(dayKey)) return null;
  if (event.all_day) {
    if (!(event.start_date <= dayKey && dayKey < event.end_date)) return null;
    return deepFreeze({ day_key: dayKey, time_label: "Ganztägig", phase: "all_day", sort_at: null });
  }

  const dayStart = zonedStartOfDate(dayKey, timeZone);
  const nextDay = addDateKey(dayKey, 1);
  const dayEnd = nextDay ? zonedStartOfDate(nextDay, timeZone) : null;
  if (!dayStart || !dayEnd) return null;
  const startMs = new Date(event.start_at).valueOf();
  const endMs = new Date(event.end_at).valueOf();
  const dayStartMs = new Date(dayStart).valueOf();
  const dayEndMs = new Date(dayEnd).valueOf();
  if (!(startMs < dayEndMs && endMs > dayStartMs)) return null;

  const startDay = dateKeyInTimeZone(event.start_at, timeZone);
  const endDay = dateKeyInTimeZone(event.end_at, timeZone);
  let phase = "intermediate";
  let timeLabel = "laufend";
  let sortAt = dayStart;
  if (dayKey === startDay) {
    phase = "start";
    timeLabel = formatZonedTime(event.start_at, timeZone);
    sortAt = canonicalInstant(event.start_at);
  } else if (dayKey === endDay) {
    phase = "end";
    timeLabel = `bis ${formatZonedTime(event.end_at, timeZone)}`;
  }
  return deepFreeze({ day_key: dayKey, time_label: timeLabel, phase, sort_at: sortAt });
}

function normalOnDay(event, dayKey) {
  return event.normal_contributors.some((sourceId) => {
    const range = event.normal_ranges[sourceId];
    return range && range.start_date <= dayKey && dayKey < range.end_date;
  });
}

function eventSourceRank(event, config) {
  for (const sourceId of event.provenance) {
    const index = config.calendars.findIndex((calendar) => calendar.entity_id === sourceId);
    if (index >= 0) return index;
  }
  return Number.MAX_SAFE_INTEGER;
}

function taskSourceRank(task, config) {
  const index = config.task_lists.findIndex((source) => source.entity_id === task.source_entity_id);
  return config.calendars.length + (index >= 0 ? index : config.task_lists.length);
}

function titleCompare(a, b) {
  return a.title.localeCompare(b.title, "de-DE", { sensitivity: "base" });
}

function eventRow(event, projection, config) {
  return {
    kind: "event",
    id: event.key,
    title: event.title,
    day_key: projection.day_key,
    time_label: projection.time_label,
    all_day: event.all_day,
    timed: !event.all_day,
    sort_at: projection.sort_at,
    source_rank: eventSourceRank(event, config),
    carried_forward: false,
    reserve_location_line: config.show_location,
    event,
  };
}

function taskDueDay(task, timeZone) {
  if (task.due.kind === "none") return null;
  if (task.due.kind === "date") return task.due.value;
  return dateKeyInTimeZone(task.due.value, timeZone);
}

function taskRow(task, dayKey, todayKey, timeZone, config) {
  const dueDay = taskDueDay(task, timeZone);
  const carriedForward = dueDay !== null && dueDay < todayKey && dayKey === todayKey;
  const originalTimed = task.due.kind === "datetime" && !carriedForward;
  return {
    kind: "task",
    id: `task:${task.source_entity_id}:${task.uid}`,
    title: task.title,
    day_key: dayKey,
    time_label: originalTimed ? formatZonedTime(task.due.value, timeZone) : null,
    all_day: false,
    timed: originalTimed,
    sort_at: originalTimed ? canonicalInstant(task.due.value) : null,
    source_rank: taskSourceRank(task, config),
    carried_forward: carriedForward,
    reserve_location_line: config.show_location,
    task,
  };
}

function taskRowsForDay(tasksSnapshot, config, dayKey, todayKey, timeZone, endDay) {
  if (!config.tasks_enabled || !tasksSnapshot?.sources) return [];
  const rows = [];
  for (const sourceConfig of config.task_lists) {
    const source = tasksSnapshot.sources[sourceConfig.entity_id];
    if (!source || source.status !== "available" || !Array.isArray(source.items)) continue;
    for (const task of source.items) {
      if (task.status !== "needs_action") continue;
      const dueDay = taskDueDay(task, timeZone);
      if (task.due.kind === "none") {
        if (dayKey === todayKey) rows.push(taskRow(task, dayKey, todayKey, timeZone, config));
        continue;
      }
      if (!dueDay) continue;
      if (dueDay > todayKey && dueDay > endDay) continue;
      if (dayKey === dueDay || (dueDay < todayKey && dayKey === todayKey)) {
        rows.push(taskRow(task, dayKey, todayKey, timeZone, config));
      }
    }
  }
  return rows;
}

function eventRowsForDay(events, config, dayKey, todayKey, now, timeZone) {
  if (!config.calendar_enabled) return [];
  const nowMs = new Date(now).valueOf();
  const rows = [];
  for (const event of events) {
    if (!event.normal_contributors.length || !normalOnDay(event, dayKey)) continue;
    if (event.all_day && !config.show_all_day) continue;
    const projection = projectEventForDay(event, dayKey, timeZone);
    if (!projection) continue;
    if (!event.all_day && dayKey === todayKey && new Date(event.end_at).valueOf() <= nowMs) continue;
    rows.push(eventRow(event, projection, config));
  }
  return rows;
}

function compareSourceThenTitle(a, b) {
  return a.source_rank - b.source_rank || titleCompare(a, b);
}

function compareTimed(a, b) {
  const left = a.sort_at ? new Date(a.sort_at).valueOf() : Number.MAX_SAFE_INTEGER;
  const right = b.sort_at ? new Date(b.sort_at).valueOf() : Number.MAX_SAFE_INTEGER;
  return left - right || compareSourceThenTitle(a, b);
}

function compareEvents(a, b) {
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
  if (a.all_day) return compareSourceThenTitle(a, b);
  return compareTimed(a, b);
}

function compareTasks(a, b) {
  if (a.timed !== b.timed) return a.timed ? -1 : 1;
  if (a.timed) return compareTimed(a, b);
  return compareSourceThenTitle(a, b);
}

function chronologicalClass(row, untimedPosition) {
  if (row.kind === "task" && !row.timed) return untimedPosition === "before" ? 0 : 3;
  if (row.kind === "event" && row.all_day) return untimedPosition === "before" ? 1 : 0;
  return untimedPosition === "before" ? 2 : 1;
}

function sortRows(eventRows, taskRows, config) {
  if (config.task_order_mode === "tasks_before") {
    return [...taskRows.sort(compareTasks), ...eventRows.sort(compareEvents)];
  }
  if (config.task_order_mode === "tasks_after") {
    return [...eventRows.sort(compareEvents), ...taskRows.sort(compareTasks)];
  }
  return [...eventRows, ...taskRows].sort((a, b) => {
    const classDelta = chronologicalClass(a, config.untimed_task_position) - chronologicalClass(b, config.untimed_task_position);
    if (classDelta) return classDelta;
    if (a.timed && b.timed) return compareTimed(a, b);
    return compareSourceThenTitle(a, b);
  });
}

function dateParts(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = Object.create(null);
  for (const part of new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "long",
  }).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return `${String(parts.weekday).replace(/\.$/, "")}, ${parts.day}. ${parts.month}`;
}

function sectionHeader(mode, dayKey, todayKey) {
  const long = dateParts(dayKey);
  if (mode === "day") return dayKey === todayKey ? `Heute · ${long}` : long;
  if (dayKey === todayKey) return "Heute";
  if (dayKey === addDateKey(todayKey, 1)) return "Morgen";
  return long;
}

function sourceNotices(config, calendarSnapshot, tasksSnapshot) {
  const notices = [];
  if (config.calendar_enabled && calendarSnapshot?.sources) {
    for (const calendar of config.calendars) {
      const source = calendarSnapshot.sources[calendar.entity_id];
      if (source && source.status !== "available") {
        notices.push({
          domain: "calendar",
          source_entity_id: calendar.entity_id,
          name: source.name ?? calendar.entity_id,
          reason: source.reason ?? "source_unavailable",
        });
      }
    }
  }
  if (config.tasks_enabled && tasksSnapshot?.sources) {
    for (const taskList of config.task_lists) {
      const source = tasksSnapshot.sources[taskList.entity_id];
      if (source && source.status !== "available") {
        notices.push({
          domain: "tasks",
          source_entity_id: taskList.entity_id,
          name: source.name ?? taskList.entity_id,
          reason: source.reason ?? "source_unavailable",
        });
      }
    }
  }
  return notices;
}

function emptyState(config) {
  if (config.calendar_enabled && config.tasks_enabled) return "Keine Termine oder Aufgaben";
  return config.calendar_enabled ? "Keine Termine" : "Keine Aufgaben";
}

function enumerateDays(startDay, endDay) {
  const days = [];
  for (let current = startDay; current && current <= endDay; current = addDateKey(current, 1)) days.push(current);
  return days;
}

function clampDay(dayKey, startDay, endDay) {
  if (!isDateKey(dayKey)) return startDay;
  if (dayKey < startDay) return startDay;
  if (dayKey > endDay) return endDay;
  return dayKey;
}

function schedulerCandidates(events, now, timeZone) {
  const nowMs = new Date(now).valueOf();
  const candidates = new Set();
  for (const event of events) {
    const values = event.all_day
      ? [zonedStartOfDate(event.start_date, timeZone), zonedStartOfDate(event.end_date, timeZone)]
      : [event.start_at, event.end_at];
    for (const value of values) {
      const canonical = canonicalInstant(value);
      if (canonical && new Date(canonical).valueOf() > nowMs) candidates.add(canonical);
    }
  }
  return [...candidates].sort((a, b) => new Date(a) - new Date(b));
}

export function buildAgendaModel({
  config,
  today_key: todayKey,
  now,
  selected_day: selectedDay = null,
  calendar_snapshot: calendarSnapshot = null,
  tasks_snapshot: tasksSnapshot = null,
} = {}) {
  if (!config || !isDateKey(todayKey) || !Number.isFinite(new Date(now).valueOf())) {
    throw new TypeError("buildAgendaModel requires config, today_key and valid now");
  }
  const timeZone = calendarSnapshot?.time_zone ?? tasksSnapshot?.time_zone ?? null;
  const startDay = config.presentation_mode === "day" ? addDateKey(todayKey, -config.lookback_days) : todayKey;
  const endDay = addDateKey(todayKey, overallLookahead(config));
  const events = collapseCalendarEvents(calendarSnapshot, config, todayKey);
  const days = config.presentation_mode === "day"
    ? [clampDay(selectedDay ?? todayKey, startDay, endDay)]
    : enumerateDays(todayKey, endDay);

  const sections = [];
  for (const dayKey of days) {
    const eventsForDay = eventRowsForDay(events, config, dayKey, todayKey, now, timeZone);
    const tasksForDay = taskRowsForDay(tasksSnapshot, config, dayKey, todayKey, timeZone, endDay);
    const rows = sortRows(eventsForDay, tasksForDay, config);
    if (config.presentation_mode === "day" || rows.length) {
      sections.push({ day_key: dayKey, header: sectionHeader(config.presentation_mode, dayKey, todayKey), rows });
    }
  }

  const hasRows = sections.some((section) => section.rows.length > 0);
  return deepFreeze({
    time_zone: timeZone,
    bounds: { start_day: startDay, end_day: endDay },
    selected_day: config.presentation_mode === "day" ? days[0] : null,
    sections,
    source_notices: sourceNotices(config, calendarSnapshot, tasksSnapshot),
    empty_state: hasRows ? null : emptyState(config),
    scheduler_candidates: schedulerCandidates(events, now, timeZone),
  });
}
