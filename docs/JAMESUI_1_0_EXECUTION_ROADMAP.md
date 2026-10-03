# JamesUI 1.0 – Execution Roadmap

_Status: written architecture spec approved; Blocks 0–6 complete and validated; next gate Block 7 detailed plan_
_Date: 2026-10-03_

This document defines the implementation order for the JamesUI 1.0 rebuild using **Variant B: clean foundation + controlled cutover**.

The current r11 implementation remains the design/reference runtime until the cutover gate. Do not continue normal feature development on the old architecture.

Canonical architecture spec:
`docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`

## Working rules for every block

1. Read the architecture spec and roadmap.
2. Inspect only the relevant current/new code.
3. Write a detailed block implementation plan before product code.
4. Work on an isolated branch.
5. Use TDD for behavior changes.
6. Keep intentionally red tests off `main`.
7. Complete block-specific CI/practical checks.
8. Review the whole branch before merge.
9. Merge the green block to `main` before dependent work.
10. Update `PROJECT_STATUS.md`, this roadmap and `JAMESUI_1_0_NEXT_CHAT.md` after merged work.
11. Do not add compatibility shims without an explicit removal point.

## Phase A – Establish the new platform

### Block 0 – Baseline and preservation tests ✅
Goal: capture only existing behavior/assets intentionally preserved.

Plan: `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-0-baseline.md`

Result: baseline inventory and preservation tests complete. PR #12 green.

### Block 1 – JamesUI Core shell ✅
Goal: minimal new runtime shell with persistent navigation, routing, technical services and error isolation.

Plan: `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-1-core-shell.md`

Result: PR #13 green. Core remains parallel/unwired from production r11.

### Block 2 – Module manifest, registry and loader ✅
Goal: modular runtime contract, lifecycle, dependencies, versioned imports/reload and module health.

Plan: `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-2-module-system.md`

Result: PR #14 green.

### Block 3 – Capability Registry and Action Registry ✅
Goal: decoupled runtime capability exchange and generic actions.

Plan: `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-3-capability-action-registries.md`

Result: PR #15 green. Real non-HA actions `navigate` and `url.open`.

### Block 4 – Home Assistant Adapter ✅
Goal: isolate all direct new-runtime Home Assistant access and provide real HA-backed actions.

Plan: `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-4-home-assistant-adapter.md`

Result: PR #16 green. Real `entity.toggle`, `ha.service`, `scene.activate`; provider/action modules may receive `homeAssistant`, layouts/widgets remain HA-free.

### Block 5 – Versioned configuration store and migrations ✅
Goal: replace flat config persistence with one structured, transactional, migratable Store.

Plan: `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-5-config-store-migrations.md`

Result: PR #17 merged. Branch validation #253 and main validation #254 succeeded.

Delivered:
- one Home Assistant `.storage` Store (`jamesui.config`)
- schema version 1
- top-level sections `pages`, `layouts`, `widget_instances`, `dynamic_buttons`, `data_sources`, `module_settings`
- exact schema validation and transactional backend Config Service
- explicit migration framework
- deterministic migration/projection for all 15 retained r11 config values
- existing Store wins over stale legacy options
- known legacy option keys removed only after successful initialization
- temporary r11 GET/UPDATE compatibility backed by the same Store
- structured `jamesui/config/get` and `jamesui/config/replace` API
- frontend read-only Core Config Service via Home Assistant Adapter
- module contexts unchanged; config still enters modules through lifecycle config args
- local display calibration remains browser-local

### Block 6 – Design system and base components ✅
Goal: establish one stable visual language for all new UI.

Plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-6-design-system.md`

Result: PR #18 merged. Branch validation #269 and main validation #270 succeeded.

Delivered:
- dedicated `frontend/design/` boundary
- frozen 62-token `--jui-*` contract for palette, typography, spacing, radii, blur, shadows, motion and icon sizes
- root-scoped Design System runtime that mounts one style below the Core root and cleans up idempotently
- shared surface variants `default | raised | glass`
- shared button variants `default | ghost | accent` with sizes `sm | md | lg`
- reusable overlay/dialog presentation primitives
- centralized reduced-motion behavior
- Core navigation migrated to the shared ghost-button primitive without route-behavior changes
- architecture guards preventing raw palette drift, asset/data-URL hacks, `!important`, direct HA access and legacy coupling in the new design boundary
- module contexts remain unchanged; Design System is not exposed as a runtime service to modules
- r11 product frontend/bootstrap remain untouched

Implementation note: a pre-existing r11 rain-time regression fixture was date-dependent and expired on 2026-10-03. Its test data was made relative to the current day; no r11 product code changed.

## Phase B – Establish the visual system

### Block 7 – Icon library and asset registry ⬜
Goal: replace mixed Unicode/inline/data-URL icon approaches with one local SVG system.

Planned scope:
- local SVG asset structure
- stable icon/asset registry IDs
- consistent line weight and `currentColor`
- navigation icons
- weather icons
- house/control icons
- moon-phase icons
- asset integrity/registry validation tests
- integration with the Block-6 icon-size/token system and visual primitives where appropriate

Exit criteria:
- new production UI does not rely on Unicode glyphs for normal controls
- icons are referenced by stable IDs rather than copied SVG fragments
- icon rendering remains local/offline and themeable through `currentColor`
- no Start layout/domain implementation is pulled forward
- CI green

**Next gate:** create/review the detailed Block-7 implementation plan before product code.

## Phase C – Rebuild Start on the new architecture

### Block 8 – `layout.home-hero-deck` ⬜
Goal: reusable Start layout with hero + lower deck slots and no HA/business logic.

### Block 9 – Weather provider ⬜
Goal: normalized `weather.current`, `weather.daily`, optional hourly, sun, moon and atmosphere capabilities.

### Block 10 – Weather Today widget + forecast overlay ⬜
Goal: rebuild accepted hero using capabilities/design/icons; temperature tap opens forecast overlay without layout shift.

### Block 11 – Calendar provider + Calendar Agenda widget ⬜
Goal: real configured calendar data, normalized/deduplicated with clean empty states.

### Block 12 – House capability providers + House Quick widget ⬜
Goal: real aggregated house state and quick controls through capabilities/actions.

### Block 13 – Dynamic Buttons module ⬜
Goal: configurable reusable action buttons for entity toggle, HA service, scene, navigation and URL.

### Block 14 – Start configuration experience ⬜
Goal: configure complete new Start page without code edits using the structured Config Store.

## Phase D – Port remaining application areas

### Block 15 – Haus page migration ⬜
Goal: rebuild useful Haus behavior on the new platform with real grouping/control.

### Block 16 – Media migration ⬜
Goal: preserve useful Media behavior without receiver-specific Core logic.

### Block 17 – Climate migration ⬜
Goal: replace demo Climate page with real `climate.*` data and controls; no fake rooms/temperatures.

### Block 18 – Door migration ⬜
Goal: replace demo groundwork with real door/camera functionality and suitable safety behavior.

## Phase E – Controlled cutover and cleanup

### Block 19 – Cutover preparation ⬜
Goal: prove new platform readiness, including OnePlus/Fully portrait acceptance and migration completeness.

### Block 20 – Cutover ⬜
Goal: switch Home Assistant panel bootstrap to the new Core and run final config migration/first-load checks.

### Block 21 – Legacy deletion and architecture gate ⬜
Goal: remove old monolith/Start patch layers/demo data/obsolete compatibility paths and enforce permanent architecture CI gates.

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
| 7 Icon library | ⬜ |
| 8 Start layout | ⬜ |
| 9 Weather provider | ⬜ |
| 10 Weather widget | ⬜ |
| 11 Calendar | ⬜ |
| 12 House Quick | ⬜ |
| 13 Dynamic Buttons | ⬜ |
| 14 Start config | ⬜ |
| 15 Haus migration | ⬜ |
| 16 Media migration | ⬜ |
| 17 Climate migration | ⬜ |
| 18 Door migration | ⬜ |
| 19 Cutover preparation | ⬜ |
| 20 Cutover | ⬜ |
| 21 Legacy deletion/gate | ⬜ |

**Current summary:** Blocks 0–6 are complete, green and merged. The next task is the detailed implementation plan for Block 7. r11 remains production/reference; no cutover has occurred.