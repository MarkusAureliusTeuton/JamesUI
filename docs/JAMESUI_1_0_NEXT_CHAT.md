# JamesUI 1.0 – Next Chat / New ChatGPT Project Handover

_Date: 2026-10-02_

Use this document to start a completely fresh conversation or a dedicated ChatGPT Project without relying on old chat history.

## Canonical repository

`MarkusAureliusTeuton/JamesUI`

Default branch: `main`

The repository is the source of truth. Do not reconstruct architecture from memory when these files are available.

## Required reading order for a new chat

1. `PROJECT_STATUS.md`
2. `docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`
3. `docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`
4. `docs/JAMESUI_1_0_BASELINE.md`
5. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-1-core-shell.md`
6. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-2-module-system.md`
7. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-3-capability-action-registries.md`
8. `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-4-home-assistant-adapter.md`
9. inspect current Core/runtime/backend files only as required by the active block plan

The r11 implementation remains the running design/reference runtime. The approved strategic direction is **Variant B: clean JamesUI 1.0 foundation in parallel, controlled cutover, then delete the old implementation**.

## Current process state

The written architecture specification has been reviewed, clarified and **approved**.

Approved clarifications included in the canonical spec/roadmap:

- manifest module dependencies are separate from required/provided capabilities,
- Block 3 defines the Action Registry and HA-backed action contracts with fakes; real HA-backed actions are implemented only in Block 4 through the HA Adapter,
- Event Bus is restricted to transient technical/UI/lifecycle events and cannot bypass Capabilities or Actions.

**Block 0 – Baseline and preservation tests is complete and merged.**

**Block 1 – JamesUI Core shell is complete, green and merged through PR #13.** Main validation #192 succeeded.

**Block 2 – Module manifest, registry and loader is complete, green and merged through PR #14.** Branch validation #196 and main validation #197 succeeded.

**Block 3 – Capability Registry and Action Registry is complete, green and merged through PR #15.** Branch validation #212 and main validation #214 succeeded.

**Block 4 – Home Assistant Adapter is complete, green and merged through PR #16.** Branch validation #229 and main validation #230 succeeded.

The next formal gate is the detailed implementation plan/review for **Block 5 – Versioned configuration store and migrations**. Block 5 product code has not started.

## Block 1 result to preserve

The parallel Core under `custom_components/jamesui/frontend/core/` provides:

- canonical routes `home | house | climate | media | door`
- internal router and persistent `Start | Haus | Klima | Medien | Tür` navigation
- structural app shell and isolated page-error state
- transient technical Event Bus
- single-active Overlay Service with stale-close protection
- generic keyed Health Service
- opaque host-context handoff for `hass`, `narrow`, `route`, `panel`
- Core composition entry with read-only service references
- architecture guards preventing direct HA access and legacy coupling

## Block 2 result to preserve

Block 2 added the modular runtime contract:

- `CORE_API_VERSION = 1.0.0` with narrow `N.x` compatibility checks
- strict manifests with separate `depends_on`, `requires_capabilities`, `provides_capabilities`
- supported module types `layout`, `widget`, `provider`, `action`
- immutable Module Registry with concrete dependency checks and capability declaration ownership
- versioned Module Loader using module-specific `v=` import tokens
- lifecycle `create / mount / update / destroy`
- isolated per-module reload generation via `r=`
- module health isolation through `module:<id>`
- Core composition exposes read-only `moduleRegistry` and `moduleLoader`
- test-only fixture modules and dedicated manifest/Registry/Loader CI coverage

## Block 3 result to preserve

Block 3 added runtime exchange contracts.

### Capability Registry

- provider runtime registration is tied to Module Registry capability declaration ownership
- explicit states: `available | unavailable | not_configured`
- consumers can subscribe to named capabilities without importing provider internals
- current state is emitted immediately by default
- provider removal publishes explicit synthetic `unavailable` and invalidates stale provider handles
- subscriber failures are isolated without using Event Bus as the data channel

### Action Registry

- generic action provider registration/dispatch
- normalized results: `success | unavailable | rejected | error`
- Action Registry errors use keyed Health Service records
- HA-independent Core actions:
  - `navigate`
  - `url.open`

### Module context foundation

Module Loader requests context with `{ id, manifest }` for both create and update. The Block-3 five-key safe module context remains the basis for all modules:

- `events`
- `overlays`
- `capabilities`
- `actions`
- frozen `module` identity (`id`, `type`, `version`)

Block 4 extends only provider/action contexts with the HA Adapter. Raw `hass`, `narrow`, host `route`, `panel`, raw Router, Health Service and Module Registry/Loader remain absent from module contexts.

## Block 4 result to preserve

Block 4 introduced the **Home Assistant Adapter**, the only permitted direct Home Assistant runtime boundary for the new architecture.

### Adapter responsibilities

- private ownership of the current panel-supplied `hass` object
- explicit connection state: `unavailable | connected | disconnected`
- entity state lookup and domain queries
- entity/domain subscriptions driven by successive HA host snapshots
- disconnected/unavailable state views are deliberately empty, so stale cached HA state is not exposed
- generic `callService(domain, service, data, target)`
- generic `callWS(message)`
- WebSocket streaming subscriptions through `connection.subscribeMessage`
- area/device/entity registry helpers
- deterministic local and remote subscription cleanup
- reusable fake adapter for provider/action tests

### Action integration

Real Action Registry providers now exist for:

- `entity.toggle`
- `ha.service`
- `scene.activate`

These production action providers call the Home Assistant Adapter only. `HomeAssistantUnavailableError` normalizes to Action Registry `unavailable`; other backend failures normalize to `error` through the existing registry/health path.

### Module-context boundary after Block 4

- `layout` and `widget`: exactly `events`, `overlays`, `capabilities`, `actions`, `module`
- `provider` and `action`: the same five keys plus `homeAssistant`
- raw `hass`, `narrow`, host `route`, `panel`, Router, Health Service and Module Registry/Loader remain absent everywhere

### Architecture guard

- direct new-runtime HA access is confined to `custom_components/jamesui/frontend/ha/`
- Core composes the adapter but may not directly use raw `hass.states`, `hass.callService`, `hass.callWS` or `connection.subscribeMessage`
- HA-backed action identifiers live in the HA boundary, not Core
- production `jamesui-entry.js` is still the legacy r11 runtime; no cutover occurred

The new Core/module/capability/action/HA runtime remains **unwired from `jamesui-entry.js`**. The running panel stays r11 until the controlled cutover.

## Block 5 boundary

Block 5 replaces the current flat configuration model with a **versioned structured configuration store and explicit migrations**.

Roadmap scope:

- versioned backend storage
- schema validation
- config service/API
- migration framework
- initial schema sections:
  - `pages`
  - `layouts`
  - `widget_instances`
  - `dynamic_buttons`
  - `data_sources`
  - `module_settings`
- deterministic migration of the relevant current r11 config values inventoried in `docs/JAMESUI_1_0_BASELINE.md`
- local-only display calibration remains outside shared configuration

Hard boundaries for Block 5:

- no design-system work yet
- no weather/calendar/house/media/climate/door domain implementation
- no production cutover
- no fake data
- migration must be explicit, idempotent and tested
- invalid structured configuration must be rejected rather than silently repaired into a different meaning

## Working preferences

- German communication
- concise technical collaboration
- repository changes directly through GitHub when access is available
- no unnecessary user copy/paste
- approved green work merges to `main` without repeated repository confirmation
- one implementation block at a time
- TDD for behavior changes
- intentionally red tests never go to `main`
- keep `PROJECT_STATUS.md`, roadmap and this handover current
- OnePlus Pad 2 portrait is the primary visual target
- Fully is the kiosk/display shell only
- Home Assistant is backend/source of truth; KNX remains primary building automation
- no new monkey-patches, version-specific polish layers, duplicate implementations or permanent compatibility shims

## Product goal in one paragraph

JamesUI is a permanent wall-tablet interface that shows important household information at a glance and gives fast access to common KNX/Home Assistant controls, while allowing deeper control pages for ventilation schedules, heating modes, shutters, appliances, media and door/camera functions. The permanent architecture is modular: pages select layouts, layouts expose slots, widgets consume registered capabilities, actions dispatch through an Action Registry, configuration is structured/versioned/migratable, modules have independent versions and lifecycles, and the visual language comes from one design system and icon library.

## Start page direction to preserve

- persistent bottom navigation `Start | Haus | Klima | Medien | Tür`
- upper Alpine/weather hero
- weekday/date + large time
- current temperature and weather
- max/min, rain/time, wind/storm, snow relevance, sunrise/sunset, moon
- tap current temperature for forecast overlay without layout shift
- lower shared widget deck starting below/overlapping the hero and extending to bottom navigation
- Calendar left, House Quick right, four configurable Dynamic Buttons below House Quick
- dark/translucent Alpine-Chic surface with restrained warm shimmer
- no labels `Home`, `HEUTE & DANACH`, `ZUHAUSE`

## Legacy policy

Keep old r11 only until the new architecture reaches the cutover gate. After cutover, delete obsolete production code/assets/tests. Git history is the archive; do not create permanent legacy source trees.

## Copy/paste start prompt for a fresh chat

```text
Wir setzen mein Projekt JamesUI aus dem Repository MarkusAureliusTeuton/JamesUI fort.

Bitte arbeite NICHT aus Erinnerung oder alten Chat-Zusammenfassungen, sondern lies zuerst im Repository:
1. PROJECT_STATUS.md
2. docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md
3. docs/JAMESUI_1_0_EXECUTION_ROADMAP.md
4. docs/JAMESUI_1_0_BASELINE.md
5. docs/JAMESUI_1_0_NEXT_CHAT.md
6. docs/superpowers/plans/2026-10-02-jamesui-1.0-block-1-core-shell.md
7. docs/superpowers/plans/2026-10-02-jamesui-1.0-block-2-module-system.md
8. docs/superpowers/plans/2026-10-02-jamesui-1.0-block-3-capability-action-registries.md
9. docs/superpowers/plans/2026-10-02-jamesui-1.0-block-4-home-assistant-adapter.md

Variante B und die schriftliche Architektur-Spec sind verbindlich freigegeben. Blocks 0 bis 4 sind abgeschlossen, grün und nach main integriert. Der neue Core inklusive Module Registry/Loader, Capability-/Action-Runtime und Home Assistant Adapter liegt parallel unter custom_components/jamesui/frontend/ und ist noch nicht in den laufenden r11-Home-Assistant-Panel-Bootstrap geschaltet.

Nächster Gate: Erstelle und prüfe den detaillierten Implementierungsplan für Block 5 – Versioned configuration store and migrations. Noch keinen Block-5-Produktcode schreiben, bevor der Plan geprüft und freigegeben ist.

Block 5 ersetzt die aktuelle flache Konfiguration durch einen versionierten strukturierten Store mit Schema-Validierung, Config-Service/API und expliziten, idempotenten Migrationen. Die initialen Bereiche sind pages, layouts, widget_instances, dynamic_buttons, data_sources und module_settings. Die relevanten r11-Werte aus docs/JAMESUI_1_0_BASELINE.md müssen deterministisch migriert werden; lokale Display-Kalibrierung bleibt außerhalb der Shared Config. Kein Design-System, keine Domain-Provider und kein Cutover in Block 5.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. Keine manuellen Copy/Paste-Anweisungen an mich, wenn du selbst committen kannst. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine neuen Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```

## Recommended dedicated ChatGPT Project name

`JamesUI 1.0`
