# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-02_

This file is the persistent **single source of truth** for JamesUI intent, architecture, active implementation, compatibility code, removal rules and next work. In every new JamesUI chat: read this file first, inspect only the relevant repository files, and update this file after substantive implementation/design/removal decisions.

## 1. Product goal

JamesUI is a tablet-first Home Assistant interface for the KNX/Home Assistant home. It should feel like a calm, premium, bespoke architectural control surface rather than a Lovelace/card dashboard.

Core rules:

- Home Assistant is backend/source of truth; KNX remains primary building automation.
- Primary target: **OnePlus Pad 2 wall tablet in portrait**; landscape/browser is secondary responsive behavior.
- Active global navigation: `Start | Haus | Klima | Medien | Tür`.
- The fixed global bottom navigation is the **only primary navigation**; do not duplicate these destinations inside Start.
- Local operation preferred; avoid unnecessary dependencies/cloud runtime assets.
- Automatic discovery first; manual mapping only where needed.
- Alpine-Chic / Chalet style: photorealistic outdoor weather atmosphere, near-black/anthracite base, restrained warm champagne accents, no fake apartment scene, no generic card grid, no glowing borders.

## 2. Repository / release state

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.1**

V9 implementation branch: `implementation/start-dashboard-v9`

Frontend revision on V9 branch: **0.5.1-r9**

V9 verification state:

- PR #9 open as draft against `main`
- latest full PR validation before this documentation-only update: **#147 → success**
- implementation head validated: `2bf5de22294990fb5da876eed781505ee3b3136d`
- practical browser / OnePlus portrait verification still required after integration

`main` remains implementation truth until PR #9 is integrated. The V9 branch is the only active implementation branch for the Start redesign.

## 3. Critical runtime chain

Home Assistant loads JamesUI through:

1. `custom_components/jamesui/__init__.py` → static path + custom panel registration.
2. `const.py` → `FRONTEND_FILE = "jamesui-entry.js"` + `FRONTEND_REVISION`.
3. `jamesui-entry.js` (classic script) → loads `jamesui-panel.js`, recursively finds panels through nested Shadow DOMs and restores pre-upgrade `hass/narrow/route/panel` properties.
4. `jamesui-home-entry.js` (module bridge) → imports `jamesui-home.js`, `jamesui-home-data.js` and `jamesui-home-background.js` with the same revision token.
5. Start, live-data and background enhancements install and the real panel rerenders immediately.

Do not bypass this chain casually. Previous failures included blank panel from direct ES-module loading, stale cached Start code, missing `hass`, and base Start showing until `Haus → Start`.

## 4. Ownership map

| Path | Responsibility | Rule |
| --- | --- | --- |
| `custom_components/jamesui/const.py` | release/frontend revision | revision truth |
| `custom_components/jamesui/api.py` | central WebSocket config, including favorite Start scenes | active |
| `frontend/jamesui-entry.js` | classic loader + Shadow-DOM/property bridge | critical |
| `frontend/jamesui-home-entry.js` | Start module bridge + initial rerender | critical |
| `frontend/jamesui-panel.js` | app shell, global nav, Haus/Klima/Medien/Tür, settings, base fallback Start | active; do not duplicate shell logic |
| `frontend/jamesui-home.js` | V9 Start renderer, weather hero, weather tendency, house-status model, responsive layout | active Start owner |
| `frontend/jamesui-home-data.js` | calendar lifecycle, scene discovery/actions, Start overlays and Start-only shell interaction bridge | active V9 live-data owner |
| `frontend/jamesui-home-background.js` | Auto/Manual background mode, photo treatment, four favorite-scene selectors + Start save flow | active background/settings owner |
| `frontend/assets/alpine/` | 8 local photorealistic WebP scenes | active |
| `frontend/assets/weather/` | old SVG base-Start fallback | intentional compatibility code |
| `tests/jamesui-home.test.js` | V9 hero/calendar/house/weather/status regressions | active |
| `tests/jamesui-home-data.test.js` | calendar/scene/live-interaction/overlay regressions | active |
| `tests/jamesui-background.test.js` | background + favorite scene settings/API regressions | active |
| `tests/test_alpine_assets.py` | WebP signature/RIFF-length/detail checks | critical |
| `tests/test_frontend_entrypoint.py` | loader/revision/module/Shadow-DOM/property/rerender checks | critical |
| `PROJECT_STATUS.md` | persistent handover | keep current |

## 5. Start page – V9

**Status: ⚠️ implementation and CI verified on PR branch; practical visual/runtime test required after integration.**

### Weather hero

The upper Start area is one large image-backed hero using the existing local Alpine background family.

It contains:

- date
- large clock
- Home Assistant location label
- current weather icon, temperature and condition
- one integrated daily information row:
  - maximum temperature
  - minimum temperature
  - precipitation probability / `ab HH:MM` when hourly or twice-daily forecast can derive a first rain time
  - wind
  - sunrise
  - sunset
  - **moon phase + illumination**
- compact `3-Tage-Prognose` action with temperature tendency (`Wärmer`, `Kühler`, `Stabil`) and rain expectation
- existing forecast detail overlay remains the full 3-day view
- one subtle `…` button in the upper-right

The former separate moon block is removed from the enhanced Start renderer.

### Start app chrome

On normal Start only:

- large JamesUI topbar is hidden
- content uses the full available width/height above the fixed bottom navigation
- hero `…` reuses the existing app-menu state/methods
- Start app menu additionally exposes **Einstellungen** inside the same menu, so the separate topbar settings button is unnecessary on Start
- other pages/settings keep the existing topbar until they are redesigned separately

The bottom navigation remains `Start | Haus | Klima | Medien | Tür` but V9 applies a calmer translucent dark treatment, refined spacing and a small champagne active indicator. No glow frame is used.

### Calendar

Calendar data is real Home Assistant data, not demo content.

Behavior:

- auto-discovers `calendar.*`
- subscribes via `calendar/event/subscribe`
- rolling window: current local day through the following 7 days
- merges and sorts all calendars
- conservative deduplication only within the same calendar for identical event/time pairs
- supports timed and all-day events
- Start shows a compact selection; `Weitere Termine` opens a larger overlay with the available subscribed events
- missing/no calendar data shows `Keine Kalenderdaten`
- subscriptions are cleaned up on panel disconnect

No external calendar credentials or cloud API are added to JamesUI.

### Hausstatus

Start summarizes the existing HA state without creating a second Haus implementation.

Current status groups:

- Licht
- Steckdosen
- Fenster
- Türen/Tore
- Lüftung
- Klima
- Medien

Window/door status uses real `binary_sensor.*` device classes and common opening names. Open windows/doors contribute to `Aufmerksamkeit nötig`; calm state is `Alles in Ordnung`.

`Weitere` navigates to the existing `Haus` page.

### Lieblingsszenen

- discovers real `scene.*` entities
- exactly up to four favorites shown on Start
- favorites are configurable in Start settings as an ordered list
- if configuration is incomplete/missing, remaining slots fall back deterministically to discovered scenes by name
- invalid/missing scene IDs are ignored in the frontend resolver and validated by the backend config API
- activation uses `scene.turn_on`
- scene buttons use momentary feedback only; JamesUI does not pretend scenes have a persistent active state
- `Weitere` opens an overlay of all discovered scenes

Config key: `home_scene_entities` (ordered list, max 4).

## 6. Background system

Start settings retain:

- **Automatisch**: follows weather + sun/day/night/twilight
- **Manuell**: forces one of 8 local scenes for visual testing while weather values remain live
- immediate scene preview
- dedicated `Start speichern` action

The same save action now persists both background selection and the four favorite scene selectors.

Alpine assets:

- `clear-day.webp`
- `cloudy-day.webp`
- `rain-day.webp`
- `snow-day.webp`
- `fog.webp`
- `dusk.webp`
- `clear-night.webp`
- `cloudy-night.webp`

## 7. Important bug-history lessons

Do not re-debug these from scratch:

- frontend revision tokens are mandatory to avoid stale cached Start code
- panel instances are nested in Shadow DOM; use existing recursive finder
- pre-upgrade HA properties must be bridged after custom-element definition
- Start enhancement must force initial rerender
- atmosphere layers must stay above the host background; negative z-index previously hid images
- `.webp` extension is not proof of a valid image; CI checks RIFF/WEBP and RIFF-declared length
- large binary image sets may be uploaded manually as ZIP when connector transfer risks truncation; verify repo blobs + CI afterwards

## 8. Base Start fallback lifecycle

`jamesui-panel.js` still contains the older base `_homePage()` / `_weatherBackground()` implementation and `frontend/assets/weather/` contains its SVGs. This remains intentional fallback code.

Only remove base Start + old weather SVGs together after enhanced Start is proven stable on OnePlus/Fully and browser, loader architecture is settled, and a tested safe render path remains if enhancement loading fails.

V9 therefore evolves the enhanced Start renderer in place rather than deleting fallback code.

## 9. Other pages

### Haus
**Status: ⚠️ functional, not final.** Registry discovery, light/socket/fan classification, availability/low-battery summary, area grouping and toggles exist. Next direction: room-first presentation without duplicating discovery/control helpers.

### Klima
**Status: 🚧 demo only.** Hard-coded rooms/demo temperatures/disabled controls remain. Replace them with real `climate.*` entities and remove demo code in the same change.

### Medien
**Status: ⚠️ substantial implementation exists; practical E2E verification still needed.** Spotify, Music Assistant, Onkyo preparation, source/transport/volume/now-playing and playlist normalization exist. Do not create a second receiver stack.

### Tür
**Status: 🚧 UI groundwork only.** Camera/doorbell/open-action placeholders remain; replace inside existing Tür flow when reliable Siedle/camera backend entities exist.

## 10. Validation / workflow

`.github/workflows/validate.yml` now covers:

- Python syntax
- JSON validity
- frontend JavaScript syntax
- guarded classic loader + revision propagation
- nested Shadow-DOM panel discovery/property bridge/initial rerender
- Alpine WebP/RIFF integrity
- V9 Start renderer/status/weather tests
- background/favorite-scene settings tests
- calendar/scene/live-interaction tests

Development rules:

1. inspect existing code/assets first
2. use small cohesive batches when work is risky
3. TDD red states stay off `main`
4. no duplicate implementations
5. update this file after substantive work
6. practical visual confirmation is required before declaring tablet UX final

## 11. Current priorities

1. Integrate PR #9 into `main` after branch-completion decision.
2. Update/reload Home Assistant so **`0.5.1-r9`** is served.
3. Browser test: verify the Start header is gone, hero `…` opens one combined menu, and Settings opens from it.
4. Verify weather hero: current values, max/min, rain probability/timing, sunrise/sunset, moon phase/illumination and 3-day tendency.
5. Verify real `calendar.*` events appear; test `Weitere Termine`.
6. Configure four favorite scenes in Start settings and test activation + `Weitere` scene overlay.
7. Verify Hausstatus classifications against actual entities, especially windows/doors.
8. Send a fresh browser screenshot; when OnePlus is available, repeat in portrait because portrait remains design authority.
9. Fine-tune spacing/crop/brightness only from real screenshots.
10. Continue Haus room-first, then real Klima, Media verification, and later Tür backend integration.

## 12. Working style

JamesUI replies start with `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:`.

- fewer confirmation questions; make progress when intent is clear
- direct repository edits when available
- one useful troubleshooting step at a time
- no unnecessary user copy/paste
- no intentionally red `main`
- preserve proven fallback paths until replacement is verified
- portrait wall-tablet behavior is primary

## 13. Design / implementation docs

- V9 design: `docs/superpowers/specs/2026-10-02-start-dashboard-v9-design.md`
- V9 plan: `docs/superpowers/plans/2026-10-02-start-dashboard-v9.md`

## 14. Next-chat instruction

1. Read `PROJECT_STATUS.md` first.
2. Treat `main` as implementation truth; if PR #9 is not yet merged, inspect its branch before continuing V9 work.
3. Inspect relevant existing files/assets before changing them.
4. Continue directly without asking the user to repeat documented decisions.
5. Update this file after substantive work.
