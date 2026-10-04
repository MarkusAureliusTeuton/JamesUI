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
8. `docs/superpowers/specs/2026-10-04-jamesui-1.0-block-10-weather-today-design.md`
9. `docs/superpowers/plans/2026-10-04-jamesui-1.0-block-10-weather-today.md`
10. inspect only files relevant to the active block

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
- Block 10 – `widget.weather-today` + forecast overlay ✅ PR #22

Block 10 merge commit:
`f8abbbb28588e210e87727f5fcb3a68984766887`

Validation:
- Block 10 final branch #378 success; full job rerun on unchanged head also passed
- Block 10 main #379 success on the merge commit
- whole-branch review found one Important `pouring` presentation mismatch; a focused RED regression preceded the fix to `Starker Regen` + alert emphasis
- permanent architecture guards protect widget boundaries, local Alpine allowlist, Core weather neutrality and legacy production entry
- no open Critical/Important findings
- no deterministic browser/screenshot harness exists; screenshot-level Block-10 acceptance was not claimed. Full composed OnePlus/Fully portrait acceptance remains required at Block 14 / pre-cutover.

**Next formal gate: Block 11 – Calendar provider + Calendar Agenda widget.** No Block-11 product code has started.

## Current platform

### Core
`frontend/core/` provides routes, persistent navigation, Router, Event Bus, Overlay Service, Health Service, Module Registry/Loader, Capability Registry, Action Registry, Config Service and composition with the Design System.

The shell now generically mounts same-document DOM element content from Overlay Service descriptors. This is domain-neutral; Core has no Weather Today special case.

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

### Design System / icons
`frontend/design/` owns the 62-token root-scoped design contract and shared Surface/Button/Overlay/Dialog primitives.

`frontend/icons/` owns the immutable local 40-ID semantic icon registry, using pinned Tabler v3.48.0 provenance plus JamesUI-specific weather/shutter/moon icons. No runtime CDN/npm/fetch/icon-font/SVG-string dependency.

### Block 8 layout
Boundary: `frontend/modules/layout.home-hero-deck/`

Contract:
- stable slots `hero`, `widget-left`, `widget-right-main`, `widget-right-footer`
- `getSlot()` / frozen `listSlots()`
- strict optional `hero_ratio`, default `0.42`, range `0.35–0.50`
- atomic updates preserve slot identity/children
- continuous lower deck, two-column primary geometry, CSS-only `44rem` fallback
- tall widget content grows deck/page scroll
- no domain logic/Core Start markup

### Block 9 Weather provider
Boundary: `frontend/modules/provider.weather/`

Capabilities:
- `weather.current`
- `weather.daily`
- `weather.hourly`
- `weather.sun`
- `weather.moon`
- `weather.atmosphere`

Important behavior:
- deterministic source selection; explicit configured source never silently falls back
- real Daily/Hourly/Twice-Daily HA forecast subscriptions
- Daily fallback priority usable Daily → Twice-Daily → Hourly
- exact rain start only from genuine Hourly data
- validated additive timezone metadata supports truthful consumer formatting
- day grouping uses HA IANA timezone
- Sun strict ISO instants + semantic period
- Moon prefers valid HA phase, otherwise verified local SunCalc-based fallback
- atmosphere exposes semantic scene keys only
- five-minute time-derived refresh, no HA polling
- source-generation guards reject stale callbacks
- no DOM/UI/assets/raw HA/config/r11 coupling

### Block 10 Weather Today
Boundary: `frontend/modules/widget.weather-today/`

Important behavior:
- consumes only the six Block-9 weather capabilities
- strict empty V1 config; no direct HA
- stable Alpine hero DOM
- device-local German date + `HH:MM` clock with one aligned timeout
- temperature is the accessible forecast trigger
- truthful current condition, today high/low, genuine rain/time, wind/gust, sunrise/sunset and moon facts
- exact eight-scene local Alpine asset allowlist + neutral fallback
- seven restrained facts in one primary row with CSS container fallback
- forecast overlay: up to 12 future Hourly + 7 current/future Daily entries, explicit HA timezone, clean empty states
- live updates preserve important DOM identity
- stale-safe overlay ownership and complete cleanup on update/reload/destroy
- real Registry/Loader integration and capability ownership are tested
- no Core weather branching, r11 copy, old weather SVG dependency, raw palette or remote assets

## r11 / cutover status

r11 is **still the running production/reference frontend**.

`jamesui-entry.js` still loads the old panel/start bridge. The new Core/Design/Icon/Layout/Weather/Weather-Today runtime is not wired into production. Do not cut over before Blocks 19–20.

## Block 11 boundary

Block 11 is **Calendar provider + Calendar Agenda widget**.

Initial goal:
- use real configured Home Assistant calendar data only
- define normalized Calendar capability contract before widget implementation
- deterministic configured-calendar selection; no fabricated demo events
- normalize event identity, start/end, all-day semantics, titles and source calendar
- define explicit timezone/day-boundary behavior compatible with Home Assistant/local household semantics
- deduplicate repeated/overlapping source representations where required by the retained UX
- distinguish unavailable/not-configured/empty states
- provider owns HA subscriptions/queries; widget consumes capabilities only
- Calendar Agenda mounts in Block-8 `widget-left` later without final Start composition in Block 11
- preserve premium quiet deck styling rather than generic HA cards

Block 11 must **not** implement House Quick, Dynamic Buttons, final Start composition, production bootstrap switch or cutover.

Before Block-11 product code:
1. read current status/foundation/roadmap/baseline and Blocks 8–10 contracts
2. inspect existing Config Store data-source shape, HA adapter calendar support/gaps and retained r11 calendar behavior as evidence
3. brainstorm 2–3 provider/widget boundary approaches if architecture choices remain
4. write and get approval for the binding Block-11 design/spec
5. write the detailed implementation plan
6. get plan approval
7. implement in an isolated branch with TDD, whole-branch review and fresh CI

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

Bitte arbeite nicht aus Erinnerung, sondern lies zuerst PROJECT_STATUS.md, die Foundation-Spec, die Execution Roadmap, die Baseline und JAMESUI_1_0_NEXT_CHAT.md. Lies für den aktuellen Plattformstand außerdem die Block-8-, Block-9- und Block-10-Spec sowie den Block-10-Plan.

Variante B ist verbindlich. Blocks 0 bis 10 sind abgeschlossen, reviewed, grün und auf main. Block 10 wurde über PR #22 mit Merge f8abbbb28588e210e87727f5fcb3a68984766887 integriert; Main-CI #379 ist grün. r11 läuft weiterhin produktiv; der neue Core ist noch nicht in den Panel-Bootstrap geschaltet.

Nächster Gate: Block 11 – Calendar provider + Calendar Agenda widget. Beginne mit Repo-/Vertragsanalyse und der vorgesehenen Design-/Spec-Stufe. Schreibe noch keinen Block-11-Produktcode vor meiner Freigabe. Der Provider soll reale Home-Assistant-Kalenderdaten normalisieren; das Widget konsumiert nur Capabilities. House Quick, Dynamic Buttons, finaler Start-Aufbau und Cutover gehören in spätere Blöcke.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```
