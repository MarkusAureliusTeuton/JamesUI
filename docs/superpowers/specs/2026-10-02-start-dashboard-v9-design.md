# JamesUI Start Dashboard V9 – Design

Date: 2026-10-02
Status: Design approved in chat; implementation pending final spec review

## 1. Goal

Rebuild the JamesUI Start page into a calm, premium wall-tablet dashboard that keeps the Alpine-Chic character but removes the generic card-dashboard feel.

The Start page must feel like one composed interface with three functional zones:

1. a large weather hero using the existing photorealistic Alpine backgrounds,
2. a calendar area below,
3. a house-status area below with four configurable favorite scenes and a `Weitere` action.

The fixed bottom navigation remains the only primary navigation.

## 2. Visual direction

- Primary target: OnePlus Pad 2 in portrait.
- Landscape/browser remains responsive, but must not drive the layout.
- Base background below the hero: near-black / dark anthracite.
- No glowing card borders.
- No generic Lovelace/card-grid look.
- Use spacing, tonal surfaces, fine separators, restrained blur and warm champagne accents instead of visible box borders.
- Keep the existing Alpine image family and Auto/Manual background selector.
- Top image must remain clearly visible and recognizable as weather/daylight information, not merely decoration.
- Typography remains large, calm and architectural.

## 3. Start page composition

### 3.1 Weather hero

The upper part of Start is one wide hero surface with the live Alpine background.

Content:

- date,
- large clock,
- location label when available,
- current weather icon, temperature and condition,
- one horizontal daily-information row containing:
  - maximum temperature,
  - minimum temperature,
  - precipitation probability,
  - expected rain timing when hourly/twice-daily forecast data can determine it,
  - wind,
  - sunrise,
  - sunset,
  - moon phase + illumination.

Moon information is no longer rendered as a separate block. It visually joins the weather facts row.

A compact `3-Tage-Prognose` action remains part of the hero. It shows a short dynamic summary, for example temperature tendency and whether rain is expected during the next days. Activating it opens the existing forecast detail/subview rather than expanding another large block on Start.

### 3.2 Calendar area

The lower content area contains a dedicated Calendar section.

Start-page calendar behavior:

- show today's appointments first,
- show a compact indication of following appointments/days,
- sort chronologically,
- support timed and all-day events,
- show time, title and optional location/calendar context when available,
- show a `Weitere Termine` action for a fuller calendar view later.

Data source:

- auto-discover Home Assistant `calendar.*` entities,
- subscribe to the next 7 days using Home Assistant's `calendar/event/subscribe` WebSocket API,
- merge events from all discovered calendars,
- deduplicate identical events conservatively,
- update automatically when Home Assistant pushes calendar changes.

No calendar account credentials or external cloud API are added to JamesUI. Home Assistant remains the source of truth.

If no calendar entities exist or event loading fails, the section shows a calm empty state instead of demo data.

### 3.3 House status area

The House section summarizes real Home Assistant state without duplicating the full `Haus` page.

Status groups:

- lights,
- sockets,
- windows,
- doors / gates,
- ventilation,
- climate,
- media.

The summary should prefer useful states such as counts and deviations rather than raw entity names.

Examples:

- `Licht – 2 an`
- `Steckdosen – 1 an`
- `Fenster – Alle zu`
- `Türen – Alle zu`
- `Lüftung – Aus` or active count
- `Klima – 21,3 °C`
- `Medien – Aus` or active playback count

A `Weitere` action opens the existing `Haus` page or the appropriate richer house view; Start does not create a second full house-control implementation.

### 3.4 Favorite scenes

House status includes exactly four favorite Home Assistant scenes plus a `Weitere` action.

Behavior:

- scene entities come from existing `scene.*` entities,
- the four Start favorites are configurable,
- pressing a favorite calls `scene.turn_on`,
- active feedback is momentary only; JamesUI must not pretend a Home Assistant scene has a persistent `on` state,
- `Weitere` opens an overlay/list containing all discovered scenes and can activate them from there.

Configuration:

- add `home_scene_entities` as an ordered list of up to four entity IDs in JamesUI config,
- settings expose four scene selectors,
- if no favorites are configured, JamesUI falls back to the first four discovered scene entities in deterministic alphabetical order,
- invalid/missing scene IDs are ignored safely.

## 4. Responsive layout

### Portrait (design authority)

- Weather hero: full width at top.
- Calendar: full width below hero.
- House status: full width below calendar.
- Fixed bottom navigation remains visible.
- The page may scroll vertically if real calendar content exceeds the available viewport; the hero itself should not consume the full screen height.

### Landscape / browser

- Weather hero remains full width at top.
- Calendar and House status use a two-column grid below when sufficient width exists.
- On smaller widths they stack.

## 5. App chrome

On Start only:

- remove the large top header bar containing `James UI / Start / date / time`,
- keep one subtle `…` button in the upper-right of the hero,
- the menu opened by `…` must contain both the existing app actions and settings/reload actions.

Other pages may keep their current header until they are redesigned separately.

Bottom navigation:

- keep `Start | Haus | Klima | Medien | Tür`,
- improve presentation with restrained spacing, clearer icons and a subtle warm active marker,
- no glow frames and no duplicate navigation inside Start.

## 6. Code ownership / architecture

Existing ownership remains valid where possible:

- `jamesui-home.js`: Start layout, weather hero, house summary presentation.
- `jamesui-home-background.js`: Auto/Manual background selection and background settings.
- `jamesui-panel.js`: app shell, navigation, existing forecast overlay and shared HA helpers.
- `api.py`: persistent JamesUI configuration.

Add one focused module:

- `jamesui-home-data.js`: Start-only live data lifecycle for calendar subscription, scene discovery/favorites and scene activation helpers.

`jamesui-home-entry.js` loads/install this module together with the existing Start modules.

Reason: calendar subscriptions and scene actions are stateful data behavior and should not further enlarge `jamesui-home.js` or the already-large `jamesui-panel.js`.

No second Start renderer is introduced. The existing Alpine Start renderer is replaced/evolved in place.

## 7. Data flow

### Weather / moon

Use existing helpers and forecast subscription:

- `_weatherEntityId()`
- `_normalizedDailyForecast()`
- `_moonInfo()` / `_moonDetails()`
- `_formatSunEvent()`
- existing background resolver

Add a small weather-summary helper for:

- 3-day temperature tendency,
- rain expected in next 3 days,
- first probable rain time when forecast granularity supports it.

If exact rain timing cannot be derived from the available forecast type, display probability/tendency only; do not invent a time.

### Calendar

For each discovered `calendar.*` entity:

- subscribe for local `today 00:00` through `+7 days`,
- store latest returned events by entity ID,
- merge and sort for rendering,
- refresh subscription window when the date rolls over or the component reconnects,
- unsubscribe on component disconnect.

### Scenes

- discover via current HA state map (`scene.*`),
- resolve configured favorites against discovered entities,
- activate through `hass.callService("scene", "turn_on", { entity_id })`,
- report failures in a small non-blocking UI message/log.

## 8. Error / empty states

- Weather unavailable: retain current graceful missing-data behavior and fallback background.
- Moon entity unavailable: show `Mondphase nicht eingerichtet` in the facts row without reserving a large block.
- Calendar unavailable/no entities: `Keine Kalenderdaten` with no fake events.
- Scene unavailable/no entities: `Keine Szenen eingerichtet` and hide empty favorite slots.
- Individual unavailable house entities must not crash the whole summary.
- Calendar subscription failure must not break the Start page.

## 9. Settings

Extend existing JamesUI settings, not a new settings page.

Start settings contain:

- existing weather/outdoor/moon/illuminance mappings,
- existing background Auto/Manual controls,
- four optional favorite-scene selectors.

Calendar selection is automatic for V9; manual calendar filtering is explicitly deferred until there is a real need.

## 10. Testing

Add or update tests for:

- weather hero contains moon info in the weather-facts row,
- no separate moon card/block,
- 3-day summary/tendency generation,
- rain timing only when derivable,
- calendar event normalization, sorting, all-day support and merge behavior,
- calendar empty/error state,
- scene favorite resolution and fallback,
- scene activation calls `scene.turn_on`,
- exactly four configured favorite scenes max,
- house-status window/door classification,
- Start does not render duplicate primary navigation,
- Start hides the large shell header while other pages retain it,
- portrait/landscape structural class hooks,
- frontend revision propagation and loader compatibility remain intact.

CI must remain green before merge.

## 11. Migration / cleanup rules

- Do not add demo calendar events to production code.
- Do not create a second house-control stack.
- Do not duplicate weather or moon calculations already available in the panel.
- Do not remove the base Start fallback until the existing fallback-removal conditions in `PROJECT_STATUS.md` are met.
- Remove obsolete Alpine Start markup/CSS made unreachable by V9 in the same implementation batch so old layout fragments do not remain as dead visual code.
- Update `PROJECT_STATUS.md` after implementation with V9 ownership, data sources, remaining limitations and practical-test status.

## 12. Acceptance criteria

V9 is implementation-complete when:

1. Start visually matches the approved direction: Alpine weather hero above a dark, elegant lower grid without glowing card borders.
2. Moon data is integrated into the daily weather row.
3. Forecast action shows a useful 3-day tendency and opens forecast detail.
4. Real HA calendar events for today/following days appear automatically when calendars exist.
5. House status shows real summarized states including windows/doors.
6. Four configurable favorite scenes can be activated; `Weitere` exposes all scenes.
7. Start uses a single subtle top-right `…` menu and no large Start header.
8. Bottom navigation is the only primary navigation.
9. No fake runtime data is shown when integrations/entities are missing.
10. Full CI passes and practical OnePlus portrait verification is then marked `⚠️ Test nötig` until the user confirms the visual result.