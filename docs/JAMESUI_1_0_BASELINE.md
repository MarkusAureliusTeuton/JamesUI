# JamesUI 1.0 – Block 0 Baseline

_Date: 2026-10-02_
_Status: Block 0 characterization baseline for JamesUI 1.0_

This document records what the current r11 runtime does that JamesUI 1.0 intentionally preserves as behavior, data input or accepted visual direction. It is not a contract to keep the current implementation. The r11 structure remains temporary and is deleted after the controlled cutover once the new architecture satisfies the acceptance gate.

## Production surface

### Backend / panel registration

- `custom_components/jamesui/__init__.py` — registers the static frontend path and Home Assistant custom panel; injects `jamesui-entry.js` through `js_url` with the current frontend revision token.
- `custom_components/jamesui/api.py` — current flat WebSocket configuration API backed by `config_entry.options`; this API shape is migration input, not the future config architecture.
- `custom_components/jamesui/const.py` — integration/frontend version and panel/static-path constants.

### Frontend JavaScript

- `jamesui-entry.js` — guarded classic-script Home Assistant panel bootstrap. It discovers nested `jamesui-panel` elements through open shadow roots, replays predefined Home Assistant panel properties after the panel class loads, and propagates the entry revision token.
- `jamesui-panel.js` — current monolithic runtime containing shell/navigation, Home Assistant access, weather helpers, config/settings, Haus, Klima demo, Media, Tür demo, overlays, display calibration and global styling. It is a behavior source only, not the JamesUI 1.0 architectural basis.
- `jamesui-home-entry.js` — legacy Start enhancement bridge. It imports and installs the Start modules after the monolithic panel is defined and triggers re-rendering of discovered panels.
- `jamesui-home.js` — legacy Start replacement/renderer plus reusable domain calculations such as house/weather summaries. The renderer/CSS and panel coupling are legacy-only.
- `jamesui-home-data.js` — legacy Start calendar/scene runtime wrapper. Calendar normalization is a reusable behavior candidate; lifecycle/prototype wrapping is legacy-only.
- `jamesui-home-background.js` — legacy Start background/settings wrapper. The Alpine scene mapping/config intent may inform the new provider/settings design; rendered-HTML/CSS wrapping is legacy-only.
- `jamesui-v11-polish.js` — release-specific visual override layer. Legacy-only; it must not be carried into JamesUI 1.0.

### Assets

- `frontend/assets/alpine/` — approved local Alpine WebP background family plus `SHA256.txt` integrity manifest. Retain as assets unless a later explicit design decision replaces an image.
- `frontend/assets/weather/` — legacy SVG weather family referenced by the old monolithic/weather implementation. Candidate-delete after the JamesUI 1.0 icon/asset system is active and no new production module references it.

### Current reference ownership

- Home Assistant loads `jamesui-entry.js` from `__init__.py`.
- `jamesui-entry.js` loads the stable legacy `jamesui-panel.js`, then the legacy Start enhancement bridge.
- `jamesui-home-entry.js` loads `jamesui-home.js`, `jamesui-home-data.js`, `jamesui-home-background.js` and `jamesui-v11-polish.js`.
- The monolithic panel and Start modules reference the current asset families.

## Preserve as behavior

Preservation means that the new architecture reproduces the useful outcome through its own module contracts. It does **not** mean copying the current files, selectors, prototype patches or render structure.

- Guarded classic Home Assistant panel bootstrap behavior.
- Discovery of `jamesui-panel` even when nested below Home Assistant open shadow roots.
- Replay/upgrade of predefined own properties `hass`, `narrow`, `route`, `panel` after the custom element runtime becomes available.
- Stable persistent product navigation `Start | Haus | Klima | Medien | Tür` unless the product direction is explicitly changed.
- Alpine WebP atmosphere/background family.
- Weather source selection, forecast normalization and calculations that prove useful under the new provider contract.
- Calendar event normalization/filtering/deduplication that proves useful under the new provider contract.
- Proven entity classification rules where they remain correct for real Home Assistant data.
- Device-local display-calibration concept, separated from shared JamesUI configuration.
- Useful Media routing/receiver preparation knowledge, moved into dedicated provider/integration boundaries rather than Core.
- No fake data: missing capabilities remain empty/unavailable/not-configured rather than being populated with demo values.

## Retain assets

Retain through the rebuild:

- `assets/alpine/clear-day.webp`
- `assets/alpine/cloudy-day.webp`
- `assets/alpine/rain-day.webp`
- `assets/alpine/snow-day.webp`
- `assets/alpine/fog.webp`
- `assets/alpine/dusk.webp`
- `assets/alpine/clear-night.webp`
- `assets/alpine/cloudy-night.webp`
- `assets/alpine/SHA256.txt`

The SHA-256 manifest is the committed integrity reference for the approved Alpine family.

The current `assets/weather/*.svg` family is **not** a permanent JamesUI 1.0 asset contract. It remains only until the new local icon/asset system has replaced all required references.

## Config migration inputs

The following keys are the exact currently persisted shared `config_entry.options` inputs that Block 5 must evaluate and migrate deterministically:

```text
weather_entity
outdoor_temperature_entity
moon_entity
illuminance_entity
home_scene_entities
background_mode
background_scene
media_spotify_entity
media_onkyo_entity
media_ma_player_entity
media_route
media_spotify_source
media_onkyo_source
media_playlist_name
media_playlist_uri
```

These entries are migration inputs only; they do not prescribe the JamesUI 1.0 structured schema field names.

### Device-local setting — not shared config migration

Browser-local storage key:

```text
jamesui-display-calibration
```

Fields:

```text
top
right
bottom
left
scale
```

This setting belongs to one physical browser/tablet. It remains **device-local** and is not migrated into the shared Home Assistant configuration store.

## Reusable logic candidates

Classification meanings:

- `port concept` — behavior is worth preserving, but should be reimplemented behind JamesUI 1.0 interfaces.
- `re-evaluate` — useful knowledge exists, but assumptions must be checked against the new provider/action model and real Home Assistant data.
- `legacy-only` — do not port as architecture; delete/supersede at cutover.

| Current owner / function | Classification | Notes |
| --- | --- | --- |
| `jamesui-panel.js::_weatherEntityId` | port concept | Configured source first, controlled fallback discovery. Move to weather provider. |
| `jamesui-panel.js::_outdoorTemperatureEntityId` | re-evaluate | Heuristic is useful but should become explicit/configurable provider behavior. |
| `jamesui-panel.js::_forecastPreference` | port concept | Forecast capability preference belongs in the weather provider. |
| `jamesui-panel.js::_normalizedDailyForecast` | port concept | Preserve normalization behavior, not panel ownership. |
| `jamesui-panel.js::_sunPeriod` | port concept | Useful atmosphere input independent of rendering. |
| `jamesui-panel.js::_moonDetails` | re-evaluate | Astronomical fallback may remain useful, but authoritative HA source/provider semantics must be decided in Block 9. |
| `jamesui-panel.js::_houseEntities` | re-evaluate | Existing classification heuristics are useful evidence; new house providers must own them. |
| `jamesui-panel.js::_houseSummary` | port concept | Aggregation belongs in house capabilities, not Start/render code. |
| `jamesui-panel.js::_spotifyEntityId` | re-evaluate | Useful discovery knowledge; dedicated Media provider owns it. |
| `jamesui-panel.js::_onkyoEntityId` | re-evaluate | Receiver-specific detection must stay outside Core. |
| `jamesui-panel.js::_musicAssistantPlayerId` | re-evaluate | Useful routing discovery, but provider-specific. |
| `jamesui-panel.js::_mediaRouteInfo` | port concept | Preserve source/target route concept within Media boundaries. |
| `jamesui-panel.js::_onkyoNetworkSource` | re-evaluate | Receiver-specific source matching may be retained in a dedicated integration/provider. |
| `jamesui-panel.js::_prepareOnkyo` | re-evaluate | Useful sequence knowledge; direct panel-coupled service calls are not portable. |
| `jamesui-panel.js::_musicAssistantPlaylistId` | port concept | URI normalization is portable if still required by the selected Media API. |
| `jamesui-home.js::summarizeHomeState` | port concept | Preserve real-state aggregation semantics through house capabilities. |
| `jamesui-home.js::resolveHomeAtmosphere` | port concept | Preserve weather/day-period to Alpine-scene intent through the weather provider/asset registry. |
| `jamesui-home.js::weatherTrendSummary` | re-evaluate | Keep only if useful in the final Weather Today/forecast experience. |
| `jamesui-home.js::firstExpectedRainTime` | port concept | Critical rule: derive first rain time only from granular data; never fabricate it from daily forecast. |
| `jamesui-home-data.js::normalizeCalendarEvents` | port concept | Preserve filtering, sorting and safe malformed/empty handling in `provider.calendar`. |
| all `render*` functions, global CSS and release selectors | legacy-only | Visual implementation is rebuilt from layouts/widgets/design tokens. |
| `Panel.prototype` wrapping / foreign lifecycle wrapping | legacy-only | Explicitly prohibited in JamesUI 1.0. |
| direct panel-coupled HA service execution | legacy-only | Replaced by HA Adapter + Action Registry/provider boundaries. |

## Start visual acceptance

Primary acceptance viewport: **OnePlus Pad 2 portrait**. Fully is the kiosk shell only and is not part of the layout contract.

The rebuilt Start page must preserve this approved product direction:

- persistent bottom navigation `Start | Haus | Klima | Medien | Tür`;
- Alpine/weather hero in the upper region;
- weekday/date and large current time;
- current outdoor temperature and weather condition;
- daily high and low;
- rain probability and first rain time only when real granular data supports it;
- strong wind/storm relevance;
- snow relevance when applicable;
- sunrise and sunset;
- moon phase/illumination;
- tapping the large current temperature opens the forecast overlay without moving or expanding the underlying page;
- no standalone visible `3-Tage-Prognose` row in the normal page;
- one intentional lower widget deck beginning below/overlapping the hero and extending to the persistent bottom navigation;
- rounded upper deck corners and square lower deck corners;
- restrained dark/translucent gradient with a fine warm shimmer/highlight at the upper edge;
- Calendar widget on the left;
- House Quick on the right/main region;
- four manually assigned Dynamic Buttons below House Quick;
- labels `Home`, `HEUTE & DANACH` and `ZUHAUSE` are absent.

These are behavioral/visual acceptance points. r11 CSS selectors, pixel values and patch-layer implementation details are not permanent contracts.

## Delete at cutover

Delete or supersede only after the JamesUI 1.0 cutover gate passes:

- monolithic old `jamesui-panel.js`;
- old `_homePage()` implementation;
- `jamesui-home-entry.js`;
- `jamesui-home.js`;
- `jamesui-home-data.js`;
- `jamesui-home-background.js`;
- `jamesui-v11-polish.js`;
- unused legacy weather SVG family after the new icon/asset system owns all required icons;
- hard-coded Klima demo rooms/temperatures;
- doorbell demo/prototype UI;
- release-patch-specific tests once replaced by architecture/behavior contracts;
- obsolete flat compatibility/config keys after tested migration.

Git history is the archive. Do not create permanent `legacy`, `old`, `v11-final` or equivalent production copies.

## Block 0 scope guard

This baseline introduces no JamesUI 1.0 runtime module and no production-code refactor. Its purpose is to make later deletion safe by recording exactly what is worth preserving and what is deliberately temporary.
