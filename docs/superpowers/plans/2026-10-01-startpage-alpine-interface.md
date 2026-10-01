# JamesUI Start Page – Alpine Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current card-heavy JamesUI Start page with the approved bespoke Alpine Interface: weather-first, realistic but restrained outside atmosphere, integrated home status, and non-card navigation for Haus / Klima / Medien / Tür.

**Architecture:** Keep the guarded loader and stable `jamesui-panel.js` unchanged. Implement the redesign inside the existing `jamesui-home.js` enhancement path, backed by local atmosphere assets and pure helper functions that can be tested independently. Work on a feature branch so intentionally failing TDD steps never land on `main`; merge only after the complete validation suite is green.

**Tech Stack:** Vanilla JavaScript, Web Components/custom element monkey-patch used by JamesUI, CSS, Home Assistant state model, local WebP background assets, Node built-in test runner, Python unittest for loader regression.

**Spec:** `docs/superpowers/specs/2026-10-01-startpage-alpine-interface-design.md`

## Global Constraints

- Home Assistant remains source of truth.
- Keep existing JamesUI navigation and functional logic intact.
- Do not introduce hard-coded entity IDs for normal operation.
- Do not add unnecessary frontend frameworks or large dependencies.
- Keep the current guarded classic-script loader architecture intact.
- Implement the visual redesign in `jamesui-home.js`; do not modify `jamesui-panel.js` for this redesign unless a blocker is discovered and explicitly reviewed.
- Primary target is OnePlus Pad 2 landscape; laptop/browser must remain usable.
- The page must read as one composed surface, not a grid of rounded cards.
- Atmosphere/background should carry roughly 20–30% of the visual weight and remain subordinate to readability.
- `main` must not receive deliberately failing TDD commits; perform implementation on `feature/startpage-alpine-interface` and merge only when green.

## Review Focus

- Missing/unknown weather state must fall back to a readable neutral atmosphere instead of a broken image or blank page.
- Missing forecast, illuminance, moon or climate entities must render graceful `–`/quiet fallback states without layout collapse.
- Narrower laptop/tablet viewports must preserve the functional strip and weather hierarchy without reverting to tile/card stacking.
- Alert states (open door, offline device, low battery) must be visually distinct but not dominate the page or destroy contrast over the atmosphere.
- Background assets must never block panel loading; missing asset should degrade to dark gradient/solid background while navigation remains functional.

---

### Task 1: Testable atmosphere and home-navigation model

**Files:**
- Modify: `custom_components/jamesui/frontend/jamesui-home.js`
- Modify: `tests/jamesui-home.test.js`

**Interfaces:**
- Produces: `resolveHomeAtmosphere(condition, period) -> { key, asset, tone, weatherClass }`
- Produces: existing `summarizeHomeState(panel)` remains backwards compatible.
- Produces: `homeNavItems(status) -> Array<{ target, label, value, tone }>` for Haus/Klima/Medien/Tür.

- [ ] **Step 1: Write failing tests for atmosphere mapping**

Add tests asserting at minimum:
- `sunny + day` resolves to the clear-day atmosphere asset.
- `cloudy + night` resolves to cloudy-night.
- `rainy + day` resolves to rain-day.
- `snowy + night` resolves to snow-night.
- `fog + twilight` resolves to fog/dusk-compatible atmosphere.
- unknown condition resolves to a neutral cloudy/day-or-period fallback and never returns an empty asset.

- [ ] **Step 2: Write failing tests for functional navigation model**

Assert that `homeNavItems()` returns exactly four ordered entries with targets `house`, `climate`, `media`, `door`, carrying the values/tone from `summarizeHomeState()` rather than hard-coded UI copy.

- [ ] **Step 3: Run the focused test file and verify failure**

Run: `node --experimental-default-type=module --test tests/jamesui-home.test.js`

Expected: FAIL because the new exported helpers do not yet exist.

- [ ] **Step 4: Implement the helpers in `jamesui-home.js`**

Keep the mapping pure and dependency-free. Normalize Home Assistant conditions into a practical initial atmosphere subset while preserving a future-expandable key structure.

- [ ] **Step 5: Run the focused test file and verify pass**

Run: `node --experimental-default-type=module --test tests/jamesui-home.test.js`

Expected: all home tests PASS.

- [ ] **Step 6: Commit on feature branch**

Commit message: `test: model alpine home atmosphere`

---

### Task 2: Add restrained realistic alpine atmosphere assets

**Files:**
- Create: `custom_components/jamesui/frontend/assets/alpine/clear-day.webp`
- Create: `custom_components/jamesui/frontend/assets/alpine/cloudy-day.webp`
- Create: `custom_components/jamesui/frontend/assets/alpine/rain-day.webp`
- Create: `custom_components/jamesui/frontend/assets/alpine/snow-day.webp`
- Create: `custom_components/jamesui/frontend/assets/alpine/dusk.webp`
- Create: `custom_components/jamesui/frontend/assets/alpine/clear-night.webp`
- Create: `custom_components/jamesui/frontend/assets/alpine/cloudy-night.webp`
- Create: `custom_components/jamesui/frontend/assets/alpine/fog.webp`
- Modify: `custom_components/jamesui/frontend/jamesui-home.js`
- Modify: `tests/jamesui-home.test.js`

**Interfaces:**
- Consumes: `resolveHomeAtmosphere(condition, period)` from Task 1.
- Produces: local asset paths under `/jamesui_static/assets/alpine/` only; no cloud/runtime image dependency.

- [ ] **Step 1: Add a failing asset-contract test**

For every asset returned by the supported atmosphere mapping, assert that its path begins with `/jamesui_static/assets/alpine/` and corresponds to one of the approved local filenames.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --experimental-default-type=module --test tests/jamesui-home.test.js`

Expected: FAIL until the mapping is switched from legacy weather SVGs to Alpine assets.

- [ ] **Step 3: Create the eight local WebP atmosphere assets**

Visual requirements shared by all assets:
- realistic alpine sky/horizon/weather read at a glance
- no prominent fictional room, sofa or fireplace
- at most subtle terrace/roof/tree silhouettes
- no text, controls or UI baked into the image
- composition leaves dark/quiet zones suitable for foreground typography
- consistent camera/viewpoint family so weather changes feel like states of one environment, not unrelated wallpapers

- [ ] **Step 4: Point `resolveHomeAtmosphere()` at the new local assets**

Map rain/snow night conditions to the closest supported night atmosphere plus CSS weather treatment where a dedicated night asset is not yet part of the initial set. Unknown/missing inputs use `cloudy-day.webp` or the period-appropriate neutral fallback.

- [ ] **Step 5: Run home tests**

Run: `node --experimental-default-type=module --test tests/jamesui-home.test.js`

Expected: PASS.

- [ ] **Step 6: Commit on feature branch**

Commit message: `feat: add alpine weather atmospheres`

---

### Task 3: Recompose the Start page as one surface

**Files:**
- Modify: `custom_components/jamesui/frontend/jamesui-home.js`
- Modify: `tests/jamesui-home.test.js`

**Interfaces:**
- Consumes: `summarizeHomeState(panel)`, `homeNavItems(status)`, `resolveHomeAtmosphere(condition, period)`.
- Produces: replacement `Panel.prototype._homePage` markup and Alpine-specific CSS appended through the existing `_styles` enhancement.

- [ ] **Step 1: Write failing structure tests for the new composition**

Add string-level rendering tests/helper assertions that require:
- one main Alpine atmosphere surface
- free weather/time information hierarchy
- one compact home-status region
- one low-profile functional strip with four `data-nav` targets
- compact secondary moon information
- no `home-nav-card`, `home-nav-grid`, or repeated large direct-access tile markup in the redesigned Start page

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --experimental-default-type=module --test tests/jamesui-home.test.js`

Expected: FAIL against the current card-heavy layout.

- [ ] **Step 3: Replace the current Start-page markup in `jamesui-home.js`**

Implement these visual zones inside one composed surface:
- background atmosphere layer with readability masks
- primary time/date and weather block
- secondary weather facts using fine separators rather than cards
- compact `Zuhause` status with restrained alert treatment
- integrated functional strip for Haus / Klima / Medien / Tür using existing `data-nav`
- compact moon note, especially at night
- existing forecast trigger retained
- existing scene selection retained only if it can remain visually subordinate; otherwise omit it from the Start composition without deleting underlying scene behavior

- [ ] **Step 4: Replace card-heavy Start-page CSS with Alpine Interface CSS**

Use:
- near-black/smoked surfaces
- warm champagne/metal accent
- fine separators
- minimal rounded containers only where needed for contrast
- responsive typography sized for a fixed wall tablet
- gradient masks/controlled blur so the background never competes with content
- hover/touch affordance through underline/glow/contrast shifts instead of tile elevation

- [ ] **Step 5: Preserve graceful fallbacks**

Verify missing Home Assistant data renders readable placeholders and the interface still works if the atmosphere image fails to load.

- [ ] **Step 6: Run home tests**

Run: `node --experimental-default-type=module --test tests/jamesui-home.test.js`

Expected: PASS.

- [ ] **Step 7: Commit on feature branch**

Commit message: `feat: redesign JamesUI start as alpine interface`

---

### Task 4: Loader regression, full validation, status handoff, and merge readiness

**Files:**
- Do not modify: `custom_components/jamesui/const.py`, `custom_components/jamesui/frontend/jamesui-entry.js`, `custom_components/jamesui/frontend/jamesui-home-entry.js` unless a failing regression test proves it necessary.
- Modify: `PROJECT_STATUS.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a green feature branch ready for merge to `main` and a practical verification checklist for the real installation.

- [ ] **Step 1: Run JavaScript syntax validation**

Run: `for file in custom_components/jamesui/frontend/*.js; do node --check "$file"; done`

Expected: PASS for every frontend JavaScript file.

- [ ] **Step 2: Run loader regression test**

Run: `python -m unittest tests/test_frontend_entrypoint.py`

Expected: PASS; active entry remains the guarded classic loader.

- [ ] **Step 3: Run home model tests**

Run: `node --experimental-default-type=module --test tests/jamesui-home.test.js`

Expected: PASS.

- [ ] **Step 4: Run full repository validation equivalent to CI**

Run Python compileall, JSON validation, frontend syntax check, entrypoint unittest and home Node tests using the same commands as `.github/workflows/validate.yml`.

Expected: all checks PASS.

- [ ] **Step 5: Update `PROJECT_STATUS.md`**

Record:
- Alpine Interface design implemented on feature branch
- loader untouched and regression-safe
- local atmosphere assets and mapping added
- Start page no longer uses generic direct-access tile grid
- status is `⚠️ Test nötig` until laptop + OnePlus Pad 2/Fully practical verification
- next practical action: refresh/update JamesUI and provide screenshot or report visual issues

- [ ] **Step 6: Review branch diff against the approved spec**

Confirm no out-of-scope Haus/Klima/Media/Tür backend redesign slipped in and no fictional interior imagery dominates the Start page.

- [ ] **Step 7: Merge only the green reviewed branch to `main`**

Do not merge if any validation is red. This prevents the failure-notification pattern previously seen from intentionally red intermediate commits on `main`.
