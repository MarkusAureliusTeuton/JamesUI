# JamesUI 1.0 – Next Chat / New ChatGPT Project Handover

_Date: 2026-10-02_

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
10. inspect current files only as required by the active block

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

Block 5 merge commit:
`1882bd85a4918a80a487d6044f1a6baf25b06fc9`

Validation:
- branch #253 success
- main #254 success

**Next formal gate: detailed implementation plan for Block 6 – Design system and base components.**

Block 6 product code has not started.

## Current JamesUI 1.0 platform

### Core
`custom_components/jamesui/frontend/core/` now provides:
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

Module context:
- layout/widget: `events`, `overlays`, `capabilities`, `actions`, `module`
- provider/action: same five + `homeAssistant`
- Config Service is intentionally **not** in module context
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

## Block 5 result to preserve

Canonical persistence is now one versioned Home Assistant Store:
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

Behavior:
- strict schema/container validation
- JSON-safe nested values
- transactional writes
- serialized update transforms
- failed validation/store write leaves current config unchanged
- explicit future schema migration framework
- unsupported/newer versions do not silently downgrade

All 15 retained r11 config values migrate deterministically into structured `data_sources` / `module_settings`.

On initialization:
- existing structured Store wins over stale legacy options
- known legacy option keys are removed only after successful Store initialization
- unrelated config-entry options are preserved

Temporary r11 compatibility until Block 20/21:
- `jamesui/config`
- `jamesui/config/update`

These project/patch the same Store, not a second persistence copy.

Structured API:
- `jamesui/config/get`
- `jamesui/config/replace`

Frontend `core.config` uses the Home Assistant Adapter only.

Local display calibration stays in browser-local `jamesui-display-calibration` and is not shared/migrated.

## r11 / cutover status

r11 is **still the running production/reference frontend**.

`jamesui-entry.js` still loads the old panel/start bridge. The new Core is not wired into production yet.

Do not cut over before Blocks 19–20.

## Block 6 boundary

Block 6 – **Design system and base components** should establish one shared visual language for all upcoming new UI.

Roadmap scope:
- colors
- typography
- spacing
- radii
- borders/highlights
- shadows/blur
- motion tokens
- icon-size tokens
- common surface primitives
- common button primitives
- common overlay/dialog primitives

Important boundaries:
- no Block-7 icon registry/assets yet
- no Block-8 Start layout implementation yet
- no weather/calendar/house domain logic
- no production cutover
- no new visual constants scattered into modules
- use the approved Alpine-Chic direction and OnePlus Pad 2 portrait as the target, but Block 6 should build reusable primitives rather than the final Start screen

Before any Block-6 product code:
1. inspect current spec/roadmap and relevant r11 visual reference
2. create the detailed Block-6 implementation plan
3. review it for completeness and boundary violations
4. wait for user approval

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
6. die vorhandenen Block-Pläne 1 bis 5

Variante B ist verbindlich. Blocks 0 bis 5 sind abgeschlossen, grün und auf main. r11 läuft weiterhin produktiv; der neue Core ist noch nicht in den Panel-Bootstrap geschaltet.

Nächster Gate: Erstelle den detaillierten Implementierungsplan für Block 6 – Design system and base components. Noch keinen Block-6-Produktcode schreiben, bevor der Plan geprüft und freigegeben ist.

Block 6 soll die wiederverwendbaren Design-Tokens und Basisprimitives für JamesUI 1.0 definieren. Noch keine Block-7-Iconbibliothek, keine Block-8-Startseite, keine Domain-Provider und kein Cutover vorziehen.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine neuen Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```
