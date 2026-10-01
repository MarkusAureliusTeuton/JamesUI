# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-01_

This file is the persistent **single source of truth** for JamesUI intent, architecture, active implementation, compatibility code, removal rules and next work. In every new JamesUI chat: read this file first, then inspect only the repository files relevant to the requested work. After every substantive design, implementation, removal or architecture decision, update this file in the same work batch.

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
- Portrait is the design authority for Start and future wall-tablet UX; landscape/browser is secondary responsive behavior.
- Fully Kiosk may be the kiosk shell, but JamesUI must not depend on Fully.

Active navigation:

`Start | Haus | Klima | Medien | Tür`

## 2. Repository / release state

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.1**

Frontend asset revision: **0.5.1-r6**

`main` is always the implementation source of truth. Feature/fix branches are temporary development aids only and must not become alternate product states.

Latest validation:

- PR #6 / **Validate JamesUI #111 → success**
- `main` / **Validate JamesUI #112 → success**
- commit: `ef0c04e0fb2709dd2ca47ee443d49eebf48d14c9`
- scope: replace eight corrupt Alpine atmosphere files with valid WebP assets, add binary-signature regression validation, bump frontend revision to r6

## 3. Active runtime chain – critical

Home Assistant loads JamesUI through this chain:

1. `custom_components/jamesui/__init__.py` registers `/jamesui_static` and the custom panel.
2. `custom_components/jamesui/const.py` defines `FRONTEND_FILE = "jamesui-entry.js"`, integration `VERSION` and `FRONTEND_REVISION`.
3. Home Assistant registers `jamesui-entry.js?v={FRONTEND_REVISION}`.
4. `frontend/jamesui-entry.js` is a **classic script** and loads `jamesui-panel.js` first.
5. The loader recursively searches document + open Shadow DOM roots for `jamesui-panel`.
6. After the panel class exists, the loader reapplies any Home Assistant properties assigned before custom-element upgrade: `hass`, `narrow`, `route`, `panel`.
7. The loader injects `jamesui-home-entry.js` as `type="module"`.
8. `jamesui-home-entry.js` derives the same frontend revision from its own URL and imports `jamesui-home.js` with that revision.
9. `jamesui-home.js` installs the Alpine Start enhancement.
10. `jamesui-home-entry.js` finds the real nested panel instance and rerenders it so Alpine Start is visible on the first render.

Why this structure exists:

- A previous direct ES-module panel entry caused a blank/black JamesUI screen.
- A stale-cache issue later kept old Start code visible despite newer repository code.
- Home Assistant can place the panel inside nested Shadow DOMs and assign properties before the custom element class is defined.
- A light-DOM-only `document.querySelectorAll("jamesui-panel")` missed the real panel, causing both `HOME ASSISTANT OFFLINE` and the old Start page until `Haus → Start` forced a rerender.

Protection:

- `tests/test_frontend_entrypoint.py` protects classic entry loading, revision propagation, Shadow-DOM panel discovery, pre-upgrade property handoff and post-enhancement rerender.

**Removal rule:** never delete or bypass `jamesui-entry.js` / `jamesui-home-entry.js` independently. If the loader architecture changes, change the chain and its regression tests together.

## 4. Repository ownership map

| Path | Responsibility | Status / rule |
| --- | --- | --- |
| `custom_components/jamesui/__init__.py` | HA setup, static frontend path, panel registration | Stable infrastructure |
| `custom_components/jamesui/const.py` | domain, panel constants, integration version, frontend revision | Active source for release/revision |
| `custom_components/jamesui/api.py` | WebSocket config read/update for Start + Media mappings | Active |
| `custom_components/jamesui/config_flow.py` | single-instance integration setup | Active |
| `custom_components/jamesui/manifest.json` | HA integration metadata/version | Must match integration `VERSION` |
| `frontend/jamesui-entry.js` | classic loader, Shadow-DOM panel finder, property-upgrade bridge, revision propagation | Critical active infrastructure |
| `frontend/jamesui-home-entry.js` | module bridge + immediate rerender after Start enhancement | Critical active infrastructure |
| `frontend/jamesui-panel.js` | app shell + Haus/Klima/Medien/Tür + settings/overlays + base/fallback Start | Active; large; refactor only deliberately |
| `frontend/jamesui-home.js` | current Alpine Start, home summary, atmosphere mapping, portrait/landscape Start CSS | Active Start owner |
| `frontend/assets/alpine/` | local Alpine weather/day/night atmosphere WebP assets | Active Start assets; format is CI-validated |
| `frontend/assets/weather/` | older SVG weather backgrounds used by base Start fallback | Intentional compatibility code, not dead code |
| `tests/jamesui-home.test.js` | Start summary/atmosphere/navigation/portrait/fallback/weather-hero/layer-order tests | Active |
| `tests/test_alpine_assets.py` | verifies all 8 Alpine assets are real RIFF/WEBP files | Critical asset regression protection |
| `tests/test_frontend_entrypoint.py` | loader/revision/Shadow-DOM/HA-property/rerender tests | Critical loader protection |
| `.github/workflows/validate.yml` | syntax, JSON, loader, Alpine asset and Start tests | Active; Markdown-only changes ignored |
| `PROJECT_STATUS.md` | persistent handover + ownership/removal map | Must stay current |

## 5. Start page – Alpine Interface

**Status: ⚠️ r6 implemented and CI-verified; practical visual verification on the OnePlus is now required.**

Design authority:

- Portrait-first wall-tablet layout.
- Weather and day/night should be immediately recognizable **from imagery**, not just text.
- Alpine-Chic / Chalet character through atmosphere, lighting and restrained material language; do not show a dominant fictional apartment/interior.
- Dark stone/anthracite base, restrained champagne/warm-metal accents, fine separators and calm typography.
- No generic card grid.
- Roughly 70–80% functional/information weight and 20–30% atmosphere overall; the weather hero may be visually stronger.
- The image supports the interface; it must not make the wall tablet look like a photo frame.

Current implementation in `jamesui-home.js`:

- one composed Start surface instead of tile/card grid
- time/date + weather primary hierarchy
- current temperature, condition, high/low, precipitation, humidity, wind, illuminance, sunrise/sunset
- compact `Zuhause` state summary
- one integrated `Haus | Klima | Medien | Tür` function strip
- compact moon information
- local weather/day/night atmosphere mapping
- graceful missing-data fallback
- no runtime cloud-image dependency

### V2 – flatter architectural surface

- reduced card appearance
- weather facts became free-standing semantic information with hairlines
- function strip made lighter and more integrated
- unified Alpine accent handling

### V3 – portrait first

- dedicated `@media(orientation:portrait)` layout
- one wall-tablet composition instead of a long dashboard
- compact horizontal `Zuhause` section
- moon remains secondary
- single four-wide function strip at OnePlus-class portrait width
- narrower phone fallback may use 2×2 controls; phone layout is not the design authority

### V4 – weather hero sizing / contrast

After live weather data worked, the upper surface was still nearly black. V4 therefore:

- changed portrait atmosphere sizing to `cover`
- shifted image focus vertically for sky/horizon/alpine scenery
- allocated a stronger weather hero (`minmax(430px,58vh)`)
- reduced night over-darkening
- softened the fade into the dark lower functional surface
- added localized text shadows instead of relying on a heavy full-image veil
- frontend revision `0.5.1-r4`
- PR #4 validation #107 and `main` validation #108 passed

### V5 – atmosphere layer-order fix

The r4 screenshot still showed no image. Code inspection found that the atmosphere used negative z-index values inside an isolated, opaque `.alpine-home` host.

Fix:

- `.alpine-atmosphere-fallback` → `z-index:0`
- `.alpine-atmosphere` → `z-index:1`
- `.alpine-ambient-shade` → `z-index:2`
- `.alpine-surface` → `position:relative; z-index:3`
- frontend revision `0.5.1-r5`
- layer-order regression protection added
- PR #5 validation #109 and `main` validation #110 passed

### r6 – Alpine asset repair

The 20:43 r5 screenshot still showed an almost uniform black/blue upper surface. Direct inspection of the repository binaries then found the actual asset fault:

- `cloudy-night.webp` did **not** contain a RIFF/WEBP header
- `clear-day.webp` also did **not** contain a RIFF/WEBP header
- the existing Alpine `.webp` family had been stored with invalid/corrupt binary contents, so the browser could not decode the images at all
- the dark surface visible on the tablet was the fallback/gradient, not a successfully rendered weather image

Repair:

- all eight existing Alpine files were replaced **at the same paths** with valid WebP files; no competing asset family was added
- current paths/names remain unchanged, so `jamesui-home.js` mapping does not need a parallel implementation
- `tests/test_alpine_assets.py` verifies every expected asset exists and has both `RIFF` and `WEBP` signatures
- CI now runs the asset test in `.github/workflows/validate.yml`
- frontend revision bumped to **`0.5.1-r6`** to prevent clients from reusing corrupt cached assets
- PR #6 validation #111 and `main` validation #112 passed

Current Alpine assets:

- `clear-day.webp`
- `cloudy-day.webp`
- `rain-day.webp`
- `snow-day.webp`
- `dusk.webp`
- `clear-night.webp`
- `cloudy-night.webp`
- `fog.webp`

### Real tablet observations

- **19:08:** old cached Start visible; later solved by versioned frontend delivery.
- **19:40:** Alpine Start loads, but HA context missing (`HOME ASSISTANT OFFLINE`).
- **19:54:** `… → Oberfläche neu laden` could return to base Start; only `Haus → Start` showed Alpine. Root cause was light-DOM-only panel discovery.
- **r3 fix:** Shadow-DOM-aware panel discovery + property bridge + immediate enhancement rerender.
- **20:05:** first real success of loader/data path: `Zuhause verbunden`, real weather data and new Start immediately visible.
- **20:30 / r4:** still no recognizable atmosphere; prompted layer investigation.
- **20:43 / r5:** still almost flat black/blue despite correct z-order. Binary inspection proved the `.webp` assets themselves were invalid. This produced r6.

**Next visual decision must be based on a fresh r6 screenshot.** Do not make further brightness/crop changes until a valid atmosphere asset is actually visible on the tablet.

Approved design spec:

`docs/superpowers/specs/2026-10-01-startpage-alpine-interface-design.md`

## 6. Base Start / fallback lifecycle

`jamesui-panel.js` still contains the older base `_homePage()` / `_weatherBackground()` implementation, and `frontend/assets/weather/` contains its SVG assets.

This is intentional compatibility code, not accidental dead code.

Only remove base Start + old weather SVGs together after:

1. Alpine Start is proven stable on OnePlus/Fully and normal browser use,
2. long-term loader/module architecture is settled,
3. a safe render path exists and is tested when the Start enhancement cannot load.

Do not delete only the fallback SVGs or only the base renderer.

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

If generalized later, migrate the existing path into a generic abstraction; do not add a second parallel receiver stack.

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

Before generating/adding/replacing visual assets:

1. inspect existing assets first,
2. verify actual binary/file validity, not only filename/extension,
3. reuse/replace assets at existing paths where appropriate,
4. do not create a competing image family without a migration plan,
5. keep runtime assets local to JamesUI,
6. retire code references and files together,
7. keep format validation in CI for critical runtime assets.

The r6 repair is the preferred pattern: repair the existing asset family in place and protect it with a regression test.

## 13. Known cleanup backlog

These are maintenance items, not permission for opportunistic rewrites:

1. `jamesui-panel.js` still has an internal display `VERSION` constant; release/revision display can be centralized later.
2. `jamesui-panel.js` is large (~130 KB). Split only when a module is deliberately being reworked.
3. Base Start + Alpine Start coexist intentionally for fallback until practical stability is proven.
4. README/release tagging/HACS update strategy should remain aligned with actual releases.
5. Temporary development branches should be synchronized or retired after completed batches.

## 14. Validation / workflow

`.github/workflows/validate.yml` currently checks:

- Python syntax
- JSON parsing
- frontend JavaScript syntax
- classic/guarded panel entry
- frontend revision propagation
- Shadow-DOM-aware panel discovery
- pre-upgrade HA property bridge contract
- post-enhancement initial rerender contract
- **Alpine binary asset signatures (`RIFF` / `WEBP`)**
- Start/home Node tests, including portrait weather-hero and atmosphere layer-order protection

Development workflow:

1. inspect existing code/assets before creating replacements,
2. make related work as one cohesive batch,
3. run focused checks first where possible,
4. keep intentionally failing TDD states off `main`,
5. prefer one meaningful `main` validation run per cohesive batch,
6. update `PROJECT_STATUS.md` afterwards without triggering unnecessary CI.

The platform's own review/safety checks cannot be bypassed. Reduce delays by avoiding unnecessary binary/image operations, duplicate work and repeated validation cycles.

## 15. Current priorities

1. Reload/update JamesUI/Home Assistant so `jamesui-entry.js?v=0.5.1-r6` is served.
2. Capture a fresh portrait screenshot and confirm a real Alpine weather image is finally visible behind the UI.
3. Only after the r6 screenshot: tune realism, night contrast, image focus, hero height and Alpine-Chic atmosphere.
4. Verify `… → Oberfläche neu laden` returns directly to the current Alpine Start; initial page load/navigation is already practically verified.
5. Resolve `Klima – Noch nicht verknüpft` using real entity mapping, without fake values.
6. Identify the current `1 Gerät offline` source and decide whether it is a real alert or classification noise.
7. Continue Haus toward room-first presentation.
8. Replace Klima demo with real entity-driven implementation and remove demo code in the same change.
9. Complete Media verification.
10. Replace Tür placeholders when Siedle/camera backend is reliable.

## 16. Working style

JamesUI replies should start with:

- `✅ Fertig:` fully implemented / verified
- `⚠️ Test nötig:` implementation exists but needs practical verification
- `🚧 Nicht fertig:` more work required

Other rules:

- fewer confirmation questions; make progress when intent is clear
- direct repository edits when available, independent of whether the user is currently chatting from tablet or laptop
- one useful troubleshooting step at a time
- no unnecessary user copy/paste
- no intentionally red `main`
- no duplicate implementation beside temporary/legacy paths
- preserve working fallback until replacement is proven
- reuse/repair existing visuals/assets before creating new parallel families
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
