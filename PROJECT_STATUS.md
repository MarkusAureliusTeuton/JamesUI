# JamesUI – Project Status / Chat Handover

_Last updated: 2026-10-01_

This file is the persistent **single source of truth for project intent, architecture, active implementation, temporary compatibility code, cleanup rules and next work**. In every new JamesUI chat: read this file first, then inspect only the repository files relevant to the requested work. After every substantive design, implementation, removal or architecture decision, update this file in the same work batch.

## 1. Product goal

JamesUI is a tablet-first Home Assistant interface for the user's KNX/Home Assistant home. It should feel like a calm, premium, bespoke architectural control surface rather than a Lovelace/card dashboard.

Core rules:

- Home Assistant is backend/source of truth.
- KNX remains the primary building-automation layer.
- JamesUI owns presentation, navigation and interaction.
- Local operation is preferred; avoid unnecessary cloud dependencies.
- Automatic entity/device/area discovery first; manual mapping only where required.
- Do not hard-code entity IDs for normal use.
- Do not add dependencies or abstractions without a concrete need.
- Primary target: **OnePlus Pad 2 landscape**. Fully Kiosk may be the kiosk shell, but JamesUI must not depend on Fully.

## 2. Current release / repository state

Repository: `MarkusAureliusTeuton/JamesUI`

Default branch: `main`

Integration / manifest version: **0.5.0**

Active primary navigation:

`Start | Haus | Klima | Medien | Tür`

Current Start-page direction: **Alpine Interface**.

The Alpine Start implementation and eight local WebP atmosphere assets are merged into `main`. GitHub Actions validation passed after the merge and after the subsequent status update. Practical visual acceptance on laptop and OnePlus Pad 2/Fully is still required.

A merged development branch `feature/startpage-alpine-interface` may still exist remotely. `main` is ahead of it; it is not an alternate source of truth and must not be used as the basis for new work.

## 3. Active runtime chain – do not casually change

Home Assistant loads JamesUI through this chain:

1. `custom_components/jamesui/__init__.py` registers `/jamesui_static` and the custom panel.
2. `custom_components/jamesui/const.py` sets `FRONTEND_FILE = "jamesui-entry.js"`.
3. `frontend/jamesui-entry.js` is a **classic script**. It loads `jamesui-panel.js` first.
4. After the stable panel loads, `jamesui-entry.js` injects `jamesui-home-entry.js` as `type="module"`.
5. `jamesui-home-entry.js` imports `jamesui-home.js`, waits for `jamesui-panel`, installs the Start enhancement and rerenders the panel.
6. `jamesui-home.js` overrides only the Start-page rendering/styles; the remaining modules stay in `jamesui-panel.js`.

Reason for this structure: a previous direct ES-module panel entry caused a blank/black JamesUI screen. `tests/test_frontend_entrypoint.py` protects the working loader structure.

**Removal rule:** never delete or bypass `jamesui-entry.js` / `jamesui-home-entry.js` independently. If the loader is redesigned, change the whole chain together and keep the regression test green.

## 4. Repository map / ownership

| Path | Responsibility | Status / rule |
| --- | --- | --- |
| `custom_components/jamesui/__init__.py` | HA integration setup, static frontend path, custom panel registration | Stable infrastructure |
| `custom_components/jamesui/const.py` | domain, panel constants, frontend entry, integration version | Stable; version is duplicated elsewhere, see cleanup backlog |
| `custom_components/jamesui/api.py` | WebSocket config read/update for Start + Media mappings | Active |
| `custom_components/jamesui/config_flow.py` | single-instance integration setup | Active |
| `custom_components/jamesui/manifest.json` | HA integration metadata/version | Active |
| `frontend/jamesui-entry.js` | guarded classic entry loader | Active critical infrastructure |
| `frontend/jamesui-home-entry.js` | ES-module bridge for Start enhancement | Active critical infrastructure |
| `frontend/jamesui-panel.js` | stable application shell plus Haus, Klima, Medien, Tür, settings, overlays, base/fallback Start implementation and shared CSS | Active, but too large; refactor only module-by-module when justified |
| `frontend/jamesui-home.js` | current Alpine Start page, home-status summary, atmosphere mapping and Alpine Start CSS | Active Start implementation |
| `frontend/assets/alpine/` | current realistic Alpine atmosphere WebP assets | Active Start assets |
| `frontend/assets/weather/` | older 28 SVG weather backgrounds | **Intentional fallback**, not dead code yet |
| `tests/jamesui-home.test.js` | Start status, atmosphere, navigation, structure and fallback tests | Active |
| `tests/test_frontend_entrypoint.py` | loader regression protection | Active critical test |
| `.github/workflows/validate.yml` | syntax + JSON + loader + Start tests | Active; Markdown-only changes are intentionally ignored |
| `PROJECT_STATUS.md` | project handover / architecture / cleanup map | Must be maintained continuously |
| `docs/superpowers/specs/...startpage...md` | approved Alpine Start design record | Historical design authority for this feature |
| `docs/superpowers/plans/...startpage...md` | implementation plan for Alpine Start | Completed plan; retain as development record |

## 5. Start page – Alpine Interface

**Status: ⚠️ implemented and CI-verified; practical visual test still required.**

Implemented in `jamesui-home.js`:

- one composed Start surface instead of a card/tile grid
- time/date and weather as primary hierarchy
- current temperature, condition, high/low, precipitation, humidity, wind, illuminance, sunrise/sunset
- compact `Zuhause` status using live HA state summaries
- low-profile live functional strip for `Haus`, `Klima`, `Medien`, `Tür`
- compact secondary moon information
- atmosphere mapping from HA weather condition + sun period
- graceful missing-data fallback
- no runtime cloud-image dependency

Current local Alpine assets:

- `clear-day.webp`
- `cloudy-day.webp`
- `rain-day.webp`
- `snow-day.webp`
- `dusk.webp`
- `clear-night.webp`
- `cloudy-night.webp`
- `fog.webp`

Design target:

- 70–80% visual weight on function/information, 20–30% atmosphere
- realistic sky/horizon/mountains/trees/subtle terrace cues
- no dominant fictional living room
- dark/near-black, smoked glass/anthracite, restrained champagne/warm-metal accents
- fine separators and typography hierarchy instead of generic rounded-card grids

Approved design spec: `docs/superpowers/specs/2026-10-01-startpage-alpine-interface-design.md`

## 6. Why the old Start implementation/assets still exist

`jamesui-panel.js` still contains the older base `_homePage()` and `_weatherBackground()` logic, and `assets/weather/` still contains 28 SVG states.

These are **not currently considered dead code**. They provide a stable fallback if the Start enhancement/module fails to load. Deleting only the SVGs or only the base `_homePage()` would make that fallback incomplete.

**Future removal rule:** only remove the old base Start markup, `_weatherBackground()` dependency and `assets/weather/` together after:

1. the Alpine Start has been practically proven stable on laptop + OnePlus Pad 2/Fully,
2. the desired long-term loader/module architecture is decided,
3. a test proves JamesUI still has a safe render path when the enhancement cannot load.

Until then, retain the fallback intentionally and label it as compatibility code rather than repeatedly rediscovering it as a possible “old corpse.”

## 7. Haus module

**Status: ⚠️ functional, not final.**

Implemented in `jamesui-panel.js`:

- HA Area / Device / Entity Registry loading
- lights, sockets, fans/ventilation and device-health classification
- house summary and availability/update/low-battery counts
- room/area grouping in category detail views
- light/switch/fan toggles

Next intended change: presentation should become more room-oriented and less raw-entity/category-oriented while preserving working toggles and automatic HA area assignment.

Do not duplicate these discovery helpers in a new module unless that module becomes the deliberate owner and callers are migrated together.

## 8. Klima module – temporary implementation map

**Status: 🚧 not functionally implemented.**

Current temporary/demo code is in `jamesui-panel.js`:

- `_climatePage()`
- `_climateRoom()`
- hard-coded room list: Wohnzimmer, Küche, Schlafzimmer, Kinderzimmer, Bad, Flur
- demo temperatures and disabled setpoint controls

**Removal/replacement rule:** when real climate integration is implemented, replace `_climatePage()` / `_climateRoom()` and their demo data in the same change. Do not leave a second parallel climate renderer behind.

Target data:

- `climate.*` discovery
- actual / target temperature
- heating state
- optional humidity/outside temperature
- room mapping for KNX entities where HA climate entities alone are insufficient
- programs/modes/helpers only where there is a real backend entity/helper to control

JamesUI is not the heating controller.

## 9. Medien module

**Status: ⚠️ substantial implementation exists; practical end-to-end verification still needed.**

Current implementation is in `jamesui-panel.js` plus media config keys in `api.py`.

Existing paths:

- Home Assistant media players
- Spotify
- Music Assistant
- receiver preparation
- transport / volume / source / now-playing
- playlist URI normalization

Current vendor-specific implementation that must be generalized if receiver support expands:

- `_onkyoEntityId()`
- `_onkyoNetworkSource()`
- `_prepareOnkyo()`
- `media_onkyo_entity`
- `media_onkyo_source`

**Removal/replacement rule:** do not simply add a second generic receiver path beside these. Introduce the generic abstraction, migrate the existing Onkyo path to it, update config compatibility, then remove/alias the old names deliberately.

## 10. Tür / camera – temporary implementation map

**Status: 🚧 UI groundwork only; backend trigger/history unresolved.**

Current placeholder/demo code is in `jamesui-panel.js`:

- `_doorPage()`
- camera placeholder
- disabled open/light actions
- `data-demo-doorbell` / `_doorbellDemo` test path and overlay

The real Siedle SG150 event path remains a Home Assistant/backend issue.

**Removal/replacement rule:** when reliable camera/doorbell entities exist, replace the placeholders and demo action in the existing Tür flow. Do not create a second door page alongside `_doorPage()`.

## 11. Scenes / house mode

`_scene` and `_setScene()` currently represent UI selection only; the Start redesign does not bind them to a Home Assistant scene/helper. If house modes are implemented later, bind this existing concept to a persistent HA/KNX source or remove it if no longer exposed. Do not treat UI-only scene state as automation truth.

## 12. Settings / configuration

Working central configuration exists for Start data sources and Media via `api.py` and the HA config entry.

Still needed over time:

- room/device mapping UX where automatic discovery is insufficient
- climate mapping
- door/camera mapping
- optional-feature controls

Normal operation should not require source-code edits or raw entity IDs.

## 13. Assets and lifecycle

### Active

`frontend/assets/alpine/` – 8 WebP atmosphere files used by `jamesui-home.js`.

### Compatibility / fallback

`frontend/assets/weather/` – 28 SVG weather states used by the base Start implementation in `jamesui-panel.js`.

### Rule for future visual work

Before generating or adding new images:

1. inspect existing assets first,
2. reuse/adjust existing assets when they already cover the state,
3. do not create a second competing asset family without a migration plan,
4. keep runtime assets local to JamesUI,
5. when an asset family is retired, remove its code references and files together.

## 14. Known architecture cleanup backlog

These are known maintenance items, **not permission to refactor them opportunistically**:

1. Version/cache-busting `0.5.0` is duplicated in `const.py`, `manifest.json`, `jamesui-panel.js`, `jamesui-entry.js` and `jamesui-home-entry.js`.
2. `jamesui-entry.js` computes/stores a `homeModuleUrl` data attribute, while `jamesui-home-entry.js` currently imports its own hard-coded versioned URL. This should be simplified when version handling is cleaned up.
3. `jamesui-panel.js` is large (~130 KB) and contains multiple modules. Split only when a module is actively being reworked; avoid a large rewrite just for file size.
4. Base Start + enhanced Start currently coexist intentionally for fallback. Consolidate only after practical Alpine stability is proven.
5. README/release tagging and HACS release/update strategy need to stay aligned with the actual version.

## 15. Validation and GitHub workflow

`.github/workflows/validate.yml` validates functional changes on `main` and pull requests:

- Python syntax
- JSON parsing
- frontend JavaScript syntax
- guarded panel entrypoint test
- Start/home Node tests

**Noise-reduction rule:** Markdown-only changes are ignored by the workflow. This allows `PROJECT_STATUS.md`, README and design documentation to be maintained without running the whole software validation every time.

Development workflow:

1. inspect existing implementation/assets before creating anything new,
2. make related changes as one cohesive batch,
3. run focused/local checks first where possible,
4. keep intentionally failing TDD states off `main`,
5. do not open a PR merely to trigger checks if direct feature-branch development is sufficient,
6. merge/push a complete green state to `main`, producing one meaningful CI run,
7. update this status file in the same batch or directly afterwards if it is documentation-only.

The platform's own safety/review systems cannot be bypassed. To reduce long waits, avoid unnecessary image-generation/repeated binary operations and reuse existing generated/repository assets whenever possible.

## 16. Current priorities

1. Practical visual verification of Alpine Start on laptop and Fully/OnePlus Pad 2.
2. Tune Start spacing, contrast, atmosphere intensity and typography from a real screenshot.
3. Improve Haus toward room-first presentation without duplicating discovery/control logic.
4. Replace Klima demo with real entity-driven implementation and remove demo code in the same change.
5. Complete practical Media verification, then generalize receiver naming only if needed.
6. Replace Tür placeholders when Siedle/camera backend data is reliable.
7. Simplify Settings/mapping UX.
8. Clean version/cache-busting duplication and settle HACS release workflow.
9. Only after Alpine Start is proven: decide whether to retire base Start + `assets/weather/` fallback together.

## 17. Working style

JamesUI replies should start with:

- `✅ Fertig:` fully implemented / verified
- `⚠️ Test nötig:` implementation exists but needs practical verification
- `🚧 Nicht fertig:` more work required

Other working rules:

- fewer confirmation questions when intent/scope is already clear; make progress
- direct repository edits when available
- one useful troubleshooting step at a time
- no unnecessary user copy/paste
- no intentionally red `main`
- no duplicate implementation alongside a temporary/legacy path: migrate and remove deliberately
- preserve working fallback code until its replacement is proven

## 18. Next-chat instruction

When continuing in a new chat:

1. Read `PROJECT_STATUS.md` first.
2. Treat repository code on `main` as implementation truth and this file as architecture/progress/removal context.
3. Check the relevant existing files/assets before designing replacements.
4. Continue directly; do not ask the user to repeat already documented decisions.
5. When adding, replacing or removing a feature, update the corresponding ownership/removal notes in this file.
6. After substantive work, update status, current priority and practical-test state here.
