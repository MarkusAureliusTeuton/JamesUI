# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-02_

This file is the persistent **single source of truth** for JamesUI intent, architecture, active implementation, compatibility code, removal rules and next work. In every new JamesUI chat: read this file first, then inspect only the repository files relevant to the requested work. After substantive design, implementation, removal or architecture decisions, update this file in the same work batch.

## 1. Product goal

JamesUI is a tablet-first Home Assistant interface for the KNX/Home Assistant home. It should feel like a calm, premium, bespoke architectural control surface rather than a Lovelace/card dashboard.

Core rules:

- Home Assistant is backend/source of truth.
- KNX remains the primary building-automation layer.
- JamesUI owns presentation, navigation and interaction.
- Local operation preferred; avoid unnecessary cloud dependencies.
- Automatic entity/device/area discovery first; manual mapping only where needed.
- Do not hard-code entity IDs for normal use.
- Do not add dependencies or abstractions without a concrete need.
- Primary target: **OnePlus Pad 2 / wall tablet in portrait orientation**.
- Portrait is the design authority; landscape/browser is secondary responsive behavior.
- Fully Kiosk may be the shell, but JamesUI must not depend on Fully.

Active navigation:

`Start | Haus | Klima | Medien | Tür`

## 2. Repository / release state

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.1**

Frontend revision: **0.5.1-r7**

Latest verified state:

- PR #7 merged into `main`
- PR validation **#122 → success**
- `main` validation **#123 → success**
- merge commit: `486b3211e1dee6635b5c0f6faf37d4b386fd0467`
- scope: photorealistic Alpine backgrounds, Auto/Manual background mode, manual test scenes, stronger asset validation, frontend revision r7

`main` is always implementation truth. Feature/fix branches are temporary only and must not become alternate product states.

## 3. Active runtime chain – critical

Home Assistant loads JamesUI through this chain:

1. `custom_components/jamesui/__init__.py` registers `/jamesui_static` and the custom panel.
2. `custom_components/jamesui/const.py` defines `FRONTEND_FILE = "jamesui-entry.js"`, integration `VERSION` and `FRONTEND_REVISION`.
3. Home Assistant registers `jamesui-entry.js?v={FRONTEND_REVISION}`.
4. `frontend/jamesui-entry.js` is a **classic script** and loads `jamesui-panel.js` first.
5. The loader recursively searches document + open Shadow DOM roots for `jamesui-panel`.
6. Pre-upgrade HA properties (`hass`, `narrow`, `route`, `panel`) are reapplied after the custom element exists.
7. The loader injects `jamesui-home-entry.js` as `type="module"`.
8. `jamesui-home-entry.js` imports `jamesui-home.js` and `jamesui-home-background.js` with the same revision token.
9. Alpine Start and background/settings enhancements are installed.
10. The real nested panel instance is rerendered immediately so the enhanced Start page appears on first load/reload.

Why this chain exists:

- Direct ES-module panel entry once caused a blank/black screen.
- Stale browser cache once kept old Start code visible.
- Home Assistant places the panel inside nested Shadow DOMs.
- A light-DOM-only lookup caused both `HOME ASSISTANT OFFLINE` and the old Start page until `Haus → Start` forced a rerender.

**Removal rule:** never delete or bypass `jamesui-entry.js` / `jamesui-home-entry.js` independently. If loader architecture changes, update the complete chain and its regression tests together.

## 4. Repository ownership map

| Path | Responsibility | Rule |
| --- | --- | --- |
| `custom_components/jamesui/__init__.py` | HA setup, static path, panel registration | Stable infrastructure |
| `custom_components/jamesui/const.py` | domain, panel constants, release/revision | Active source of revision truth |
| `custom_components/jamesui/api.py` | central WebSocket config read/update | Active |
| `frontend/jamesui-entry.js` | classic loader, Shadow-DOM search, HA property bridge | Critical |
| `frontend/jamesui-home-entry.js` | Start module bridge + initial rerender | Critical |
| `frontend/jamesui-panel.js` | app shell + Haus/Klima/Medien/Tür + settings + base/fallback Start | Active; large; refactor deliberately only |
| `frontend/jamesui-home.js` | Alpine Start structure, summary, auto atmosphere mapping, portrait CSS | Active Start owner |
| `frontend/jamesui-home-background.js` | r7 photo background override + Auto/Manual settings + persistence hook | Active background owner |
| `frontend/assets/alpine/` | local photorealistic weather/day/night WebP assets | Active Start assets |
| `frontend/assets/weather/` | older SVG backgrounds used by base Start fallback | Intentional compatibility code |
| `tests/jamesui-home.test.js` | Start layout/summary/atmosphere regressions | Active |
| `tests/jamesui-background.test.js` | Auto/Manual background settings and override behavior | Active |
| `tests/test_alpine_assets.py` | RIFF/WEBP + declared-size integrity + night-detail checks | Critical asset protection |
| `tests/test_frontend_entrypoint.py` | loader/revision/Shadow-DOM/HA-property/rerender tests | Critical loader protection |
| `.github/workflows/validate.yml` | syntax, JSON, loader, asset and Start tests | Active |
| `PROJECT_STATUS.md` | architecture/progress/removal handover | Must stay current |

## 5. Start page – Alpine Interface

**Status: ⚠️ r7 implemented and CI-verified; practical OnePlus visual verification is next.**

Design authority:

- Portrait-first wall-tablet layout.
- Weather and day/night must be recognizable **from imagery**, not only text.
- Alpine-Chic / Chalet character through landscape, light and restrained warm material accents.
- No dominant fictional apartment/interior.
- Dark stone/anthracite base, restrained champagne/warm-metal accents, fine separators, calm typography.
- No generic card grid.
- Image supports the interface; JamesUI must not turn into a photo frame.

Current Start composition:

- one composed surface instead of tile/card grid
- time/date + weather primary hierarchy
- current temperature, condition, high/low, precipitation, humidity, wind, illuminance, sunrise/sunset
- compact `Zuhause` state summary
- integrated `Haus | Klima | Medien | Tür` function strip
- compact moon information
- local weather/day/night atmosphere mapping
- graceful missing-data fallback
- no runtime cloud-image dependency

### r7 background system

The original Alpine images were first invalid/corrupt, then valid but too abstract/dark. r7 replaces them with a new **photorealistic 1280×720 Alpine family** at the existing paths:

- `clear-day.webp`
- `cloudy-day.webp`
- `rain-day.webp`
- `snow-day.webp`
- `fog.webp`
- `dusk.webp`
- `clear-night.webp`
- `cloudy-night.webp`

The files stay under `frontend/assets/alpine/`; there is no parallel runtime image family.

Background behavior:

- **Automatisch** is the normal/default mode.
- Auto follows real weather plus day/night/twilight information from the existing Start atmosphere logic.
- **Manuell** is a test mode and can force any of the eight scenes.
- Manual background selection changes only the visual scene; real weather values stay live.
- Settings live in the existing Start settings flow and persist through the existing JamesUI config API.
- Settings therefore apply centrally rather than per-tablet local storage.

Current visual treatment:

- portrait image uses `cover`
- weather hero occupies the upper visual portion of the screen
- darkening is localized rather than a full opaque veil
- night image gets moderate brightness/contrast compensation
- lower functional surface fades to dark anthracite

### Practical observations / bug history worth retaining

Keep only these lessons; do not re-debug them from scratch:

- stale frontend revisions can show old Start code → revision token is mandatory
- HA panel lives in nested Shadow DOM → use the existing recursive panel finder
- pre-upgrade `hass` assignment must be bridged after custom-element definition
- Start enhancement must force an initial rerender → otherwise old Start appears until navigation
- Alpine atmosphere layers must stay above the host background; negative z-index previously hid images
- `.webp` filename alone is not enough; invalid binaries once looked like valid assets in the repo
- r7 asset test also checks RIFF-declared file length to detect truncated WebPs
- latest pre-r7 real screenshot showed a valid but much too dark/abstract scene; r7 specifically addresses this with photorealistic assets

**Next visual decision must be based on a fresh r7 OnePlus portrait screenshot.**

Approved design spec:

`docs/superpowers/specs/2026-10-01-startpage-alpine-interface-design.md`

## 6. Base Start / fallback lifecycle

`jamesui-panel.js` still contains the older base `_homePage()` / `_weatherBackground()` implementation, and `frontend/assets/weather/` contains its SVG assets.

This is intentional compatibility code, not dead code.

Only remove base Start + old weather SVGs together after:

1. Alpine Start is proven stable on OnePlus/Fully and normal browser use,
2. long-term loader/module architecture is settled,
3. a safe render path remains when the Start enhancement cannot load.

Do not delete only the fallback SVGs or only the base renderer.

## 7. Haus

**Status: ⚠️ functional, not final.**

Existing logic:

- HA Area / Device / Entity Registry loading
- lights, sockets, fans/ventilation and device-health classification
- house summary and availability/update/low-battery counts
- room/area grouping in category details
- light/switch/fan toggles

Next direction: room-first presentation while preserving existing discovery/control logic. Do not duplicate these helpers in a second implementation.

## 8. Klima

**Status: 🚧 demo only.**

Temporary code in `jamesui-panel.js` still contains hard-coded rooms/demo temperatures/disabled controls.

When implementing real climate support, replace/remove that demo code in the same change.

Target:

- real `climate.*` discovery
- actual / target temperature
- heating state
- optional humidity/outdoor temperature
- mapping only where KNX/HA entities require it

JamesUI is not the heating controller.

## 9. Medien

**Status: ⚠️ substantial implementation exists; practical end-to-end verification still needed.**

Existing paths include Home Assistant media players, Spotify, Music Assistant, Onkyo preparation, source/transport/volume/now-playing and playlist URI normalization.

Vendor-specific Onkyo helpers still exist. If generalized later, migrate the existing path into a generic abstraction; do not add a second receiver stack.

## 10. Tür / camera

**Status: 🚧 UI groundwork only; backend event/history path unresolved.**

Current placeholders/demo include camera placeholder, disabled open/light actions and doorbell demo overlay.

When reliable Siedle/camera entities exist, replace these inside the existing Tür flow rather than creating a second page.

## 11. Settings / configuration

Working central configuration now includes:

- Start weather source
- optional outdoor temperature source
- moon phase source
- optional illuminance source
- **Start background mode: Auto / Manual**
- **manual Alpine test scene**
- Media mappings

Still needed over time:

- room/device mapping where automatic discovery is insufficient
- climate mapping
- door/camera mapping
- optional feature controls

Normal operation should not require source-code edits or raw entity IDs.

## 12. Asset lifecycle

Before generating/adding/replacing visual assets:

1. inspect existing assets first,
2. verify actual binary/file validity, not only filename/extension,
3. reuse/replace assets at existing paths where appropriate,
4. do not create competing image families without a migration plan,
5. keep runtime assets local to JamesUI,
6. retire code references and files together,
7. keep format/integrity validation in CI for critical runtime assets.

For larger binary image sets, ZIP/manual GitHub upload is acceptable when the connector would risk truncating binary data. Afterwards, immediately verify the repository blobs and run CI.

## 13. Known cleanup backlog

Maintenance items only; not permission for opportunistic rewrites:

1. `jamesui-panel.js` still has an internal display `VERSION` constant; release/revision display can be centralized later.
2. `jamesui-panel.js` is large (~130 KB). Split only when a module is deliberately being reworked.
3. Base Start + Alpine Start coexist intentionally as fallback until practical stability is proven.
4. README/release tagging/HACS update strategy should stay aligned with actual releases.
5. Temporary development branches should be synchronized/retired after completed batches.
6. `README_UPLOAD.txt` / `SHA256.txt` from manual r7 asset upload are not runtime dependencies; remove later if they are no longer useful.

## 14. Validation / workflow

`.github/workflows/validate.yml` checks:

- Python syntax
- JSON parsing
- frontend JavaScript syntax
- classic/guarded panel entry
- frontend revision propagation
- Shadow-DOM-aware panel discovery
- pre-upgrade HA property bridge
- post-enhancement initial rerender
- Alpine RIFF/WEBP signatures
- Alpine RIFF declared-size integrity
- Start/home Node tests
- Start background Auto/Manual tests

Development workflow:

1. inspect existing code/assets before creating replacements,
2. make related work as one cohesive batch,
3. run focused checks first where possible,
4. keep intentionally failing TDD states off `main`,
5. prefer one meaningful `main` validation run per cohesive batch,
6. update this file afterwards without triggering unnecessary CI.

Platform review/safety checks cannot be bypassed. Reduce delays by avoiding unnecessary duplicate work, binary transfers and repeated validation cycles.

## 15. Current priorities

1. Reload/update JamesUI/Home Assistant so `jamesui-entry.js?v=0.5.1-r7` is served.
2. Capture a fresh OnePlus portrait screenshot in **Auto** mode.
3. Open Start settings, switch to **Manuell**, and visually test the 8 background scenes without waiting for real weather/time changes.
4. Tune crop/brightness/overlay only from the real r7 screenshots; do not regenerate the image family unless a specific scene is genuinely unsuitable.
5. Verify `… → Oberfläche neu laden` still returns directly to the enhanced Start page.
6. Resolve `Klima – Noch nicht verknüpft` using real entity mapping.
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
- direct repository edits when available, independent of whether user is on tablet or laptop
- one useful troubleshooting step at a time
- no unnecessary user copy/paste
- no intentionally red `main`
- no duplicate implementation beside temporary/legacy paths
- preserve working fallback until replacement is proven
- reuse/repair existing visuals/assets before creating parallel families
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
