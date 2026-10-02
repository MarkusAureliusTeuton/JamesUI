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
- Start should fit the important daily information on one portrait screen whenever the target tablet viewport allows it.

## 2. Repository / release state

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.1**

Frontend revision on `main`: **0.5.1-r10**

Latest verified implementation:

- PR #9 merged the V9 Start redesign
- V9 merge commit: `fa9749c9be660ac8b7db6b2ee20d1d126989c14a`
- first real OnePlus/browser portrait screenshot received and reviewed
- PR #10 merged the r10 compact-grid/pictogram refinement
- r10 merge commit: `bf9fecbbaef8773eccf46b54985e6520f933538e`
- PR validation #154 → success
- final `main` validation #155 → success

`main` is implementation truth. Approved JamesUI changes should be implemented directly in the repository and finished green work integrated into `main` without asking the user to repeat that preference.

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
| `frontend/jamesui-home.js` | V9/r10 Start renderer, pictogram weather facts, weather tendency, house-status model, responsive compact grid | active Start owner |
| `frontend/jamesui-home-data.js` | calendar lifecycle, scene discovery/actions, Start overlays and Start-only shell interaction bridge | active live-data owner |
| `frontend/jamesui-home-background.js` | Auto/Manual background mode, photo treatment, four favorite-scene selectors + Start save flow | active background/settings owner |
| `frontend/assets/alpine/` | 8 local photorealistic WebP scenes | active |
| `frontend/assets/weather/` | old SVG base-Start fallback | intentional compatibility code |
| `tests/jamesui-home.test.js` | Start hero/calendar/house/weather/responsive regressions | active |
| `tests/jamesui-home-data.test.js` | calendar/scene/live-interaction/overlay regressions | active |
| `tests/jamesui-background.test.js` | background + favorite scene settings/API regressions | active |
| `tests/test_alpine_assets.py` | WebP signature/RIFF-length/detail checks | critical |
| `tests/test_frontend_entrypoint.py` | loader/revision/module/Shadow-DOM/property/rerender checks | critical |
| `PROJECT_STATUS.md` | persistent handover | keep current |

## 5. Start page – V9 / r10

**Status: ⚠️ code + CI verified on `main`; r10 still needs a fresh real browser/OnePlus portrait screenshot.**

### Weather hero

The upper Start area remains the large image-backed Alpine hero. The first real V9 screenshot confirmed that this direction works well and should not be redesigned wholesale.

It contains:

- date
- large clock
- Home Assistant location label
- current weather icon, temperature and condition
- one compact daily-information row
- compact `3-Tage-Prognose` action
- one subtle `…` button in the upper-right

r10 changes the daily information row from visible text headings to **local inline SVG pictograms**. The seven facts are:

- maximum temperature → sun pictogram
- minimum temperature → moon/night pictogram
- precipitation / first rain time → rain pictogram
- wind → wind pictogram
- sunrise → sunrise pictogram
- sunset → sunset pictogram
- moon phase + illumination → moon pictogram

The text labels remain visually hidden for accessibility. No external icon package or cloud dependency is added.

Rain behavior remains conservative: exact `ab HH:MM` is shown only when granular hourly/twice-daily forecast data actually supports it. Otherwise precipitation probability is shown.

### Compact portrait composition

The first real portrait screenshot showed that stacking Kalender and Hausstatus forced scenes below the fold. r10 therefore changes the target-tablet portrait layout:

- Hero is slightly shorter: target range roughly `410–540 px` / about `44vh` on portrait tablet.
- At portrait widths **>= 760 px**, the lower region stays a two-column grid.
- Calendar uses the slightly narrower left column.
- House status uses the slightly wider right column.
- Ratio: approximately `0.92fr / 1.08fr`.
- Only narrow/mobile widths below 760 px fall back to stacked layout.
- Lower section padding, headings, timeline and status rows are tightened while preserving readability.

Goal: **Hero + Kalender + Hausstatus + 4 Szenen + bottom nav** should fit on one OnePlus Pad 2 portrait screen without normal scrolling.

### Calendar

Calendar data is real Home Assistant data, not demo content.

Behavior:

- auto-discovers `calendar.*`
- subscribes via `calendar/event/subscribe`
- rolling window: current local day through following 7 days
- merges/sorts all calendars
- conservative deduplication
- supports timed and all-day events
- Start shows at most **3 compact events**
- `Weitere Termine` opens the larger overlay
- missing/no data shows compact `Keine Kalenderdaten`

The first real screenshot showed **Keine Kalenderdaten**, so actual HA calendar availability still needs to be verified separately from layout.

### Hausstatus

Start summarizes real HA state without creating a second Haus implementation.

Current groups:

- Licht
- Steckdosen
- Fenster
- Türen/Tore
- Lüftung
- Klima
- Medien

r10 compacts these into a **3-column status grid** on tablet-width Start. Open windows/doors still contribute to `Aufmerksamkeit nötig`.

The first real screenshot showed `–` for Fenster/Türen/Klima, meaning suitable entities were not detected in that runtime state. This is a data/classification issue, not a layout placeholder.

### Lieblingsszenen

- discovers real `scene.*`
- up to four favorites shown on Start
- ordered favorites configurable in Start settings
- deterministic fallback to discovered scenes if configuration is incomplete
- activation uses `scene.turn_on`
- momentary feedback only
- `Weitere` opens all-scenes overlay

r10 keeps all four scene buttons directly below the compact house-status grid so they should remain visible without scrolling on the target portrait tablet.

## 6. Background system

Start settings retain:

- **Automatisch**: follows weather + sun/day/night/twilight
- **Manuell**: forces one of 8 local scenes for visual testing while weather values remain live
- immediate scene preview
- dedicated `Start speichern` action
- four favorite scene selectors

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

`.github/workflows/validate.yml` covers:

- Python syntax
- JSON validity
- frontend JavaScript syntax
- guarded classic loader + revision propagation
- nested Shadow-DOM panel discovery/property bridge/initial rerender
- Alpine WebP/RIFF integrity
- Start renderer/status/weather/responsive tests
- background/favorite-scene settings tests
- calendar/scene/live-interaction tests

Current verified `main` validation: **#155 → success** on `bf9fecbbaef8773eccf46b54985e6520f933538e`.

Development rules:

1. inspect existing code/assets first
2. use small cohesive branches when work is risky
3. TDD red states stay off `main`
4. no duplicate implementations
5. update this file after substantive work
6. practical visual confirmation is required before declaring tablet UX final
7. approved green JamesUI repository work should be merged to `main` without asking the user to repeat that preference

## 11. Current priorities

1. Reload Home Assistant/JamesUI so **`0.5.1-r10`** is served.
2. Send a fresh portrait screenshot and verify that normal Start no longer scrolls on OnePlus Pad 2.
3. Check pictogram sizing/alignment and whether moon text still fits comfortably.
4. Verify real `calendar.*` entities/data, because the first screenshot showed no calendar data.
5. Configure/test four favorite scenes and verify they are visible and actionable without scrolling.
6. Investigate Fenster/Türen/Klima `–` values against actual HA entities/classification.
7. Fine-tune only from real screenshots, preserving the approved overall composition.
8. Continue Haus room-first, then real Klima, Media verification, and later Tür backend integration.

## 12. Working style

JamesUI replies start with `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:`.

- fewer confirmation questions; make progress when intent is clear
- direct repository edits when available
- when JamesUI code changes are approved and repository access is available, implement them directly and integrate finished green work into `main`
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
2. Treat `main` as implementation truth.
3. Inspect relevant existing files/assets before changing them.
4. Continue directly without asking the user to repeat documented decisions.
5. Update this file after substantive work.
