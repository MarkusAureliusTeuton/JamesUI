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
6. inspect current production/new Core files only as required by the active block plan

The r11 implementation remains the running design/reference runtime. The approved strategic direction is **Variant B: clean JamesUI 1.0 foundation in parallel, controlled cutover, then delete the old implementation**.

## Current process state

The written architecture specification has been reviewed, clarified and **approved**.

Approved clarifications included in the canonical spec/roadmap:

- manifest module dependencies are separate from required/provided capabilities,
- Block 3 defines the Action Registry and HA-backed action contracts with fakes; real HA-backed actions are implemented only in Block 4 through the HA Adapter,
- Event Bus is restricted to transient technical/UI/lifecycle events and cannot bypass Capabilities or Actions.

**Block 0 – Baseline and preservation tests is complete and merged.**

**Block 1 – JamesUI Core shell is complete, green and merged through PR #13.** Main validation #192 succeeded. The next formal gate is the detailed implementation plan/review for **Block 2 – Module manifest, registry and loader**. Block 2 product code has not started.

Block 1 produced a parallel Core under `custom_components/jamesui/frontend/core/` with:

- canonical routes `home | house | climate | media | door`
- internal router and persistent `Start | Haus | Klima | Medien | Tür` navigation
- structural app shell and isolated page-error state
- transient technical Event Bus
- single-active Overlay Service with stale-close protection
- generic keyed Health Service
- opaque host-context handoff for `hass`, `narrow`, `route`, `panel`
- Core composition entry with read-only service references
- architecture guards preventing direct HA access and legacy coupling

The new Core is **not wired into `jamesui-entry.js`** in Block 1. No current r11 production frontend file was modified. The running panel remains r11 until the later controlled cutover.

## Block 2 boundary

Block 2 introduces the modular runtime contract only:

- manifest schema with separate `depends_on`, `requires_capabilities`, `provides_capabilities`
- Module Registry
- Module Loader
- lifecycle `create / mount / update / destroy`
- concrete module dependency validation
- Core API compatibility validation
- capability requirement metadata validation only; runtime Capability Registry remains Block 3
- module health reporting
- module-specific version tokens
- basic isolated module reload

Block 2 must **not** implement:

- Capability Registry or Action Registry runtime behavior (Block 3)
- raw Home Assistant access or HA Adapter (Block 4)
- structured shared config/migrations (Block 5)
- Design System or Icon Registry (Blocks 6–7)
- weather/calendar/house/media/climate/door business logic
- production cutover from r11 to the new Core

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

Variante B und die schriftliche Architektur-Spec sind verbindlich freigegeben. Block 0 und Block 1 sind abgeschlossen und nach main integriert. Der neue Core liegt parallel unter custom_components/jamesui/frontend/core/ und ist noch nicht in den laufenden r11-Home-Assistant-Panel-Bootstrap geschaltet.

Nächster Gate: Erstelle den detaillierten Implementierungsplan für Block 2 – Module manifest, registry and loader. Noch keinen Block-2-Produktcode schreiben, bevor der Plan geprüft und freigegeben ist.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. Keine manuellen Copy/Paste-Anweisungen an mich, wenn du selbst committen kannst. TDD für Verhaltensänderungen; absichtlich rote Tests niemals nach main. Keine neuen Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```

## Recommended dedicated ChatGPT Project name

`JamesUI 1.0`
