# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-01_

This file is the persistent **single source of truth** for project intent, architecture, active implementation, compatibility code, cleanup rules and next work. In every new JamesUI chat: read this file first, then inspect only the repository files relevant to the requested work. After every substantive design, implementation, removal or architecture decision, update this file in the same work batch.

## 1. Product goal

JamesUI is a tablet-first Home Assistant interface for the KNX/Home Assistant home. It should feel like a calm, premium, bespoke architectural control surface rather than a Lovelace/card dashboard.

Core rules:

- Home Assistant is backend/source of truth.
- KNX remains the primary building-automation layer.
- JamesUI owns presentation, navigation and interaction.
- Local operation is preferred; avoid unnecessary cloud dependencies.
- Automatic entity/device/area discovery first; manual mapping only where required.
- Do not hard-code entity IDs for normal use.
- Do not add dependencies or abstractions without a concrete need.
- Primary target: **OnePlus Pad 2 / wall tablet in portrait orientation**.
- Portrait is the design authority for Start and future wall-tablet UX; landscape/browser remains a secondary responsive layout.
- Fully Kiosk may be the kiosk shell, but JamesUI must not depend on Fully.

Active navigation:

`Start | Haus | Klima | Medien | Tür`

## 2. Repository / release state

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.1**

Frontend asset revision: **0.5.1-r4**

`main` is always the implementation source of truth. Feature branches are temporary development aids only; completed branches must not become alternate product states.

Latest functional validation:

- **Validate JamesUI #108 → success**
- commit: `cab60a496adaee95591429f2d18502165e12e479`
- scope: Alpine Start V4 portrait weather hero + r4 cache revision

## 3. Active runtime chain – critical

Home Assistant loads JamesUI through this chain:

1. `custom_components/jamesui/__init__.py` registers `/jamesui_static` and the custom panel.
2. `custom_components/jamesui/const.py` defines `FRONTEND_FILE = "jamesui-entry.js"`, integration `VERSION` and `FRONTEND_REVISION`.
3. Home Assistant registers `jamesui-entry.js?v={FRONTEND_REVISION}`.
4. `frontend/jamesui-entry.js` is a **classic script** and loads `jamesui-panel.js` first.
5. The loader recursively searches the document **and open Shadow DOM roots** for `jamesui-panel`; it must not assume the panel lives in the light DOM.
6. After the panel script has defined `jamesui-panel`, the loader reapplies any properties Home Assistant may have assigned before the custom element upgrade (`hass`, `narrow`, `route`, `panel`).
7. The loader then injects `jamesui-home-entry.js` as `type="module"`.
8. `jamesui-home-entry.js` derives the same revision from its own URL and dynamically imports `jamesui-home.js` with that revision.
9. `jamesui-home.js` installs the Alpine Start enhancement.
10. `jamesui-home-entry.js` uses the same Shadow-DOM-aware panel finder and rerenders the existing panel instance so the Alpine Start is visible immediately after page load.

Why this structure exists:

- A previous direct ES-module panel entry caused a blank/black JamesUI screen.
- A later stale-cache issue caused old Start code to remain visible despite newer repository code.
- Home Assistant can create/place the custom panel inside nested Shadow DOMs and can assign properties before the custom element class is defined.
- Direct `document.querySelectorAll("jamesui-panel")` therefore missed the real panel instance. This caused **both** observed symptoms: `hass` was not upgraded (`HOME ASSISTANT OFFLINE`) and the Alpine enhancement did not rerender the already-visible Start page.

Protection:

- `tests/test_frontend_entrypoint.py` keeps the classic entry requirement, revision propagation, Shadow-DOM panel discovery, pre-upgrade property handoff and post-enhancement rerender covered.

**Removal rule:** never delete or bypass `jamesui-entry.js` / `jamesui-home-entry.js` independently. If this loader is redesigned, change the chain and its regression tests together.

## 4. Repository ownership map

| Path | Responsibility | Status / rule |
| --- | --- | --- |
| `custom_components/jamesui/__init__.py` | HA setup, static frontend path, panel registration | Stable infrastructure |
| `custom_components/jamesui/const.py` | domain, panel constants, release version, frontend revision | Active source for integration/revision |
| `custom_components/jamesui/api.py` | WebSocket config read/update for Start + Media mappings | Active |
| `custom_components/jamesui/config_flow.py` | single-instance integration setup | Active |
| `custom_components/jamesui/manifest.json` | HA integration metadata/version | Must match integration `VERSION` |
| `frontend/jamesui-entry.js` | guarded classic loader, Shadow-DOM panel finder, property-upgrade bridge, asset revision propagation | Critical active infrastructure |
| `frontend/jamesui-home-entry.js` | ES-module bridge + initial rerender after Start enhancement | Critical active infrastructure |
| `frontend/jamesui-panel.js` | app shell + Haus/Klima/Medien/Tür + settings/overlays + base/fallback Start | Active; large; refactor only deliberately |
| `frontend/jamesui-home.js` | current Alpine Start, home summary, atmosphere mapping, portrait/landscape Start CSS | Active Start owner |
| `frontend/assets/alpine/` | realistic Alpine atmosphere WebP assets | Active Start assets |
| `frontend/assets/weather/` | older SVG weather backgrounds | Intentional fallback, not dead code yet |
| `tests/jamesui-home.test.js` | Start summary/atmosphere/navigation/portrait/fallback/V4 weather-hero tests | Active |
| `tests/test_frontend_entrypoint.py` | loader/revision/Shadow-DOM/HA-property/initial-rerender regression protection | Critical active test |
| `.github/workflows/validate.yml` | syntax/JSON/loader/Start validation | Active; Markdown-only changes ignored |
| `PROJECT_STATUS.md` | persistent handover + ownership/removal map | Must stay current |

## 5. Start page – Alpine Interface

**Status: ⚠️ V4 implemented and CI-verified; practical V4 visual verification on the OnePlus is still required.**

Current design authority:

- Portrait-first wall-tablet layout.
- Weather and day/night should be immediately recognizable **from the image**, not only from text.
- Alpine-Chic / Chalet character through atmosphere and material language, not a fictional dominant room scene.
- Dark stone/anthracite base, restrained champagne/warm-metal accents, fine separators, calm typography.
- No generic card grid.
- Roughly 70–80% functional/information weight and 20–30% atmosphere overall; the upper weather zone may be visually stronger.

Current implementation in `jamesui-home.js`:

- one composed Start surface instead of tile/card grid
- time/date + weather primary hierarchy
- current temperature, condition, high/low, precipitation, humidity, wind, illuminance, sunrise/sunset
- compact `Zuhause` state summary
- one integrated `Haus | Klima | Medien | Tür` functional strip
- compact moon information
- local weather/day/night atmosphere mapping
- graceful missing-data fallback
- no runtime cloud-image dependency

### V2

- flattened the Start surface
- reduced card appearance
- made weather atmosphere more legible
- replaced weather mini-cards with semantic free-standing facts + hairlines
- lightened the function strip
- unified Alpine accent handling

### V3 – portrait first

- dedicated `@media(orientation:portrait)` layout
- targets one composed wall-tablet screen instead of a long dashboard
- initially scaled the 16:9 atmosphere image to portrait width (`100% auto`)
- lower half transitions into near-black stone/metal-like gradient
- `Zuhause` is compact and horizontal
- moon remains secondary
- single four-wide function strip on OnePlus-class portrait width
- narrower-phone fallback may use 2×2 controls, but that is not the wall-tablet target

### V4 – visible weather hero

Implemented after the first fully live-data portrait screenshot showed the technical flow working but the atmosphere almost disappearing into a black upper surface.

Changes:

- portrait atmosphere image now uses `cover` instead of width-only `100% auto`
- image focus is shifted vertically to make sky / horizon / Alpine scenery useful in portrait
- weather hero gets a stronger portrait allocation (`minmax(430px,58vh)`)
- night atmosphere brightness increased so clouds / terrain / moonlight remain readable while still looking like night
- rain / snow / fog portrait filters were rebalanced rather than globally over-darkened
- the dark lower surface now fades in more gradually instead of covering the weather scene too early
- time / temperature / weather text gets localized shadow contrast rather than relying on a dark full-image veil
- frontend revision bumped to `0.5.1-r4`
- `tests/jamesui-home.test.js` protects the V4 portrait image sizing, focus, hero proportion and night brightness contract
- PR validation #107 and `main` validation #108 both passed

### Real tablet observations

**19:08 screenshot:** old cached Start implementation still visible (SVG mountains, separate `Zuhause`, duplicate `Direktzugriff`).

Fix applied:

- integration bumped to 0.5.1
- cache-visible frontend URLs refreshed

**19:40 screenshot:** Alpine V3 is visibly loaded, confirming the cache issue is resolved. However live HA context is missing: `HOME ASSISTANT OFFLINE`, weather `unknown`, no temperature/forecast and no meaningful atmosphere selection.

Initial attempted fix:

- pre-upgrade HA properties were reapplied after `jamesui-panel` definition
- frontend revision separated from integration release version (`0.5.1-r2`)

**19:54 screenshot:** symptoms remain, and user reports an additional repeatable behavior: choosing `… → Oberfläche neu laden` returns to the old/base Start presentation; only navigating `Haus → Start` causes the new Alpine Start to appear.

Root cause confirmed from code:

- both the property-upgrade bridge in `jamesui-entry.js` and the enhancement rerender in `jamesui-home-entry.js` used direct `document.querySelectorAll("jamesui-panel")`.
- the actual HA panel lives below nested Shadow DOM roots, so both queries returned no panel instance.
- later page navigation works because it invokes `panel.render()` from the existing instance, at which point the already-patched Alpine `_homePage()` is used.

Fix merged as **frontend revision `0.5.1-r3`**:

- one recursive `findJamesPanels()` walks document + open Shadow DOM roots
- the same finder is exposed by the classic loader and reused by the home-entry bridge
- pre-upgrade `hass/narrow/route/panel` properties are now applied to the real nested panel
- after `installHomeExperience()`, the real nested panel is rerendered immediately
- no Alpine layout, styles, images or Home Assistant entity logic were changed in this bugfix
- Validate JamesUI #106 is green

**20:05 screenshot:** first practical success of the loader/data path.

Confirmed on the actual portrait tablet:

- current Alpine Start appears directly
- `Zuhause verbunden` is shown
- real weather data populates (`20.9°C`, partially cloudy, humidity, wind, sunrise/sunset)
- Start no longer needs `Haus → Start` to obtain the new layout

Visual issue observed:

- the atmosphere was still almost invisible / black despite live weather data
- V3 used a 16:9 image at `100% auto` inside a tall portrait area, leaving much of the hero without useful imagery
- night filtering plus the large dark surface gradients suppressed the remaining image too strongly

This observation directly produced V4. **The next screenshot must be with frontend revision r4 before making further atmosphere judgments.**

Current Alpine assets:

- `clear-day.webp`
- `cloudy-day.webp`
- `rain-day.webp`
- `snow-day.webp`
- `dusk.webp`
- `clear-night.webp`
- `cloudy-night.webp`
- `fog.webp`

Approved design spec:

`docs/superpowers/specs/2026-10-01-startpage-alpine-interface-design.md`

## 6. Base Start / fallback lifecycle

`jamesui-panel.js` still contains the older base `_homePage()` / `_weatherBackground()` implementation, and `frontend/assets/weather/` contains the corresponding SVG assets.

This is intentional compatibility code, not accidental dead code.

Only remove these together after:

1. Alpine Start is proven stable on OnePlus/Fully and normal browser use,
2. long-term loader/module architecture is settled,
3. a safe render path exists and is tested when the Start enhancement cannot load.

Do not delete only the SVG assets or only the base renderer.

## 7. Haus

**Status: ⚠️ functional, not final.**

Implemented in `jamesui-panel.js`:

- HA Area / Device / Entity Registry loading
- lights, sockets, fans/ventilation and device-health classification
- house summary and availability/update/low-battery counts
- room/area grouping in category details
- light/switch/fan toggles

Next direction: room-first presentation while preserving existing discovery/control logic.

Do not duplicate these helpers in a second implementation.

## 8. Klima

**Status: 🚧 demo only.**

Temporary code in `jamesui-panel.js`:

- `_climatePage()`
- `_climateRoom()`
- hard-coded rooms
- demo temperatures
- disabled setpoint controls

When implementing real climate support, replace/remove the demo code in the same change.

Target:

- real `climate.*` discovery
- actual / target temperature
- heating state
- optional humidity/outdoor temperature
- mapping only where KNX/HA entities require it

JamesUI is not the heating controller.

## 9. Medien

**Status: ⚠️ substantial implementation exists; end-to-end practical verification still needed.**

Existing paths:

- Home Assistant media players
- Spotify
- Music Assistant
- Onkyo preparation
- source / transport / volume / now-playing
- playlist URI normalization

Vendor-specific code currently includes `_onkyoEntityId()`, `_onkyoNetworkSource()`, `_prepareOnkyo()`, `media_onkyo_entity`, `media_onkyo_source`.

If generalized later, migrate the existing path into the generic abstraction; do not add a second parallel receiver stack.

## 10. Tür / camera

**Status: 🚧 UI groundwork only; backend event/history path unresolved.**

Current placeholders/demo:

- `_doorPage()`
- camera placeholder
- disabled open/light actions
- doorbell demo overlay

When reliable Siedle/camera entities exist, replace these within the existing Tür flow rather than creating a second door page.

## 11. Settings / configuration

Working central configuration exists for Start data sources and Media via `api.py` / HA config entry.

Still needed over time:

- room/device mapping where automatic discovery is insufficient
- climate mapping
- door/camera mapping
- optional-feature controls

Normal operation should not require source-code edits or raw entity IDs.

## 12. Asset lifecycle

Before generating/adding new images:

1. inspect existing assets first,
2. reuse/adjust existing assets where possible,
3. do not create a competing image family without a migration plan,
4. keep runtime assets local to JamesUI,
5. retire code references and files together.

## 13. Known cleanup backlog

These are maintenance items, not permission for opportunistic rewrites:

1. `jamesui-panel.js` still has an internal display `VERSION` constant; release/revision display can be centralized later.
2. `jamesui-panel.js` is large (~130 KB). Split only when a module is deliberately being reworked.
3. Base Start + Alpine Start coexist intentionally for fallback until practical stability is proven.
4. README/release tagging/HACS update strategy should remain aligned with actual releases.
5. Temporary development branches should be synchronized or retired after completed batches.

## 14. Validation / workflow

`.github/workflows/validate.yml` checks:

- Python syntax
- JSON parsing
- frontend JavaScript syntax
- classic/guarded panel entry
- frontend revision propagation
- Shadow-DOM-aware panel discovery
- pre-upgrade HA property bridge contract
- post-enhancement initial rerender contract
- Start/home Node tests, including the V4 portrait weather-hero contract

Development workflow:

1. inspect existing code/assets before creating replacements,
2. make related work as one cohesive batch,
3. run focused/local checks first where possible,
4. keep intentionally failing TDD states off `main`,
5. prefer one meaningful `main` validation run per cohesive batch,
6. update `PROJECT_STATUS.md` afterwards without triggering unnecessary CI.

The platform's own review/safety checks cannot be bypassed. Reduce delays by avoiding repeated binary/image operations and unnecessary validation cycles.

## 15. Current priorities

1. Reload/update JamesUI/Home Assistant so `jamesui-entry.js?v=0.5.1-r4` is served.
2. Capture a fresh portrait screenshot and confirm the V4 weather image is visibly present across the upper hero area.
3. Check that night still reads as night while clouds / horizon / terrain remain recognizable.
4. Verify `… → Oberfläche neu laden` returns directly to the current Alpine Start; initial page load/navigation is already practically verified.
5. Fine-tune image focus / hero height / contrast only from the r4 screenshot.
6. Resolve the real `Klima – Noch nicht verknüpft` mapping without fake values.
7. Identify the current `1 Gerät offline` source and decide whether it is a real alert or classification noise.
8. Continue Haus toward room-first presentation.
9. Replace Klima demo with real entity-driven implementation and remove demo code in the same change.
10. Complete Media verification.
11. Replace Tür placeholders when Siedle/camera backend is reliable.

## 16. Working style

JamesUI replies should start with:

- `✅ Fertig:` fully implemented / verified
- `⚠️ Test nötig:` implementation exists but needs practical verification
- `🚧 Nicht fertig:` more work required

Other rules:

- fewer confirmation questions; make progress when intent is clear
- direct repository edits when available
- one useful troubleshooting step at a time
- no unnecessary user copy/paste
- no intentionally red `main`
- no duplicate implementation beside temporary/legacy paths
- preserve working fallback until replacement is proven
- reuse existing visuals/assets before creating new ones
- portrait wall-tablet behavior is primary
- keep this file current enough that a new chat can continue without reconstructing intent

## 17. Next-chat instruction

When continuing in a new chat:

1. Read `PROJECT_STATUS.md` first.
2. Treat `main` as implementation truth and this file as architecture/progress/removal context.
3. Inspect relevant existing files/assets before designing replacements.
4. Continue directly; do not ask the user to repeat documented decisions.
5. When adding/replacing/removing a feature, update the corresponding ownership/removal note here.
6. After substantive work, update status, current priority and practical-test state here.
