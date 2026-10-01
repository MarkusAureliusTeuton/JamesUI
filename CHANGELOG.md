# Changelog

## Unreleased

- Reworked the Start page into the approved **Alpine Interface**: one composed weather/home surface instead of a generic direct-access card grid.
- Added eight local realistic Alpine WebP atmosphere assets for clear/cloudy/rain/snow day, dusk, clear/cloudy night and fog.
- Added tested weather/sun-period atmosphere mapping, live functional navigation and graceful missing-data fallbacks.
- Kept the previous SVG weather artwork and base Start renderer intentionally as a compatibility fallback until the Alpine Start is practically proven on the target tablet.
- Hardened the Home Assistant frontend loading path with a guarded classic `jamesui-entry.js` plus module bridge after a direct ES-module panel entry caused a blank screen.
- Added loader and Start-page regression tests.
- Documented repository ownership, temporary/demo code and explicit removal rules in `PROJECT_STATUS.md`.
- Reduced CI noise: Markdown-only documentation changes no longer run the full validation workflow.

## 0.5.0 — Media playback

- Replaced the Media placeholder with a functional Spotify-to-receiver workflow.
- Added automatic discovery of Spotify, Onkyo and Music Assistant media-player entities.
- Added two playback routes: Music Assistant (preferred) and direct Spotify Connect fallback.
- Added configurable Spotify playlist name/link, receiver, playback target and receiver input.
- Added one-touch Spotify playlist playback through `music_assistant.play_media` or Spotify `media_player.play_media`.
- Added Onkyo power/input preparation before playback.
- Added live now-playing title/artist, transport controls and volume control.
- Added media routing diagnostics directly on the Media page.
- Added a dedicated Media settings page; configuration is stored centrally in the JamesUI Home Assistant config entry.

## 0.3.1 — Start visual refresh

- Added 28 local weather background artworks: clear, partly cloudy, cloudy, rain, storm, snow and fog across day, golden hour, twilight and night.
- Added automatic background selection from current Home Assistant weather condition and real sun elevation.
- Added optional ambient-light sensor discovery and source selection.
- Added visual dimming based on measured outdoor illuminance when a lux sensor is available.
- Redesigned the Start layout around a large atmospheric weather scene.
- Added a dedicated moon-phase card with phase rendering, approximate illumination, lunar age, cycle progress and next major phase.
- Added sunrise/sunset and illuminance information to the weather scene.
- Kept all weather artwork local to JamesUI for offline/kiosk operation.

## 0.3.0 — House

- Added automatic Home Assistant area, device and entity registry loading.
- Added live house overview for lights, sockets, devices and ventilation.
- Added overall availability, update and low-battery health indicators.
- Added current house statistics for active lights, sockets and fans.
- Added room-aware category detail pages based on Home Assistant area assignments.
- Added direct light, outlet and fan toggles through Home Assistant services.
- Added automatic socket detection from outlet device class and common socket/plug names.
- Added device-health discovery for update, battery and vacuum entities.
- Kept the fixed JamesUI bottom navigation while House detail content scrolls independently.

## 0.2.0 — Home & Weather

- Added persistent JamesUI configuration stored in the Home Assistant config entry.
- Added automatic weather, outdoor-temperature and moon-phase entity discovery.
- Added page-specific source selection under Start settings.
- Added live current weather, temperature, humidity and wind.
- Added live daily/twice-daily/hourly forecast subscription through Home Assistant WebSocket API.
- Added normalization of non-daily forecasts into daily summaries.
- Added 3-day forecast overlay.
- Added real sun state, elevation and azimuth from Home Assistant.
- Added day, golden-hour, twilight and night visual states.
- Added condition-aware clouds, rain and snow presentation.
- Added current moon phase plus an approximate next major lunar-phase preview.
- Added live Quickinfo basics for lights, climate and persons.
- Kept house-mode/scene activation unbound until the House module defines the persistent mode helper.

## 0.1.2 — Viewport & navigation fix

- Fixed touch sliders losing pointer capture after each value change.
- Calibration values now update live without rebuilding the UI.
- Draggable calibration corners now move continuously.
- Bound JamesUI to the current visual viewport using dynamic viewport sizing.
- Removed minimum application heights that could push navigation outside the visible area.
- Forced a dark document background to prevent exposed Home Assistant/browser background around the app.
- Bottom navigation now remains outside the scrolling content area.
- Only the page content scrolls between the fixed header and fixed bottom navigation.
- Added live viewport updates when browser or kiosk dimensions change.

## 0.1.1 — Display setup

- Added automatic viewport, panel size, orientation, touch and pixel-density detection.
- Added per-device display calibration stored locally in the browser.
- Added draggable corner markers plus pixel-precise edge controls.
- Added optional UI scale control and one-click reset to automatic sizing.
- Added Display & Kalibrierung to the JamesUI application menu.

## 0.1.0 — Foundation

- Added HACS-compatible Home Assistant custom integration.
- Added UI config flow and single-instance setup.
- Added native JamesUI sidebar panel.
- Added responsive OnePlus Pad 2 / 7:5 application shell.
- Added Start, Haus, Klima, Medien and Tür views.
- Added context-specific settings views.
- Added application control menu and live Home Assistant entity count.
- Added UI-only doorbell overlay demo: “Es klingelt an der Haustür”.
- Added validation workflow for Python, JSON and JavaScript.

No device-control actions are enabled in this version.
