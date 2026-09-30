# Changelog

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
