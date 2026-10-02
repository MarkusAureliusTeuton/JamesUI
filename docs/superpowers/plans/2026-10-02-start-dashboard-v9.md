# JamesUI Start Dashboard V9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the JamesUI Start page into the approved Alpine weather hero plus real calendar and house-status sections, with four configurable favorite scenes and a single clean Start chrome.

**Architecture:** Keep the existing Alpine Start renderer and background module as the visual base, but split Start-only live data into a focused `jamesui-home-data.js` module. Weather/moon/forecast continue to use existing panel helpers; calendar events and scene behavior are added without duplicating the `Haus` page or the base fallback Start implementation.

**Tech Stack:** Home Assistant custom integration, Home Assistant WebSocket API, vanilla JavaScript/Web Components, CSS, Python/Voluptuous config API, Node built-in test runner, Python unittest/CI.

**Spec:** `docs/superpowers/specs/2026-10-02-start-dashboard-v9-design.md`

## Global Constraints

- Primary target: **OnePlus Pad 2 wall tablet in portrait**; browser/landscape is secondary responsive behavior.
- Active primary navigation remains exactly `Start | Haus | Klima | Medien | Tür`.
- Bottom navigation is the only primary navigation; Start must not duplicate it.
- Keep local photorealistic Alpine assets and existing Auto/Manual background selection.
- No glowing card borders and no generic Lovelace/card-grid appearance.
- Home Assistant remains source of truth; do not add external calendar or scene cloud APIs.
- Do not hard-code normal entity IDs; discover entities and use configuration only where required.
- Do not introduce demo calendar events or fake persistent scene state.
- Preserve the current classic-loader / module-bridge / Shadow-DOM compatibility chain.
- Preserve the base Start fallback until the existing fallback-removal conditions in `PROJECT_STATUS.md` are met.

## Review Focus

- Calendar entity disappears/reloads while subscribed: Start must remain usable, unsubscribe safely, and show a calm empty state.
- Duplicate events from multiple calendars: merge conservatively without hiding distinct appointments that happen to share a title.
- Forecast lacks hourly/twice-daily granularity: show rain probability/tendency but never invent a rain time.
- Configured scene IDs become invalid/unavailable: ignore them safely and fill remaining favorite slots from valid discovered scenes.
- Start module fails to load or receives HA properties before upgrade: existing fallback/loader behavior must remain intact.

---

### Task 1: Start live-data module for calendar and scenes

**Files:**
- Create: `custom_components/jamesui/frontend/jamesui-home-data.js`
- Create: `tests/jamesui-home-data.test.js`
- Modify: `custom_components/jamesui/frontend/jamesui-home-entry.js`
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Consumes: `panel._hass`, `panel._config`, `panel.render()`, current `scene.*` states, Home Assistant calendar WebSocket connection.
- Produces:
  - `normalizeCalendarEvents(eventsByEntity, now) -> Array<CalendarEvent>`
  - `resolveFavoriteScenes(states, configuredIds) -> Array<SceneModel>` with maximum 4 items
  - `activateScene(panel, entityId) -> Promise<boolean>`
  - `installHomeDataExperience() -> boolean`, which owns subscription lifecycle and exposes `panel._jamesHomeCalendarEvents`, `panel._jamesHomeScenes`, `panel._activateHomeScene(entityId)`.

- [ ] **Step 1: Write failing unit tests for calendar normalization**

Add tests proving chronological ordering, all-day handling, seven-day filtering, duplicate suppression only for same calendar/entity + same start/end/title, and empty input returning `[]`.

- [ ] **Step 2: Run the focused calendar tests and verify RED**

Run: `node --test tests/jamesui-home-data.test.js`

Expected: FAIL because `jamesui-home-data.js` does not exist yet.

- [ ] **Step 3: Implement `normalizeCalendarEvents()`**

Normalize HA event fields into `{ id, calendarEntityId, title, start, end, allDay, location }`; sort by start, keep only the current local day through +7 days, and deduplicate conservatively using calendar entity + title + normalized start/end.

- [ ] **Step 4: Add failing tests for favorite-scene resolution and activation**

Assertions:
- configured order wins,
- invalid/missing IDs are ignored,
- unfilled slots fall back alphabetically from remaining discovered `scene.*` entities,
- output length is at most 4,
- `activateScene()` calls `hass.callService("scene", "turn_on", { entity_id })`,
- service failure resolves `false` instead of crashing Start.

- [ ] **Step 5: Implement scene helpers**

Implement `resolveFavoriteScenes(states, configuredIds)` and `activateScene(panel, entityId)` with the exact behavior above.

- [ ] **Step 6: Add failing lifecycle/source tests for `installHomeDataExperience()`**

Source-level/lifecycle tests must pin:
- discovery of all `calendar.*` entities,
- subscription window from local today 00:00 through +7 days,
- per-calendar storage,
- unsubscribe on disconnect/reinstall,
- rerender after calendar updates,
- no exception when no calendars exist.

- [ ] **Step 7: Implement `installHomeDataExperience()`**

Patch only the JamesUI panel lifecycle needed for Start data. Use the supported HA calendar subscription API available through `panel._hass.connection`; store unsubscribers and clean them up on disconnect. Recompute scene models from the HA state map when rendering rather than creating a second scene registry.

- [ ] **Step 8: Wire the module into `jamesui-home-entry.js`**

Load `jamesui-home-data.js` with the same revision token as the existing Start modules. Installation order: home renderer → home data → background/settings, then force the existing Shadow-DOM-aware rerender.

- [ ] **Step 9: Add the new Node test to CI and run focused validation**

Run:
- `node --test tests/jamesui-home-data.test.js`
- `node --check custom_components/jamesui/frontend/jamesui-home-data.js`
- `node --check custom_components/jamesui/frontend/jamesui-home-entry.js`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add custom_components/jamesui/frontend/jamesui-home-data.js custom_components/jamesui/frontend/jamesui-home-entry.js tests/jamesui-home-data.test.js .github/workflows/validate.yml
git commit -m "feat: add Start calendar and scene data"
```

### Task 2: Persist four favorite scenes in JamesUI settings

**Files:**
- Modify: `custom_components/jamesui/api.py`
- Modify: `custom_components/jamesui/frontend/jamesui-home-background.js`
- Modify: `tests/jamesui-background.test.js`

**Interfaces:**
- Consumes: existing `jamesui/config` and `jamesui/config/update` API, `scene.*` state map.
- Produces: config key `home_scene_entities` as an ordered list of zero to four valid `scene.*` entity IDs.

- [ ] **Step 1: Write failing API/config tests**

Pin that `home_scene_entities` accepts a list with maximum length 4, rejects non-list/overlength values, ignores empty entries, and verifies each non-empty ID exists and is a `scene.*` entity.

- [ ] **Step 2: Run focused tests and verify RED**

Run the existing Python/API validation plus `node --test tests/jamesui-background.test.js`.

Expected: FAIL because the new config key/settings controls are not implemented.

- [ ] **Step 3: Extend `api.py`**

Add `home_scene_entities` to the update schema as an optional list of up to four strings. Validate entity existence and `scene.` domain before writing the ordered list to config entry options; remove the option when empty.

- [ ] **Step 4: Add four scene selectors to existing Start settings**

Extend the current Start settings module instead of creating a new settings page. Render four optional selectors populated from discovered `scene.*` entities, preserving configured order. Label them `Szene 1` through `Szene 4`.

- [ ] **Step 5: Extend the existing independent Start-settings save path**

Send `home_scene_entities` together with the Start background/settings update. Keep the dedicated Start save action and current live background preview behavior.

- [ ] **Step 6: Run focused config/settings tests**

Run:
- Python syntax/config tests used by CI
- `node --test tests/jamesui-background.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add custom_components/jamesui/api.py custom_components/jamesui/frontend/jamesui-home-background.js tests/jamesui-background.test.js
git commit -m "feat: configure Start favorite scenes"
```

### Task 3: Replace the Start renderer with the approved V9 composition

**Files:**
- Modify: `custom_components/jamesui/frontend/jamesui-home.js`
- Modify: `tests/jamesui-home.test.js`

**Interfaces:**
- Consumes:
  - existing weather helpers (`_weatherEntityId`, `_normalizedDailyForecast`, `_moonInfo`, `_moonDetails`, `_formatSunEvent`),
  - `panel._jamesHomeCalendarEvents`,
  - `panel._jamesHomeScenes`,
  - `panel._activateHomeScene(entityId)`,
  - existing house summary/discovery helpers.
- Produces:
  - `weatherTrendSummary(forecast) -> { label, direction, rainExpected }`
  - `firstExpectedRainTime(panel) -> string | null`
  - expanded `summarizeHomeState(panel)` including windows/doors/ventilation/climate/media,
  - V9 Start markup with classes `.start-v9-hero`, `.start-v9-calendar`, `.start-v9-house`, `.start-v9-scenes`.

- [ ] **Step 1: Write failing weather-summary tests**

Pin:
- rising/falling/stable 3-day temperature tendency from daily highs,
- rain expected when any of the next 3 days crosses the existing forecast precipitation probability threshold used by the implementation (define threshold as `>= 40%`),
- no invented rain time when forecast granularity cannot supply one,
- exact first rain time when hourly/twice-daily entries expose it.

- [ ] **Step 2: Run the weather tests and verify RED**

Run: `node --test tests/jamesui-home.test.js`

Expected: FAIL on the new helpers/markup.

- [ ] **Step 3: Implement weather trend/rain helpers**

Keep these pure where possible. Use only current forecast data; return `null` for unavailable timing.

- [ ] **Step 4: Write failing markup tests for the V9 hero**

Assertions:
- moon label/illumination occur inside the daily weather facts row,
- no `.alpine-moon-note` block remains,
- current temperature, condition, high, low, precipitation, wind, sunrise, sunset and moon are present,
- `3-Tage-Prognose` action includes the dynamic tendency/rain summary and keeps `data-open-forecast`,
- no duplicate `Haus | Klima | Medien | Tür` markup is rendered inside Start.

- [ ] **Step 5: Replace the hero markup and CSS in `jamesui-home.js`**

Evolve the existing Alpine renderer in place. Keep the Alpine background resolver and local assets; remove V8-only unreachable status/moon markup and associated CSS in the same change.

- [ ] **Step 6: Write failing calendar-section tests**

Pin:
- today's real events render first,
- timed events show local time,
- all-day events show `Ganztägig`,
- following-day events can appear as compact continuation when today has fewer than the display limit,
- empty state is `Keine Kalenderdaten`,
- `Weitere Termine` action is rendered but must not show fake data.

- [ ] **Step 7: Implement the Calendar section**

Render a restrained timeline/list on the dark lower surface. Use at most four visible entries on Start; prefer today, then nearest following events.

- [ ] **Step 8: Write failing house-status and scene tests**

Pin status output for lights, sockets, windows, doors/gates, ventilation, climate and media. Pin exactly four favorite scene controls maximum plus a `Weitere` action. Do not assert persistent active scene state.

- [ ] **Step 9: Implement House status + favorite scenes**

Use current HA state summaries; scene buttons carry `data-home-scene="<entity_id>"`. `Weitere` carries a dedicated action hook to open the all-scenes overlay/list; the richer house action navigates to the existing `Haus` page rather than duplicating controls.

- [ ] **Step 10: Replace lower-layout CSS with V9 grid**

Portrait: hero full width, calendar full width, house full width. Landscape/browser: hero full width and lower two-column calendar/house grid when space permits. Use spacing/tonal surfaces/fine separators; no glowing borders.

- [ ] **Step 11: Run the focused Start tests**

Run:
- `node --test tests/jamesui-home.test.js`
- `node --test tests/jamesui-home-data.test.js`
- `node --check custom_components/jamesui/frontend/jamesui-home.js`

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add custom_components/jamesui/frontend/jamesui-home.js tests/jamesui-home.test.js
git commit -m "feat: rebuild Start dashboard V9"
```

### Task 4: Start chrome, ellipsis menu, scene overlay and navigation polish

**Files:**
- Modify: `custom_components/jamesui/frontend/jamesui-panel.js`
- Modify: `custom_components/jamesui/frontend/jamesui-home-data.js`
- Modify: `tests/jamesui-home.test.js`
- Modify: `tests/test_frontend_entrypoint.py` only if loader assertions need the new module URL

**Interfaces:**
- Consumes: existing panel `_page`, `_settings`, `_appMenu`, render/event-binding flow, fixed bottom navigation.
- Produces:
  - Start-only hidden shell header,
  - one hero `…` action that opens the existing app/menu surface containing settings + reload actions,
  - scene `Weitere` overlay using all discovered scenes,
  - polished bottom nav classes without changing destination IDs.

- [ ] **Step 1: Write failing structural tests**

Pin that Start has a single `…` control, no large shell header, and other pages retain their header. Pin bottom nav destinations remain exactly `home, house, climate, media, door`.

- [ ] **Step 2: Run focused tests and verify RED**

Run the Start tests plus frontend entrypoint tests.

Expected: FAIL on Start-only chrome behavior.

- [ ] **Step 3: Implement Start-only shell-header suppression**

Use `_page === "home"` to apply a class/conditional render path; do not remove the shared header from other pages.

- [ ] **Step 4: Bind the hero `…` button to existing app-menu behavior**

Reuse existing settings/reload actions. Do not create a second settings menu implementation.

- [ ] **Step 5: Implement all-scenes overlay/list**

Render all valid discovered `scene.*` models from `jamesui-home-data.js`; activation calls the same `_activateHomeScene()` helper used by favorites. Close overlay after a successful activation or explicit close.

- [ ] **Step 6: Polish the existing bottom navigation**

Keep the same nav IDs/actions. Refine spacing, icon hierarchy, active marker and warm accent; no glow frames.

- [ ] **Step 7: Verify event bindings**

Add/adjust tests/source assertions that `data-home-scene`, scene `Weitere`, forecast, app-menu and nav actions all bind through the existing render/event lifecycle without duplicate listeners.

- [ ] **Step 8: Run focused tests**

Run:
- `node --test tests/jamesui-home.test.js tests/jamesui-home-data.test.js tests/jamesui-background.test.js`
- `python -m unittest tests/test_frontend_entrypoint.py`
- JavaScript syntax checks for all modified frontend files

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add custom_components/jamesui/frontend/jamesui-panel.js custom_components/jamesui/frontend/jamesui-home-data.js tests/jamesui-home.test.js tests/test_frontend_entrypoint.py
git commit -m "feat: refine Start chrome and scene controls"
```

### Task 5: Revision, full validation, status handover and merge

**Files:**
- Modify: `custom_components/jamesui/const.py`
- Modify: `PROJECT_STATUS.md`
- Modify: tests only if revision assertions require the exact new token

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: `FRONTEND_REVISION = "0.5.1-r9"`, updated persistent project handover, green full CI, mergeable implementation branch.

- [ ] **Step 1: Write/update the revision assertion before changing the constant**

Pin that all frontend module URLs inherit the shared revision and no hard-coded stale r8 module token remains.

- [ ] **Step 2: Run revision/entrypoint test and verify RED**

Run: `python -m unittest tests/test_frontend_entrypoint.py`

Expected: FAIL on the expected r9 revision assertion.

- [ ] **Step 3: Bump frontend revision to `0.5.1-r9`**

Change only `FRONTEND_REVISION`; integration manifest version remains `0.5.1` unless an unrelated release decision is made.

- [ ] **Step 4: Run the complete local test set available in CI**

Run all Python syntax/tests, JSON validation, JS syntax checks, Alpine asset validation and Node Start/background/data tests exactly as defined by `.github/workflows/validate.yml`.

Expected: zero failures.

- [ ] **Step 5: Update `PROJECT_STATUS.md`**

Record:
- V9 architecture/ownership,
- real calendar source and seven-day subscription,
- favorite-scene config key and behavior,
- Start-only chrome behavior,
- moon-in-weather-row decision,
- forecast tendency/rain behavior,
- practical OnePlus portrait verification as `⚠️ Test nötig`,
- explicit remaining limitation: fuller Calendar subpage is future work; Start action may remain a placeholder/navigation hook until that page is implemented.

- [ ] **Step 6: Commit documentation/revision**

```bash
git add custom_components/jamesui/const.py PROJECT_STATUS.md tests/test_frontend_entrypoint.py
git commit -m "chore: release Start dashboard r9"
```

- [ ] **Step 7: Create/update PR and run full CI once**

Expected: `Validate JamesUI` completes successfully on the exact branch head.

- [ ] **Step 8: Review the full diff against the V9 spec**

Check each acceptance criterion, especially no duplicate Start navigation, no demo data, no dead V8 visual fragments, no new external dependencies, and preserved fallback/loader paths.

- [ ] **Step 9: Merge only after green CI and review**

After merge, verify the `main` workflow on the merge commit is green before reporting repository completion.

- [ ] **Step 10: Practical user verification**

Ask for one fresh Start screenshot after Home Assistant/JamesUI reload, then verify calendar data, scene activation, Auto/Manual background, forecast overlay, `…` menu and portrait visual balance one issue at a time.
