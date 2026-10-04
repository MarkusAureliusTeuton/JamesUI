# JamesUI 1.0 – Block 11 Planning Notes

_Date: 2026-10-04_
_Status: active design notes; not yet the approved Block-11 spec or implementation plan_

This file is the persistent planning record for confirmed Block-11 decisions and explicitly deferred requirements. Future Block-11 chats must read and update it. Cross-page layout rules live in `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md` and must also be read when sizing/scroll behavior is involved.

## Persistent chat / AI working rules

Every future chat that continues Block 11 must:

- read this file before proposing, changing or implementing Block-11 behavior
- treat the repository as source of truth, not chat memory
- add newly confirmed Block-11 decisions here during design
- add explicitly deferred requirements here instead of leaving them only in chat
- update/remove superseded wording rather than keeping contradictory active requirements
- reconcile these notes into the formal Block-11 spec before implementation planning
- not use this planning note as permission to write product code before spec/plan approval

JamesUI AI/agent work must preserve the project rules already established in the canonical repository documents:

- German, concise, technical and direct communication
- every JamesUI response starts with `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:` and ends with a short summary
- work one roadmap block at a time
- inspect current repository state before changing code or architecture
- edit the repository directly when GitHub access is available
- use TDD for behavior changes; intentionally red tests never go to `main`
- no monkey-patches, Prototype overrides, version-polish layers, parallel implementations or permanent legacy compatibility shims
- r11 remains production/reference until controlled cutover
- do not invent unavailable backend data or silently substitute fabricated values
- OnePlus Pad 2 portrait remains the primary visual target; Fully is only the kiosk shell
- future-facing product and AI-handling decisions must be persisted in the repository

## Scope direction

Block 11 is a combined household agenda, not calendar-only:

- `provider.calendar` for explicitly configured Home Assistant `calendar.*` sources
- `provider.tasks` for explicitly configured Home Assistant `todo.*` sources
- `widget.calendar-agenda` consuming capabilities only
- no raw Home Assistant access from the widget
- no final Start composition or production cutover in Block 11

No automatic inclusion of every discovered calendar/task list as visible content.

## Agenda presentation

Three presentation modes must be configurable:

- `grouped` – grouped by day (`Heute`, `Morgen`, then date), events and tasks combined inside each day
- `timeline` – one chronological agenda presentation across the configured look-ahead window
- `day` – exactly one selected calendar day at a time

Provider data/contracts stay identical; presentation mode changes only widget rendering/navigation.

### `day` mode

- horizontal swipe = previous/next calendar day
- vertical swipe/scroll = additional entries inside the selected day
- every calendar day remains reachable in sequence; empty days are not skipped
- today header format: `Heute · So, 4. Oktober`
- other days: e.g. `Mo, 5. Oktober`
- empty day: quiet state such as `Keine Termine oder Aufgaben`
- changing days must not change row geometry or task-ordering rules

## Visibility and look-ahead

Calendar and widget density are separate concerns.

### Calendar look-ahead

- global `lookahead_days` default = **30**
- applies consistently to `grouped`, `timeline` and `day`
- each configured calendar inherits the global value by default
- each calendar may optionally enable its own `lookahead_days` override
- local override field remains visible but disabled/greyed until override is enabled

### Task look-ahead

Tasks do not need a practical look-ahead restriction.

- for schema consistency, task sources may expose `lookahead_days`
- default/normal task value = `0`
- for `todo.*`, `0` means **no look-ahead restriction / not applicable**, never “show zero tasks”
- this control should not clutter normal task configuration unless a future source requires it

## Visible-row modes and host sizing

The Agenda supports:

- `visible_items_mode = fixed`
- `visible_items_mode = auto`

### `fixed`

- default `max_visible_items = 5`
- allowed range `3–8`
- events and tasks count together toward the visible-row budget

### `auto`

- use as many complete fixed-height rows as fit below the widget header/controls inside the **height actually allocated by the host layout**
- do not compress row height or show a partial row to squeeze in another item
- `max_visible_items` remains visible but disabled/greyed because it is irrelevant in auto mode
- recalculate when the allocated host height genuinely changes
- additional items stay reachable through the widget's own vertical scrolling

### Layout responsibility

The Agenda does **not** decide whether the page itself is fixed or vertically scrollable. That belongs to the selected page layout; see `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`.

The Agenda must always respect the host region it receives:

- it may not enlarge its parent merely to expose more rows
- in a bounded/fixed layout, overflow stays inside the Agenda
- in a vertically scrollable layout, the layout may allocate a larger region, but the Agenda still obeys that allocation
- manual maximum height is expressed later through the host layout's logical grid/span system where that layout uses a grid, not through arbitrary widget pixel values

Block 11 therefore implements a height-aware widget contract; Block 14 formalizes the Start layout/configuration and its lower-deck grid.

## Row geometry

Rows remain visually stable:

- equal fixed row height
- stable time/date column
- stable icon area
- stable task-completion-control area where applicable
- title gets all remaining width (`minmax(0, 1fr)` behavior)
- long titles use ellipsis; font size does not shrink
- icon/accent selection must not alter geometry

### Optional location line

`show_location` is a global widget option.

- disabled: no compact location line
- enabled: reserve a consistent second-line region for rows so row heights do not jump
- render location only when the event actually has one
- never render fake placeholder text such as `Kein Ort`

## Timeline continuation / internal scrolling

The Agenda uses the mockup's vertical point-and-line timeline.

For each displayed day:

- visible entries use points connected by the vertical line
- if earlier entries for that day exist above the current visible portion, the line continues upward as a short dashed continuation instead of ending normally
- if later entries for that day exist below the current visible portion, the line continues downward as a short dashed continuation
- if no hidden entries exist in that direction, the timeline terminates normally
- no permanent up/down arrow controls are required
- vertical touch scrolling is the primary within-day/internal navigation
- dashed continuation must not change row height or timeline alignment

In `day` mode the dashed continuation refers only to hidden entries inside the current day; horizontal day navigation remains separate.

## Task ordering

Ordering is global across `grouped`, `timeline` and `day`.

Supported `task_order_mode` values:

- `chronological` – timed tasks mix chronologically with events
- `tasks_before` – all tasks of a day before calendar events
- `tasks_after` – all tasks of a day after calendar events

For `chronological` only:

- `untimed_task_position = before | after`
- default recommendation remains `after`

If `tasks_before` or `tasks_after` is active, `untimed_task_position` has no effect and must be shown disabled/greyed rather than silently active.

This dependency-aware configuration principle applies generally to later settings.

## Task completion and overdue behavior

- task completion is available directly from the row
- completed tasks disappear from the normal agenda immediately
- completing a task offers a short-lived Undo action
- tapping the rest of a task row opens a task detail view
- overdue incomplete tasks are carried forward into JamesUI's `Heute` presentation until completed
- carry-forward is presentation logic only: do not rewrite the real provider due date or recurrence
- overdue carried-forward tasks look like ordinary current tasks; no warning color, badge or `seit X Tagen`

## Task editing – deferred but binding

The user wants tasks editable from JamesUI later.

Block 11 may remain display + complete + Undo, but the normalized task model must preserve truthful edit identity/context as available:

- source todo entity/list
- stable task UID
- title
- due date/time
- description/notes
- status
- other provider fields required for future updates

Future editing must go through the provider/HA boundary, never direct raw HA access from the widget.

## Event details and all-day behavior

Tapping a calendar event opens a shared detail overlay showing only real available fields, such as:

- title
- date/time or all-day information
- location
- description

No fake/missing-field placeholders.

All-day behavior is confirmed:

- global `show_all_day` default = `true`
- all-day events are shown as normal agenda rows and count toward the visible-row budget
- the time area displays `Ganztägig`; no artificial clock time is invented
- `show_all_day = false` hides all-day calendar events globally from the Agenda
- no per-calendar all-day override is required in Block 11 unless a later real use case justifies it

## Calendar icon and accent rules

Each configured calendar can define:

- default icon
- default accent color

Ordered event rules may override icon and/or accent color.

Supported matching operators:

- `ist genau`
- `enthält`
- `beginnt mit`

Rules:

- first matching rule wins
- event title is searched by default
- description may optionally be included per rule
- location may optionally be included per rule
- no regex is required in normal UI
- rules should be reorderable

Presentation priority:

1. first matching event rule
2. calendar default icon/accent
3. neutral JamesUI fallback

Color remains restrained: icon/marker/fine accent only, not brightly colored full cards.

Example requirement: waste calendar can use a neutral trash/recycling default while rules such as `Gelber Sack`, `Biotonne`, `Restmüll`, `Papier` override icon/color appropriately.

The shared icon registry may need additional semantic IDs (birthday, waste, recycling, paper, etc.); this must be done through the existing icon system, never ad hoc inline icons.

## Calendar reminder / advance-notice semantics – OPEN and important

The user explicitly considers reminder lead time important. Example: an appointment intended to remind one week beforehand should ideally become visible/noticeable sufficiently early.

Current rule:

- never fabricate reminder metadata
- investigate supported Home Assistant/source APIs for real reminder/alarm metadata
- preserve provider/capability model so truthful reminder metadata can be added later without redesign
- if source reminder data is unavailable, evaluate an explicit JamesUI-owned advance-visibility/look-ahead feature as a separate product behavior, not as a fake source reminder

This remains a high-priority unresolved design item.

## Still open

- exact capability names/shapes for calendar and task providers
- exact Home Assistant calendar/todo query/subscription/refresh strategy
- allowed bounds around the confirmed 30-day calendar default
- exact minimum usable Agenda host height in `auto` mode
- exact dashed-continuation visual dimensions
- exact `day` swipe threshold/snap behavior
- exact task detail-overlay fields supported by HA source data
- future task-editing block placement
- reminder metadata feasibility/fallback
- exact semantic icon additions required
- exact within-day position of all-day events relative to timed events/tasks

## Gate

No Block-11 product code from these notes alone. Resolve remaining design questions, write the binding Block-11 spec, get approval, then write/approve the detailed implementation plan before TDD implementation.
