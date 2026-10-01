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
    └── jamesui-home.js

tests/
├── jamesui-home.test.js
└── test_frontend_entrypoint.py

.github/workflows/validate.yml
```

**Current loader architecture:** Home Assistant still registers one classic `_panel_custom.js_url`. `FRONTEND_FILE` points to `jamesui-entry.js`, but this file itself is a classic script with no top-level `import`/`export`. It first loads the stable `jamesui-panel.js`, then injects `jamesui-home-entry.js` explicitly as `type="module"`. That module imports `jamesui-home.js` and installs the Start-page refinement only after `jamesui-panel` is defined.

This replaces the failed 2026-10-01 approach where `FRONTEND_FILE` directly pointed at an ES-module file. That direct module entry caused a blank/black panel on laptop and tablet. The guarded classic loader now has a regression test in CI.

## 3. Navigation

Approved primary navigation remains:

```text
Start | Haus | Klima | Medien | Tür
```

Do not replace this with a generic sidebar because of later visual experiments.

## 4. Visual direction

Desired feel:

- dark / near-black base
- warm restrained accents
- calm and premium
- strong hierarchy and large readable information
- minimal clutter
- closer to a premium native smart-home / automotive interface than standard Home Assistant
- room imagery should eventually look realistic and close to the actual rooms

Generic AI room imagery tested previously was not good enough. Realistic room visual direction remains open.

## 5. Start page – current state

**Status: ⚠️ refinement is active again through the guarded loader; practical tablet/laptop verification required**

Current refinement design:

- large weather/time hero remains the visual anchor
- date, time, current temperature, condition, high/low, precipitation, humidity, wind, illuminance and sunrise/sunset remain available
- weather/time-of-day visual background logic remains in use
- prominent former moon card removed from the primary hierarchy
- moon phase retained only as a compact secondary note
- right-side `Zuhause` status panel summarizes important deviations
- below the hero is a direct-access area for `Haus`, `Klima`, `Medien`, `Tür`
- those cards are clickable and reuse existing `data-nav` routing
- scenes are visually reduced to a compact house-mode row; actual scene/service mapping still pending

The home status model in `jamesui-home.js` detects/summarizes:

- lights on
- monitored devices offline
- low battery states already known through the Haus model
- average current climate temperature when available
- active media playback
- open door/garage/opening binary sensors whose names look like door/gate/garage entities

Normal state: `Alles ruhig`.

Relevant deviations switch the summary to `Aufmerksamkeit nötig`.

Automated tests cover a calm state and an alert/activity state. The practical next step is to verify that the guarded loader displays the refined Start page correctly on laptop and OnePlus Pad 2/Fully.

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

Legacy method names such as `_prepareOnkyo()` are implementation details and should later be generalized so the architecture is not manufacturer-specific.

Music Assistant still needs robust testing of service schema, player detection, URL/media-ID handling and error/status feedback.

## 10. Tür / camera

Dedicated navigation section: **Tür**.

Planned/present groundwork:

- door state
- doorbell event
- live/snapshot image
- event/history view
- optional door-open action where technically supported
- prominent doorbell overlay

The home uses a Siedle SG150. Reliable HA doorbell triggering remains an external backend issue; JamesUI should present the event once Home Assistant supplies it reliably.

Persistent camera/snapshot history remains open.

**Status: 🚧 UI groundwork exists; backend trigger/history unresolved**

## 11. Settings

JamesUI needs its own settings/mapping UX for:

- entity mapping
- room/device assignment
- media player selection
- door/camera mapping
- weather source
- optional features

Basic config infrastructure exists, but the normal user should not need to edit source code/entity IDs manually.

**Status: ⚠️ infrastructure exists; UX needs refinement**

## 12. Responsive / display behavior

Primary target remains OnePlus Pad 2 landscape, but layout uses viewport-responsive CSS rather than fixed physical pixels.

Normal browser use is supported conceptually; phone support may follow later.

Existing display calibration/view metrics should remain available.

## 13. HACS / release workflow

- `hacs.json` exists
- repository is public and HACS-compatible in structure
- current manifest version remains `0.5.0`
- current work is on `main` without a new version bump yet
- HACS tag/release/update strategy is still to be finalized and should be verified against current HACS behavior before changing it

## 14. Validation / tests

GitHub Actions currently validates:

- Python syntax
- JSON files
- JavaScript syntax for all frontend `.js` files
- Home-page state-summary tests using Node's built-in test runner
- Home Assistant panel entrypoint compatibility
- guarded loader structure: active `FRONTEND_FILE` must be `jamesui-entry.js`, remain a classic script, load `jamesui-panel.js` first and reference the Start-page enhancement afterwards

The loader regression was reproduced test-first. The new stricter entrypoint test failed while the stable panel was still active, then passed after the guarded classic loader and module bridge were implemented. Latest CI run on commit `da11d651da992574d977151989ff15c8d9a261da` passed all checks.

For future behavior changes, add focused tests where practical rather than relying only on visual/manual testing.

## 15. Current priorities

Recommended next order:

1. practical verification of the guarded loader and refined Start page on laptop and Fully/OnePlus Pad 2
2. adjust Start-page spacing/proportions based on the real screenshot
3. improve Haus/room presentation and classification
4. realistic room visual direction
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

## 17. Next-chat instruction

When continuing in a new chat:

1. Read this file first.
2. Inspect repository files relevant to the requested area.
3. Repository code is implementation truth; this file is design/progress context.
4. Continue directly without asking the user to repeat history.
5. Update this file again after substantive JamesUI changes or decisions.
