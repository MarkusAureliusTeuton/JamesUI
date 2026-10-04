# JamesUI 1.0 – Next Chat / New ChatGPT Project Handover

_Date: 2026-10-04_

Use this document to start a fresh JamesUI conversation without relying on old chat history. The repository is the source of truth.

## Canonical repository

`MarkusAureliusTeuton/JamesUI`

Default branch: `main`

## Required reading order

1. `PROJECT_STATUS.md`
2. `docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`
3. `docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`
4. `docs/JAMESUI_1_0_BASELINE.md`
5. `docs/JAMESUI_1_0_NEXT_CHAT.md`
6. `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-8-home-hero-deck-design.md`
7. `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-9-weather-provider-design.md`
8. `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-9-weather-provider.md`
9. inspect only files relevant to the active block

## Binding direction

Variant B remains binding:
- build the clean JamesUI 1.0 runtime in parallel
- r11 remains production/reference until controlled cutover
- port desired behavior, not legacy architecture
- delete obsolete legacy implementation after cutover
- Git history is the archive

No normal feature development on r11.

## Current execution state

Completed and merged:
- Block 0 – Baseline ✅
- Block 1 – Core shell ✅ PR #13
- Block 2 – Module system ✅ PR #14
- Block 3 – Capability/Action registries ✅ PR #15
- Block 4 – Home Assistant Adapter ✅ PR #16
- Block 5 – Versioned Config Store + migrations ✅ PR #17
- Block 6 – Design System + base components ✅ PR #18
- Block 7 – Icon Library + Asset Registry ✅ PR #19
- Block 8 – `layout.home-hero-deck` ✅ PR #20
- Block 9 – `provider.weather` ✅ PR #21

Block 9 merge commit:
`3f27f8d800534792c50c29e7e153045bc14a1352`

Validation:
- Block 9 final branch #336 success
- Block 9 main #337 success
- Whole-branch review found two timestamp-truthfulness issues; review CI #333 demonstrated them and the strict ISO-instant fix is included in #336
- no open Critical/Important findings

**Next formal gate: Block 10 – Weather Today widget + forecast overlay.** No Block-10 product code has started.

## Current platform

### Core
`frontend/core/` provides routes, persistent navigation, Router, Event Bus, Overlay Service, Health Service, Module Registry/Loader, Capability Registry, Action Registry, Config Service and composition with the Design System.

### Module context
- layout/widget: `events`, `overlays`, `capabilities`, `actions`, `module`
- provider/action: same five + `homeAssistant`
- raw `hass`, Router, Health, Config Service, Design System and Registry/Loader are not exposed to modules
- module config enters through lifecycle config arguments

### Home Assistant boundary
All direct new-runtime HA access belongs under `frontend/ha/`. HA-backed actions use the adapter. The adapter additionally exposes validated `timeZone()` for provider-side HA-local day semantics. Disconnected/unavailable state views expose no stale cached entity data.

### Configuration
One canonical Home Assistant `.storage` Store:
- key `jamesui.config`
- schema version 1
- sections `pages`, `layouts`, `widget_instances`, `dynamic_buttons`, `data_sources`, `module_settings`
- atomic/transactional writes and explicit migrations
- local display calibration remains browser-local

### Design System
`frontend/design/` owns:
- 62 shared `--jui-*` tokens
- shared Surface/Button/Overlay/Dialog primitives
- reduced-motion behavior
- semantic icon sizes `sm | md | lg | xl | hero`
- root-scoped styling only

### Icon system
`frontend/icons/` owns one local immutable semantic registry.

Contract:
- exact initial 40 IDs across `nav.*`, `shell.*`, `weather.*`, `home.*`, `moon.*`
- Tabler Icons v3.48.0 pinned source/style baseline
- checked-in MIT attribution
- JamesUI-specific weather/shutter/moon icons use the same 24×24 / 2.0 px / `currentColor` contract
- SVG creation only through `createElementNS()`
- no runtime Tabler/npm/CDN/fetch/icon-font/SVG-string/XML-parser dependency
- Core navigation uses `nav.start`, `nav.house`, `nav.climate`, `nav.media`, `nav.door`

Implementation ruling: `home.ventilation` uses Tabler `propeller`; the originally planned `fan` source name does not exist in v3.48.0.

### Block 8 layout
Boundary:
`frontend/modules/layout.home-hero-deck/`

Contract:
- exact stable slots `hero`, `widget-left`, `widget-right-main`, `widget-right-footer`
- `getSlot()` and frozen `listSlots()`
- slot identity and children survive `update()`
- optional strict `hero_ratio`; default `0.42`, range `0.35–0.50`
- invalid updates are atomic
- DOM uses `target.ownerDocument`; no module-context expansion
- one continuous lower deck surface
- two-column primary deck; right-main + right-footer stack
- CSS-only `44rem` container fallback
- lower content can grow the deck/scroll area when future widgets are taller than the initial viewport
- shared Block-6 tokens only
- real Registry/Loader lifecycle compatibility tested
- no HA/config/domain/widget logic and no Core Start markup

### Block 9 Weather provider
Boundary:
`frontend/modules/provider.weather/`

Capabilities:
- `weather.current`
- `weather.daily`
- `weather.hourly`
- `weather.sun`
- `weather.moon`
- `weather.atmosphere`

Important behavior:
- explicit configured Weather source never silently falls back
- automatic source selection is deterministic
- genuine Daily/Hourly/Twice-Daily subscriptions use the HA adapter
- Daily fallback priority is usable Daily → Twice-Daily → Hourly
- exact rain time comes only from genuine Hourly data
- forecast calendar-day logic uses HA IANA timezone, including DST/midnight cases
- Sun publishes normalized state/period and strict ISO rising/setting instants
- Moon phase prefers valid configured/discovered HA state, otherwise local verified calculation
- Moon illumination is calculated locally; SunCalc v1.9.0 BSD-2-Clause provenance is checked in
- local Moon calculation passed fixed 2026 reference cases at the predefined ±3 percentage-point illumination tolerance
- atmosphere publishes semantic scene keys only and does not know asset paths
- one five-minute timer refreshes only time-derived cached values, never polls HA
- source-generation guards reject stale forecast callbacks
- capabilities fail independently and never fabricate missing weather data
- no DOM/UI/assets/raw HA/config/r11/production-entry coupling

## r11 / cutover status

r11 is **still the running production/reference frontend**.

`jamesui-entry.js` still loads the old panel/start bridge. The new Core/Design/Icon/Layout/Weather runtime is not wired into production. Do not cut over before Blocks 19–20.

## Block 10 boundary

Block 10 is **Weather Today widget + forecast overlay**.

Goal:
- rebuild the accepted Alpine/weather hero in the Block-8 `hero` slot
- consume only Block-9 weather capabilities; no direct HA access
- use shared Design System and semantic icons
- weekday/date + large time
- current temperature/condition, high/low, real rain/time only when Block 9 provides it
- wind/storm/snow relevance, sunrise/sunset and moon information as appropriate
- temperature interaction opens a forecast overlay through the existing Overlay Service without shifting the hero layout
- preserve the visual intent: premium Alpine-Chic/architectural, near-black/anthracite, restrained champagne accents, no generic Lovelace/card look
- atmosphere/background visuals must be driven by semantic capability/asset mappings rather than hard-coded fake weather data
- missing capability fields produce deliberate empty/unavailable states, not fabricated values

Block 10 must **not** implement Calendar/House/Dynamic Buttons, final Start configuration/composition, or production cutover.

Before Block-10 product code:
1. read current status/foundation/roadmap/baseline plus Block-8 and Block-9 contracts
2. inspect Block-9 capability shapes, Overlay Service, Design/Icon APIs and relevant accepted r11 hero behavior only as visual evidence
3. brainstorm and write the Block-10 design/spec
4. get user spec approval
5. write the detailed implementation plan
6. get user plan approval
7. implement on an isolated branch with TDD
8. plan a OnePlus/Fully portrait visual acceptance checkpoint when enough of the composed hero is visible

## Working preferences

- German
- concise, technical, direct
- repository edits directly through GitHub when available
- every JamesUI response starts `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:`
- one roadmap block at a time
- TDD for behavior changes
- intentionally red tests never to `main`
- approved green blocks merge to `main` without repeated repository confirmation
- update status/roadmap/handover after merged work
- no monkey-patches, Prototype overrides, version-polish files, parallel implementations or permanent legacy shims
- OnePlus Pad 2 portrait is primary visual target; Fully is kiosk shell only

## Fresh-chat prompt

```text
Wir setzen mein Projekt JamesUI aus dem Repository MarkusAureliusTeuton/JamesUI fort.

Bitte arbeite nicht aus Erinnerung, sondern lies zuerst PROJECT_STATUS.md, die Foundation-Spec, die Execution Roadmap, die Baseline und JAMESUI_1_0_NEXT_CHAT.md. Lies für den aktuellen Plattformstand außerdem die Block-8-Spec sowie Block-9-Spec und Block-9-Plan.

Variante B ist verbindlich. Blocks 0 bis 9 sind abgeschlossen, reviewed, grün und auf main. r11 läuft weiterhin produktiv; der neue Core ist noch nicht in den Panel-Bootstrap geschaltet.

Nächster Gate: Block 10 – Weather Today widget + forecast overlay. Beginne mit der vorgesehenen Design-/Spec-Stufe und schreibe noch keinen Block-10-Produktcode vor meiner Freigabe. Das Widget konsumiert ausschließlich die Block-9-Capabilities und nutzt die bestehenden Design/Icon/Overlay-Grenzen. Calendar, House Quick, Dynamic Buttons und finaler Start-Aufbau gehören in spätere Blöcke.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```
