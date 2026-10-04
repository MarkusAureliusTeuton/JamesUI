# JamesUI 1.0 – Block 11 Planning Notes

_Date: 2026-10-04_
_Status: active design notes; not yet the approved Block-11 spec or implementation plan_

This file is the persistent planning record for decisions made while designing Block 11. It exists so confirmed behavior and explicitly deferred requirements are not lost between chats. Once the Block-11 design is approved, these notes must be reconciled into the formal spec and the detailed implementation plan.

## Persistent chat / AI working rules

This file is also the persistent Block-11 handover for future JamesUI chats.

Every future chat that continues Block 11 must:

- read this file before proposing, changing or implementing Block-11 behavior
- treat the repository as source of truth; do not rely on memory or old chat summaries when the repository contains the current decision
- add newly confirmed Block-11 product decisions to this file during the design phase so they survive chat changes
- add explicitly deferred or later-phase requirements to this file instead of leaving them only in chat
- keep this file updated when a decision is changed or superseded; do not leave contradictory active requirements behind
- reconcile these notes into the formal Block-11 spec before implementation planning, then into the implementation plan where execution detail belongs
- not use this planning note as authorization to write Block-11 product code before the required spec/plan gates are approved

AI/agent work on JamesUI must additionally preserve the project rules already established in the canonical repository documents:

- German, concise, technical and direct communication
- every JamesUI response starts with `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:` and ends with a short summary
- work one roadmap block at a time
- inspect current repository state before changing code or architecture
- edit the repository directly when GitHub access is available instead of giving the user unnecessary copy/paste work
- use TDD for behavior changes; intentionally red tests never go to `main`
- do not add monkey-patches, Prototype overrides, version-polish layers, parallel implementations or permanent legacy compatibility shims
- keep r11 as production/reference only until the controlled cutover; new normal functionality belongs to the JamesUI 1.0 architecture
- do not invent unavailable backend data or silently substitute fabricated values
- preserve OnePlus Pad 2 portrait as the primary visual target; Fully is only the kiosk shell
- record future-facing decisions and AI handling rules in the repository rather than depending on chat memory

If these working rules later change, update this section in the same repository commit that changes the rule wherever practical.

## Scope direction

Block 11 is expanding from the original calendar-only wording to a combined household agenda:

- `provider.calendar` for configured Home Assistant `calendar.*` sources
- `provider.tasks` for configured Home Assistant `todo.*` sources
- `widget.calendar-agenda` consuming capabilities only
- no raw Home Assistant access from the widget
- no final Start composition or production cutover in Block 11

Only explicitly configured calendar/task sources are shown. No automatic inclusion of every discovered calendar.

## Agenda presentation

Three presentation modes must be supported by widget configuration:

- `grouped` – grouped by day (`Heute`, `Morgen`, then date), with events and tasks within the day
- `timeline` – one chronological agenda presentation across the configured look-ahead window
- `day` – one selected day at a time; horizontal touch swipe moves to the previous/next day while vertical touch scrolling remains available within the selected day when more rows exist than fit in the viewport

The user can switch between these modes later in configuration. Provider contracts/data stay identical; only widget presentation/navigation changes.

The `day` mode must keep gesture directions semantically distinct:

- horizontal swipe = previous/next calendar day
- vertical swipe/scroll = additional agenda entries within the currently selected day
- switching days must not change row geometry or silently alter task-ordering rules
- the selected day uses a compact, restrained header; for today the form is `Heute · So, 4. Oktober`, while other days use the weekday/date form such as `Mo, 5. Oktober`
- the day header updates together with the horizontal day swipe so the currently selected day is always explicit
- every calendar day remains reachable in sequence, including days with no calendar events or tasks; the widget must not skip automatically to the next occupied day
- an empty selected day shows a quiet empty state such as `Keine Termine oder Aufgaben` while preserving the normal day header and navigation behavior

## Visibility and look-ahead

Visible row count and source look-ahead are separate concerns:

- global calendar `lookahead_days` defaults to **30 days**
- calendar `lookahead_days` controls how far future calendar events are loaded/made available for scrolling/day paging
- every configured calendar inherits the global 30-day value by default
- each configured calendar can optionally enable its own look-ahead override and then supply its own `lookahead_days` value
- when the per-calendar override is disabled, the local value has no effect and the calendar follows the global value
- the configuration UI must make this dependency clear: the local calendar look-ahead control remains disabled/greyed until the override is enabled
- task lists do not need a practical look-ahead limit; tasks remain available independent of calendar look-ahead
- for schema/config consistency, task sources may still expose `lookahead_days`, but its default and normal value is `0`
- for `todo.*`, `lookahead_days = 0` means **no look-ahead restriction / not applicable**, never “show zero tasks”
- task look-ahead controls should not clutter the normal configuration UI unless a future source genuinely requires them

The global/default calendar look-ahead applies consistently to `grouped`, `timeline` and `day` modes. Changing the presentation mode must not silently change provider query range.

### Visible-row modes, auto sizing and bounded height

The agenda supports two visible-row modes:

- `fixed` – a configured number of rows is shown in the widget viewport
- `auto` – the widget derives the number of fully visible rows from the vertical space actually allocated to it by the page layout

For `fixed` mode:

- default `max_visible_items = 5`
- allowed range is `3–8`
- events and tasks count together toward this visible item budget

For `auto` mode:

- the agenda uses as many complete fixed-height rows as fit below its own header/controls inside the allocated widget height
- no row may be compressed or partially clipped merely to squeeze in another item
- the fixed `max_visible_items` control is irrelevant and must remain visible but disabled/greyed in configuration
- items beyond the calculated visible capacity remain reachable through the widget's internal vertical touch scrolling/swiping
- recalculation follows a genuine change in the widget's allocated layout height; it must not resize the parent page to make more content fit

The agenda widget must be height-constrained by its host/layout. It must never force the Start page to become taller merely because more agenda items exist.

The user must later be able to set a manual maximum widget height through the Start page's shared layout-grid system rather than by entering arbitrary pixel values. The agenda's `auto` mode then fills the usable portion of that configured grid height with the maximum number of complete rows.

This creates a deliberate responsibility split:

- Block 11 defines a widget that behaves correctly inside a bounded height, including internal scrolling and automatic row-capacity calculation
- Block 14 defines/configures the shared Start-page height grid, widget grid spans/max-heights and the composed non-scrollable tablet viewport

The final OnePlus/Fully Start page is intended to fit inside the available tablet viewport without page-level vertical scrolling. Widgets therefore may not visually or logically extend below their allocated layout area. Internal widget scrolling is allowed where the widget's content exceeds its allocated height.

### Row geometry and density

- agenda rows have a consistent fixed height within the selected presentation configuration
- time/date and icon areas have stable reserved geometry
- task completion control has stable reserved geometry where applicable
- the remaining horizontal space belongs to the title
- long titles are truncated cleanly with ellipsis; font size is not reduced to make them fit
- additional items remain reachable through vertical touch scrolling/swiping
- the widget must not compress rows or grow unpredictably because many items exist

### Timeline continuation instead of navigation arrows

The agenda uses the vertical point-and-line timeline language from the approved mockup as both structure and continuation cue.

For each displayed day:

- visible agenda entries sit on the vertical timeline as points connected by a line
- when no earlier item for that day exists outside the visible portion, the timeline may terminate normally at the first visible point
- when earlier items for that day exist above the current visible portion, the timeline continues upward beyond the first visible point as a short dashed line rather than terminating with a point
- when no later item for that day exists outside the visible portion, the timeline may terminate normally at the last visible point
- when later items for that day exist below the current visible portion, the timeline continues downward beyond the last visible point as a short dashed line rather than terminating with a point
- this dashed continuation is a visual indication that more entries exist before/after within that day
- separate up/down navigation arrows are therefore not required for normal agenda navigation
- vertical touch scrolling/swiping is the primary within-day navigation mechanism

In `day` mode the dashed continuation continues to represent hidden entries within the current day; horizontal day navigation is conveyed by the swipe interaction rather than by adding permanent arrow controls.

The continuation treatment must remain visually restrained and must not change row height or timeline alignment.

## Task ordering

Task ordering is global across `grouped`, `timeline` and `day` presentation modes.

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
- allowed bounds for calendar look-ahead around the confirmed 30-day default
- exact Start-page height-grid definition / grid unit count and how widget max-height spans are configured in Block 14
- exact minimum usable widget height when `auto` mode cannot fit the normal number of agenda rows
- precise visual dimensions/style of dashed timeline continuation cues
- exact `day`-mode swipe threshold/snap behavior
- task detail-overlay fields beyond currently available source data
- task-editing phase/block placement
- reminder metadata feasibility and fallback strategy
- whether new semantic icons are required in the shared icon registry for categories such as birthday, waste, recycling, paper, etc.

## Gate

No Block-11 product code should be written from this note alone. Remaining design questions must be resolved, then the approved decisions are written into the formal Block-11 spec. Only after spec approval is the detailed implementation plan created and approved.
