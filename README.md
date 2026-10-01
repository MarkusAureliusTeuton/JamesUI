# JamesUI

JamesUI is a tablet-first Home Assistant control interface for a KNX/Home Assistant home. It is designed as a calm, bespoke wall-tablet HMI rather than a collection of standard Lovelace cards.

Current integration version: **0.5.0**

Primary reference device: **OnePlus Pad 2**, landscape. Fully Kiosk can be used as an optional kiosk shell, but JamesUI does not depend on Fully.

## Current capabilities

- native Home Assistant sidebar panel
- fixed primary navigation: `Start | Haus | Klima | Medien | Tür`
- responsive dark interface and per-device display calibration
- Home Assistant weather, forecast, sun, moon and illuminance integration
- Alpine Interface Start page with local weather/day-night atmosphere assets
- automatic HA area/device/entity registry loading for the House module
- house summaries, device health and light/switch/fan toggles
- Spotify / Music Assistant / receiver media workflow with live playback controls
- Tür/doorbell UI groundwork and demo overlay
- central JamesUI configuration stored in the Home Assistant config entry
- local assets and no runtime cloud-image dependency for the Start page

Klima and Tür still contain placeholder/demo portions and are not complete functional modules yet. See `PROJECT_STATUS.md` for the exact implementation, temporary-code and removal map.

## Architecture

Responsibilities are intentionally separated:

- **KNX:** primary building automation and control logic
- **Home Assistant:** entities, states, automations, scripts, scenes, schedules, history and integration layer
- **JamesUI:** presentation, navigation and interaction
- **Fully Kiosk:** optional tablet/kiosk shell

The active frontend loader uses a guarded classic-script entry (`jamesui-entry.js`) before loading the Start-page ES-module enhancement. This structure is regression-tested because a direct ES-module panel entry previously caused a blank panel.

For development context, file ownership, compatibility/fallback code, cleanup rules and current priorities, read **`PROJECT_STATUS.md` first**.

## Installation with HACS

1. In HACS, add this repository as a custom repository with category **Integration**.
2. Download **JamesUI**.
3. Restart Home Assistant.
4. Open **Settings → Devices & services → Add integration**.
5. Search for **JamesUI** and add it.
6. Open **JamesUI** in the Home Assistant sidebar.

## Manual installation

Copy `custom_components/jamesui` to `/config/custom_components/jamesui`, restart Home Assistant, then add JamesUI from **Settings → Devices & services**.

## Development workflow

- `main` should contain cohesive states expected to pass validation.
- Intentionally failing TDD intermediates stay local or on a feature branch.
- Markdown-only documentation changes do not run the full validation workflow.
- Existing implementation and assets should be inspected before adding replacements.
- When a compatibility path is retired, remove its code references and assets together rather than leaving orphaned files.

## Roadmap

- **v0.5.x** — current: Media + Alpine Start stabilization
- next — room-first House refinement and real Climate integration
- later — Tür/Siedle/camera integration, settings/mapping refinement, Fully-specific comfort functions
- **v1.0.0** — first complete home release
