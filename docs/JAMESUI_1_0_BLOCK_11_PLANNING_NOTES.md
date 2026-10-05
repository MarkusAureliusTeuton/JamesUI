# JamesUI 1.0 – Block 11 Planning Notes

_Date: 2026-10-05_
_Status: completed, approved, implemented and merged_

This file is retained as the **historical planning record** for Block 11. It is no longer the active source of implementation truth.

Binding final documents:
- Spec: `docs/superpowers/specs/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda-design.md`
- Plan: `docs/superpowers/plans/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda.md`
- Merged implementation/tests on `main`

Result:
- PR #23
- final unchanged feature head: `4f9c6959f15a5eb1e21ab38d6c30cc913219626d`
- merge commit: `63e0b8dc6072eed885f591161180f7082f6f7f2c`
- final branch validation `37284834614`: success
- merged-main validation `37285828629`: success

Whole-branch review found one Important `task.update` registry-rebinding lifecycle issue. It was fixed before merge and is permanently covered by `tests/jamesui-task-update-review-regressions.test.js`. No Critical/Important findings remain.

## Final delivered scope

Block 11 delivered:
- `provider.calendar`
- `provider.tasks`
- semantic `action.task-update`
- `widget.calendar-agenda`
- shared zoned-time and Todo-feature helpers
- six new Agenda semantic icons

The final contracts include:
- only explicitly configured `calendar.*` and `todo.*` sources
- range-based `calendar.events` with validated HA timezone/DST semantics
- live normalized `tasks.items` snapshots
- `task.update` using source entity + stable UID + minimal patch
- `grouped`, `timeline`, `day` Agenda modes
- Today/history semantics, all-day and timed multi-day projection
- duplicate collapse with provenance
- task ordering, overdue carry-forward, direct completion and exact 5 s Undo
- source-supported task editing
- JamesUI-owned advance notices with device/instance-local dismissal persistence
- calendar/task source-specific unavailable handling without stale-data fabrication
- fixed/auto complete-row host-aware sizing and internal overflow
- swipe plus accessible previous/next day controls
- independent direct Agenda instances

Out of scope remained:
- task create/delete/move/reorder
- calendar event mutation
- source reminder/alarm import
- House Quick
- Dynamic Buttons
- generic Loader/page multi-instance orchestration
- final Start grid/composition
- production cutover

## Architectural decisions retained

### Calendar

`calendar.events` is a read-only range service rather than one giant shared event snapshot. Provider-owned subscriptions are keyed by source/range, may be shared/ref-counted and use generation guards so stale callbacks cannot republish old data.

### Tasks

`tasks.items` is a live normalized capability snapshot built from Todo streams. Source identity and UID remain preserved.

### Mutations

Agenda never calls `todo.update_item` or generic HA services directly. All task edits/completion/reopen operations go through `task.update`, which validates actual Todo feature support.

### Time

All Agenda domain date/day calculations use validated Home Assistant timezone metadata. Browser timezone is not a silent fallback. DST gap/ambiguity behavior is centralized in the shared zoned-time helper.

### Layout ownership

Agenda reacts to host allocation; it does not own page scrolling and does not force its parent to grow. Cross-page layout rules remain in `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`.

Generic configured multi-instance placement/orchestration remains a Block-14 responsibility even though the widget implementation itself is already instance-safe.

## Historical product decisions now implemented

The approved design/plan contain the exact details. Key outcomes:
- calendar lookahead default 30 days, allowed 1–365; day lookback default 7, allowed 0–365
- `visible_items_mode = fixed | auto`; fixed default 5 and allowed 3–8
- no partial rows; insufficient host allocation becomes `too_small`
- `show_all_day = true` default
- optional stable second location line
- `chronological | tasks_before | tasks_after` task ordering; untimed default `after`
- overdue incomplete tasks also appear Today without changing true due date or adding warning styling
- completed tasks disappear with exact 5 s status-only Undo
- calendar presentation rules use ordered exact/contains/starts-with matching and restrained icon/accent overrides
- advance notices are JamesUI-owned, max two collapsed, expandable in-widget and do not fabricate source reminder metadata
- source failures remain distinct from healthy empty states
- no periodic HA polling

## Closure

Block 11 is closed. Do not reopen this planning note as a live backlog for unrelated later work.

New Start-layout/multi-instance configuration decisions belong to Block 14 / `JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`. House Quick work belongs to Block 12. Dynamic Buttons belong to Block 13. Any later change to Calendar/Tasks/Agenda should be treated as a new scoped change with its own current design/test evidence rather than silently editing the historical Block-11 record.
