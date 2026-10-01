# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-01_

This is the persistent handover for continuing JamesUI work across chats. Read this file first, then inspect the relevant repository files before changing code. After substantive JamesUI decisions or implementation steps, update this file again.

## 1. Goal

JamesUI is a tablet-first Home Assistant interface for the user's KNX/Home Assistant home. It should feel like a calm, premium native smart-home application rather than a collection of Lovelace cards.

Core principles:

- Home Assistant remains backend/source of truth.
- KNX remains the primary building-automation layer.
- JamesUI owns presentation, navigation and interaction.
- Local operation preferred; avoid unnecessary cloud dependence.
- Automatic entity/device/area detection first; manual mapping only where required.
- No hard-coded entity IDs in normal use.
- Keep architecture maintainable and pragmatic; do not overengineer.

Primary target device: **OnePlus Pad 2**, landscape. Fully Kiosk may provide kiosk/display-shell behavior, but JamesUI must not depend on Fully.

## 2. Repository / architecture

Repository: `MarkusAureliusTeuton/JamesUI`

Branch: `main`

Current integration version: **v0.5.0**

JamesUI is a Home Assistant custom integration with an integrated custom frontend panel.

Important files:

```text
custom_components/jamesui/
├── __init__.py
├── api.py
├── config_flow.py
├── const.py
├── manifest.json
└── frontend/
    ├── jamesui-entry.js
    ├── jamesui-panel.js
    ├── jamesui-home-entry.js
    ├── jamesui-home.js
    └── assets/
        ├── weather/
        └── alpine/

tests/
├── jamesui-home.test.js
└── test_frontend_entrypoint.py

.github/workflows/validate.yml
```

**Current loader architecture:** Home Assistant registers one classic `_panel_custom.js_url`. `FRONTEND_FILE` points to `jamesui-entry.js`, which remains a classic script with no top-level `import`/`export`. It loads the stable `jamesui-panel.js`, then injects `jamesui-home-entry.js` as `type="module"`. That module imports `jamesui-home.js` and installs the Start-page enhancement only after `jamesui-panel` is defined.

This replaces the failed 2026-10-01 direct ES-module entry approach that caused a blank/black panel. Loader structure is protected by CI regression tests and must remain unchanged unless Home Assistant panel loading is deliberately redesigned.

## 3. Navigation

Approved primary navigation remains:

```text
Start | Haus | Klima | Medien | Tür
```

Do not replace this with a generic sidebar.

## 4. Visual direction

Approved direction: **Alpine Interface**.

JamesUI should feel like a bespoke architectural / premium vehicle HMI rather than a standard smart-home dashboard.

Design principles:

- dark / near-black base
- smoked-glass / anthracite surfaces
- restrained champagne / warm-metal accent
- subtle natural-stone / warm-wood cues, not literal decorative chalet imagery
- strong hierarchy and large readable information
- fine separators and integrated information regions instead of rounded-card grids
- approximately 70–80% visual weight on information/UI and 20–30% on atmosphere/background
- realistic outside atmosphere should communicate weather/day-night quickly but remain subordinate to readability

Avoid a dominant fictional living room/chalet render. Background imagery should focus on sky, horizon, mountains, trees and subtle terrace/architecture silhouettes.

Approved design spec:
`docs/superpowers/specs/2026-10-01-startpage-alpine-interface-design.md`

Implementation plan:
`docs/superpowers/plans/2026-10-01-startpage-alpine-interface.md`

## 5. Start page – current state

**Status: ⚠️ Alpine Interface implementation is complete on `feature/startpage-alpine-interface`; practical laptop + OnePlus Pad 2/Fully verification is still required before final visual acceptance.**

Implemented on the feature branch:

- one composed Alpine Start surface instead of a generic tile/card grid
- large time/date + current weather hierarchy
- current temperature, condition, high/low, precipitation, humidity, wind, illuminance and sunrise/sunset remain available
- compact `Zuhause` status region using live Home Assistant state summaries
- integrated low-profile functional strip for `Haus`, `Klima`, `Medien`, `Tür`
- four function items reuse existing `data-nav` routing and stay live-state-driven
- moon information reduced to a compact secondary note
- local realistic alpine atmosphere assets under `assets/alpine/`
- atmosphere selection mapped from Home Assistant weather condition + sun period
- graceful fallback for unknown/missing weather data
- no runtime cloud-image dependency
- generic `home-nav-card` / `home-nav-grid` / repeated direct-access tile presentation removed from the redesigned Start page

Initial local atmosphere set:

- clear day
- cloudy day
- rain day
- snow day
- dusk/twilight
- clear night
- cloudy night
- fog

The implementation is intentionally contained in `jamesui-home.js`; the stable base `jamesui-panel.js` and guarded loader were not redesigned for this work.

Home status continues to summarize:

- lights on
- monitored devices offline
- low battery states
- average current climate temperature where available
- active media playback
- open door/garage/opening binary sensors with door/gate/garage naming

Normal state: `Alles ruhig`.
Relevant deviations: `Aufmerksamkeit nötig`.

Automated home tests now cover atmosphere mapping, local asset contract, navigation model, Alpine structure, calm/alert states and missing optional data.

## 6. Haus module

**Status: ⚠️ functional, not final**

Implemented:

- HA Area Registry
- Device Registry
- Entity Registry
- category detection
- room/area grouping
- summaries
- detail views
- toggles/service calls

Current categories include lights, sockets, ventilation and device-health/status entities.

Open improvements:

- classification edge cases
- KNX-specific naming/mapping
- entities without proper HA area assignment
- multiple entities belonging to one physical device
- presentation should move further toward room summaries rather than raw entity lists

## 7. Lighting / blinds

Lighting target:

- room state / count active
- room/group control
- on/off, dimming, optional color temperature/color
- scenes/quick actions

Blinds/covers target:

- room overview
- open/closed/intermediate position
- up/down/stop
- optional slat position
- group control and house overview

KNX remains responsible for underlying control.

**Status: 🚧 further refinement required**

## 8. Climate

Target:

- detect `climate.*`
- actual/target temperature
- heating state
- optional humidity/outside temperature
- heating-circuit state
- programs/modes/helpers

JamesUI is not the heating controller. Regulation remains in KNX, Home Assistant or dedicated heating logic.

Separate KNX entities may require mapping for actual temperature, target value and status.

**Status: 🚧 not finished**

## 9. Media

**Status: ⚠️ substantial frontend/logic exists; end-to-end practical verification still required**

Current direction:

```text
JamesUI Media
    ↓
Home Assistant / Music Assistant
    ↓
Receiver / TV / player
```

Existing work includes:

- media page
- player presentation
- transport controls
- volume
- source selection
- Spotify playlist start logic
- Home Assistant media-player support
- Music Assistant path
- automatic Onkyo network-input preparation for Spotify playback
- live media state updates
- Spotify URI normalization work

Legacy method names such as `_prepareOnkyo()` should later be generalized.

## 10. Tür / camera

Dedicated navigation section: **Tür**.

Planned/present groundwork:

- door state
- doorbell event
- live/snapshot image
- event/history view
- optional door-open action where technically supported
- prominent doorbell overlay

The home uses a Siedle SG150. Reliable HA doorbell triggering remains an external backend issue.

**Status: 🚧 UI groundwork exists; backend trigger/history unresolved**

## 11. Settings

JamesUI needs its own settings/mapping UX for:

- entity mapping
- room/device assignment
- media player selection
- door/camera mapping
- weather source
- optional features

**Status: ⚠️ infrastructure exists; UX needs refinement**

## 12. Responsive / display behavior

Primary target remains OnePlus Pad 2 landscape, but layout uses viewport-responsive CSS rather than fixed physical pixels.

Normal browser use remains supported. Existing display calibration/view metrics should remain available.

## 13. HACS / release workflow

- `hacs.json` exists
- repository is public and HACS-compatible in structure
- current manifest version remains `0.5.0`
- HACS tag/release/update strategy still needs to be finalized

## 14. Validation / tests

CI validates:

- Python syntax
- JSON files
- JavaScript syntax for all frontend `.js` files
- Home-page tests with Node built-in test runner
- Home Assistant panel entrypoint compatibility / guarded loader structure

Start-page tests additionally cover:

- calm home status
- alert/activity status
- weather + sun-period atmosphere mapping
- approved local Alpine asset paths
- ordered live functional navigation
- single Alpine composition with four `data-nav` targets
- absence of old generic Start-page card-grid markup
- graceful rendering with missing optional weather data

Development workflow decision: intentionally failing TDD intermediate states should stay local/feature-only; `main` should receive only cohesive green changes to avoid noisy GitHub Actions failure emails.

## 15. Current priorities

Recommended next order:

1. CI/review `feature/startpage-alpine-interface` and merge only if green
2. practical verification of Alpine Start page on laptop and Fully/OnePlus Pad 2
3. adjust Start-page spacing, contrast, atmosphere intensity and typography from a real screenshot
4. improve Haus/room presentation and classification
5. implement/refine Klima
6. complete and robustly test Medien
7. expand Tür/Kamera
8. simplify Settings/mapping UX
9. settle HACS release/update process
10. full tablet/Fully practical test

## 16. Working style

Start JamesUI answers with one of:

- **✅ Fertig:** fully implemented / verified
- **⚠️ Test nötig:** implementation exists but needs practical verification
- **🚧 Nicht fertig:** more development required

Troubleshooting: give one useful next action at a time and wait for the result.

Development:

- prefer editing the repository directly when write access is available
- prefer Git/HACS workflow
- avoid user copy/paste where unnecessary
- avoid hard-coded entity IDs unless unavoidable
- avoid unnecessary dependencies and premature modularization
- minimize confirmation questions when scope/design is already approved; make progress and report results
- keep deliberately failing TDD intermediates off `main`

## 17. Next-chat instruction

When continuing in a new chat:

1. Read this file first.
2. Inspect repository files relevant to the requested area.
3. Repository code is implementation truth; this file is design/progress context.
4. Continue directly without asking the user to repeat history.
5. Update this file again after substantive JamesUI changes or decisions.
