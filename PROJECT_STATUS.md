# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-05_

This file is the persistent **single source of truth for the current execution state**. Architecture details live in approved specs, retained behavior in the baseline, and block-specific implementation detail in plans/tests.

## 1. Product goal

JamesUI is the permanent wall-tablet interface for the KNX/Home Assistant home.

Primary target:
- OnePlus Pad 2 portrait, normally through Fully
- fixed navigation `Start | Haus | Klima | Medien | Tür`
- important household information visible at a glance
- fast controls plus deeper pages when needed
- Alpine-Chic / premium architectural design rather than generic Lovelace/card styling

Home Assistant is the backend/source of truth; KNX remains the primary building-automation layer. Fully is the kiosk shell only.

## 2. Binding architecture

**Variant B – clean JamesUI 1.0 foundation + controlled cutover.**

The new modular runtime is built in parallel. r11 remains the running design/reference implementation until the cutover gate. New functionality belongs on the 1.0 architecture. After cutover, obsolete runtime code is deleted; Git history is the archive.

Canonical documents:
- Foundation spec: `docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`
- Roadmap: `docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`
- Baseline: `docs/JAMESUI_1_0_BASELINE.md`
- Fresh-chat handover: `docs/JAMESUI_1_0_NEXT_CHAT.md`
- Cross-block layout rules: `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`
- Block 11 spec: `docs/superpowers/specs/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda-design.md`
- Block 11 plan: `docs/superpowers/plans/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda.md`

## 3. Current formal state

- Block 0 – Baseline and preservation tests: ✅
- Block 1 – Core shell: ✅ PR #13
- Block 2 – Module manifest/registry/loader: ✅ PR #14
- Block 3 – Capability Registry + Action Registry: ✅ PR #15
- Block 4 – Home Assistant Adapter: ✅ PR #16
- Block 5 – Versioned Config Store + migrations: ✅ PR #17
- Block 6 – Design System + base components: ✅ PR #18
- Block 7 – Icon Library + Asset Registry: ✅ PR #19
- Block 8 – `layout.home-hero-deck`: ✅ PR #20
- Block 9 – Weather provider: ✅ PR #21
- Block 10 – Weather Today widget + forecast overlay: ✅ PR #22
- Block 11 – Calendar/task providers + Agenda widget: ✅ PR #23
- Block 12 – House capability providers + House Quick widget: ⬜ not started

Block 11 merge commit: `63e0b8dc6072eed885f591161180f7082f6f7f2c`.

Block 11 verification evidence:
- final unchanged feature head: `4f9c6959f15a5eb1e21ab38d6c30cc913219626d`
- final branch validation: run `37284834614` – success
- merge/main validation: run `37285828629` – success
- whole-branch review found one Important lifecycle issue in `action.task-update`: registry rebinding could lose the old registration if the new registry rejected registration
- that issue was fixed atomically and is permanently covered by `tests/jamesui-task-update-review-regressions.test.js`
- permanent Block-11 integration and architecture gates are active
- no open Critical/Important review findings remain
- no open pull requests remain after PR #23 merge

**Next formal gate:** Block 12 – House capability providers + House Quick widget. Inspect retained r11 house/status behavior and current HA/KNX-facing data before defining provider/widget contracts. Do not fold Dynamic Buttons, final Start composition or cutover into Block 12.

## 4. Platform completed through Block 11

### Core and module contract

Module types: `layout`, `widget`, `provider`, `action`.

Lifecycle:
- `create(context, config)`
- `mount(target)`
- `update(nextContext, nextConfig)`
- `destroy()`

Context:
- layout/widget: `events`, `overlays`, `capabilities`, `actions`, `module`
- provider/action: same five plus `homeAssistant`
- no normal module receives raw `hass`, Router, Health, Config Service, Design System, Module Registry or Module Loader

Core owns routing, persistent navigation, Event Bus, Overlay Service, Health Service, Module Registry/Loader, Capability Registry, Action Registry, HA Adapter and Config Service references. Domain behavior stays outside Core.

### Actions and Home Assistant boundary

Registered semantic/generic actions now include:
- `navigate`
- `url.open`
- `entity.toggle`
- `ha.service`
- `scene.activate`
- `task.update`

Calendar/task widgets never call Todo services directly. `task.update` owns Todo mutation translation and feature validation.

### Structured configuration

Canonical persistence remains one Home Assistant `.storage` Store:
- key `jamesui.config`
- schema version `1`
- atomic writes
- top-level sections: `pages`, `layouts`, `widget_instances`, `dynamic_buttons`, `data_sources`, `module_settings`

Device-local display calibration remains browser-local under `jamesui-display-calibration`.

## 5. Visual foundation

### Design System

Boundary: `custom_components/jamesui/frontend/design/`

- frozen 62-token `--jui-*` contract
- shared Surface/Button/Overlay/Dialog primitives
- root-scoped CSS only
- reduced-motion support
- no `!important`, data-image hacks, direct HA access or scattered palette constants

### Icon system

Boundary: `custom_components/jamesui/frontend/icons/`

- exactly **46** semantic IDs after Block 11
- original 40 IDs preserved
- Block 11 adds `home.calendar`, `home.task`, `home.birthday`, `home.waste`, `home.recycling`, `home.paper`
- Tabler Icons v3.48.0 pinned source/style baseline with checked-in MIT attribution
- SVG DOM creation only through `createElementNS()`
- no runtime npm/CDN/fetch/icon-font/SVG-string dependency

## 6. Start foundation already rebuilt

### Block 8 – `layout.home-hero-deck`

Stable slots:
- `hero`
- `widget-left`
- `widget-right-main`
- `widget-right-footer`

The layout provides structure only. Final Start composition/grid sizing remains Block 14.

### Blocks 9–10 – Weather

`provider.weather` exposes:
- `weather.current`
- `weather.daily`
- `weather.hourly`
- `weather.sun`
- `weather.moon`
- `weather.atmosphere`

`widget.weather-today` consumes only those capabilities, owns the Alpine/weather presentation and forecast overlay, and has no raw HA access.

No deterministic screenshot harness exists yet; composed OnePlus Pad 2 / Fully screenshot acceptance remains mandatory at Block 14 / pre-cutover.

## 7. Block 11 – Calendar, Tasks and Agenda

Boundaries:
- `custom_components/jamesui/frontend/modules/provider.calendar/`
- `custom_components/jamesui/frontend/modules/provider.tasks/`
- `custom_components/jamesui/frontend/modules/action.task-update/`
- `custom_components/jamesui/frontend/modules/widget.calendar-agenda/`
- shared time/Todo helpers under `frontend/shared/`

Delivered:
- explicit configured `calendar.*` sources through `calendar.events`
- range-based calendar subscriptions with HA-timezone/DST-safe boundaries, sharing/ref-counting, source failure isolation and stale-callback guards
- explicit configured `todo.*` sources through live `tasks.items` snapshots
- semantic Todo feature handling and UID-based task identity
- dedicated `task.update` action with safe rename/status/due/description updates and clear operations
- Agenda modes `grouped`, `timeline`, `day`
- Today/history semantics, all-day and timed multi-day projection, duplicate collapse with provenance
- task ordering, overdue carry-forward, direct completion, exact 5 s Undo and source-supported task editing
- JamesUI-owned advance notices with local instance-scoped dismissal persistence
- fixed/auto complete-row sizing, internal overflow, `too_small` handling and day swipe/navigation
- source-specific unavailable vs healthy-empty states
- instance-safe widget implementation proven by direct parallel-instance tests
- generic multi-instance Loader/page orchestration intentionally remains Block 14

No Calendar mutation, task create/delete/move/reorder, source reminder import, House Quick, Dynamic Buttons, final Start composition or production cutover was added.

## 8. Production/reference runtime

Repository: `MarkusAureliusTeuton/JamesUI`
Default branch: `main`
Integration version: `0.5.1`
Frontend revision: `0.5.1-r11`

**r11 is still production/reference.** `jamesui-entry.js` still loads the old production bridge. The new modular runtime is intentionally not wired into production yet. No cutover has occurred.

The retained baseline therefore remains valid and did not require a Block-11 change.

## 9. Start direction to preserve/rebuild

- persistent bottom nav `Start | Haus | Klima | Medien | Tür`
- Alpine/weather hero
- weekday/date + large time
- current temperature/weather plus truthful weather facts
- one lower dark/translucent deck extending to navigation
- Agenda left
- House Quick right/main
- four Dynamic Buttons right/footer
- never fake unavailable backend data

Cross-page page-scroll/grid/widget-instance rules remain binding in `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`.

## 10. Development rules

1. Repository is source of truth.
2. One roadmap block at a time.
3. Design/spec where domain/architecture requires it, then detailed implementation plan before product code.
4. Isolated implementation branch.
5. TDD for behavior changes; intentionally red tests never go to `main`.
6. Keep draft PRs from generating intentional-red CI noise; trigger full CI only at meaningful green checkpoints.
7. Whole-branch review and fresh unchanged-head validation before merge.
8. Verify main CI after merge before completion claims.
9. Update status/roadmap/handover after merged work.
10. No monkey-patches, Prototype overrides, version-polish layers, duplicate implementations or permanent legacy shims.
11. OnePlus/Fully portrait screenshot acceptance is required at major composed-UI milestones; do not claim it without a deterministic or explicit visual run.
12. Keep GitHub/tool traffic compact: inspect targeted files/steps rather than repeatedly streaming full logs.

## 11. Next action

Start **Block 12 – House capability providers + House Quick widget**.

First inspect current repository contracts and retained r11 house/status behavior. Define truthful house-state capability boundaries and quick-action ownership before product code. Preserve the existing Block-14 ownership of final Start composition/grid and the Block-13 ownership of Dynamic Buttons.
