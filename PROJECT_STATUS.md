# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-02_

This file is the persistent **single source of truth** for JamesUI intent, architecture, current implementation and next work. In every new JamesUI chat: read this file first, inspect only the relevant repository files, and update this file after substantive implementation/design/removal decisions.

## 1. Product goal

JamesUI is a tablet-first Home Assistant interface for the KNX/Home Assistant home. It should feel like a calm, premium, bespoke architectural control surface rather than a Lovelace/card dashboard.

Core rules:

- Home Assistant is backend/source of truth; KNX remains primary building automation.
- Primary target: **OnePlus Pad 2 wall tablet in portrait**; browser/landscape remain secondary.
- Global navigation: `Start | Haus | Klima | Medien | Tür`.
- The fixed bottom navigation is the **only primary navigation**.
- Prefer local operation and automatic discovery; add manual mapping only where needed.
- Alpine-Chic / Chalet style: photorealistic outdoor atmosphere, anthracite/near-black base, restrained warm champagne accents, no generic dashboard cards, no glowing frames.
- Start should fit the important daily information on one portrait screen whenever the target viewport allows it.
- Approved JamesUI changes should be implemented directly in the repository and finished green work merged to `main` without repeatedly asking for permission.

## 2. Repository / release state

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.1**

Frontend revision on `main`: **0.5.1-r11**

Latest verified implementation:

- PR #9 → V9 Start redesign
- PR #10 → r10 compact portrait grid + pictogram facts
- PR #11 → r11 visual polish toward approved mockup
- r11 squash merge commit: `83daa861a3bcbe0aa610af7ba9d3846544ad4068`
- PR validation #161 → success
- final `main` validation #162 → success

`main` is implementation truth.

## 3. Critical runtime chain

1. `custom_components/jamesui/__init__.py` registers the static path and panel.
2. `const.py` defines `FRONTEND_FILE = "jamesui-entry.js"` and `FRONTEND_REVISION`.
3. `jamesui-entry.js` is the guarded classic loader and restores pre-upgrade HA properties while finding nested Shadow-DOM panel instances.
4. `jamesui-home-entry.js` imports the Start modules with the same revision token:
   - `jamesui-home.js`
   - `jamesui-home-data.js`
   - `jamesui-home-background.js`
   - `jamesui-v11-polish.js`
5. Enhancements install and the real panel rerenders immediately.

Do not bypass this chain casually. Previous failures included blank panels from direct ES-module loading, stale cached Start code, missing `hass`, and enhancement appearing only after navigating away/back.

## 4. Ownership map

| Path | Responsibility | Rule |
| --- | --- | --- |
| `custom_components/jamesui/const.py` | frontend revision | revision truth |
| `custom_components/jamesui/api.py` | central config API | active |
| `frontend/jamesui-entry.js` | classic loader + Shadow-DOM/property bridge | critical |
| `frontend/jamesui-home-entry.js` | Start module bridge + revision propagation | critical |
| `frontend/jamesui-panel.js` | shell/global nav/other pages/base fallback Start | active; do not duplicate shell logic |
| `frontend/jamesui-home.js` | Start renderer, weather/status/calendar layout | active Start owner |
| `frontend/jamesui-home-data.js` | calendar lifecycle, scene discovery/actions, overlays | active live-data owner |
| `frontend/jamesui-home-background.js` | background mode + Start settings | active |
| `frontend/jamesui-v11-polish.js` | r11 visual refinement layer for Start | active; visual-only override layer |
| `frontend/assets/alpine/` | local photorealistic weather scenes | active |
| `tests/jamesui-home.test.js` | core Start regressions | active |
| `tests/jamesui-home-data.test.js` | calendar/scene regressions | active |
| `tests/jamesui-background.test.js` | background/settings regressions | active |
| `tests/jamesui-v11-style.test.js` | r11 visual-contract regressions | active |
| `tests/test_frontend_entrypoint.py` | loader/revision propagation | critical |
| `PROJECT_STATUS.md` | persistent handover | keep current |

## 5. Start page – current r11 direction

**Status: ⚠️ code + CI verified; practical screenshot verification still required.**

### Weather hero

The upper hero remains the strongest part of the design and should not be redesigned wholesale.

Current behavior:

- large local Alpine weather/day/night image
- date, clock, HA location
- current condition + temperature
- compact row for max/min/rain/wind/sunrise/sunset/moon
- 3-day tendency action
- one subtle `…` button

r10 introduced icon-led weather facts. r11 moves closer to the approved mockup:

- removes the horizontal divider above the weather facts
- preserves the seven compact pictogram facts
- replaces the simple current-weather glyph with richer local inline-SVG weather artwork for cloudy/clear/rain/snow/fog states
- keeps everything local; no icon CDN/package dependency

### Calendar + Hausstatus deck

The approved mockup comparison showed that the lower widgets should feel like one intentional surface layered over the atmosphere, not two flat black sections.

r11 therefore:

- keeps Kalender and Hausstatus side-by-side on portrait tablet
- moves the shared grid visually upward with a small overlap onto the hero
- wraps it in one rounded semi-transparent glass/anthracite frame
- adds a subtle champagne/white shimmer line along the upper edge
- continues the current Alpine scene slightly behind the deck and fades it into black below, so the mountain image appears to continue down the left/right edges like in the mockup
- removes the separate hard top borders from the child sections

### Hausstatus

The previous r10 compact table was functional but visually too dry. r11 keeps the same real HA data model but restyles the individual status entries as tactile mini-surfaces:

- rounded 10 px surfaces
- restrained depth/highlight rather than glow
- larger icon treatment
- 3-column compact grid remains so the page still fits without scrolling
- active/alert states retain separate tone handling

Current groups remain: Licht, Steckdosen, Fenster, Türen/Tore, Lüftung, Klima, Medien.

### Szenen

The four real favorite `scene.*` entities remain functional via `scene.turn_on`.

r11 makes the scene controls closer to the mockup:

- larger image-backed scene buttons
- subtle local Alpine artwork as the visual layer
- dark gradient for legibility
- restrained border/highlight and momentary activated state
- still no fake persistent scene-active state

If no scenes are configured/discovered, JamesUI still shows the real empty state rather than demo scenes.

### Calendar

Calendar still uses real `calendar.*` entities via Home Assistant subscriptions. Start shows up to three compact events; `Weitere Termine` opens the full overlay.

The most recent real screenshot still showed `Keine Kalenderdaten`. That remains a data/integration question to verify separately from the visual layout.

## 6. Known live-data gaps from the latest screenshot

- Moon entity is still not fully configured/mapped in the real runtime.
- Calendar currently returns no events/data.
- Fenster/Türen/Klima show `–` where suitable entities are not being detected.
- Favorite scenes were not yet configured/discovered in the screenshot.

These are data/configuration issues; do not fake them in the UI.

## 7. Important bug-history lessons

- frontend revision tokens are mandatory to defeat stale cached Start code
- panel instances are nested in Shadow DOM; use the existing recursive finder
- pre-upgrade HA properties must be restored after custom-element definition
- enhanced Start must force initial rerender
- local WebP assets are validated for real RIFF/WEBP integrity
- keep the base Start fallback until the enhanced Start is proven stable in browser + OnePlus/Fully

## 8. Other pages

### Haus
**Status: ⚠️ functional, not final.** Registry discovery, light/socket/fan classification, availability/low-battery summary, area grouping and toggles exist. Next direction: room-first presentation.

### Klima
**Status: 🚧 demo only.** Replace hardcoded demo rooms with real `climate.*` entities and remove demo code in the same change.

### Medien
**Status: ⚠️ substantial implementation exists; practical E2E verification still needed.** Spotify, Music Assistant, Onkyo preparation, source/transport/volume/now-playing and playlist normalization exist.

### Tür
**Status: 🚧 groundwork only.** Camera/doorbell/open-action flow exists but depends on reliable backend entities/events.

## 9. Validation / workflow

`.github/workflows/validate.yml` covers Python/JSON/JS syntax, loader contracts, asset integrity, Start layout/data tests, background settings, calendar/scenes, and the r11 visual-contract test.

Current verified `main` validation: **#162 → success** on `83daa861a3bcbe0aa610af7ba9d3846544ad4068`.

Development rules:

1. inspect existing code/assets first
2. use small cohesive branches for risky visual/runtime changes
3. TDD red states stay off `main`
4. no duplicate implementations without a removal plan
5. update this file after substantive work
6. practical screenshot confirmation is required before declaring tablet UX final
7. approved green JamesUI repository work goes to `main` without re-asking

## 10. Current priorities

1. Reload/update JamesUI so **`0.5.1-r11`** is served.
2. Send a fresh portrait screenshot.
3. Verify the r11 goals visually:
   - no line above weather facts
   - richer current weather/cloud artwork
   - framed lower widget deck with shimmer edge
   - Alpine image visibly continuing/fading behind the deck edges
   - house status surfaces closer to mockup
   - scene buttons closer to mockup
   - no normal scrolling
4. Then address real data/configuration gaps: calendar, moon, Fenster/Türen/Klima and favorite scenes.
5. Continue Haus room-first, then real Klima, Media verification and Tür backend integration.

## 11. Working style

JamesUI replies start with `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:`.

- concise technical collaboration
- direct repository edits when available
- one useful troubleshooting action at a time
- no unnecessary copy/paste for the user
- preserve fallback paths until replacements are practically verified
- portrait wall-tablet behavior is primary

## 12. Next-chat instruction

1. Read `PROJECT_STATUS.md` first.
2. Treat `main` as implementation truth.
3. Inspect relevant existing files before editing.
4. Continue directly without asking the user to repeat documented decisions.
5. Update this file after substantive work.
