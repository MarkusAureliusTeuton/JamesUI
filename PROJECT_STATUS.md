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
- Block 7 icon spec: `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-7-icon-asset-system-design.md`
- Block 8 layout spec: `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-8-home-hero-deck-design.md`
- Block 8 plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-8-home-hero-deck.md`
- Block 9 weather spec: `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-9-weather-provider-design.md`
- Block 9 plan: `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-9-weather-provider.md`

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
- Block 10 – Weather Today widget + forecast overlay: ⬜ not started

Block 9 merge commit: `3f27f8d800534792c50c29e7e153045bc14a1352`.

Validation evidence:
- Block 9 final branch validation #336: success
- Block 9 main validation #337: success
- Whole-branch review found two timestamp-truthfulness regressions: parseable non-ISO Sun/Forecast timestamps could pass through `Date.parse()`; review CI #333 stayed red until strict ISO-instant normalization was added
- final review after that fix has no open Critical/Important findings

**Next formal gate:** Block 10 – Weather Today widget + forecast overlay. Design/spec first, then detailed implementation plan before product code.

## 4. Platform completed through Block 9

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

### Module contract
Types: `layout`, `widget`, `provider`, `action`.

Lifecycle:
- `create(context, config)`
- `mount(target)`
- `update(nextContext, nextConfig)`
- `destroy()`

Module context after Block 9 is unchanged:
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

All direct new-runtime HA access remains under `frontend/ha/`. The adapter now also exposes a narrow validated `timeZone()` accessor for provider-side HA-local calendar semantics. Disconnected/unavailable state views deliberately expose no stale entity values.

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

Existing large `assets/weather/*.svg` and Alpine assets remain untouched.

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
- Sun capability exposes semantic `day | golden | twilight | night` period plus validated ISO rising/setting instants
- Moon prefers a valid configured/discovered HA phase, otherwise uses a local calculation derived from SunCalc v1.9.0 with checked-in BSD-2-Clause attribution
- local Moon calculation passed eight fixed 2026 primary-phase reference cases at the predeclared ±3 percentage-point illumination tolerance
- atmosphere emits semantic weather class/period/scene key only; it does not know asset paths
- one five-minute provider timer refreshes only time-derived cached values; it does not poll Home Assistant
- stale forecast callbacks are isolated by generation/source guards
- each capability has independent `available`, `unavailable` or `not_configured` semantics
- strict ISO-instant validation prevents locale-dependent Sun/Forecast timestamp publication
- no UI, DOM, CSS, icon/asset loading, raw `hass`, Config Service, r11 coupling or production bootstrap change

## 9. Production/reference runtime

Repository: `MarkusAureliusTeuton/JamesUI`
Default branch: `main`
Integration version: `0.5.1`
Frontend revision: `0.5.1-r11`

**r11 is still the running production/reference implementation.** `jamesui-entry.js` still loads the old panel/start bridge. The new Core/Design/Icon/Layout/Weather-provider runtime is intentionally not wired into production yet. No cutover has occurred.

## 10. Start direction to preserve/rebuild

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

## 11. Development rules

1. Repository is source of truth.
2. One roadmap block at a time.
3. Detailed design/spec when architecture requires it, then detailed implementation plan before product code.
4. Isolated implementation branch.
5. TDD for behavior changes; intentionally red tests never go to `main`.
6. Approved green work merges to `main` without repeated repository confirmation.
7. Whole-branch review and main-CI verification before completion claims.
8. Update status/roadmap/handover after merged work.
9. No monkey-patches, Prototype overrides, version-polish layers, duplicate implementations or permanent legacy shims.
10. OnePlus/Fully portrait screenshot acceptance is required at major composed-UI milestones, not for infrastructure-only blocks.

## 12. Next action

Start **Block 10 – Weather Today widget + forecast overlay** at the design/spec stage. It must consume Block-9 capabilities plus the existing Design/Icon/Overlay boundaries and mount into the Block-8 hero slot. Preserve the accepted Alpine/weather hero direction and temperature-tap overlay behavior without layout shift. Do not implement Calendar/House/Dynamic Buttons, final Start composition, or production cutover inside Block 10.
