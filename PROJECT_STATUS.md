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
- Alpine-Chic / Chalet style: photorealistic outdoor weather atmosphere, dark stone/anthracite base, restrained warm champagne accents, no fake apartment scene, no generic card grid.

## 2. Repository / release state

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.1**

Frontend revision: **0.5.1-r8**

Latest verified implementation:

- PR #8 merged into `main`
- PR validation **#130 → success**
- `main` validation **#131 → success**
- merge commit: `95b54559f8348d8a2a0083c263782434ebfe6696`
- scope: dedicated background save flow, immediate settings preview, single Start navigation, stronger information hierarchy/readability, brighter Alpine photo treatment, revision r8

`main` is always implementation truth. Feature/fix branches are temporary only and must not become alternate product states.

## 3. Critical runtime chain

Home Assistant loads JamesUI through:

1. `custom_components/jamesui/__init__.py` → static path + custom panel registration.
2. `const.py` → `FRONTEND_FILE = "jamesui-entry.js"` + `FRONTEND_REVISION`.
3. `jamesui-entry.js` (classic script) → loads `jamesui-panel.js`, recursively finds panels through nested Shadow DOMs and restores pre-upgrade `hass/narrow/route/panel` properties.
4. `jamesui-home-entry.js` (module bridge) → imports `jamesui-home.js` + `jamesui-home-background.js` with the same revision token.
5. Start/background enhancements install and the real panel rerenders immediately.

Do not bypass this chain casually. Previous failures included blank panel from direct ES-module loading, stale cached Start code, missing `hass`, and base Start showing until `Haus → Start`.

## 4. Ownership map

| Path | Responsibility | Rule |
| --- | --- | --- |
| `custom_components/jamesui/const.py` | release/frontend revision | revision truth |
| `custom_components/jamesui/api.py` | central WebSocket config | active |
| `frontend/jamesui-entry.js` | classic loader + Shadow-DOM/property bridge | critical |
| `frontend/jamesui-home-entry.js` | Start module bridge + initial rerender | critical |
| `frontend/jamesui-panel.js` | app shell, global nav, Haus/Klima/Medien/Tür, settings, base fallback Start | active; refactor deliberately only |
| `frontend/jamesui-home.js` | Alpine Start structure, status model, auto weather mapping, responsive Start CSS | active Start owner |
| `frontend/jamesui-home-background.js` | Auto/Manual background mode, scene selection, dedicated save flow, photo treatment | active background owner |
| `frontend/assets/alpine/` | 8 local photorealistic WebP scenes | active |
| `frontend/assets/weather/` | old SVG base-Start fallback | intentional compatibility code |
| `tests/jamesui-home.test.js` | Start layout/status/atmosphere/readability regressions | active |
| `tests/jamesui-background.test.js` | background settings/save/override tests | active |
| `tests/test_alpine_assets.py` | WebP signature/RIFF-length/detail checks | critical |
| `tests/test_frontend_entrypoint.py` | loader/revision/Shadow-DOM/property/rerender checks | critical |
| `PROJECT_STATUS.md` | persistent handover | keep current |

## 5. Start page – current r8 state

**Status: ⚠️ implementation + CI verified; practical browser/OnePlus visual test required.**

Current composition:

- photorealistic Alpine weather/day/night image as the atmosphere layer
- large time/date and weather hierarchy
- current temperature/condition, high/low, rain, humidity, wind, illuminance, sunrise/sunset
- `Zuhause` status with alerts, climate/door/media state
- compact activity line for lights, sockets and ventilation
- moon information kept secondary
- **no second `Haus | Klima | Medien | Tür` strip inside Start**; global bottom nav is the sole navigation
- larger, brighter wall-tablet typography and stronger local text contrast
- no runtime cloud image dependency

### Background modes

In Start settings → `Atmosphärischer Hintergrund`:

- **Automatisch** (default): follows weather + sun/day/night/twilight.
- **Manuell**: forces one of 8 scenes for visual testing while live weather numbers remain unchanged.
- Scene preview updates immediately when the mode/scene selector changes.
- There is now a dedicated **`Hintergrund speichern`** button; it no longer depends on the unrelated `Zuordnung speichern` action.
- Saved values use the existing `jamesui/config/update` API and therefore persist centrally.

Scenes:

- `clear-day.webp`
- `cloudy-day.webp`
- `rain-day.webp`
- `snow-day.webp`
- `fog.webp`
- `dusk.webp`
- `clear-night.webp`
- `cloudy-night.webp`

### r8 visual treatment

User feedback from the r7 browser screenshot: imagery was finally realistic but Start still felt too dark/trieste, information was too small, and navigation was duplicated.

r8 response:

- removed the duplicate in-content navigation markup and obsolete associated Start CSS
- increased weather facts/status/supporting text sizes and contrast
- added direct house activity facts (`Licht`, `Steckdosen`, `Lüftung`) instead of using a second navigation row as status display
- reduced full-photo dark overlays from roughly `.46/.62` to `.34/.48`
- increased image brightness/saturation modestly while using localized text shadows/gradients for readability
- keeps the lower area darker so the screen remains architectural rather than looking like a photo frame

## 6. Important bug-history lessons

Do not re-debug these from scratch:

- frontend revision tokens are mandatory to avoid stale cached Start code
- panel instances are nested in Shadow DOM; use existing recursive finder
- pre-upgrade HA properties must be bridged after custom-element definition
- Start enhancement must force initial rerender
- atmosphere layers must stay above the host background; negative z-index previously hid images
- `.webp` extension is not proof of a valid image; CI checks RIFF/WEBP and RIFF-declared length
- large binary image sets may be uploaded manually as ZIP when connector transfer risks truncation; verify repo blobs + CI afterwards

## 7. Base Start fallback lifecycle

`jamesui-panel.js` still contains the older base `_homePage()` / `_weatherBackground()` implementation and `frontend/assets/weather/` contains its SVGs. This is intentional fallback code.

Only remove base Start + old weather SVGs together after Alpine Start is proven stable on OnePlus/Fully and browser, loader architecture is settled, and a tested safe render path remains if enhancement loading fails.

## 8. Other pages

### Haus
**Status: ⚠️ functional, not final.** Registry discovery, light/socket/fan classification, availability/low-battery summary, area grouping and toggles exist. Next direction: room-first presentation without duplicating discovery/control helpers.

### Klima
**Status: 🚧 demo only.** Hard-coded rooms/demo temperatures/disabled controls remain. Replace them with real `climate.*` entities and remove demo code in the same change.

### Medien
**Status: ⚠️ substantial implementation exists; practical E2E verification still needed.** Spotify, Music Assistant, Onkyo preparation, source/transport/volume/now-playing and playlist normalization exist. Do not create a second receiver stack.

### Tür
**Status: 🚧 UI groundwork only.** Camera/doorbell/open-action placeholders remain; replace inside existing Tür flow when reliable Siedle/camera backend entities exist.

## 9. Settings / configuration

Central configuration currently includes:

- Start weather source
- optional outdoor temperature source
- moon phase source
- optional illuminance source
- Start background Auto/Manual mode + manual scene
- Media mappings

Still needed over time: climate, door/camera, and special room/device mappings where automatic discovery is insufficient.

## 10. Validation/workflow rules

`.github/workflows/validate.yml` covers Python/JSON/JS syntax, loader contracts, Alpine asset integrity, Start tests and background settings tests.

Development rules:

1. inspect existing code/assets first
2. use small cohesive batches when work is risky
3. TDD red states stay off `main`
4. prefer one meaningful final `main` validation per batch
5. update this file afterwards
6. no duplicate implementations or unnecessary dead code

## 11. Current priorities

1. Reload/update JamesUI/Home Assistant so **`0.5.1-r8`** is served.
2. In browser/settings, verify `Manuell` → choose scene → **`Hintergrund speichern`** → return to Start and confirm the chosen photo is applied.
3. Confirm Start now has only the fixed global bottom navigation and that information is comfortably readable.
4. Send a fresh browser screenshot; when OnePlus is available, repeat in portrait because portrait remains design authority.
5. Fine-tune r8 crop/brightness/information placement from those screenshots rather than regenerating assets wholesale.
6. Verify `… → Oberfläche neu laden` still returns directly to enhanced Start.
7. Resolve `Klima – Noch nicht verknüpft` with real entities.
8. Identify the current `1 Gerät offline` source and determine whether it is a real alert or classification noise.
9. Continue Haus room-first, then replace Klima demo, finish Media verification and later Tür backend integration.

## 12. Working style

JamesUI replies start with `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:`.

- fewer confirmation questions; make progress when intent is clear
- direct repository edits when available
- one useful troubleshooting step at a time
- no unnecessary user copy/paste
- no intentionally red `main`
- preserve proven fallback paths until replacement is verified
- portrait wall-tablet behavior is primary

## 13. Next-chat instruction

1. Read `PROJECT_STATUS.md` first.
2. Treat `main` as implementation truth and this file as architecture/progress/removal context.
3. Inspect relevant existing files/assets before changing them.
4. Continue directly without asking the user to repeat documented decisions.
5. Update this file after substantive work.
