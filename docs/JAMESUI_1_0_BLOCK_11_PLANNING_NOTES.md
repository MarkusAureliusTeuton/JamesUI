# JamesUI 1.0 – Block 11 Planning Notes

_Date: 2026-10-04_
_Status: active design notes; not yet the approved Block-11 spec or implementation plan_

This file is the persistent planning record for decisions made while designing Block 11. It exists so confirmed behavior and explicitly deferred requirements are not lost between chats. Once the Block-11 design is approved, these notes must be reconciled into the formal spec and the detailed implementation plan.

## Scope direction

Block 11 is expanding from the original calendar-only wording to a combined household agenda:

- `provider.calendar` for configured Home Assistant `calendar.*` sources
- `provider.tasks` for configured Home Assistant `todo.*` sources
- `widget.calendar-agenda` consuming capabilities only
- no raw Home Assistant access from the widget
- no final Start composition or production cutover in Block 11

Only explicitly configured calendar/task sources are shown. No automatic inclusion of every discovered calendar.

## Agenda presentation

Two presentation modes must be supported by widget configuration:

- `grouped` – grouped by day (`Heute`, `Morgen`, then date), with events and tasks within the day
- `timeline` – one chronological agenda presentation

The user can switch between these modes later in configuration. Provider contracts/data stay identical; only widget presentation changes.

### Row geometry and density

- agenda rows have a consistent fixed height within the selected presentation configuration
- time/date and icon areas have stable reserved geometry
- task completion control has stable reserved geometry where applicable
- the remaining horizontal space belongs to the title
- long titles are truncated cleanly with ellipsis; font size is not reduced to make them fit
- `max_visible_items` / visible row count is configurable
- events and tasks count together toward the visible item budget
- additional items must remain reachable by a simple tablet gesture/scroll and also by a simple explicit navigation control where useful
- the widget must not compress rows or grow unpredictably because many items exist

The exact default visible row count and final gesture/button mechanics remain to be chosen during the remaining design/visual acceptance work.

## Task ordering

Task ordering is global across both `grouped` and `timeline` presentation modes.

Supported modes:

- `chronological` – timed tasks participate in chronological ordering with calendar events
- `tasks_before` – all tasks for the day are grouped before calendar events
- `tasks_after` – all tasks for the day are grouped after calendar events

For `chronological`, untimed tasks additionally support:

- `untimed_task_position = before`
- `untimed_task_position = after`

If `tasks_before` or `tasks_after` is selected, `untimed_task_position` has no effect and must be visibly disabled/greyed in configuration rather than silently remaining active.

This dependency-aware configuration rule is general: when one choice makes another setting meaningless, the irrelevant setting remains understandable but disabled.

## Task completion and overdue behavior

- completed tasks disappear from the normal agenda
- task completion is available directly from the row
- completing a task offers a short-lived Undo action
- tapping the remainder of the task row opens a task detail view
- overdue incomplete tasks are carried forward into JamesUI's `Heute` presentation until completed
- this carry-forward is presentation logic only: JamesUI does **not** rewrite the task's real source due date and does not alter recurrence/source semantics
- overdue tasks are visually shown like ordinary current tasks; no warning color, badge, `seit X Tagen`, or other overdue emphasis is added

## Calendar event row and details

A calendar event row reserves stable geometry for time/date and icon. The rest of the width is used for the title.

`show_location` is a global widget option:

- when disabled, the compact agenda row shows no location
- when enabled, a second line is reserved consistently for location
- the location text is rendered only when the event actually contains a location
- missing location is not replaced with placeholder text

Tapping a calendar event opens a detail overlay. It shows only fields that really exist, including as applicable:

- title
- date/time or all-day information
- location
- description

## Calendar icon and accent rules

Each configured calendar can define a default presentation:

- default icon
- default accent color

Specific event rules can override both icon and accent color. This supports use cases such as a waste-collection calendar where `Gelber Sack` is shown with a suitable waste/recycling icon and a yellow accent.

Rule matching supports simple user-facing predicates:

- `ist genau`
- `enthält`
- `beginnt mit`

Rules are ordered; the first matching rule wins.

Search fields:

- event title is searched by default
- description can optionally be included per rule
- location can optionally be included per rule

No regex input is required for normal configuration.

Presentation priority:

1. first matching event/keyword rule: icon and/or accent color
2. calendar default icon/accent color
3. neutral JamesUI calendar fallback

Accent color is used restrainedly (for example icon/marker/fine accent), not as a full brightly colored card, to preserve the quiet Alpine-Chic visual language.

## Deferred but binding future requirements

The following items are explicitly important and must not be forgotten even if they are not fully implemented in the first Block-11 delivery.

### Calendar reminder / advance-notice semantics

The user considers source-event reminder lead time important. Example: if an event is configured to remind one week in advance, the agenda should ideally surface the relevant information early enough rather than only on the event day.

Current design rule:

- do not fabricate reminder metadata when Home Assistant does not expose it
- investigate whether the selected calendar integration/source exposes reminder/alarm metadata through any supported Home Assistant API
- preserve the capability/data model so truthful reminder metadata can be added later without redesigning the widget
- if direct reminder metadata remains unavailable, evaluate a JamesUI-owned configurable look-ahead/advance-visibility policy as an explicit fallback product feature, not as a fake source reminder

This requirement remains OPEN and high priority for later design/research.

### Task editing

The user wants tasks to be editable from JamesUI later.

The first Block-11 interaction may remain limited to display, completion and Undo, but the normalized task model must preserve enough identity/source information for later editing, including as available:

- source todo entity/list
- stable task UID
- title
- due date/time
- description/notes
- status
- other truthful provider fields needed to update the original task

Future editing should use the provider/HA boundary rather than direct Home Assistant access from the widget.

## Still open in the current design

- exact capability names/shapes for calendar and task providers
- exact Home Assistant query/subscription strategy and refresh semantics
- final date/look-ahead window defaults
- whether look-ahead can be overridden per calendar
- exact visible-row default and bounds
- exact scroll/swipe plus explicit navigation-control behavior
- task detail-overlay fields beyond currently available source data
- task-editing phase/block placement
- reminder metadata feasibility and fallback strategy
- whether new semantic icons are required in the shared icon registry for categories such as birthday, waste, recycling, paper, etc.

## Gate

No Block-11 product code should be written from this note alone. Remaining design questions must be resolved, then the approved decisions are written into the formal Block-11 spec. Only after spec approval is the detailed implementation plan created and approved.
