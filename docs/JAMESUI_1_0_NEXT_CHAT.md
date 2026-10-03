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
7. `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-7-icon-asset-system.md`
8. inspect only files relevant to the active block

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

Block 7 merge commit:
`3b1142d9d0491605775f998c1dfe2b39f9791d63`

Validation:
- Block 7 branch #285 success
- Block 7 main #286 success
- Whole-branch review: no open Critical/Important findings

**Next formal gate: Block 8 – `layout.home-hero-deck`.** Block 8 product code has not started.

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

### Block 7 icon system
`frontend/icons/` owns one local immutable semantic registry.

Contract:
- exact initial 40 IDs across `nav.*`, `shell.*`, `weather.*`, `home.*`, `moon.*`
- Tabler Icons v3.48.0 pinned source/style baseline for standard icons
- checked-in MIT attribution
- JamesUI-specific weather/shutter/moon icons use the same 24×24 / 2.0 px / `currentColor` contract
- SVG creation only through `createElementNS()`
- no runtime Tabler/npm/CDN/fetch/icon-font/SVG-string/XML-parser dependency
- decorative by default; labelled standalone icons supported
- unknown/malformed IDs fail with no fallback glyph

Core navigation now uses:
`nav.start`, `nav.house`, `nav.climate`, `nav.media`, `nav.door`.

Implementation ruling: `home.ventilation` uses Tabler `propeller`; the originally planned `fan` source name does not exist in v3.48.0.

Existing `assets/weather/*.svg` are large weather/background illustrations, not the new icon family, and remain untouched.

## r11 / cutover status

r11 is **still the running production/reference frontend**.

`jamesui-entry.js` still loads the old panel/start bridge. The new Core/Design/Icon runtime is not wired into production. Do not cut over before Blocks 19–20.

## Block 8 boundary

Block 8 is **`layout.home-hero-deck`**.

Known foundation contract:
- layout only; no Home Assistant/business logic
- intended slots:
  - `hero`
  - `widget-left`
  - `widget-right-main`
  - `widget-right-footer`
- later assignment will be Weather Today / Calendar Agenda / House Quick / Dynamic Buttons, but those later widgets/providers are not implemented in Block 8
- preserve the accepted Start composition: Alpine/weather hero above one intentional lower deck extending to persistent bottom navigation
- OnePlus Pad 2 portrait is the primary target

Before Block-8 product code:
1. read current status/foundation/roadmap
2. inspect relevant Core/Design/Icon/layout infrastructure only
3. complete the required Block-8 design/planning stage
4. get user approval
5. implement on an isolated branch with TDD

Do not pull forward Block 9+ weather/provider/widget/domain logic.

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

Bitte arbeite nicht aus Erinnerung, sondern lies zuerst PROJECT_STATUS.md, die Foundation-Spec, die Execution Roadmap, die Baseline und JAMESUI_1_0_NEXT_CHAT.md. Lies außerdem die Block-7-Icon-Spec und den Block-7-Plan, damit die neue visuelle Infrastruktur klar ist.

Variante B ist verbindlich. Blocks 0 bis 7 sind abgeschlossen, reviewed, grün und auf main. r11 läuft weiterhin produktiv; der neue Core ist noch nicht in den Panel-Bootstrap geschaltet.

Nächster Gate: Block 8 – layout.home-hero-deck. Beginne mit der vorgesehenen Design-/Planungsstufe und schreibe noch keinen Block-8-Produktcode vor meiner Freigabe. Block 8 ist nur das wiederverwendbare Start-Layout; keine Weather/Calendar/House Provider oder Widgets, keine Dynamic Buttons und kein Cutover vorziehen.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```
