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

Frontend asset revision: **0.5.1-r2**

`main` is always the implementation source of truth. Feature branches are temporary development aids only; completed branches must not become alternate product states.

Latest functional validation:

- **Validate JamesUI #105 → success**
- commit: `145763f1b4216bb2cea3f76a4a9fdc8c0fd8361d`
- scope: HA context/property upgrade bridge + frontend revision propagation

## 3. Active runtime chain – critical

Home Assistant loads JamesUI through this chain:

1. `custom_components/jamesui/__init__.py` registers `/jamesui_static` and the custom panel.
2. `custom_components/jamesui/const.py` defines `FRONTEND_FILE = "jamesui-entry.js"`, integration `VERSION` and `FRONTEND_REVISION`.
3. Home Assistant registers `jamesui-entry.js?v={FRONTEND_REVISION}`.
4. `frontend/jamesui-entry.js` is a **classic script** and loads `jamesui-panel.js` first.
5. After the panel script has defined `jamesui-panel`, the loader reapplies any properties Home Assistant may have assigned before the custom element upgrade (`hass`, `narrow`, `route`, `panel`).
6. The loader then injects `jamesui-home-entry.js` as `type="module"`.
7. `jamesui-home-entry.js` derives the same revision from its own URL and dynamically imports `jamesui-home.js` with that revision.
8. `jamesui-home.js` installs the Alpine Start enhancement and rerenders the panel.

Why this structure exists:

- A previous direct ES-module panel entry caused a blank/black JamesUI screen.
- A later stale-cache issue caused old Start code to remain visible despite newer repository code.
- The 2026-10-01 19:40 tablet screenshot showed Alpine V3 itself loading, but `HOME ASSISTANT OFFLINE`, `unknown` weather and no live state. Root cause identified: Home Assistant can assign `hass` to the element **before** the custom element class is defined; that own property then shadows the class setter after upgrade. `jamesui-entry.js` now explicitly reapplies these pre-upgrade properties after `jamesui-panel.js` loads.

Protection:

- `tests/test_frontend_entrypoint.py` keeps the classic entry requirement, revision propagation and pre-upgrade property handoff covered.

**Removal rule:** never delete or bypass `jamesui-entry.js` / `jamesui-home-entry.js` independently. If this loader is redesigned, change the chain and its regression tests together.

## 4. Repository ownership map

| Path | Responsibility | Status / rule |
| --- | --- | --- |
| `custom_components/jamesui/__init__.py` | HA setup, static frontend path, panel registration | Stable infrastructure |
| `custom_components/jamesui/const.py` | domain, panel constants, release version, frontend revision | Active source for integration/revision |
| `custom_components/jamesui/api.py` | WebSocket config read/update for Start + Media mappings | Active |
| `custom_components/jamesui/config_flow.py` | single-instance integration setup | Active |
| `custom_components/jamesui/manifest.json` | HA integration metadata/version | Must match integration `VERSION` |
| `frontend/jamesui-entry.js` | guarded classic loader, property-upgrade bridge, nested asset revision propagation | Critical active infrastructure |
| `frontend/jamesui-home-entry.js` | ES-module bridge for Start enhancement | Critical active infrastructure |
| `frontend/jamesui-panel.js` | app shell + Haus/Klima/Medien/Tür + settings/overlays + base/fallback Start | Active; large; refactor only deliberately |
| `frontend/jamesui-home.js` | current Alpine Start, home summary, atmosphere mapping, portrait/landscape Start CSS | Active Start owner |
| `frontend/assets/alpine/` | realistic Alpine atmosphere WebP assets | Active Start assets |
| `frontend/assets/weather/` | older SVG weather backgrounds | Intentional fallback, not dead code yet |
| `tests/jamesui-home.test.js` | Start summary/atmosphere/navigation/portrait/fallback tests | Active |
| `tests/test_frontend_entrypoint.py` | loader/revision/HA-property regression protection | Critical active test |
| `.github/workflows/validate.yml` | syntax/JSON/loader/Start validation | Active; Markdown-only changes ignored |
| `PROJECT_STATUS.md` | persistent handover + ownership/removal map | Must stay current |

## 5. Start page – Alpine Interface

**Status: ⚠️ implemented and CI-verified; practical live-data verification on the OnePlus is still required after the HA-context bridge fix.**

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
- atmosphere image shown full-width at top without aggressive `cover` crop
- lower half transitions into near-black stone/metal-like gradient
- `Zuhause` is compact and horizontal
- moon remains secondary
- single four-wide function strip on OnePlus-class portrait width
- narrower-phone fallback may use 2×2 controls, but that is not the wall-tablet target

### Real tablet observations

**19:08 screenshot:** old cached Start implementation still visible (SVG mountains, separate `Zuhause`, duplicate `Direktzugriff`).

Fix applied:

- integration bumped to 0.5.1
- cache-visible frontend URLs refreshed

**19:40 screenshot:** Alpine V3 is now visibly loaded, confirming the cache issue is resolved. However live HA context is missing: `HOME ASSISTANT OFFLINE`, weather `unknown`, no temperature/forecast and no meaningful atmosphere selection.

Fix merged after this screenshot:

- pre-upgrade HA properties are reapplied after `jamesui-panel` definition
- frontend cache revision separated from integration release version (`FRONTEND_REVISION = 0.5.1-r2`)
- nested JS module URLs now derive the revision dynamically instead of hard-coding release query strings
- no Start markup/CSS/assets were changed by this fix

**Next visual decision must be based on a fresh screenshot after this fix is loaded.** Do not tune weather image contrast/position from the 19:40 screenshot because its weather state was not live.

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
- pre-upgrade HA property bridge contract
- Start/home Node tests

Development workflow:

1. inspect existing code/assets before creating replacements,
2. make related work as one cohesive batch,
3. run focused/local checks first where possible,
4. keep intentionally failing TDD states off `main`,
5. prefer one meaningful `main` validation run per cohesive batch,
6. update `PROJECT_STATUS.md` afterwards without triggering unnecessary CI.

The platform's own review/safety checks cannot be bypassed. Reduce delays by avoiding repeated binary/image operations and unnecessary validation cycles.

## 15. Current priorities

1. Update/reload JamesUI/Home Assistant so `jamesui-entry.js?v=0.5.1-r2` is served.
2. Confirm on the OnePlus that `HOME ASSISTANT OFFLINE` disappears and live weather/state values populate.
3. Capture a fresh portrait screenshot with real weather data.
4. Only then tune Alpine atmosphere visibility, weather-image height/position, contrast, typography and bottom-strip proportions.
5. Resolve any remaining real data-source mapping issues (`unknown`, `–`, `Noch nicht verknüpft`) without fake values.
6. Continue Haus toward room-first presentation.
7. Replace Klima demo with real entity-driven implementation and remove demo code in the same change.
8. Complete Media verification.
9. Replace Tür placeholders when Siedle/camera backend is reliable.

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
