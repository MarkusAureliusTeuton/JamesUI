# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-02_

This file is the persistent **single source of truth** for current JamesUI direction, process state and next work. In every new JamesUI chat: read this file first, then the referenced architecture/roadmap documents, and update this file after substantive decisions or merged work.

## 1. Product goal

JamesUI is a permanent wall-tablet interface for the KNX/Home Assistant home.

Primary use:

- displayed continuously on a **OnePlus Pad 2 in portrait**, normally through Fully
- important information visible immediately while passing the tablet
- quick access to frequent house functions
- deeper control pages for devices and systems when needed

Planned future scope includes lighting, sockets, shutters, ventilation schedules, heating modes/programs, appliance status/update actions, media, door/camera, energy and further smart-home functions.

Core product rules:

- Home Assistant is backend/source of truth; KNX remains the primary building-automation layer.
- Fully is the kiosk/display shell only; JamesUI must not depend on Fully for core behavior.
- Fixed global navigation remains `Start | Haus | Klima | Medien | Tür` unless the product direction is explicitly changed.
- OnePlus portrait is the primary visual acceptance target.
- Alpine-Chic / premium architectural style: near-black/anthracite, restrained warm champagne accents, strong outdoor/weather imagery, no generic Lovelace/card look, no glowing borders.

## 2. Major architecture decision – JamesUI 1.0

**Decision: Variant B – clean foundation + controlled cutover.**

We will not keep extending the current r11 frontend architecture with normal new features.

Instead:

1. build a new modular JamesUI 1.0 foundation in parallel,
2. port only the behavior/features we actually want,
3. prove the new runtime on Home Assistant + OnePlus/Fully,
4. perform one controlled cutover,
5. delete the old implementation and obsolete assets/tests.

Git history is the archive. Do not create permanent `legacy`, `old`, `v11-final`, etc. source trees after cutover.

Canonical architecture spec:

`docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`

Canonical execution roadmap:

`docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`

Fresh-chat / ChatGPT-Project handover and start prompt:

`docs/JAMESUI_1_0_NEXT_CHAT.md`

## 3. Current formal process state

- Variant B architecture direction: **approved conversationally**.
- Written architecture specification: **created and committed**.
- Execution roadmap with Blocks 0–21: **created and committed**.
- Next-chat handover/start prompt: **created and committed**.
- Next gate: **user review/approval of the written architecture spec**.
- After written-spec approval: create the detailed implementation plan for **Block 0 – Baseline and preservation tests**.
- No product-code implementation of JamesUI 1.0 should start before that block plan is reviewed according to the project workflow.

## 4. Current production/reference runtime

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.1**

Frontend revision: **0.5.1-r11**

Current r11 is still the running/reference implementation and is useful as a visual/behavioral reference until cutover.

Latest verified old-runtime implementation:

- PR #9 → V9 Start redesign
- PR #10 → r10 compact portrait grid + pictogram facts
- PR #11 → r11 visual polish toward approved mockup
- r11 merge commit: `83daa861a3bcbe0aa610af7ba9d3846544ad4068`
- main validation #162 → success

Do not treat r11 structure as the future architecture.

## 5. Architecture audit findings

The current frontend accumulated exploration debt and should be replaced rather than patched indefinitely.

Main findings:

- `jamesui-panel.js` is a very large monolith containing shell, navigation, old Start, weather helpers, Haus, Klima demo, Media, settings, overlays, display calibration and global styles.
- Old Start still exists in the panel while newer Start modules replace/wrap it at runtime.
- `jamesui-home-background.js` wraps panel methods and rewrites rendered HTML.
- `jamesui-home-data.js` wraps render/lifecycle behavior to add calendar/scenes/runtime hooks.
- `jamesui-v11-polish.js` is another visual override layer using `!important`, data-URL SVGs and positional rules.
- Icons are inconsistent: Unicode + inline SVG + data-URL SVG + legacy SVG assets.
- Config is a flat set of unrelated options and will not scale to pages/layouts/widgets/buttons/modules.
- Klima contains hard-coded demo rooms/temperatures.
- Doorbell demo/prototype behavior remains in production shell.
- frontend cache revisioning is currently global instead of module-specific.

These are the reasons for the JamesUI 1.0 rebuild.

## 6. JamesUI 1.0 architecture summary

The new system separates:

- **Core** – shell, fixed navigation, routing, module loader/registry, config service, event bus, overlay service, module health
- **Home Assistant Adapter** – all direct HA states/registry/WS/service access
- **Capability Registry** – e.g. `weather.current`, `calendar.events`, `house.lights`
- **Action Registry** – e.g. `entity.toggle`, `ha.service`, `scene.activate`, `navigate`, `url.open`
- **Layouts** – pure visual slot arrangement, no Home Assistant access
- **Widgets** – consume capabilities and configured actions
- **Providers** – own discovery/subscriptions/normalization and publish capabilities
- **Design System** – one shared token system and base component language
- **Icon/Asset Registry** – one local SVG icon family and managed local assets
- **Versioned Config Store** – structured schema + explicit migrations

Hard rule: **no new runtime monkey-patching / `Panel.prototype` override layers.**

Every module gets ID, type, version, Core API requirement, dependencies/capabilities, config schema and lifecycle.

## 7. Start page direction to preserve/rebuild

The visible direction developed in r11 is still the target reference, but it will be rebuilt on the new architecture.

### Hero
- weekday/date
- large current time
- current temperature
- current weather condition
- max/min
- rain + first rain time when real granular data supports it
- wind/storm relevance
- snow relevance
- sunrise/sunset
- moon phase/illumination
- local Alpine background according to weather/day period
- tapping current temperature opens 3-day forecast overlay without changing the base layout
- no visible standalone `3-Tage-Prognose` row

### Lower widget deck
- shared deck begins below/overlaps hero at approved position
- extends all the way to bottom navigation
- upper corners rounded, lower corners square
- elegant dark/translucent gradient
- warm subtle shimmer line
- Alpine transition can continue behind the deck near the top
- remove labels `Home`, `HEUTE & DANACH`, `ZUHAUSE`

### Deck content
- left: Calendar widget
- right/main: House Quick widget
- right/footer: four manually assigned Dynamic Buttons

## 8. Dynamic Buttons target

Dynamic Buttons are generic reusable configured action buttons, not hard-coded scene controls.

Configurable presentation:

- text
- icon
- icon color
- local background preset
- text color

Configurable actions:

- entity toggle
- Home Assistant service
- scene
- JamesUI navigation
- URL

Initial visual presets:

- Ankommen
- Abend
- Kino
- Alles aus

Presets are visual templates only; they do not fake Home Assistant actions.

## 9. Current r11 live-data gaps to remember as reference

Latest screenshots showed:

- calendar currently has no visible real events/data
- moon entity/mapping still not fully configured in runtime
- Fenster/Türen/Klima may show `–` where current detection finds no suitable entities
- favorite scenes were not configured/discovered in the live screenshot

Do not solve these by faking data. The new providers/configuration must handle them explicitly.

## 10. Code/behavior likely worth porting conceptually

Potentially retain/port:

- guarded HA panel bootstrap / Shadow-DOM property handling that solved real HA loading issues
- Alpine WebP asset family
- useful weather normalization/calculation logic
- useful calendar normalization logic
- proven entity classification rules
- display calibration concept as a separate device-settings module
- WebP integrity tests
- useful knowledge from current Media integration

Do not automatically copy old implementations. Port behavior into the new module contracts.

## 11. Old code expected to disappear at cutover

Once JamesUI 1.0 satisfies the cutover gate, remove/supersede:

- monolithic old `jamesui-panel.js`
- old `_homePage()` implementation
- `jamesui-home-entry.js`
- `jamesui-home.js`
- `jamesui-home-data.js`
- `jamesui-home-background.js`
- `jamesui-v11-polish.js`
- unused legacy weather SVG family
- Klima demo rooms/temperatures
- doorbell demo
- release-patch-specific tests replaced by architecture/behavior contracts
- obsolete config compatibility keys after migration

## 12. Execution roadmap

Implementation is divided into numbered blocks in `docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`.

High-level sequence:

- Blocks 0–5: baseline, Core, module system, capabilities/actions, HA adapter, config/migrations
- Blocks 6–7: design system + icon/asset system
- Blocks 8–14: rebuild complete Start page and its configuration
- Blocks 15–18: migrate Haus, Media, Climate, Door
- Blocks 19–21: cutover, legacy deletion, architecture CI gate

After cleanup, future modules such as WC ventilation scheduling, heating programs, shutter groups, appliance status/update actions and energy are built on the new platform.

## 13. Development rules from now on

1. Read architecture spec + roadmap before JamesUI 1.0 work.
2. One roadmap block at a time.
3. Every block gets a detailed implementation plan before product code.
4. Work on isolated branches for implementation blocks.
5. TDD for behavior changes.
6. Intentionally red tests never go to `main`.
7. Finished green approved work is merged to `main` without repeatedly asking whether repository changes are desired.
8. Update this file and roadmap status after substantive merged work.
9. No new monkey-patches, version-specific polish modules, parallel duplicate implementations or permanent compatibility shims.
10. Practical OnePlus/Fully screenshot testing remains required at major UI milestones.

## 14. Working style

JamesUI replies should start with one of:

- `✅ Fertig:`
- `⚠️ Test nötig:`
- `🚧 Nicht fertig:`

Preferences:

- German
- concise, technical, direct
- repository edits directly through GitHub when available
- no unnecessary user copy/paste
- one useful troubleshooting action at a time

## 15. Next action

**Review the written spec:**

`docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`

If approved, the next chat should create the detailed implementation plan for:

**Block 0 – Baseline and preservation tests**

Do not begin JamesUI 1.0 product-code implementation before that plan is ready and reviewed.
