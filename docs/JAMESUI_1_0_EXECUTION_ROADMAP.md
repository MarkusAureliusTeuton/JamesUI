# JamesUI 1.0 – Execution Roadmap

_Status: foundation architecture approved; Blocks 0–12 complete and validated; next gate Block 13_
_Date: 2026-10-06_

This document defines the implementation order for JamesUI 1.0 using **Variant B: clean foundation + controlled cutover**. r11 remains the running design/reference runtime until the cutover gate.

Canonical foundation spec:
`docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`

## Working rules

1. Read current status/spec/roadmap before work.
2. Work one block at a time.
3. Create the required design/spec and detailed implementation plan before product code when a block introduces domain/architecture contracts.
4. Use an isolated implementation branch.
5. Use TDD for behavior changes; intentionally red tests never reach `main`.
6. Keep draft PRs from generating intentional-red CI noise; run full CI at meaningful green checkpoints.
7. Run block-specific and full regression CI.
8. Review the whole branch before merge.
9. Merge approved green work to `main`, verify main CI, then update handover docs.
10. Do not add monkey-patches, Prototype overrides, version-polish layers, duplicate implementations or permanent compatibility shims.

## Phase A – Platform foundation

### Block 0 – Baseline and preservation tests ✅
Retained behavior/assets documented and protected. PR #12.

### Block 1 – JamesUI Core shell ✅
Persistent navigation, routing, technical services and error isolation. PR #13.

### Block 2 – Module manifest, registry and loader ✅
Versioned module lifecycle/dependency system. PR #14.

### Block 3 – Capability Registry and Action Registry ✅
Decoupled capabilities and generic action dispatch. PR #15.

### Block 4 – Home Assistant Adapter ✅
All direct new-runtime HA access isolated; real HA-backed actions added. PR #16.

### Block 5 – Versioned configuration store and migrations ✅
One structured Home Assistant `.storage` Store, schema v1, migrations and Config Service. PR #17.

## Phase B – Visual foundation

### Block 6 – Design System and base components ✅
PR #18. Root-scoped 62-token design contract, Surface/Button/Overlay/Dialog primitives and reduced-motion support.

### Block 7 – Icon Library and Asset Registry ✅
PR #19. Initial 40-ID semantic icon registry with pinned Tabler 3.48.0 provenance and local SVG DOM rendering.

## Phase C – Rebuild Start on the new architecture

### Block 8 – `layout.home-hero-deck` ✅
PR #20, merge `e13d8e386ee3bbbc5d86bd88c068315018fc4647`.

Delivered the reusable Start layout family with stable `hero`, `widget-left`, `widget-right-main`, `widget-right-footer` slots and no domain/Core coupling. Final composed Start grid remains Block 14.

### Block 9 – Weather provider ✅
PR #21, merge `3f27f8d800534792c50c29e7e153045bc14a1352`.

Delivered `provider.weather` with current/daily/hourly/sun/moon/atmosphere capabilities, explicit HA timezone handling, truthful fallback semantics and stale-callback isolation.

### Block 10 – Weather Today widget + forecast overlay ✅
PR #22, merge `f8abbbb28588e210e87727f5fcb3a68984766887`.

Delivered `widget.weather-today`, local Alpine scene handling, truthful weather facts and forecast overlay. No production cutover. Screenshot-level composed-tablet acceptance remains Block 14 / pre-cutover.

### Block 11 – Calendar/task providers + Agenda widget ✅

Spec: `docs/superpowers/specs/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda-design.md`

Plan: `docs/superpowers/plans/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda.md`

Result: PR #23, merge `63e0b8dc6072eed885f591161180f7082f6f7f2c`.

Final unchanged branch head `4f9c6959f15a5eb1e21ab38d6c30cc913219626d` passed run `37284834614`; merged `main` passed run `37285828629`.

Delivered:
- `provider.calendar` with explicit configured sources, range subscriptions, HA-timezone/DST-safe bounds, sharing/ref-counting and stale/failure isolation
- `provider.tasks` with explicit configured todo lists and live normalized `tasks.items` snapshots
- shared zoned-time and Todo-feature contracts
- semantic `action.task-update` with UID identity, feature checks and safe title/status/due/description mutation/clearing
- six new semantic icons, taking the registry from 40 to 46 IDs
- `widget.calendar-agenda` with `grouped`, `timeline`, `day` modes
- Today/history, all-day/multi-day projection, duplicate collapse with provenance and source-specific unavailable states
- task ordering, overdue carry-forward, completion, exact 5 s Undo and supported task editing
- JamesUI-owned advance notices with instance/device-local dismissal state
- host-aware fixed/auto complete-row sizing, internal scroll, swipe/day navigation and `too_small` behavior
- direct multi-instance isolation proof; generic Loader/page multi-instance orchestration remains Block 14
- permanent Block-11 integration/architecture gates

Whole-branch review found one Important `task.update` registry-rebinding lifecycle issue. It was fixed atomically and permanently covered by a review-regression test before merge. No Critical/Important findings remain.

No Calendar mutation, task create/delete/move/reorder, source reminder import, House Quick, Dynamic Buttons, final Start composition or cutover was included.

### Block 12 – House capability providers + House Quick widget ✅

Spec: `docs/superpowers/specs/2026-10-05-jamesui-1.0-block-12-house-capabilities-house-quick-design.md`

Plan: `docs/superpowers/plans/2026-10-05-jamesui-1.0-block-12-house-capabilities-house-quick.md`

Result: PR #25, merge `04e6beb8614d69c1dbd397391d136b28b492aedc`.

Final unchanged branch head `966569786771b194dcfc5caee30e9cd1ee73de29` passed run `37441731886`; merged `main` passed run `37441814856`.

Delivered:
- explicit House source-binding primitives with truthful unavailable semantics
- `provider.house-heating` / `house.heatingZones` for KNX-defined zones
- `provider.house-lighting` / `house.lights` + `house.ambientLights` with mutually exclusive source assignment
- `provider.house-devices` / `house.devices` with activity, update, warning, fault and reachability aggregation
- `provider.house-energy` / `house.energy` as a query capability with current power, HA-history-backed time-weighted trailing averages and 60 s refresh
- `widget.house-quick` as status + semantic navigation only; no direct HA/control path
- button priority `critical > warning > active > neutral`; unreachable is warning, updates are informational
- heating activity follows auto regulation; heating demand remains informational
- energy source/window/warning/critical thresholds are configurable per button; multiple energy buttons and heating-zone buttons are supported
- arbitrary per-instance button subset/order and direct multi-instance isolation
- permanent Block-12 architecture, loader and CI gates

Whole-branch review issues around provider rebind failure and critical-status clarity were fixed and covered by regression tests before merge. No Critical/Important findings remain.

Windows/doors, ventilation, scenes, detail pages, final Start composition/grid, generic Loader/page multi-instance orchestration and production cutover remain out of scope.

### Block 13 – Dynamic Buttons module ⬜
Configurable reusable action buttons for entity toggle, HA service, scene, navigation and URL.

### Block 14 – Start configuration experience ⬜
Configure the complete new Start page using the structured Config Store. This is also the next major composed OnePlus/Fully portrait screenshot-acceptance milestone.

Binding composition requirements:
- normal tablet Start fits inside the available OnePlus/Fully viewport without page-level vertical scrolling
- widgets stay inside allocated layout regions; supported overflow remains inside widgets
- use shared logical layout-height/grid units rather than arbitrary pixel heights
- height-aware widgets such as Agenda derive content capacity from actual allocation
- configuration controls are dependency-aware and remain understandable when disabled
- generic multi-instance widget placement/orchestration is solved here

### Block 15 – Haus page migration ⬜
Rebuild useful Haus behavior on the new platform.

### Block 16 – Media migration ⬜
Preserve useful Media behavior without receiver-specific Core logic.

### Block 17 – Climate migration ⬜
Real `climate.*` data and controls; no demo rooms/temperatures.

### Block 18 – Door migration ⬜
Real door/camera functionality with suitable safety behavior.

## Phase E – Controlled cutover and cleanup

### Block 19 – Cutover preparation ⬜
Prove readiness including OnePlus/Fully portrait acceptance and migration completeness.

### Block 20 – Cutover ⬜
Switch the Home Assistant panel bootstrap to the new Core and perform first-load/migration checks.

### Block 21 – Legacy deletion and architecture gate ⬜
Delete old monolith/patch/demo/compatibility paths and enforce permanent architecture gates.

## Status table

| Block | Status |
| --- | --- |
| 0 Baseline | ✅ |
| 1 Core shell | ✅ |
| 2 Module registry/loader | ✅ |
| 3 Capability/Action registries | ✅ |
| 4 HA adapter | ✅ |
| 5 Config store/migrations | ✅ |
| 6 Design system | ✅ |
| 7 Icon library | ✅ |
| 8 Start layout | ✅ |
| 9 Weather provider | ✅ |
| 10 Weather widget | ✅ |
| 11 Calendar/tasks agenda | ✅ |
| 12 House Quick | ✅ |
| 13 Dynamic Buttons | ⬜ |
| 14 Start config | ⬜ |
| 15 Haus migration | ⬜ |
| 16 Media migration | ⬜ |
| 17 Climate migration | ⬜ |
| 18 Door migration | ⬜ |
| 19 Cutover preparation | ⬜ |
| 20 Cutover | ⬜ |
| 21 Legacy deletion/gate | ⬜ |

**Current summary:** Blocks 0–12 are complete, reviewed, green and merged. Block 13 Dynamic Buttons is the next formal gate. r11 remains production/reference; no cutover has occurred.
