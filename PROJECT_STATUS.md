# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-04_

This file is the persistent **single source of truth for the current execution state**. Architecture details live in the approved specs, retained behavior in the baseline, and task-level decisions in the individual block plans.

## 1. Product goal

JamesUI is the permanent wall-tablet interface for the KNX/Home Assistant home.

Primary target:
- OnePlus Pad 2 in portrait, normally through Fully
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
- Block 8 layout spec: `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-8-home-hero-deck-design.md`
- Block 8 plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-8-home-hero-deck.md`
- Block 9 weather spec: `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-9-weather-provider-design.md`
- Block 9 plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-9-weather-provider.md`
- Block 10 Weather Today spec: `docs/superpowers/specs/2026-10-04-jamesui-1.0-block-10-weather-today-design.md`
- Block 10 plan: `docs/superpowers/plans/2026-10-04-jamesui-1.0-block-10-weather-today.md`

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
- Block 11 – Calendar provider + Calendar Agenda widget: ⬜ not started

Block 10 merge commit: `f8abbbb28588e210e87727f5fcb3a68984766887`.

Validation evidence:
- Block 10 final branch validation #378: success; final verification was rerun on the unchanged head and passed all workflow steps again
- Block 10 main validation #379: success on the merge commit
- whole-branch review found one Important presentation mismatch: `pouring` used `Starkregen` with normal emphasis instead of approved `Starker Regen` + alert emphasis; review regression was RED before the minimal fix and remains permanently gated
- permanent Block-10 architecture guards now protect widget file boundaries, local Alpine asset allowlist, Core weather neutrality, legacy production entry and shared overlay stacking
- no open Critical/Important review findings remain
- no deterministic browser/screenshot harness exists in the repository; Block-10 visual acceptance was therefore structural DOM/CSS review only. Full composed OnePlus Pad 2 / Fully screenshot acceptance remains mandatory at Block 14 / pre-cutover.

**Next formal gate:** Block 11 – Calendar provider + Calendar Agenda widget. Use design/spec and detailed implementation-plan gates before product code where the block introduces architectural/domain contracts.

## 4. Platform completed through Block 10

### Core
`custom_components/jamesui/frontend/core/` provides:
- routes `home | house | climate | media | door`
- persistent bottom navigation
- Router
- Event Bus for transient technical/UI/lifecycle events only
- Overlay Service
- Health Service
- Module Registry + versioned Module Loader
- Capability Registry
- Action Registry
- Home Assistant Adapter reference
- Config Service reference
- internally composed root-scoped Design System

Block 10 adds one **generic** Core shell capability: Overlay Service descriptors may contain same-document DOM element content. The shell still contains no weather vocabulary or widget-specific branches. Shared overlay stacking remains in Design with `z-index: 100`, above sticky bottom navigation.

### Module contract
Types: `layout`, `widget`, `provider`, `action`.

Lifecycle:
- `create(context, config)`
- `mount(target)`
- `update(nextContext, nextConfig)`
- `destroy()`

Module context after Block 10 is unchanged:
- layout/widget: `events`, `overlays`, `capabilities`, `actions`, `module`
- provider/action: same five plus `homeAssistant`
- no module receives Design System, Config Service, raw `hass`, Router, Health, Module Registry or Module Loader
- configuration enters modules through lifecycle config arguments

### Actions and HA boundary
Real actions:
- `navigate`
- `url.open`
- `entity.toggle`
- `ha.service`
- `scene.activate`

All direct new-runtime HA access remains under `frontend/ha/`. The adapter exposes a narrow validated `timeZone()` accessor for provider-side HA-local calendar semantics. Disconnected/unavailable state views deliberately expose no stale entity values.

## 5. Structured configuration

Canonical persistence is one Home Assistant `.storage` Store:
- key `jamesui.config`
- schema version `1`
- atomic writes

Top-level sections:
`pages`, `layouts`, `widget_instances`, `dynamic_buttons`, `data_sources`, `module_settings`.

The Config Service is transactional and migratable. All 15 retained r11 values have deterministic mappings. Temporary r11 config GET/UPDATE compatibility points at the same Store, not a second persistence source.

Device-local display calibration remains browser-local under `jamesui-display-calibration`.

## 6. Visual foundation

### Design System
Boundary: `custom_components/jamesui/frontend/design/`

- frozen 62-token `--jui-*` contract
- shared Surface/Button/Overlay/Dialog primitives
- root-scoped CSS only
- reduced-motion support
- semantic icon sizes 16 / 20 / 24 / 32 / 48 px
- no `!important`, data-image hacks, direct HA access or scattered palette constants

### Icon system
Boundary: `custom_components/jamesui/frontend/icons/`

- exactly 40 initial semantic IDs
- Tabler Icons v3.48.0 pinned source/style baseline with checked-in MIT attribution
- JamesUI-specific weather/shutter/moon definitions in the same 24×24 / 2px / `currentColor` contract
- SVG DOM creation only through `createElementNS()`
- no runtime npm/CDN/fetch/icon-font/SVG-string dependency
- fixed Core navigation uses `nav.start`, `nav.house`, `nav.climate`, `nav.media`, `nav.door`
- `home.ventilation` uses source icon `propeller`; Tabler `fan` does not exist in pinned v3.48.0

Existing large `assets/weather/*.svg` and Alpine assets remain retained; the new Weather Today widget uses only its explicit local Alpine allowlist.

## 7. Block 8 – `layout.home-hero-deck`

Boundary:
`custom_components/jamesui/frontend/modules/layout.home-hero-deck/`

Contract:
- module ID `layout.home-hero-deck`, type `layout`, version `1.0.0`
- no module dependencies or capabilities
- exactly four stable slots: `hero`, `widget-left`, `widget-right-main`, `widget-right-footer`
- explicit `getSlot()` / frozen `listSlots()` API
- slot element identity and mounted children survive `update()`
- strict config: optional `hero_ratio` only; default `0.42`, accepted `0.35–0.50`
- invalid config update is atomic
- DOM is created from `target.ownerDocument`; module context was not expanded
- one continuous lower deck surface, not three layout-level cards
- two-column primary deck; right side stacks main + footer
- CSS container fallback at `44rem`, preserving semantic order
- deck/right-main grid minima allow tall future widget content to grow the surface and page scroll instead of overflowing outside a fixed background
- styling consumes Block-6 tokens only
- no HA, Config Service, capability/action/provider/widget business logic
- no automatic Start route composition yet
- real Module Registry/Loader load/mount/update/reload/destroy compatibility is tested

## 8. Block 9 – `provider.weather`

Boundary:
`custom_components/jamesui/frontend/modules/provider.weather/`

Capabilities:
- `weather.current`
- `weather.daily`
- `weather.hourly`
- `weather.sun`
- `weather.moon`
- `weather.atmosphere`

Contract/result:
- explicit configured `weather.*` source never silently falls back; automatic mode chooses deterministically
- current measurements are normalized as numbers + explicit units; missing values stay `null`
- optional explicit outdoor-temperature source may override current temperature without collapsing the Weather source
- real Home Assistant `daily`, `hourly` and `twice_daily` forecast subscriptions are normalized independently
- Daily fallback priority is usable Daily → Twice-Daily → Hourly aggregation
- concrete precipitation time is derived only from genuine Hourly forecast data
- all forecast day/today grouping uses validated Home Assistant IANA timezone, not browser timezone
- available current/hourly/daily/sun capability values expose validated additive `time_zone` metadata where truthful formatting needs it
- Sun capability exposes semantic `day | golden | twilight | night` period plus validated ISO rising/setting instants
- Moon prefers a valid configured/discovered HA phase, otherwise uses a local calculation derived from SunCalc v1.9.0 with checked-in BSD-2-Clause attribution
- atmosphere emits semantic weather class/period/scene key only; it does not know asset paths
- one five-minute provider timer refreshes only time-derived cached values; it does not poll Home Assistant
- stale forecast callbacks are isolated by generation/source guards
- strict ISO-instant validation prevents locale-dependent Sun/Forecast timestamp publication
- no UI, DOM, CSS, icon/asset loading, raw `hass`, Config Service, r11 coupling or production bootstrap change

## 9. Block 10 – `widget.weather-today`

Boundary:
`custom_components/jamesui/frontend/modules/widget.weather-today/`

Contract/result:
- consumes exactly `weather.current`, `weather.daily`, `weather.hourly`, `weather.sun`, `weather.moon`, `weather.atmosphere`
- strict empty V1 config; no direct Home Assistant access
- stable hero DOM with device-local German date + `HH:MM` clock and one minute-aligned self-rescheduling timer
- current temperature is an accessible forecast trigger and remains usable when current weather is unavailable but forecast data exists
- current condition uses semantic local weather/moon icons only; unknown conditions do not invent icons or polished backend-state labels
- real current-day high/low only; tomorrow is never mislabeled as today
- precipitation start time is displayed only when Block 9 supplied a genuine Hourly-derived instant
- wind/gust, sunrise, sunset and moon facts fail independently and never fabricate missing values
- exact local Alpine background allowlist: clear/cloudy/rain/snow day, fog, dusk, clear/cloudy night; unknown scene uses neutral dark fallback
- facts form one restrained information row at primary geometry with deterministic CSS container wrapping on narrow widths
- forecast overlay shows up to 12 future Hourly entries and up to 7 current/future Daily entries, with explicit HA-timezone formatting and empty/unavailable states
- live capability updates mutate existing hero/forecast DOM instead of rebuilding the layout
- overlay ownership is stale-safe and cannot close a newer unrelated overlay
- loader load/update/reload/destroy integration is permanently tested with declared capability ownership
- no r11 selector/copy, raw palette, remote asset, old weather-SVG dependency, Config Service, Router/Health or Core weather special case

Visual acceptance note:
- automated DOM/CSS/architecture gates cover hierarchy structure, seven-fact treatment, local scene allowlist, neutral fallback and modal stacking
- no deterministic screenshot harness is present, so screenshot-level OnePlus/Fully acceptance was **not** claimed for Block 10
- composed portrait screenshot acceptance is still required at Block 14 / pre-cutover

## 10. Production/reference runtime

Repository: `MarkusAureliusTeuton/JamesUI`
Default branch: `main`
Integration version: `0.5.1`
Frontend revision: `0.5.1-r11`

**r11 is still the running production/reference implementation.** `jamesui-entry.js` still loads the old panel/start bridge. The new Core/Design/Icon/Layout/Weather-provider/Weather-Today runtime is intentionally not wired into production yet. No cutover has occurred.

## 11. Start direction to preserve/rebuild

- persistent bottom nav `Start | Haus | Klima | Medien | Tür`
- Alpine/weather hero
- weekday/date + large time
- current temperature/weather, high/low, real rain/time where supported
- wind/storm/snow relevance, sunrise/sunset, moon
- temperature tap opens forecast overlay without layout shift
- no standalone 3-day row
- one lower dark/translucent deck extending to navigation
- Calendar left
- House Quick right/main
- four Dynamic Buttons right/footer
- no `Home`, `HEUTE & DANACH`, `ZUHAUSE` labels
- never fake unavailable backend data

## 12. Development rules

1. Repository is source of truth.
2. One roadmap block at a time.
3. Detailed design/spec when architecture requires it, then detailed implementation plan before product code.
4. Isolated implementation branch.
5. TDD for behavior changes; intentionally red tests never go to `main`.
6. Approved green work merges to `main` without repeated repository confirmation.
7. Whole-branch review and independent main-CI verification before completion claims.
8. Update status/roadmap/handover after merged work.
9. No monkey-patches, Prototype overrides, version-polish layers, duplicate implementations or permanent legacy shims.
10. OnePlus/Fully portrait screenshot acceptance is required at major composed-UI milestones; do not claim it when no deterministic screenshot run occurred.

## 13. Next action

Start **Block 11 – Calendar provider + Calendar Agenda widget**. First inspect the approved foundation, current Config/HA/Capability boundaries and retained real calendar behavior. Define the Calendar capability/data normalization and widget boundary before product code, including configured-calendar selection, event normalization/deduplication, timezone/day handling and clean unavailable/empty states. Do not implement House Quick, Dynamic Buttons, final Start composition or production cutover inside Block 11.
