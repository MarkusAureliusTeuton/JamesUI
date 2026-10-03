# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-03_

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
- Block 9 – Weather provider: ⬜ not started

Block 8 merge commit: `e13d8e386ee3bbbc5d86bd88c068315018fc4647`.

Validation evidence:
- Block 8 final branch validation #301: success
- Block 8 main validation #302: success
- Whole-branch review found one Important content-growth issue; RED #300 proved it, the fix made the deck/right-main tracks content-growing, and #301 verified the final branch
- no open Critical/Important findings remain

**Next formal gate:** Block 9 – Weather provider. Complete the required architectural design/spec and implementation-plan stages before product code.

## 4. Platform completed through Block 8

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

Module context after Block 8 is unchanged:
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

All direct new-runtime HA access remains under `frontend/ha/`. Disconnected/unavailable state views deliberately expose no stale entity values.

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

Files:
- `manifest.js`
- `index.js`
- `styles.js`

Contract:
- module ID `layout.home-hero-deck`, type `layout`, version `1.0.0`
- no module dependencies or capabilities
- exactly four stable slots:
  - `hero`
  - `widget-left`
  - `widget-right-main`
  - `widget-right-footer`
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

## 8. Production/reference runtime

Repository: `MarkusAureliusTeuton/JamesUI`
Default branch: `main`
Integration version: `0.5.1`
Frontend revision: `0.5.1-r11`

**r11 is still the running production/reference implementation.** `jamesui-entry.js` still loads the old panel/start bridge. The new Core/Design/Icon/Layout runtime is intentionally not wired into production yet. No cutover has occurred.

## 9. Start direction to preserve/rebuild

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

## 10. Development rules

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

## 11. Next action

Start **Block 9 – Weather provider** design/planning only. It must publish normalized weather capabilities behind the existing provider/HA-adapter boundary. Do not implement the Weather Today widget/overlay (Block 10), Calendar/House/Dynamic Buttons, final Start composition, or production cutover inside Block 9.
