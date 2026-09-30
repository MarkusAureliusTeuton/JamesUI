# JamesUI

JamesUI is a tablet-first Home Assistant control interface.

## v0.1.0 — Foundation

This first milestone provides a native Home Assistant sidebar panel with:

- responsive 7:5 landscape layout for the OnePlus Pad 2
- shared dark/copper design system
- Start, Haus, Klima, Medien and Tür navigation
- context-specific settings views
- global overlay layer prepared for doorbell events
- direct access to the Home Assistant `hass` object
- HACS-compatible custom integration structure

The application shell is live. Home/weather data is connected in v0.2.0; the remaining functional modules are added incrementally.

## Installation with HACS

1. In HACS, add this repository as a custom repository with category **Integration**.
2. Download **JamesUI**.
3. Restart Home Assistant.
4. Open **Settings → Devices & services → Add integration**.
5. Search for **JamesUI** and add it.
6. Open **JamesUI** in the Home Assistant sidebar.

## Manual installation

Copy `custom_components/jamesui` to `/config/custom_components/jamesui`, restart Home Assistant, then add JamesUI from **Settings → Devices & services**.

## Architecture

JamesUI keeps responsibilities separate:

- **Home Assistant:** entities, states, automations, scripts, scenes, schedules and history
- **JamesUI:** presentation, navigation and interaction
- **Fully Kiosk:** optional tablet/kiosk shell to be added later

Normal JamesUI changes are shipped through repository updates rather than manual dashboard editing.

## Target device

Primary reference: **OnePlus Pad 2**, landscape, 7:5 display ratio. The UI is responsive and does not depend on fixed physical pixels.

## Roadmap

- v0.1.x — application shell and design system
- v0.2.x — Home/weather
- v0.3.x — House/status
- v0.4.x — Climate
- v0.5.x — Media **(current)** routing
- v0.6.x — Door/Siedle
- v0.7.x — Fully Kiosk integration
- v1.0.0 — first complete home release
