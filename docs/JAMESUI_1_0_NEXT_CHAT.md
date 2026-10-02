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
8. inspect current Core/module-system files only as required by the active block plan

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

The detailed implementation plan for **Block 3 – Capability Registry and Action Registry** now exists at:

`docs/superpowers/plans/2026-10-02-jamesui-1.0-block-3-capability-action-registries.md`

The next formal gate is **review/approval of the Block 3 plan**. Block 3 product-code implementation has not started. Do not start Block 4 or other dependent JamesUI 1.0 product-code work before Block 3 is completed and merged green.

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
- module context contains only `events` and `overlays`; raw Home Assistant host context is not exposed
- test-only fixture modules and dedicated manifest/Registry/Loader CI coverage

`requires_capabilities` and `provides_capabilities` are still declaration metadata only. Block 2 does **not** provide runtime capability values or subscriptions.

The new Core/module system remains **unwired from `jamesui-entry.js`**. The running panel stays r11 until the controlled cutover.

## Block 3 planned boundary

Block 3 introduces runtime exchange contracts without Home Assistant access.

### Capability Registry

- provider runtime registration is tied to Module Registry capability declaration ownership
- explicit states: `available | unavailable | not_configured`
- consumer subscriptions receive an explicit current state immediately by default
- provider removal publishes explicit `unavailable` rather than stale/missing data
- subscriber failures are isolated without using Event Bus as the data channel

### Action Registry

- generic action provider registration/dispatch
- normalized results: `success | unavailable | rejected | error`
- real non-HA actions only:
  - `navigate`
  - `url.open`
- HA-backed action identifiers/contracts are tested with fake providers only:
  - `entity.toggle`
  - `ha.service`
  - `scene.activate`

### Module context change

Block 3 plans to widen module context from `events` / `overlays` to the exact safe set:

- `events`
- `overlays`
- `capabilities`
- `actions`
- immutable `module` identity (`id`, `type`, `version`)

Raw `hass`, host `route`, `panel`, raw Router, Module Registry/Loader and Home Assistant APIs remain absent.

### Hard boundary

Block 3 must **not** add raw Home Assistant states, registries, WebSocket or service calls. Real implementations of `entity.toggle`, `ha.service` and `scene.activate` belong to Block 4 and must use the HA Adapter.

Do not introduce config persistence, design system work, domain providers/widgets or production cutover in Block 3.

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

Variante B und die schriftliche Architektur-Spec sind verbindlich freigegeben. Blocks 0, 1 und 2 sind abgeschlossen, grün und nach main integriert. Der neue Core inklusive Module Registry/Loader liegt parallel unter custom_components/jamesui/frontend/core/ und ist noch nicht in den laufenden r11-Home-Assistant-Panel-Bootstrap geschaltet.

Nächster Gate: Prüfe den detaillierten Implementierungsplan für Block 3 – Capability Registry and Action Registry auf Vollständigkeit und Widersprüche. Wenn er passt und ich ihn freigebe, setze ausschließlich Block 3 auf einem isolierten Branch um. Noch keinen Block-4-Produktcode beginnen.

Block 3 darf keine rohen Home-Assistant-Zugriffe einführen. Echte HA-Actions entity.toggle, ha.service und scene.activate kommen erst in Block 4 über den HA Adapter. In Block 3 werden nur navigate und url.open real implementiert.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. Keine manuellen Copy/Paste-Anweisungen an mich, wenn du selbst committen kannst. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine neuen Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```

## Recommended dedicated ChatGPT Project name

`JamesUI 1.0`
