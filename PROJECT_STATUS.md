# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-09_

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
- Block 12 spec: `docs/superpowers/specs/2026-10-05-jamesui-1.0-block-12-house-capabilities-house-quick-design.md`
- Block 12 plan: `docs/superpowers/plans/2026-10-05-jamesui-1.0-block-12-house-capabilities-house-quick.md`
- Block 13 spec: `docs/superpowers/specs/2026-10-09-jamesui-1.0-block-13-dynamic-buttons-design.md`
- Block 13 plan: `docs/superpowers/plans/2026-10-09-jamesui-1.0-block-13-dynamic-buttons.md`

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
- Block 12 – House capability providers + House Quick widget: ✅ PR #25
- Block 13 – Dynamic Buttons module: ✅ PR #26

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

Block 12 merge commit: `04e6beb8614d69c1dbd397391d136b28b492aedc`.

Block 12 verification evidence:
- final unchanged feature head: `966569786771b194dcfc5caee30e9cd1ee73de29`
- final branch validation: run `37441731886` – success
- merge/main validation: run `37441814856` – success
- whole-branch review fixes preserved provider runtime on failed rebind and clarified critical House Quick status semantics
- permanent Block-12 integration, architecture and regression coverage is active
- no open Critical/Important review findings remain
- PR #25 is merged

Block 13 merge commit: `8342c7055327c0d1c19b894cf63f4cd54fdaf799`.

Block 13 verification evidence:
- final unchanged feature head: `ff0c15fa452a0511ff9df25a444b5444720945b0`
- final branch validation: run `37894875901` – success
- merge/main validation: run `37894938332` – success
- whole-branch review found and fixed one provider consistency issue before the final head: multiple normalized sources sharing one HA entity are published atomically as one coherent consumer snapshot
- permanent Block-13 config, provider, state-machine, loader and architecture coverage is active
- no open Critical/Important review findings remain
- PR #26 is merged

**Next formal gate:** Block 14 – Start configuration experience, final Start grid/composition and generic page/widget multi-instance orchestration. No production cutover yet.

## 4. Platform completed through Block 13

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

## 8. Block 12 – House capabilities and House Quick

Boundaries:
- `provider.house-heating` → `house.heatingZones`
- `provider.house-lighting` → `house.lights`, `house.ambientLights`
- `provider.house-devices` → `house.devices`
- `provider.house-energy` → `house.energy`
- `widget.house-quick` consumes only capabilities/actions

Delivered:
- explicit source assignment only; no runtime name heuristics or auto-discovery
- KNX-owned heating zones with actual temperature, target temperature, heating demand and auto-regulation state
- heating button activity driven by auto regulation, not heating demand
- disjoint normal/ambient lighting groups with `x von y an` aggregation
- normalized household-device activity/update/warning/fault/reachability aggregation
- update availability is informational; unreachable sources produce warning; faults are critical
- configurable energy buttons with independent source, trailing window and warning/critical thresholds
- provider-owned HA history queries with time-weighted averages, 60 s sliding refresh and stale-response protection
- shared status priority `critical > warning > active > neutral`
- arbitrary per-instance button subset/order plus multiple heating-zone and energy buttons
- semantic navigation through Action Registry only; House Quick performs no direct control
- direct multi-instance widget isolation; generic Loader/page instance orchestration remains Block 14

Windows/doors, ventilation, scenes, direct controls, detail pages, final Start composition and production cutover remain out of Block 12. Reusable Dynamic Buttons are delivered separately by Block 13.

## 9. Block 13 – Dynamic Buttons

Boundaries:
- `provider.control-state` → `control.states`
- `widget.dynamic-buttons` consumes only `control.states` plus Action Registry commands

Delivered:
- explicit one-signal control-state sources with entity-state or one-attribute mapping
- normalized `active | inactive | intermediate | unavailable` feedback with semantic intermediate details
- per-source revisions that advance only on meaningful normalized feedback changes, preventing pre-command state from acknowledging a new command
- shared/ref-counted HA subscriptions through the existing HA Adapter, including coherent publication when multiple configured sources share one HA entity
- reusable central Dynamic Button definitions with required stable name, optional semantic icon and generic Action Registry payloads
- exactly two interaction modes: stateful `toggle` and stateless `trigger`
- toggle command direction from real terminal feedback only; Action Registry success never fabricates target state
- pending resolution by newer real target feedback, immediate failure on wrong terminal/unavailable feedback, intermediate-state continuation and configurable timeout (default 5 s)
- trigger pending, approximately 650 ms success feedback and transient error feedback
- real state shared across widget instances while pending/success/error feedback remains local to the pressed occurrence
- unavailable/external-intermediate toggles are non-actionable
- `compact | normal | wide` per-use size classes without hard-coded final Start spans or button count
- no built-in widget header and no Block-14 drag/grid editor behavior
- permanent Block-13 architecture, loader and CI gate

Final grid coordinates/spans, Android-like placement/reflow, generic Config-Store-to-instance orchestration and composed OnePlus/Fully acceptance remain Block 14.

## Approved roadmap change (2026-10-09)

**New execution sequence:** Block **14 → 19 → 20 → 21 → 15 → 16 → 17 → 18**. The user approved an early clean 1.0 cutover after the finished Start dashboard instead of waiting for all secondary-page migrations. Blocks 19–21 validate and deliver a deliberately reduced but fully honest and usable Start-first release; no fake or dead secondary routes. Retain a documented rollback until the new production path is proven; remove the r11 runtime in Block 21 rather than retaining a permanent dual path. Blocks 15–18 are built on clean production 1.0 afterward. This is a roadmap decision, **not** a completed cutover.

## 10. Production/reference runtime

Repository: `MarkusAureliusTeuton/JamesUI`
Default branch: `main`
Integration version: `0.5.1`
Frontend revision: `0.5.1-r11`

**r11 is still production/reference.** `jamesui-entry.js` still loads the old production bridge. The new modular runtime is intentionally not wired into production yet. No cutover has occurred.

The retained baseline therefore remains valid and did not require a Block-11 change.

## 11. Start direction to preserve/rebuild

- persistent bottom nav `Start | Haus | Klima | Medien | Tür`
- Alpine/weather hero
- weekday/date + large time
- current temperature/weather plus truthful weather facts
- one lower dark/translucent deck extending to navigation
- Agenda left
- House Quick right/main
- Dynamic Buttons right/footer; exact count and spans are chosen by the Block-14 logical grid from available space and minimum sizes
- never fake unavailable backend data

Cross-page page-scroll/grid/widget-instance rules remain binding in `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`.

## 12. Development rules

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

## 13. Next action

Start **Block 14 – Start configuration experience**.

Read the completed Block-13 spec/plan and the cross-block layout planning notes, then define the final Start composition and generic structured-config-to-widget-instance orchestration. Block 14 must choose the actual OnePlus Pad 2 portrait logical grid/spans from measured available space, place Agenda + House Quick + Dynamic Buttons without hard-coding a button count in Block 13, and provide the planned Android-like grid placement/reflow contract without including later Haus/Media/Climate/Door migrations in Block 14. The approved new order places cutover Blocks 19–21 immediately after Block 14, before Blocks 15–18.

## Block 14 – ongoing integration checkpoint (2026-10-09)

- Active implementation: draft PR #27 (`feat/jamesui-1-0-block-14-start-configuration`), not merged or released.
- Preview and dashboard composer/grid/editor/config implementation exist on the feature branch; integration and acceptance remain open.
- Navigation UI now disables unmigrated Haus/Klima/Medien/Tür destinations on this branch; router-level route restrictions and regression coverage remain to verify.
- No Home Assistant or OnePlus Pad 2 / Fully acceptance test has been performed or claimed.
- Next: verify preview bootstrap and real config/provider wiring, add navigation regression tests, run branch CI, validate viewport, update Soll/Ist and prepare a test release without cutover.

### Block 14 follow-up – viewport and navigation (2026-10-09)

- Preview-only route allowlist now gates both navigation controls and Core Router; default Core behavior remains unchanged.
- Navigation regression tests added; navigation CI commit `3da751c` passed. Subsequent viewport changes still require CI validation.
- Shell viewport sizing uses a bounded grid (`minmax(0, 1fr) auto`) with non-scrolling page host; physical OnePlus Pad 2 / Fully Kiosk behavior unverified.
- Current Soll-/Ist evidence matrix: `docs/JAMESUI_1_0_SOLL_IST_MATRIX.md`.
- PR #27 remains draft. No HA or tablet acceptance claimed.

### Block 14 integration work package – steps 1–6 (2026-10-09)

- CI checked: commit `22de4b66` successful; provider-registration test commit `f526e912` successful. Subsequent provider lifecycle integration test and documentation commits require fresh CI.
- The opt-in 1.0 preview now registers all eight canonical HA data providers and activates only entries explicitly present in persisted `data_sources`.
- The preview retains the four Start widget registrations and a fixed-height shell with disabled unmigrated navigation destinations.
- Added preview integration coverage for config loading and provider lifecycle; a real HA connection and actual widget data remain untested.
- Updated `docs/JAMESUI_1_0_SOLL_IST_MATRIX.md` with evidence and acceptance gaps.
- No merge or production cutover; draft PR #27 remains open. Tablet/HA/Fully Kiosk acceptance not performed.
