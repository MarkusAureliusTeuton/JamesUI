# JamesUI 1.0 – Next Chat / New ChatGPT Project Handover

_Date: 2026-10-03_

Use this document to start a fresh JamesUI conversation without relying on old chat history.

## Canonical repository

`MarkusAureliusTeuton/JamesUI`

Default branch: `main`

The repository is the source of truth.

## Required reading order

1. `PROJECT_STATUS.md`
2. `docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`
3. `docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`
4. `docs/JAMESUI_1_0_BASELINE.md`
5. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-1-core-shell.md`
6. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-2-module-system.md`
7. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-3-capability-action-registries.md`
8. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-4-home-assistant-adapter.md`
9. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-5-config-store-migrations.md`
10. `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-6-design-system.md`
11. inspect current files only as required by the active block

## Binding direction

Variant B remains binding:
- build the clean JamesUI 1.0 runtime in parallel
- r11 remains production/reference until controlled cutover
- port only desired behavior
- switch once the cutover gate is satisfied
- delete obsolete legacy code afterwards
- Git history is the archive

No normal feature development on the r11 architecture.

## Current execution state

Completed and merged:
- Block 0 – Baseline ✅
- Block 1 – Core shell ✅ PR #13
- Block 2 – Module system ✅ PR #14
- Block 3 – Capability/Action registries ✅ PR #15
- Block 4 – Home Assistant Adapter ✅ PR #16
- Block 5 – Versioned Config Store + migrations ✅ PR #17
- Block 6 – Design System + base components ✅ PR #18

Block 6 merge commit:
`869a8b28e34750479b5d458d5c498c335b472002`

Validation:
- Block 6 branch #269 success
- Block 6 main #270 success

**Next formal gate: detailed implementation plan for Block 7 – Icon library and asset registry.**

Block 7 product code has not started.

## Current JamesUI 1.0 platform

### Core
`custom_components/jamesui/frontend/core/` provides:
- canonical routes `home | house | climate | media | door`
- persistent `Start | Haus | Klima | Medien | Tür` navigation
- structural shell
- Router
- Event Bus for transient technical/UI/lifecycle events only
- Overlay Service
- Health Service
- Module Registry + Loader
- Capability Registry
- Action Registry
- read-only Home Assistant Adapter reference
- read-only Config Service reference
- internally composed root-scoped Design System

### Module contract
Initial module types:
- `layout`
- `widget`
- `provider`
- `action`

Manifest fields keep these concepts separate:
- `depends_on`
- `requires_capabilities`
- `provides_capabilities`

Lifecycle:
- `create(context, config)`
- `mount(target)`
- `update(nextContext, nextConfig)`
- `destroy()`

Module context after Block 6 remains:
- layout/widget: `events`, `overlays`, `capabilities`, `actions`, `module`
- provider/action: same five + `homeAssistant`
- Config Service and Design System are intentionally **not** in module context
- module config is passed via lifecycle config arguments
- raw `hass`, Router, Health, Module Registry/Loader remain absent

### Capability / Action runtime
Capability states:
- `available`
- `unavailable`
- `not_configured`

Action results:
- `success`
- `unavailable`
- `rejected`
- `error`

Real actions:
- `navigate`
- `url.open`
- `entity.toggle`
- `ha.service`
- `scene.activate`

### Home Assistant boundary
All direct new-runtime HA access belongs under:
`custom_components/jamesui/frontend/ha/`

The adapter owns state/entity/domain access, connection state, service calls, WebSocket calls/subscriptions, registry helpers and cleanup.

Provider/action modules may receive the adapter. Layouts/widgets never do.

Disconnected/unavailable states expose no stale cached entity values.

## Structured configuration result to preserve

Canonical persistence is one versioned Home Assistant Store:
- key `jamesui.config`
- schema version `1`
- atomic writes

Schema:
```json
{
  "schema_version": 1,
  "pages": {},
  "layouts": {},
  "widget_instances": {},
  "dynamic_buttons": {},
  "data_sources": {},
  "module_settings": {}
}
```

Temporary r11 config compatibility remains until Block 20/21, backed by the same Store. Frontend `core.config` uses the Home Assistant Adapter only. Local display calibration stays browser-local.

## Block 6 result to preserve

New design boundary:
`custom_components/jamesui/frontend/design/`

### Tokens
`tokens.js` exports one frozen 62-token `--jui-*` contract covering:
- near-black/anthracite canvas and surfaces
- restrained champagne accent
- primary/secondary/muted/status colors
- system typography scale/weights
- spacing 1–9
- radii
- blur
- shadows/highlights
- shared motion/easing
- icon sizes `sm | md | lg | xl | hero`

### Design runtime
`design-system.js` mounts one local style element below `[data-jui-design-root]`.
- no global Home Assistant CSS mutation
- same-root mount is idempotent
- moving/destroying cleans old style/marker
- reduced-motion collapses shared duration tokens to `0ms`

### Base primitives
`primitives.js` provides:
- surfaces: `default | raised | glass`
- buttons: `default | ghost | accent`
- button sizes: `sm | md | lg`
- overlay presentation frame
- accessible dialog frame/title/body/actions

Core navigation now uses the shared ghost-button primitive while keeping the same route behavior.

### Architecture constraints after Block 6
- no raw application palette values outside central tokens in the new design boundary
- no `!important`
- no asset URLs/data-image/inline-SVG hacks in the Design System
- no direct HA access in `frontend/design/`
- Design System is not in module context
- Block 6 added no icon library and no final Start layout

Implementation note: one old r11 rain-time test contained a hard-coded date and expired on 2026-10-03. Only the test fixture was made relative to the current local day; no r11 product source changed.

## r11 / cutover status

r11 is **still the running production/reference frontend**.

`jamesui-entry.js` still loads the old panel/start bridge. The new Core is not wired into production yet.

Do not cut over before Blocks 19–20.

## Block 7 boundary

Block 7 – **Icon library and asset registry** establishes one local reusable SVG icon system for all future new UI.

Roadmap intent:
- local SVG asset structure
- stable icon IDs / registry
- consistent line weight and `currentColor`
- initial navigation icons
- weather icons
- house/control icons
- moon-phase icons
- asset/registry validation tests

Important boundaries:
- use the Block-6 icon-size tokens and design primitives where useful
- normal new controls should not rely on Unicode glyphs
- do not duplicate inline SVG fragments across widgets
- all icons/assets must be local/offline
- no Block-8 Start layout yet
- no weather/calendar/house provider implementation yet
- no production cutover

Before any Block-7 product code:
1. inspect the approved architecture spec, roadmap and Block-6 design interfaces
2. inspect retained/current icon references only to decide what concepts need stable IDs; do not copy the old mixed implementation blindly
3. create the detailed Block-7 implementation plan
4. review it for asset ownership, registry behavior, accessibility/themeability and architecture boundaries
5. wait for user approval

## Start page direction to preserve for later blocks

- persistent bottom navigation `Start | Haus | Klima | Medien | Tür`
- Alpine/weather hero
- weekday/date + large clock
- current temperature/weather
- high/low, rain/time, wind/storm, snow relevance, sunrise/sunset, moon
- temperature tap opens forecast overlay without layout shift
- lower shared deck extending to bottom navigation
- Calendar left
- House Quick right/main
- four configurable Dynamic Buttons below
- dark/translucent Alpine-Chic treatment with restrained warm champagne shimmer
- no labels `Home`, `HEUTE & DANACH`, `ZUHAUSE`

## Working preferences

- German
- concise, technical, direct
- repository edits directly through GitHub when available
- no unnecessary copy/paste instructions to the user
- one roadmap block at a time
- TDD for behavior changes
- intentionally red tests never to `main`
- approved green blocks merge to `main` without repeated confirmation
- update status/roadmap/handover after merged work
- no new monkey-patches, Prototype overrides, version-polish files, duplicate implementations or permanent compatibility shims
- OnePlus Pad 2 portrait is primary visual target
- Fully is only the kiosk shell

## Fresh-chat prompt

```text
Wir setzen mein Projekt JamesUI aus dem Repository MarkusAureliusTeuton/JamesUI fort.

Bitte arbeite nicht aus Erinnerung, sondern lies zuerst:
1. PROJECT_STATUS.md
2. docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md
3. docs/JAMESUI_1_0_EXECUTION_ROADMAP.md
4. docs/JAMESUI_1_0_BASELINE.md
5. docs/JAMESUI_1_0_NEXT_CHAT.md
6. die vorhandenen Block-Pläne 1 bis 6

Variante B ist verbindlich. Blocks 0 bis 6 sind abgeschlossen, grün und auf main. r11 läuft weiterhin produktiv; der neue Core ist noch nicht in den Panel-Bootstrap geschaltet.

Nächster Gate: Erstelle den detaillierten Implementierungsplan für Block 7 – Icon library and asset registry. Noch keinen Block-7-Produktcode schreiben, bevor der Plan geprüft und freigegeben ist.

Block 7 soll ein lokales, stabiles SVG/currentColor-Iconsystem mit Registry und validierten Asset-IDs aufbauen. Nutze den neuen Block-6-Design-Unterbau, ziehe aber weder Block 8 Start-Layout noch Domain-Provider oder Cutover vor.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine neuen Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```
