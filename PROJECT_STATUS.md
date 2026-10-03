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

Completed implementation plans now cover Blocks 0–7. The latest is:
`docs/superpowers/plans/2026-10-03-jamesui-1.0-block-7-icon-asset-system.md`

## 3. Current formal state

- Block 0 – Baseline and preservation tests: ✅
- Block 1 – Core shell: ✅ PR #13
- Block 2 – Module manifest/registry/loader: ✅ PR #14
- Block 3 – Capability Registry + Action Registry: ✅ PR #15
- Block 4 – Home Assistant Adapter: ✅ PR #16
- Block 5 – Versioned Config Store + migrations: ✅ PR #17
- Block 6 – Design System + base components: ✅ PR #18
- Block 7 – Icon Library + Asset Registry: ✅ PR #19
- Block 8 – `layout.home-hero-deck`: ⬜ not started

Block 7 merge commit: `3b1142d9d0491605775f998c1dfe2b39f9791d63`.

Validation evidence:
- Block 7 branch validation #285: success
- Block 7 main validation #286: success
- Whole-branch review: no open Critical/Important findings

Implementation ruling recorded during Block 7: the approved plan named Tabler `fan` for `home.ventilation`, but that icon does not exist in pinned Tabler v3.48.0. The implemented and source-verified mapping is `home.ventilation -> propeller`.

**Next formal gate:** Block 8 – `layout.home-hero-deck`. Review the existing foundation/layout requirements and create the detailed Block-8 design/implementation plan before product code.

## 4. Platform completed through Block 7

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

Module context remains unchanged after Block 7:
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

## 6. Design System

Boundary: `custom_components/jamesui/frontend/design/`

- one frozen 62-token `--jui-*` contract
- shared Surface/Button/Overlay/Dialog primitives
- root-scoped CSS only
- reduced-motion support
- icon size tokens: 16 / 20 / 24 / 32 / 48 px via semantic names
- no `!important`, data-image hacks, direct HA access or scattered palette constants

## 7. Block 7 icon system

Boundary: `custom_components/jamesui/frontend/icons/`

Files:
- `icon-definitions.js` – curated local vector/provenance catalog
- `icon-registry.js` – validation, immutable semantic registry and lookup
- `icon.js` – SVG DOM factory
- `ICONS_LICENSE.md` – pinned Tabler attribution/MIT notice

Contract:
- exactly **40** initial semantic IDs
- namespaces `nav.*`, `shell.*`, `weather.*`, `home.*`, `moon.*`
- Tabler Icons **v3.48.0** is the pinned source/style baseline for standard icons
- JamesUI-specific icons share the same line contract
- `24×24`, `2.0 px`, `fill="none"`, `stroke="currentColor"`, round caps/joins
- no runtime Tabler/npm/CDN/fetch/icon-font dependency
- no SVG strings/XML parser/data URLs
- real SVG DOM nodes created only through `createElementNS()`
- semantic sizes `sm | md | lg | xl | hero` reuse Block-6 tokens
- decorative icons are hidden from accessibility by default; standalone meaningful icons require an accessible label
- malformed definitions and unknown IDs fail predictably; no silent fallback glyph

The fixed new-Core navigation now uses:
- Start → `nav.start`
- Haus → `nav.house`
- Klima → `nav.climate`
- Medien → `nav.media`
- Tür → `nav.door`

Visible labels, routing, `aria-current`, persistent-nav identity and shell lifecycle remain unchanged.

Existing large `assets/weather/*.svg` and Alpine assets are **not** part of the icon family and remain untouched.

## 8. Production/reference runtime

Repository: `MarkusAureliusTeuton/JamesUI`
Default branch: `main`
Integration version: `0.5.1`
Frontend revision: `0.5.1-r11`

**r11 is still the running production/reference implementation.** `jamesui-entry.js` still loads the old panel/start bridge. The new Core/Design/Icon runtime is intentionally not wired into production yet. No cutover has occurred.

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

Start **Block 8 – `layout.home-hero-deck`** planning only. Do not implement weather/calendar/house providers or widgets, dynamic buttons, final Start content, or production cutover inside Block 8.
