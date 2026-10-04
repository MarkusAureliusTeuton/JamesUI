# JamesUI 1.0 – Execution Roadmap

_Status: foundation architecture approved; Blocks 0–10 complete and validated; next gate Block 11_
_Date: 2026-10-04_

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

The Block-8 growth behavior remains a generic safety property of the reusable layout. Final Start composition is allowed to impose bounded slot heights so composed widgets scroll internally instead of growing the page; that final viewport policy is owned by Block 14.

### Block 9 – Weather provider ✅
Spec: `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-9-weather-provider-design.md`

Plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-9-weather-provider.md`

Result: PR #21, merge `3f27f8d800534792c50c29e7e153045bc14a1352`. Final branch #336 and main #337 green.

Delivered:
- `provider.weather` with exact capabilities `weather.current`, `weather.daily`, `weather.hourly`, `weather.sun`, `weather.moon`, `weather.atmosphere`
- narrow validated Home Assistant `timeZone()` adapter boundary
- explicit configured Weather source never silently falls back; automatic mode is deterministic
- current weather normalization with explicit units and optional outdoor-temperature override
- real Daily/Hourly/Twice-Daily forecast subscriptions through the HA adapter
- Daily fallback priority: usable Daily → Twice-Daily → Hourly aggregation
- HA-timezone-aware day grouping and DST/midnight handling
- precise next-rain time only from genuine Hourly data
- independent Sun normalization and semantic day/golden/twilight/night period
- local Moon fallback derived from SunCalc v1.9.0 with checked-in BSD-2-Clause attribution
- semantic atmosphere scene keys only; no asset paths
- one five-minute time-derived refresh timer with no HA polling
- source-generation guards prevent stale forecast callbacks from publishing
- strict ISO-instant normalization for Forecast and Sun timestamps
- no UI, DOM, raw HA, Config Service, asset loading, r11 coupling or production-entry change

Review note: whole-branch review caught two timestamp-truthfulness issues where `Date.parse()` accepted locale-formatted non-ISO values. Review CI #333 stayed red until strict ISO-instant validation was added; final branch #336 is green with no open Critical/Important findings.

### Block 10 – Weather Today widget + forecast overlay ✅
Spec: `docs/superpowers/specs/2026-10-04-jamesui-1.0-block-10-weather-today-design.md`

Plan: `docs/superpowers/plans/2026-10-04-jamesui-1.0-block-10-weather-today.md`

Result: PR #22, merge `f8abbbb28588e210e87727f5fcb3a68984766887`. Final branch #378 and main #379 green. The final branch validation was explicitly rerun on the unchanged head before merge and passed all workflow steps again.

Delivered:
- additive validated `time_zone` metadata for current/hourly/daily/sun weather capability values needed by consumers
- generic same-document DOM overlay hosting in Core shell; no weather-specific Core branch
- shared Overlay layer remains in Design at `z-index: 100`
- `widget.weather-today` consuming exactly the six Block-9 weather capabilities and no direct HA access
- stable Alpine hero with device-local German date/time, current semantic weather presentation and accessible temperature forecast trigger
- truthful high/low, genuine Hourly-derived precipitation time, wind/gust, sunrise/sunset and moon facts with independent missing-data behavior
- exact local eight-scene Alpine asset allowlist plus neutral unknown fallback
- restrained seven-fact primary row with CSS container fallback
- forecast overlay with up to 12 future Hourly entries and 7 current/future Daily entries, explicit HA-timezone formatting and deliberate empty states
- live hero/forecast updates preserve important DOM identity and do not shift the hero layout
- stale-safe overlay ownership; widget destroy/reload cannot close a newer unrelated overlay
- real Registry/Loader integration proof including capability ownership, update/reload/destroy cleanup
- permanent Block-10 architecture and review-regression gates
- r11 production entry remains unchanged; no final Start composition or cutover

Review note: whole-branch review found one Important presentation mismatch: Home Assistant `pouring` was rendered as `Starkregen` with normal emphasis. A focused regression test went RED before the mapping was corrected to approved `Starker Regen` + alert emphasis. No Critical/Important findings remain.

Visual acceptance note: the repository has no deterministic browser/screenshot harness. Block-10 acceptance therefore used DOM/CSS/architecture review; screenshot-level OnePlus/Fully acceptance was not claimed and remains mandatory at Block 14 / pre-cutover.

### Block 11 – Calendar/task providers + Agenda widget ⬜
Goal: real configured calendar and task data, normalization/deduplication, explicit timezone/day semantics, task completion and clean empty/unavailable states, then a bounded Calendar Agenda widget for the Start deck. The widget must support fixed and height-derived automatic visible-row capacity and keep overflow inside the widget rather than forcing page growth.

Persistent design notes: `docs/JAMESUI_1_0_BLOCK_11_PLANNING_NOTES.md`

**Next gate:** inspect existing HA/Config/Capability contracts and retained real calendar/task behavior, then complete Block-11 design/spec and detailed implementation plan before product code.

### Block 12 – House capability providers + House Quick widget ⬜
Aggregated house state and quick controls through capabilities/actions.

### Block 13 – Dynamic Buttons module ⬜
Configurable reusable action buttons for entity toggle, HA service, scene, navigation and URL.

### Block 14 – Start configuration experience ⬜
Configure complete new Start page using the structured Config Store. This is also the next major composed OnePlus/Fully portrait screenshot-acceptance milestone.

Binding composition requirements already identified for this block:
- the normal tablet Start page fits inside the available OnePlus/Fully viewport without page-level vertical scrolling
- widgets must stay inside their allocated layout regions; overflow belongs inside the widget when that widget supports scrolling
- define one shared layout-height grid for the Start page and allow widget maximum heights/spans to be configured in grid units rather than arbitrary pixel values
- height-aware widgets such as the Block-11 Agenda can derive their visible content capacity from their actual allocated grid height
- configuration controls must be dependency-aware: settings made meaningless by another selected option remain understandable but disabled/greyed instead of silently active

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
| 11 Calendar/tasks agenda | ⬜ |
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

**Current summary:** Blocks 0–10 are complete, reviewed, green and merged. Block 11 is the next formal gate. r11 remains production/reference; no cutover has occurred.
