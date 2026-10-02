# JamesUI 1.0 – Execution Roadmap

_Status: written architecture spec approved; Blocks 0–4 complete and validated; next gate Block 5 detailed plan_
_Date: 2026-10-02_

This document defines the implementation order for the JamesUI 1.0 rebuild using the approved **Variant B: clean foundation + controlled cutover** strategy.

The current r11 implementation remains the design/reference runtime until the cutover gate is reached. Do not continue normal feature development on the old architecture.

## Working rules for every block

Each block is executed as its own controlled unit:

1. Read the architecture spec and this roadmap.
2. Inspect the relevant current/new code only.
3. Write a detailed block implementation plan before product code.
4. Work on an isolated branch.
5. Use TDD for behavior changes.
6. Keep intentionally red tests off `main`.
7. Complete block-specific CI and practical checks.
8. Update `PROJECT_STATUS.md` and this roadmap status.
9. Merge the green block to `main` before starting a dependent block.
10. Do not add compatibility shims without an explicit removal point.

Canonical architecture spec:

`docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`

---

# Phase A – Establish the new platform

## Block 0 – Baseline and preservation tests

**Goal:** Capture only the existing behavior/assets we intentionally want to preserve before restructuring anything.

**Detailed implementation plan:**

`docs/superpowers/plans/2026-10-02-jamesui-1.0-block-0-baseline.md`

**Completed baseline:**

`docs/JAMESUI_1_0_BASELINE.md`

### Scope
- inventory current production frontend files/assets and their references
- identify behavior that must survive the rebuild
- add preservation tests around the guarded HA bootstrap behavior
- add/retain Alpine asset integrity checks
- capture current accepted Start screenshot/layout characteristics as written acceptance points
- document the exact current config keys that need migration
- document reusable weather/calendar/media logic candidates

### Do not do
- no new UI
- no refactor of old production code
- no new compatibility layer

### Deliverables
- preservation/baseline tests
- migration input inventory
- retained-vs-delete inventory
- updated status document

### Exit criteria
- we can later delete the old implementation without guessing what behavior mattered
- CI green

**Completion evidence:** PR #12 validation succeeded; no production file under `custom_components/jamesui/` was modified.

---

## Block 1 – JamesUI Core shell

**Goal:** Create the new minimal runtime shell without page-specific business logic.

**Detailed implementation plan:**

`docs/superpowers/plans/2026-10-02-jamesui-1.0-block-1-core-shell.md`

### Scope
- new Core entry module
- app shell
- fixed bottom navigation
- router/page selection
- Home Assistant connection context handoff
- event bus
- overlay service
- module health/error surface
- preserve working HA bootstrap mechanics but keep them thin

### Expected first routes
- `home`
- `house`
- `climate`
- `media`
- `door`

Routes may initially render neutral placeholders.

### Exit criteria
- new Core can run independently of the old Start implementation
- route change does not reload the whole page
- bottom navigation is persistent
- a failed placeholder page does not crash the shell
- CI green

**Completion evidence:** PR #13 validation succeeded. The new Core is parallel and intentionally unwired from the current Home Assistant panel entry; r11 remains production/reference. Whole-branch review found one read-only service-reference issue, fixed with RED → GREEN coverage before integration.

---

## Block 2 – Module manifest, registry and loader

**Goal:** Introduce the modular runtime contract.

**Detailed implementation plan:**

`docs/superpowers/plans/2026-10-02-jamesui-1.0-block-2-module-system.md`

### Scope
- module manifest schema with separate `depends_on`, `requires_capabilities` and `provides_capabilities`
- module registry
- module loader
- module lifecycle: create/mount/update/destroy
- module dependency validation
- Core API compatibility validation
- declared capability-requirement metadata validation without implementing the Capability Registry yet
- module health reporting
- module-specific version tokens
- basic isolated reload mechanism for frontend modules

### First test modules
- one minimal layout module
- one minimal widget module
- one minimal provider/action module as needed for contract testing

### Exit criteria
- a module can be registered, loaded, mounted, updated, destroyed and reloaded without monkey-patching the Core
- incompatible/missing concrete module dependencies produce an isolated module error
- capability requirements are represented unambiguously and are ready for Block 3 runtime resolution
- CI green

**Completion evidence:** PR #14 merged green. Branch validation #196 and main validation #197 succeeded. The Module Registry/Loader remain parallel and unwired from the production r11 panel entry. Capability fields are declaration metadata/ownership only; runtime capability resolution remains Block 3.

---

## Block 3 – Capability Registry and Action Registry

**Goal:** Define how modules exchange functionality without knowing each other’s internals.

**Detailed implementation plan:**

`docs/superpowers/plans/2026-10-02-jamesui-1.0-block-3-capability-action-registries.md`

### Scope
- Capability Registry
- provider registration/unregistration
- capability unavailable state
- consumer subscription/update mechanism
- Action Registry
- normalized action results
- real non-HA action providers:
  - `navigate`
  - `url.open`
- define and test the action contracts/identifiers for HA-backed actions using fakes/test providers only:
  - `entity.toggle`
  - `ha.service`
  - `scene.activate`

### Hard boundary
Block 3 must not introduce raw Home Assistant service access merely to complete HA-backed actions. Their real implementations belong to Block 4 after the HA Adapter exists.

### Exit criteria
- a widget can consume a capability without direct provider import
- a widget can execute a configured action without direct HA service code
- provider removal updates consumers safely
- HA-backed action contracts are covered by test doubles but do not bypass the future adapter
- CI green

**Completion evidence:** PR #15 merged green. Branch validation #212 and main validation #214 succeeded. Capability/Action runtime remains parallel and unwired from the production r11 panel entry. Only `navigate` and `url.open` are real actions; HA-backed action providers remain Block 4.

---

## Block 4 – Home Assistant Adapter

**Goal:** Put all direct Home Assistant runtime access behind one explicit boundary.

**Detailed implementation plan:**

`docs/superpowers/plans/2026-10-02-jamesui-1.0-block-4-home-assistant-adapter.md`

### Scope
- states access/subscription
- registry queries
- WebSocket commands/subscriptions
- service execution
- connection status
- domain/entity helpers
- fake adapter for tests
- real Action Registry providers using the adapter for:
  - `entity.toggle`
  - `ha.service`
  - `scene.activate`

### Exit criteria
- new providers use the adapter rather than raw `hass` access
- layouts and visual-only modules cannot require raw Home Assistant APIs
- HA-backed action providers use the adapter only
- tests run with fake adapter
- CI green

**Completion evidence:** PR #16 merged green. Branch validation #229 and main validation #230 succeeded. Direct new-runtime HA access is confined to `frontend/ha/`; provider/action modules receive the adapter while layout/widget remain HA-free. Whole-branch review found stale cached state visibility during disconnect; it was fixed with a dedicated RED → GREEN regression test before integration.

---

## Block 5 – Versioned configuration store and migrations

**Goal:** Replace the flat option model with structured, migratable JamesUI configuration.

### Scope
- versioned backend storage
- schema validation
- config service/API
- migration framework
- initial schema sections:
  - pages
  - layouts
  - widget_instances
  - dynamic_buttons
  - data_sources
  - module_settings
- one explicit migration from current r11 relevant config values
- local-only display calibration remains outside shared config

### Exit criteria
- config can be read/written transactionally
- invalid config is rejected with clear errors
- current relevant settings migrate deterministically
- migration is idempotent/tested
- CI green

---

# Phase B – Establish the visual system

## Block 6 – Design system and base components

**Goal:** Eliminate scattered visual constants and create one stable visual language.

### Scope
- color tokens
- typography tokens
- spacing scale
- radii
- borders/highlights
- shadows/blur
- motion tokens
- icon sizes
- common button/surface primitives
- common overlay/dialog primitives

### Exit criteria
- new modules do not define their own application-wide palette/type system
- mockup styling can be expressed through tokens/primitives
- CI green

---

## Block 7 – Icon library and asset registry

**Goal:** Replace mixed Unicode/inline/data-URL icon approaches with one local icon system.

### Scope
- local SVG asset structure
- icon registry
- consistent line style / `currentColor`
- initial navigation icons
- initial weather icons
- initial house/control icons
- moon-phase icons
- asset validation tests

### Exit criteria
- new production UI does not rely on Unicode glyphs for normal controls
- icons can be selected by stable ID
- all icons are local and validated
- CI green

---

# Phase C – Rebuild Start on the new architecture

## Block 8 – `layout.home-hero-deck`

**Goal:** Implement the Start layout as a reusable layout module with no HA/business logic.

### Slots
- `hero`
- `widget-left`
- `widget-right-main`
- `widget-right-footer`

### Visual requirements
- fixed bottom navigation remains outside the layout
- hero occupies upper region
- lower deck overlaps hero at approved position
- deck extends to bottom navigation
- top corners rounded, lower corners square
- subtle Alpine bleed/transition behind deck
- elegant dark/translucent gradient and shimmer edge

### Exit criteria
- layout can host arbitrary compatible widgets
- no Home Assistant calls in layout code
- OnePlus portrait geometry matches the accepted direction
- CI + screenshot check green

---

## Block 9 – Weather provider

**Goal:** Provide normalized current/daily/hourly weather capabilities independently of the widget.

### Capabilities
- `weather.current`
- `weather.daily`
- `weather.hourly` when available
- `weather.sun`
- `weather.moon`
- optional `weather.atmosphere`

### Scope
- configured/auto-discovered weather entity
- outdoor temperature preference
- daily high/low normalization
- rain probability / first rain time when supported
- strong wind/storm/snow relevance
- sunrise/sunset
- moon phase/illumination
- atmosphere/background scene key

### Exit criteria
- data is normalized without rendering code
- missing granular forecast does not fabricate rain time
- provider cleans subscriptions on destroy
- CI green

---

## Block 10 – Weather Today widget + forecast overlay

**Goal:** Rebuild the accepted Start hero on the new module/design/icon system.

### Required visible information
- weekday/date
- large clock
- current temperature
- weather condition
- high
- low
- rain/time
- wind/storm relevance
- snow relevance when applicable
- sunrise
- sunset
- moon phase/illumination
- dynamic Alpine background

### Interaction
- tapping the large current temperature opens the 3-day forecast overlay
- no visible 3-day forecast row in the normal layout
- opening forecast must not shift the underlying layout

### Exit criteria
- visually matches the accepted mockup direction
- uses new icon library
- consumes weather capabilities only
- CI + screenshot verification green

---

## Block 11 – Calendar provider + Calendar Agenda widget

**Goal:** Build Calendar as a real provider/widget pair.

### Provider scope
- calendar discovery
- selected-calendar configuration
- subscriptions
- normalization/deduplication
- date-range filtering

### Widget scope
- compact agenda
- configurable visible item count
- selected calendars
- all-day handling
- further-events overlay/action
- clean empty state

### Exit criteria
- Start calendar shows real configured HA data
- subscriptions are independent of render cycles
- provider destroys cleanly
- CI green

---

## Block 12 – House capability providers + House Quick widget

**Goal:** Provide reliable aggregated house state and attractive quick controls.

### Initial capabilities
- lights
- outlets
- windows
- doors/gates
- ventilation
- climate summary
- media summary

### Widget scope
- configurable displayed groups/order
- count/state text
- optional quick action
- optional navigation action
- mockup-style gradient/button treatment using shared components/icons

### Exit criteria
- no Start-specific entity discovery inside the widget
- actions run through Action Registry
- real HA state only; no fake status
- CI green

---

## Block 13 – Dynamic Buttons module

**Goal:** Add user-created, reusable visual action buttons.

### Button editor model
- label
- icon
- icon color
- background preset
- text color
- action type
- action target/data

### Initial action support
- entity toggle
- HA service
- scene
- navigation
- URL

### Preset visual templates
- Ankommen
- Abend
- Kino
- Alles aus

### Start assignment
- four manual slots in the Start dynamic-button widget

### Exit criteria
- button definitions persist in structured config
- button can be created/edited/deleted
- four Start slots are manually assignable
- action execution uses Action Registry
- presets do not fake unconfigured HA actions
- CI + screenshot green

---

## Block 14 – Start configuration experience

**Goal:** Make the complete new Start page configurable without editing code.

### Scope
- select Start layout
- configure weather sources
- configure Calendar widget
- configure House Quick groups/actions
- create/edit Dynamic Buttons
- assign four Start dynamic buttons
- configure background/atmosphere behavior where still needed

### Exit criteria
- Start can be configured end-to-end from JamesUI settings
- config UI writes only schema-valid structured config
- no r11-specific settings path remains necessary for Start
- CI green

---

# Phase D – Port the remaining application areas

## Block 15 – Haus page migration

**Goal:** Rebuild the useful current Haus behavior on the new platform.

### Scope
- real entity/area grouping
- room-first navigation direction
- light/socket/fan/window/door controls as appropriate
- reuse house providers rather than duplicate discovery

### Exit criteria
- useful old Haus functionality no longer depends on old panel code
- CI + practical test green

---

## Block 16 – Media migration

**Goal:** Preserve useful Media behavior without keeping receiver-specific logic in Core.

### Scope
- Media provider/module boundaries
- Music Assistant/Spotify behavior that is actually useful
- receiver preparation logic only inside a dedicated integration/provider where needed
- now playing
- transport
- volume
- source/target selection

### Exit criteria
- no Media-specific code in Core
- working path practically tested
- CI green

---

## Block 17 – Climate migration

**Goal:** Replace the current demo Climate page with a real module.

### Scope
- real `climate.*` discovery/mapping
- room temperatures
- setpoints
- modes
- heating state
- future schedule/program extension points

### Hard rule
- do not port hard-coded demo rooms or fake temperatures

### Exit criteria
- Climate page contains only real configured/available data
- CI + practical test green

---

## Block 18 – Door migration

**Goal:** Replace demo groundwork with real door/camera functionality when backend data is reliable.

### Scope
- door state
- camera/live/snapshot
- doorbell event integration
- history if supported
- open action with suitable safety/confirmation behavior

### Hard rule
- no persistent demo doorbell feature in production

### Exit criteria
- real backend integration tested
- CI green

---

# Phase E – Controlled cutover and cleanup

## Block 19 – Cutover preparation

**Goal:** Prove that the new platform is ready to replace the old runtime.

### Required checks
- Core/bootstrap reliability
- all new Start modules complete
- structured config migrated
- Haus migrated
- any old Media functionality we intend to keep migrated
- Climate no longer depends on demo page
- Door old demo no longer required
- OnePlus/Fully portrait accepted
- module error isolation tested
- architecture CI checks ready

### Exit criteria
- architecture-spec cutover acceptance criteria all pass
- explicit cutover checklist signed off in repo

---

## Block 20 – Cutover

**Goal:** Make JamesUI 1.0 the production runtime.

### Scope
- switch Home Assistant panel bootstrap to new Core
- keep only the minimal proven compatibility bootstrap needed for HA panel loading
- run config migration
- validate first-load behavior and cache/version handling

### Exit criteria
- production panel runs only new architecture
- no user-facing regression in accepted Start basics
- main CI and practical test green

---

## Block 21 – Legacy deletion and architecture gate

**Goal:** Remove the old architecture completely rather than carrying it forever.

### Delete/supersede
- old monolithic `jamesui-panel.js`
- old Start implementation
- `jamesui-home-entry.js`
- `jamesui-home.js`
- `jamesui-home-data.js`
- `jamesui-home-background.js`
- `jamesui-v11-polish.js`
- unused legacy weather SVG family
- Klima demo data
- doorbell demo
- release-patch-specific tests no longer relevant
- stale configuration compatibility keys after migration

### Add architecture CI gates
- no production `Panel.prototype` patching
- no `v9/v10/v11` production modules/classes
- no demo data
- no layout → Home Assistant direct calls
- every module has a valid manifest/version
- no dead production assets
- config migrations/schema tests green
- lifecycle cleanup tests green

### Exit criteria
- there is exactly one production implementation per responsibility
- Git history is the only archive of removed code
- main CI green

---

# Phase F – Future feature modules

After Block 21, new household functions are built as normal modules rather than added to a monolithic panel.

Likely next modules include:

- WC ventilation detail + schedule
- heating operating modes / programs
- shutter groups / all-close
- appliance status
- appliance update actions where Home Assistant supports them
- energy overview
- maintenance/device health
- notifications/attention center

Each future feature must use the same Provider → Capability → Widget/Page → Action architecture.

---

# Status tracking

Use these symbols in this document and `PROJECT_STATUS.md`:

- `⬜` not started
- `🚧` in progress
- `⚠️` code complete, practical validation needed
- `✅` complete and merged

Current state:

| Block | Status |
| --- | --- |
| 0 Baseline | ✅ |
| 1 Core shell | ✅ |
| 2 Module registry/loader | ✅ |
| 3 Capability/Action registries | ✅ |
| 4 HA adapter | ✅ |
| 5 Config store/migrations | ⬜ |
| 6 Design system | ⬜ |
| 7 Icon library | ⬜ |
| 8 Start layout | ⬜ |
| 9 Weather provider | ⬜ |
| 10 Weather widget | ⬜ |
| 11 Calendar | ⬜ |
| 12 House Quick | ⬜ |
| 13 Dynamic Buttons | ⬜ |
| 14 Start config | ⬜ |
| 15 Haus migration | ⬜ |
| 16 Media migration | ⬜ |
| 17 Climate migration | ⬜ |
| 18 Door migration | ⬜ |
| 19 Cutover preparation | ⬜ |
| 20 Cutover | ⬜ |
| 21 Legacy deletion/gate | ⬜ |

Blocks 0–4 are complete and validated. The next formal gate is the detailed implementation plan/review for **Block 5 – Versioned configuration store and migrations**. Block 5 product-code implementation has **not** started.