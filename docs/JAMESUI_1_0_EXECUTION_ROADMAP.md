# JamesUI 1.0 – Execution Roadmap

_Status: written foundation architecture approved; Blocks 0–8 complete and validated; next gate Block 9 design/planning_
_Date: 2026-10-03_

This document defines the implementation order for JamesUI 1.0 using **Variant B: clean foundation + controlled cutover**. r11 remains the running design/reference runtime until the cutover gate.

Canonical foundation spec:
`docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`

## Working rules

1. Read current status/spec/roadmap before work.
2. Work one block at a time.
3. Create the required design/spec and detailed implementation plan before product code.
4. Use an isolated implementation branch.
5. Use TDD for behavior changes; intentionally red tests never reach `main`.
6. Run block-specific and full regression CI.
7. Review the whole branch before merge.
8. Merge approved green work to `main`, verify main CI, then update handover docs.
9. Do not add monkey-patches, version-polish layers, duplicate implementations or permanent compatibility shims.

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
Plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-6-design-system.md`

Result: PR #18; root-scoped 62-token design contract, Surface/Button/Overlay/Dialog primitives, reduced-motion support. Branch #269 and main #270 green.

### Block 7 – Icon Library and Asset Registry ✅
Spec: `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-7-icon-asset-system-design.md`

Plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-7-icon-asset-system.md`

Result: PR #19, merge `3b1142d9d0491605775f998c1dfe2b39f9791d63`. Branch #285 and main #286 green.

Delivered:
- immutable semantic 40-ID icon registry
- Tabler Icons v3.48.0 pinned source/style baseline with checked-in MIT attribution
- JamesUI-specific weather/shutter/moon definitions in the same 24×24 / 2px / `currentColor` contract
- SVG DOM creation via `createElementNS()` only
- semantic sizes reuse Block-6 icon tokens
- no runtime npm/CDN/fetch/icon-font/SVG-string dependency
- Core bottom navigation uses `nav.start`, `nav.house`, `nav.climate`, `nav.media`, `nav.door`
- r11 production and existing weather/alpine assets untouched

Implementation ruling: `home.ventilation` maps to Tabler `propeller`; `fan` does not exist in pinned v3.48.0.

## Phase C – Rebuild Start on the new architecture

### Block 8 – `layout.home-hero-deck` ✅
Spec: `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-8-home-hero-deck-design.md`

Plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-8-home-hero-deck.md`

Result: PR #20, merge `e13d8e386ee3bbbc5d86bd88c068315018fc4647`. Final branch #301 and main #302 green.

Delivered:
- reusable `layout.home-hero-deck` module outside Core
- exact stable slots `hero`, `widget-left`, `widget-right-main`, `widget-right-footer`
- strict optional `hero_ratio` config, default `0.42`, range `0.35–0.50`
- atomic updates preserve slot identity and mounted children
- target-owned DOM via `ownerDocument`; module context unchanged
- one continuous token-driven lower deck surface
- two-column primary layout with right-main/right-footer stack
- CSS-only `44rem` container fallback with deterministic semantic order
- tall future widget content grows the deck/scroll area rather than escaping a fixed surface
- real Module Registry/Loader lifecycle compatibility proven
- architecture gates prevent HA/config/domain/Core/legacy coupling
- r11 production remains untouched and no Start route composition/cutover occurred

Review note: one Important content-growth issue was found during whole-branch review. RED #300 captured it; the corrected auto-minimum grid tracks passed final branch #301.

### Block 9 – Weather provider ⬜
Goal: normalized `weather.current`, `weather.daily`, optional hourly, sun, moon and atmosphere capabilities behind the existing provider/Home Assistant Adapter boundary.

**Next gate:** complete Block-9 architectural design/spec, user review, detailed implementation plan and approval before product code.

### Block 10 – Weather Today widget + forecast overlay ⬜
Rebuild accepted hero using capabilities/design/icons; temperature opens overlay without layout shift.

### Block 11 – Calendar provider + Calendar Agenda widget ⬜
Real configured calendar data, normalization/deduplication and clean empty states.

### Block 12 – House capability providers + House Quick widget ⬜
Aggregated house state and quick controls through capabilities/actions.

### Block 13 – Dynamic Buttons module ⬜
Configurable reusable action buttons for entity toggle, HA service, scene, navigation and URL.

### Block 14 – Start configuration experience ⬜
Configure complete new Start page using the structured Config Store.

## Phase D – Remaining application areas

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

**Current summary:** Blocks 0–8 are complete, reviewed, green and merged. Block 9 has not started. r11 remains production/reference; no cutover has occurred.
