# JamesUI 1.0 – Block 11 Planning Notes

_Date: 2026-10-04_
_Status: conversational design complete; written spec candidate pending user review_

This file is the persistent planning record for confirmed Block-11 decisions. The consolidated written spec candidate is:

`docs/superpowers/specs/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda-design.md`

Until that spec is explicitly approved, this planning note remains the record of confirmed product decisions. No Block-11 product code may be written before spec approval and later implementation-plan approval.

Cross-page sizing/scroll rules remain in `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`.

## Working rules

- German, concise, technical, direct communication.
- Every JamesUI response begins `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:` and ends with a short summary.
- Repository is source of truth.
- One roadmap block at a time.
- TDD for behavior changes; intentionally red tests never reach `main`.
- No monkey-patches, Prototype overrides, version-polish layers, parallel implementations or permanent legacy shims.
- r11 stays production/reference until controlled cutover.
- Never fabricate backend data.
- OnePlus Pad 2 portrait remains primary target; Fully is only the kiosk shell.
- During design, decisions may be collected in chat and then persisted in one consolidated pass rather than writing every micro-decision immediately.

## Block 11 scope

Block 11 is a combined household Agenda:

- `provider.calendar`
- `provider.tasks`
- dedicated task-update action exposing `task.update`
- `widget.calendar-agenda`

The widget consumes capabilities/actions only and has no raw Home Assistant access.

In scope:

- calendar-only, task-only and combined Agenda;
- `grouped`, `timeline`, `day` modes;
- calendar lookahead and day-mode lookback;
- current/running/upcoming and historical-day semantics;
- all-day and multi-day events;
- duplicate collapse with provenance;
- task ordering, completion, ~5 s Undo and editing;
- overdue carry-forward;
- event/task detail overlays;
- JamesUI-owned advance notices;
- icon/accent rules;
- fixed/auto row capacity;
- source-specific error handling.

Out of scope:

- task creation/deletion/move/reorder;
- calendar event editing;
- source reminder/alarm import;
- final Start grid/composition;
- generic Module Loader instance orchestration;
- House Quick, Dynamic Buttons, production cutover.

## Selected architecture

Chosen approach:

- Calendar is a **range-based read capability** because each Agenda instance can request a different historical/future window.
- Tasks are a **live normalized snapshot** built from `todo/item/subscribe` streams.
- Task mutations use a dedicated semantic `task.update` action instead of generic `ha.service` from the widget.

Rejected:

- one giant 1–365-day calendar snapshot for all consumers;
- provider range derived by coupling providers to all widget/page configuration.

### Capability direction

- `calendar.events`: read-only range service with HA timezone metadata, configured-source metadata and per-range subscription.
- `tasks.items`: normalized snapshot of configured todo lists, source status, supported features and items.

### Task action

`task.update` uses:

- `source_entity_id`
- stable task `uid`
- minimal patch containing changed title/status/due/description fields.

The action validates real Todo supported features before translating to `todo.update_item`.

## Home Assistant API findings

Current documented Calendar WebSocket subscription:

`calendar/event/subscribe`

- immediate current range result;
- later updates when the entity changes;
- `events: null` signals fetch failure;
- exposed event fields are currently start, end, summary, description and location.

Therefore JamesUI must not depend on source calendar UID/recurrence/reminder metadata in this frontend subscription path.

Current Todo stream:

`todo/item/subscribe`

- initial item list;
- later list updates;
- item model includes UID, summary, status, due, description and completed timestamp.

`todo.update_item` supports rename, status, due date/datetime and description subject to the list's feature flags; current HA service logic also permits clearing supported due/description fields.

## Widget instances

`widget.calendar-agenda` must support multiple independent instances.

Each instance owns its own:

- stable instance ID;
- selected calendars/lists;
- calendar/task enablement;
- mode;
- lookahead/lookback;
- visible-row settings;
- task ordering;
- all-day/location settings;
- calendar rules;
- task-list presentation;
- advance notices;
- transient UI and notice-dismiss state.

Provider architecture remains shared.

Block 11 proves parallel independent widget `create()` instances directly. Generic loader/page orchestration for multiple configured widget instances remains Block 14.

## Domain enablement

Defaults:

- `calendar_enabled = true`
- `tasks_enabled = true`

Invalid:

- both false;
- calendar enabled with no selected `calendar.*` source;
- tasks enabled with no selected `todo.*` source.

Irrelevant child settings remain visible but disabled/greyed in the later configuration UI.

## Modes

### `grouped`

- starts at Today;
- day sections `Heute`, `Morgen`, then date;
- no automatic past-day display.

### `timeline`

- starts at Today;
- chronological future agenda;
- no automatic past-day display.

### `day`

- one selected calendar day;
- horizontal swipe previous/next calendar day;
- vertical scroll within the day;
- empty days remain reachable;
- today header `Heute · So, 4. Oktober`;
- other day `Mo, 5. Oktober`;
- small previous/next controls supplement swipe;
- no wrap beyond history boundary.

Gesture direction locks after initial movement; exact threshold is an implementation constant, not a user setting.

## Lookahead/lookback

Calendar lookahead per Agenda instance:

- default 30 days;
- allowed 1–365 days;
- optional per-calendar override;
- override field disabled/greyed until override is enabled.

Day-mode lookback:

- default 7 days;
- allowed 0–365 days;
- applies only to `day`;
- `0` means Today is earliest day.

Tasks may retain schema `lookahead_days = 0`, where `0` means unrestricted/not applicable, never zero tasks.

## Event visibility

Today in all three modes:

- running event remains visible until actual end;
- upcoming event visible;
- ended timed event disappears from normal Today agenda.

When browsing a past date in `day`, show the full event history for that historical day.

All-day event covering Today remains current for the whole local day.

## All-day and multi-day

Per instance:

- `show_all_day = true` default;
- all-day row label `Ganztägig`;
- all-day event shown on every covered local date;
- never invent `00:00`;
- original full range retained in detail overlay.

Timed multi-day event:

- start day shows real start time;
- full intermediate day shows `laufend`;
- end day shows `bis <end time>`;
- remains one timed source event.

Example: Fri 18:00 → Sun 10:00 gives `18:00`, `laufend`, `bis 10:00`.

## Recurring events

Every concrete recurring occurrence returned by HA is treated as its own occurrence. Same series identity alone never causes different dates to collapse.

No recurrence editing in Block 11.

## Duplicate calendar events

Collapse when normalized:

- title;
- start;
- end;
- all-day status

match across selected calendars.

Location/description differences do not prevent collapse.

All contributing source IDs remain as provenance. Conflicting optional source fields are not invented/merged arbitrarily.

## Task ordering

Per instance:

- `chronological`
- `tasks_before`
- `tasks_after`

For chronological only:

- `untimed_task_position = before | after`
- default `after`.

All-day-before-timed applies only within calendar events and does not override `tasks_before/tasks_after`.

## Overdue tasks

Incomplete overdue task:

- appears on its original due day when that day is viewed in `day` history;
- also appears Today until completed;
- does not appear on every intervening date;
- original due value remains unchanged;
- no warning color/badge/`seit X Tagen` treatment.

## Completion and Undo

- direct completion control on task row;
- successful completion hides task optimistically;
- Undo remains available about 5 seconds;
- Undo sends only `status: needs_action` for original source + UID;
- no old title/due/description rewrite;
- multiple rapid completions retain independent Undo identities;
- failed mutation rolls back optimistic state.

## Task editing in Block 11

Editing is no longer deferred; it belongs in Block 11.

Task detail overlay can edit, where source supports it:

- title;
- due date;
- due date/time;
- clear due;
- description;
- clear description.

Save sends only changed fields through `task.update`.

Unsupported fields remain read-only/disabled rather than pretending they can be changed.

Not included: create/delete/move/reorder.

## Row geometry and location

- fixed equal row height;
- stable time/date area;
- stable icon area;
- stable task completion area;
- title takes remaining width and ellipsizes;
- no font shrinking;
- icon/accent does not alter geometry.

`show_location`:

- off: no location line;
- on: reserve stable second-line area;
- actual location only when present;
- never fake `Kein Ort`.

## Visible-row modes

`fixed`:

- default 5;
- allowed 3–8;
- tasks/events count together.

`auto`:

- use only complete rows that fit in host allocation;
- never compress/crop a partial row;
- recalc on host size change;
- additional content internally scrolls;
- if even one full row cannot fit in addition to required widget chrome, placement becomes `too_small`.

Widget never enlarges parent to expose more content.

## Timeline continuation

- points on vertical line;
- hidden earlier same-day content → short dashed continuation upward;
- hidden later same-day content → dashed downward;
- normal termination when no hidden content;
- no permanent up/down arrows;
- exact dash dimensions are visual implementation detail.

## Calendar presentation rules

Per selected calendar, per widget instance:

- default icon;
- default accent.

Ordered event rules can override icon/accent.

Operators:

- exact;
- contains;
- starts with.

Title searched by default; description/location optional per rule; first match wins; no regex in normal UI; rules reorderable.

Priority:

1. first matching rule;
2. calendar default;
3. neutral fallback.

Color remains restrained to marker/icon/fine accent.

Waste examples: Gelber Sack, Biotonne, Restmüll, Papier.

## Task-list presentation

Each selected todo list may define default semantic icon + accent per Agenda instance. No task keyword rules required in Block 11.

## JamesUI advance notices

Source reminder metadata is not available through the consumed Calendar subscription API, so JamesUI never pretends to show source reminders.

Instead, a clearly JamesUI-owned Vorlaufhinweis is supported.

Hierarchy:

- calendar default `advance_notice_days = 0..365`, with `0 = off`;
- matching event rule may override with its own `0..365` value;
- omitted rule value inherits calendar default;
- explicit rule `0` disables notice for that match.

Example:

- calendar default off;
- Zahnarzt → 7 days;
- Gelber Sack → 1 day.

The provider request horizon must extend far enough to discover the largest configured advance lead even when normal display lookahead is shorter.

Notice behavior:

- visible from lead threshold until event start;
- disappears from notice area at event start;
- actual event remains in normal Agenda;
- user can dismiss it;
- dismissed concrete occurrence does not reappear on that device for that widget instance.

Display:

- max 2 notices normally visible;
- additional `+N weitere Hinweise`;
- activation expands inside widget;
- notices do not count toward `max_visible_items`;
- they still consume real widget height;
- expansion never grows host layout.

Dismiss persistence is browser/device-local, versioned and scoped to widget instance. Because Calendar subscription payload has no source UID, concrete occurrence identity uses the normalized logical occurrence signature. Expired dismissal records are pruned.

## Source errors and stale data

One unavailable calendar/list:

- show restrained source-specific notice;
- keep healthy sources working;
- do not fabricate content;
- do not silently show stale data as current.

Full HA outage:

- overall Agenda unavailable state;
- cached remote events/tasks are not shown as current.

Empty healthy source is distinct from unavailable source.

## Refresh strategy

No periodic HA polling.

Calendar:

- `calendar/event/subscribe` range subscriptions;
- identical range subscriptions may be shared/ref-counted;
- rebuild only for changed ranges/config, reconnect or HA-local day rollover;
- stale callbacks ignored via generation/source guards.

Tasks:

- one `todo/item/subscribe` per configured list;
- semantic no-change suppression;
- reconnect rebuilds current subscriptions.

Local timers only for next meaningful UI boundary:

- event start/end;
- advance-notice threshold;
- HA-local midnight;
- Undo expiry.

## Widget interaction

Logical areas:

- header/mode/day controls;
- optional advance notices;
- internally scrollable Agenda content;
- transient feedback/Undo.

Calendar row tap → event detail overlay.

Task row:

- dedicated completion control;
- rest of row → task detail/edit overlay.

Shared Overlay Service owns the overlay layer.

## Accessibility

- real interactive completion control;
- keyboard-operable event/task rows;
- previous/next day controls in addition to swipe;
- no meaning conveyed by color alone;
- meaningful accessible labels;
- Reduced Motion respected.

## Semantic icons

No inline SVG special path.

Expected candidates, only if actually needed:

- `home.calendar`
- `home.task`
- `home.birthday`
- `home.waste`
- `home.recycling`
- `home.paper`

Use existing local icon registry/Tabler attribution contract.

## Test expectations

Calendar provider:

- range validation/sharing;
- HA timezone + DST;
- malformed/all-day normalization;
- source-specific failures;
- reconnect/stale callback guards;
- cleanup/no polling.

Task provider:

- initial/live streams;
- UID/due/description/status normalization;
- feature flags;
- source failure isolation;
- no-change suppression;
- cleanup/no polling.

Task action:

- validation;
- feature checks;
- UID-based update;
- rename/status/due/description + clear operations;
- normalized action results.

Widget:

- parallel independent instances;
- all modes;
- Today/history/multi-day/all-day;
- dedupe/provenance;
- task ordering/carry-forward;
- completion/Undo/editing;
- advance notices;
- source errors vs empty;
- fixed/auto sizing;
- swipe direction locking;
- overlay ownership;
- accessibility/cleanup.

Architecture gates:

- no raw HA in widget;
- no Config Service/Router/Health/Registry/Loader coupling;
- all task mutation via `task.update`;
- no r11 coupling;
- provider-owned subscriptions;
- no Agenda-specific Core behavior.

## Gate

Conversational design is complete.

Next steps:

1. user reviews and approves the written spec candidate;
2. create detailed implementation plan under `docs/superpowers/plans/`;
3. user approves plan;
4. implement on isolated branch with TDD;
5. whole-branch review + CI before merge.
