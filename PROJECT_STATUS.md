# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-01_

This file is the persistent handover document for continuing JamesUI work across ChatGPT conversations.

## How to use this file

When starting a new chat in the **KNX Home** project, the user should be able to say only:

> Schau ins Repository und mach mit JamesUI weiter.

The assistant should then read this file first, inspect the current repository state, and continue from the documented status instead of asking the user to repeat prior decisions.

### Maintenance rule

After every substantive JamesUI development/design decision or implementation step, update this file in the repository before finishing the response. Keep it concise but current. If a previous decision changes, replace the obsolete state instead of keeping contradictory versions.

---

# 1. Project goal

**JamesUI** is a custom, tablet-first Home Assistant interface for the user's KNX/Home Assistant home.

JamesUI is **not** intended to become a collection of normal Lovelace cards. It should feel like a high-quality native smart-home application.

Primary goals:

- modern, calm, premium-looking smart-home UI
- optimized for a permanently mounted tablet
- Home Assistant remains the backend and source of truth
- KNX remains the primary building-automation layer
- JamesUI handles visualization, interaction, media, climate, door/camera presentation, scenes and status
- avoid hard-coded entity IDs wherever possible
- automatic entity/device/area detection first; manual mapping only where needed
- local operation preferred; avoid unnecessary cloud dependence
- responsive and performant
- simple maintainable architecture; no unnecessary overengineering

---

# 2. Primary device / display

Primary target:

- **OnePlus Pad 2**
- landscape orientation
- wall/tablet use
- Fully Kiosk Browser may be used as the kiosk/browser shell
- JamesUI itself must **not depend on Fully Kiosk**
- layout should respond to actual CSS viewport dimensions, not fixed physical pixels

Fully Kiosk responsibilities may include fullscreen/kiosk behavior, wake/display handling and browser shell only.

---

# 3. Current technical architecture

JamesUI is implemented as a **Home Assistant custom integration with an integrated custom frontend panel**.

Repository:

- **MarkusAureliusTeuton/JamesUI**
- branch: **main**
- public repository

Current integration version:

- **v0.5.0**

Confirmed in `custom_components/jamesui/manifest.json`.

Important files:

```text
hacs.json

custom_components/jamesui/
├── __init__.py
├── api.py
├── config_flow.py
├── const.py
├── manifest.json
└── frontend/
    └── jamesui-panel.js

.github/
└── workflows/
    └── validate.yml
```

Architecture principles:

- Home Assistant owns entities, states, automations, scripts, scenes, schedules and history
- JamesUI owns presentation, navigation and interaction
- frontend uses Home Assistant `hass` state/services directly
- Web Components / custom JS/CSS frontend
- real-time HA state updates
- custom integration config/options for mapping where required
- HACS-compatible repository structure

---

# 4. Main navigation

Current agreed primary navigation:

```text
Start | Haus | Klima | Medien | Tür
```

This bottom navigation is the current product direction and should not be replaced casually by generic sidebar navigation from later visual experiments.

---

# 5. Visual design direction

Desired feel:

- dark / near-black base
- warm accents
- calm and premium
- clear hierarchy
- large readable information
- minimal visual clutter
- should feel closer to a high-end native smart-home or automotive interface than a standard Home Assistant dashboard
- avoid the typical colorful Lovelace-card look

## Room imagery

The user wants high-quality, photo-like room representation / visualizations.

Current status:

- previous generic AI room imagery was **not good enough**
- desired visuals should feel more realistic and closer to the actual rooms
- weather/time-of-day effects may later influence imagery

**Status: 🚧 not final**

---

# 6. Latest visual mockup

A recent design exploration included screens for:

- Home
- Wohnzimmer
- Licht
- Jalousien
- Klima
- Audio
- Kameras

The mockup used:

- dark UI
- warm room photography
- cards / status panels
- lighting controls
- blind controls
- climate cards
- media player
- camera tiles

Important: this mockup is **design inspiration only**, not automatically the approved application architecture. It included a left-side navigation that conflicts with the currently agreed bottom navigation.

Current approved navigation remains:

```text
Start | Haus | Klima | Medien | Tür
```

---

# 7. Start page

Target direction:

- large clock
- date
- weekday
- weather / outside temperature
- important house status
- selected room status
- media status where useful
- door status / important events
- selected scenes / quick actions

The page should remain calm and not become a dense control dashboard.

Original minimal concept was black background + clock/date/weekday; later concept expanded while retaining the minimalist feel.

**Status: 🚧 design still to finalize**

---

# 8. Haus module

Implemented from approximately v0.3 onward:

- loads HA Entity Registry
- loads Device Registry
- loads Area Registry
- category detection
- room/area grouping
- summary values
- detail views
- toggles / service calls

Typical categories:

- lights
- covers/blinds
- climate
- media players
- sensors
- switches

Known limitations / open improvements:

- automatic classification is not perfect
- counting/grouping edge cases
- KNX-specific entities may not map cleanly
- entities without proper area assignment
- multiple entities belonging to one physical device

**Status: ⚠️ functional, not final**

---

# 9. Lighting

Target features:

- state per room
- count of active lights
- room/group control
- on/off
- dimming
- optional color temperature/color where supported
- scenes / quick actions

UI should summarize the room instead of exposing long raw entity lists.

**Status: 🚧 further refinement required**

---

# 10. Blinds / covers

Target features:

- room overview
- open/closed/intermediate status
- position
- up/down/stop
- optional slat position
- grouped control
- house-level overview

KNX remains responsible for the underlying building control; JamesUI operates the Home Assistant/KNX entities.

**Status: 🚧 further refinement required**

---

# 11. Climate

Planned:

- auto-detect `climate.*`
- room temperature
- target temperature
- heating state
- optional humidity
- outside temperature
- heating circuit state
- programs/modes/helpers

Important architectural decision:

**JamesUI does not become the heating controller.** Regulation stays in KNX / Home Assistant / dedicated heating-control logic. JamesUI is the presentation and interaction layer.

For KNX, actual temperature, target value and heating status may exist as separate entities, so mapping may be required.

**Status: 🚧 not finished**

---

# 12. Media module

Media UI and basic logic have already been developed significantly.

Target capabilities:

- AV receiver
- TV
- Spotify
- Music Assistant
- volume
- play/pause/skip
- current title / artwork
- source selection
- playlists
- room/zone selection
- later multiroom where useful

Existing frontend work includes:

- media page
- player presentation
- transport controls
- volume control
- source selection
- Spotify playlist start logic
- Home Assistant media-player support
- Music Assistant path prepared

Existing internal functions include names such as:

```javascript
_prepareOnkyo()
_startSpotifyPlaylist()
```

These names are legacy/current implementation details and should later be generalized so the architecture is **not tied to one receiver manufacturer**.

Preferred long-term abstraction:

```text
JamesUI Media
    ↓
Home Assistant / Music Assistant
    ↓
Receiver / TV / other player
```

**Status: ⚠️ frontend/logic exists; end-to-end behavior still needs testing and cleanup**

---

# 13. Music Assistant

Music Assistant is part of the intended media architecture.

Desired use:

- Spotify/library access
- player selection
- playlists
- playback
- multiroom where appropriate

Still to verify/improve:

- exact `music_assistant.play_media` service schema
- Spotify playlist URL normalization
- player detection
- Spotify URL → MA media identifier handling
- error handling
- robust playback status feedback

**Status: ⚠️ prepared/integrated, not fully finished**

---

# 14. Door module

Dedicated bottom-nav section: **Tür**.

Planned UI:

- door state
- doorbell event
- live image / camera image
- snapshot
- event/history view
- optional door-open action if technically supported
- prominent overlay when doorbell rings

Existing frontend already contains a demo/test doorbell overlay.

The home uses a Siedle SG150. Reliable Home Assistant doorbell triggering remains an external backend problem; JamesUI should display the event once HA can provide it reliably.

**Status: 🚧 UI groundwork exists; backend trigger remains unresolved**

---

# 15. Camera / image history

Long-term target:

- entrance / front door
- terrace / garden where useful
- live image
- snapshots
- door-event history

Single-frame capture from the Siedle path has been possible in earlier work. Persistent storage/history and polished JamesUI presentation remain future work.

**Status: 🚧 open**

---

# 16. JamesUI settings

JamesUI has/needs its own settings layer for:

- entity mapping
- room/device assignment
- media player selection
- door/camera mapping
- weather source
- optional features

Goal: the user should **not edit source code or hard-code entity IDs manually** for normal configuration.

**Status: ⚠️ basic infrastructure exists; UX still needs refinement**

---

# 17. Frontend file / maintainability

Main frontend file:

```text
custom_components/jamesui/frontend/jamesui-panel.js
```

It currently contains or supports:

- navigation
- page routing
- Start
- Haus
- Klima
- Medien
- Tür
- settings
- HA state handling
- service calls
- responsive CSS
- door overlay
- media controls
- entity/device presentation

If the file becomes too large, modularization is reasonable. Do **not** split it prematurely just for architectural purity.

---

# 18. Responsive behavior

Primary target remains a landscape tablet, but JamesUI should not depend on a fixed physical resolution.

Desired support:

- OnePlus Pad 2 landscape first
- normal browser use
- possibly phones later
- CSS viewport responsive behavior

---

# 19. HACS / releases

JamesUI should be installable and updateable cleanly through HACS.

Current known state:

- `hacs.json` exists
- public GitHub repository exists
- integration structure is HACS-compatible

Open item:

- release/tag/update workflow has not yet been fully settled
- do not assume HACS always tracks `main`
- verify against current official HACS behavior before changing release strategy

**Status: 🚧 workflow still to finalize**

---

# 20. Version history / current milestone

Known milestones:

```text
v0.3.x  House/registry/automatic detection work
v0.5.0  Media/Spotify/Music Assistant and expanded UI work
```

Current repository manifest version:

**v0.5.0**

---

# 21. Working style / response rules

For JamesUI work, start each answer with one of these explicit status labels:

- **✅ Fertig:** fully implemented / should work
- **⚠️ Test nötig:** implementation exists but needs practical verification
- **🚧 Nicht fertig:** additional development is required

If something is not final, say so explicitly.

## Troubleshooting style

- give only one useful next action at a time
- wait for the result before giving the next step
- avoid giant troubleshooting checklists

## Development style

- if repository write access is available, prefer editing the repository directly
- avoid making the user manually copy code unnecessarily
- prefer Git/HACS workflow
- no hard-coded entity IDs unless unavoidable
- avoid unnecessary libraries and overengineering

---

# 22. Current priorities

Recommended order:

1. finalize visual/UI direction
2. finalize Start page
3. improve Haus/room presentation and classification
4. improve realistic room visual direction
5. implement/refine Klima
6. complete and robustly test Medien
7. expand Tür/Kamera
8. simplify Settings / mapping UX
9. settle HACS release/update process
10. full tablet/Fully practical test

---

# 23. Next-chat instruction

When continuing in a new chat:

1. Read this file first.
2. Inspect current repository files relevant to the requested area before changing code.
3. Treat the repository as the current source of implementation truth.
4. Treat this file as the current source of design/decision/progress context.
5. Continue directly from the current state instead of asking the user to repeat history.
6. After substantive JamesUI changes or decisions, update this file again before finishing the response.
