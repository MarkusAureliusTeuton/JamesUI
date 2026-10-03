# JamesUI 1.0 – Next Chat / New ChatGPT Project Handover

_Date: 2026-10-03_

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
6. `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-7-icon-asset-system-design.md`
7. `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-8-home-hero-deck-design.md`
8. `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-8-home-hero-deck.md`
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

Block 8 merge commit:
`e13d8e386ee3bbbc5d86bd88c068315018fc4647`

Validation:
- Block 8 final branch #301 success
- Block 8 main #302 success
- Whole-branch review found one Important content-growth issue; RED #300 captured it and the final fix is green
- no open Critical/Important findings

**Next formal gate: Block 9 – Weather provider.** Block 9 product code has not started.

## Current platform

### Core
`frontend/core/` provides routes, persistent navigation, Router, Event Bus, Overlay Service, Health Service, Module Registry/Loader, Capability Registry, Action Registry, Config Service and composition with the Design System.

### Module context
- layout/widget: `events`, `overlays`, `capabilities`, `actions`, `module`
- provider/action: same five + `homeAssistant`
- raw `hass`, Router, Health, Config Service, Design System and Registry/Loader are not exposed to modules
- module config enters through lifecycle config arguments

### Home Assistant boundary
All direct new-runtime HA access belongs under `frontend/ha/`. HA-backed actions use the adapter. Disconnected/unavailable state views expose no stale cached entity data.

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
- manifest ID `layout.home-hero-deck`, type `layout`, version `1.0.0`
- no dependencies or required/provided capabilities
- exact stable slots:
  - `hero`
  - `widget-left`
  - `widget-right-main`
  - `widget-right-footer`
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
- real Registry/Loader load/mount/update/reload/destroy compatibility tested
- no HA/config/domain/widget logic and no Core Start markup

## r11 / cutover status

r11 is **still the running production/reference frontend**.

`jamesui-entry.js` still loads the old panel/start bridge. The new Core/Design/Icon/Layout runtime is not wired into production. Do not cut over before Blocks 19–20.

## Block 9 boundary

Block 9 is **Weather provider**.

Roadmap goal:
- normalized `weather.current`
- normalized `weather.daily`
- optional normalized `weather.hourly`
- sun information
- moon information
- atmosphere/background-selection inputs
- provider owns Home Assistant discovery/subscriptions/normalization
- all direct HA interaction goes through the existing Home Assistant Adapter
- explicit unavailable/not-configured behavior; never fabricate weather data

Reusable behavior candidates from the baseline include configured weather source preference, daily forecast normalization, sun-period logic, first-rain-time only from genuinely granular data, and moon details where appropriate. Re-evaluate old heuristics rather than copying legacy panel code.

Block 9 must **not** implement the Weather Today visual widget or forecast overlay; those are Block 10. It also must not compose Start, implement Calendar/House/Dynamic Buttons, or cut over production.

Before Block-9 product code:
1. read current status/foundation/roadmap/baseline
2. inspect current HA Adapter, Capability Registry, module contracts and only relevant legacy weather logic as evidence
3. brainstorm and write the Block-9 architectural spec
4. get user spec approval
5. write the detailed implementation plan
6. get user plan approval
7. implement on an isolated branch with TDD

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

Bitte arbeite nicht aus Erinnerung, sondern lies zuerst PROJECT_STATUS.md, die Foundation-Spec, die Execution Roadmap, die Baseline und JAMESUI_1_0_NEXT_CHAT.md. Lies für den aktuellen Plattformstand außerdem die Block-8-Spec und den Block-8-Plan.

Variante B ist verbindlich. Blocks 0 bis 8 sind abgeschlossen, reviewed, grün und auf main. r11 läuft weiterhin produktiv; der neue Core ist noch nicht in den Panel-Bootstrap geschaltet.

Nächster Gate: Block 9 – Weather provider. Beginne mit der vorgesehenen Architektur-/Designstufe und schreibe noch keinen Block-9-Produktcode vor meiner Freigabe. Block 9 normalisiert Weather/Sun/Moon/Atmosphere hinter Capability Registry und HA Adapter; Weather Today UI und Forecast Overlay gehören erst zu Block 10.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```
