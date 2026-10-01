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
    └── jamesui-home.js

tests/
├── jamesui-home.test.js
└── test_frontend_entrypoint.py

.github/workflows/validate.yml
```

**Important loader decision after regression on 2026-10-01:** Home Assistant currently loads JamesUI through the integration's `_panel_custom.js_url`, so the active frontend entry must remain a classic script. `FRONTEND_FILE` is therefore restored to `jamesui-panel.js`. Do not point `FRONTEND_FILE` directly at an ES-module file containing top-level `import`/`export` unless the Home Assistant panel registration is first changed to an explicitly supported module-loading mechanism.

`jamesui-entry.js` and `jamesui-home.js` remain in the repository as inactive experimental/refinement code for the Start page. They are **not currently loaded in production** because routing the panel directly through `jamesui-entry.js` caused a blank/black JamesUI panel on laptop and tablet.

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

**Status: 🚧 refinement code exists but is temporarily rolled back from the active frontend**

The planned refined Start page goes beyond the earlier weather + large moon-card concept.

Target/refinement design:

- large weather/time hero remains the visual anchor
- date, time, current temperature, condition, high/low, precipitation, humidity, wind, illuminance and sunrise/sunset remain available
- weather/time-of-day visual background logic remains in use
- prominent former moon card should be removed from the primary hierarchy
- moon phase retained only as a compact secondary note
- right-side `Zuhause` status panel summarizes important deviations
- below the hero is a direct-access area for `Haus`, `Klima`, `Medien`, `Tür`
- those cards should be clickable and use the existing bottom-navigation routing
- scenes visually reduced to a compact house-mode row; actual scene/service mapping still pending

The home status model in `jamesui-home.js` detects/summarizes:

- lights on
- monitored devices offline
- low battery states already known through the Haus model
- average current climate temperature when available
- active media playback
- open door/garage/opening binary sensors whose names look like door/gate/garage entities

Normal state: `Alles ruhig`.

Relevant deviations switch the summary to `Aufmerksamkeit nötig`.

Automated tests cover a calm state and an alert/activity state. The visual refinement itself must be integrated again using a loading approach compatible with Home Assistant before practical tablet testing continues.

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
- Home Assistant panel entrypoint compatibility: the active `FRONTEND_FILE` may not be an ES-module script with top-level `import`/`export`

The loader regression was reproduced test-first: the new entrypoint test failed with `jamesui-entry.js` active and passed after restoring `jamesui-panel.js`.

For future behavior changes, add focused tests where practical rather than relying only on visual/manual testing.

## 15. Current priorities

Recommended next order:

1. confirm the restored classic panel loads again on laptop and Fully/tablet
2. reintegrate the refined Start-page code without changing the active HA panel entry to an unsupported ES-module loader
3. practical visual test of that refined Start page on the actual HA/tablet viewport
4. adjust spacing/proportions based on the real screenshot
5. improve Haus/room presentation and classification
6. realistic room visual direction
7. implement/refine Klima
8. complete and robustly test Medien
9. expand Tür/Kamera
10. simplify Settings/mapping UX
11. settle HACS release/update process
12. full tablet/Fully practical test

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
