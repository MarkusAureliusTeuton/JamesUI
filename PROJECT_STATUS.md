# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-03_

This file is the persistent **single source of truth for the current execution state**. Architecture details live in the approved spec, retained behavior in the baseline, and task-level decisions in the individual block plans.

## 1. Product goal

JamesUI is the permanent wall-tablet interface for the KNX/Home Assistant home.

Primary target:
- OnePlus Pad 2 in portrait, normally through Fully
- fixed navigation `Start | Haus | Klima | Medien | Tür`
- important household information visible at a glance
- fast controls plus deeper pages when needed
- Alpine-Chic / premium architectural design rather than generic Lovelace/card styling

Home Assistant is the backend/source of truth; KNX remains the primary building-automation layer. Fully is the kiosk shell only.

## 2. Binding architecture decision

**Variant B – clean JamesUI 1.0 foundation + controlled cutover.**

The new modular runtime is built in parallel. r11 remains the running design/reference implementation until the cutover gate. Normal new functionality is not added to the r11 architecture. After cutover, obsolete runtime code is deleted; Git history is the archive.

Canonical documents:
- Architecture spec: `docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`
- Roadmap: `docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`
- Baseline: `docs/JAMESUI_1_0_BASELINE.md`
- Fresh-chat handover: `docs/JAMESUI_1_0_NEXT_CHAT.md`

Completed block plans:
- `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-0-baseline.md`
- `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-1-core-shell.md`
- `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-2-module-system.md`
- `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-3-capability-action-registries.md`
- `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-4-home-assistant-adapter.md`
- `docs/superpowers/plans/2026-10-02-jamesui-1.0-block-5-config-store-migrations.md`
- `docs/superpowers/plans/2026-10-03-jamesui-1.0-block-6-design-system.md`

## 3. Current formal state

- **Block 0 – Baseline and preservation tests: ✅ complete**
- **Block 1 – Core shell: ✅ merged through PR #13**
- **Block 2 – Module manifest/registry/loader: ✅ merged through PR #14**
- **Block 3 – Capability Registry + Action Registry: ✅ merged through PR #15**
- **Block 4 – Home Assistant Adapter: ✅ merged through PR #16**
- **Block 5 – Versioned Config Store + migrations: ✅ merged through PR #17**
- **Block 6 – Design System + base components: ✅ merged through PR #18**
- **Block 7 – Icon library + asset registry: ⬜ not started**

Block 6 merge commit: `869a8b28e34750479b5d458d5c498c335b472002`.

Validation evidence:
- Block 6 branch validation #269: success
- Block 6 main validation #270: success

Block 6 whole-branch review found no open Critical/Important findings. During implementation one pre-existing date-dependent r11 rain-time test became stale on 2026-10-03; only its forecast fixture was made relative to the current day. No r11 production file was changed.

Next formal gate: **create and review the detailed implementation plan for Block 7 – Icon library and asset registry.** No Block-7 product code before that plan is reviewed and approved.

## 4. Platform completed through Block 6

### Core
The parallel Core under `custom_components/jamesui/frontend/core/` provides:
- routes `home | house | climate | media | door`
- persistent bottom navigation
- router and structural shell
- Event Bus restricted to transient technical/UI/lifecycle events
- Overlay Service
- Health Service
- opaque HA host-context handoff
- Module Registry + versioned Module Loader
- Capability Registry
- Action Registry
- read-only Home Assistant Adapter service
- read-only Config Service
- internally composed Design System mounted below the JamesUI Core root

The Design System is **not** exposed through Core service properties or module contexts.

### Module contract
Supported initial types:
- `layout`
- `widget`
- `provider`
- `action`

Manifest concepts remain separate:
- `depends_on`
- `requires_capabilities`
- `provides_capabilities`

Lifecycle:
- `create(context, config)`
- `mount(target)`
- `update(nextContext, nextConfig)`
- `destroy()`

Module context after Block 6 remains unchanged:
- `layout` / `widget`: `events`, `overlays`, `capabilities`, `actions`, `module`
- `provider` / `action`: same five plus `homeAssistant`
- **no module receives Design System, Config Service, raw `hass`, Router, Health Service, Module Registry or Module Loader**
- module configuration continues through lifecycle `config` arguments
- visual modules consume the shared `--jui-*` CSS variables and may statically import generic primitives where appropriate

### Capabilities and actions
Capability states:
- `available`
- `unavailable`
- `not_configured`

Normalized action results:
- `success`
- `unavailable`
- `rejected`
- `error`

Real actions now available:
- `navigate`
- `url.open`
- `entity.toggle`
- `ha.service`
- `scene.activate`

HA-backed actions use the Home Assistant Adapter only.

### Home Assistant boundary
Direct new-runtime HA access is confined to `custom_components/jamesui/frontend/ha/`.

Adapter responsibilities include:
- state/entity/domain access
- connection state
- local state subscriptions
- service calls
- WebSocket calls/subscriptions
- area/device/entity registry helpers
- cleanup of subscriptions

Disconnected/unavailable state views are deliberately empty so stale cached HA values are not exposed.

## 5. Structured configuration result

JamesUI has one canonical shared configuration persistence source:

- Home Assistant `.storage`
- Store key `jamesui.config`
- schema version `1`
- atomic writes enabled

Canonical schema:

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

Properties:
- exact schema/container validation
- JSON-safe nested values only
- transactional Config Service
- concurrent transforms serialized against latest committed snapshot
- failed validation/storage writes do not partially replace active config
- unsupported Store/schema versions are not silently downgraded
- explicit migration framework for future schema revisions
- all 15 retained r11 options have deterministic mappings into `data_sources` / `module_settings`

Temporary r11 compatibility remains until Block 20/21:
- `jamesui/config`
- `jamesui/config/update`

Structured API:
- `jamesui/config/get`
- `jamesui/config/replace`

Frontend `core.config` communicates through the Home Assistant Adapter only. Device-local display calibration remains browser-local under `jamesui-display-calibration`.

## 6. Block 6 design-system result

New design boundary:
`custom_components/jamesui/frontend/design/`

Files:
- `tokens.js` – one frozen 62-token `--jui-*` contract
- `base-styles.js` – root-scoped shared base styling
- `design-system.js` – root-local style lifecycle and token serialization
- `primitives.js` – reusable semantic DOM factories

The token system centrally owns:
- canvas/surface/accent/status/text colors
- system typography scale and weights
- spacing scale
- radii
- blur
- shadows/highlights
- motion durations/easing
- icon-size tokens ready for Block 7

Shared primitives now exist for:
- `surface`: `default | raised | glass`
- `button`: `default | ghost | accent`, sizes `sm | md | lg`
- overlay frame
- accessible dialog frame/title/body/actions

Hard design rules now guarded by tests/CI:
- design CSS is scoped below `[data-jui-design-root]`
- no Home Assistant global-document style mutation
- no raw palette literals outside `tokens.js`
- no `!important`
- no `url(...)`, data-image, inline SVG asset hacks in the new design boundary
- no direct Home Assistant access in the design boundary
- reduced-motion sets shared motion durations to `0ms`
- repeated mount/remount/destroy does not duplicate or leak design styles
- Core navigation uses the shared ghost-button primitive without changing routing behavior

Block 6 deliberately did **not** introduce icons or final page/layout styling.

## 7. Production/reference runtime

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Current integration version: `0.5.1`

Current frontend revision: `0.5.1-r11`

**r11 is still the running production/reference implementation.** The new Core is intentionally not wired into `jamesui-entry.js` yet. No cutover has occurred.

Do not use r11 structure as the future architecture.

## 8. Start direction to preserve/rebuild

The accepted visual/behavioral direction remains:
- Alpine/weather hero
- weekday/date + large time
- current temperature/weather
- high/low
- real rain/time when available
- wind/storm/snow relevance
- sunrise/sunset
- moon phase/illumination
- temperature tap opens forecast overlay without layout shift
- no standalone 3-day row
- lower dark/translucent deck extending to bottom navigation
- Calendar left
- House Quick right/main
- four Dynamic Buttons right/footer
- no `Home`, `HEUTE & DANACH`, `ZUHAUSE` labels

Do not fake missing backend data.

## 9. Development rules

1. Read spec + roadmap before work.
2. One roadmap block at a time.
3. Detailed implementation plan before product code.
4. Isolated implementation branch.
5. TDD for behavior changes.
6. Intentionally red tests never go to `main`.
7. Green approved blocks merge to `main` without repeated repository confirmation.
8. Update status/roadmap/handover after merged work.
9. No new monkey-patches, Prototype overrides, version-polish layers, duplicate implementations or permanent legacy shims.
10. OnePlus/Fully screenshot testing remains required at major UI milestones; Block 6 itself is infrastructure and does not claim screenshot acceptance.

## 10. Next action

Create and review the detailed implementation plan for **Block 7 – Icon library and asset registry**.

Block 7 should create one local SVG/currentColor icon system and stable asset IDs. Do not pull forward Block 8 Start layout or domain/provider work.