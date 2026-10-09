# JamesUI 1.0 – Soll-/Ist-Matrix

Stand: 2026-10-09. Arbeitsstand des Draft-PR #27, keine Freigabe oder Tablet-Abnahme.

| Bereich | Soll | Ist / Nachweis | Offen |
| --- | --- | --- | --- |
| Core / Architektur | Modularer Core, getrennt von r11 | Core, Loader, Registry und HA-Adapter vorhanden | End-to-End-Integration prüfen |
| Navigation | Nur nutzbare Ziele anwählbar | 1.0-Vorschau beschränkt Router und Buttons auf Start; separate Regressionstests | Echte HA-Vorschau prüfen |
| Dashboard-Komposition | Konfigurierte Widgetinstanzen im Layout | Composer, Grid, Widget-Hosts und Editor im Feature-Branch vorhanden | Konfiguration und Provider im HA-Verbund prüfen |
| Start-Widgets | Weather Today, Calendar Agenda, House Quick, Dynamic Buttons | Module in Vorschau registriert | Datenbindung und Funktion auf HA prüfen |
| Layout / Tablet | Hochformat, feste Startseite, Bottom-Navigation | Viewport-begrenztes Shell-Grid; Hero-Deck und internes Dashboard-Raster implementiert | Reale OnePlus-Pad-2-Maße, Fully Kiosk und Touch prüfen |
| Persistenz | Konfigurationsspeicher statt r11-Fallback | Config Service mit HA-WebSocket get/replace; Vorschau lehnt fehlende Konfiguration ab | Realen HA-Konfigurationsstand prüfen |
| Qualität | Automatisierte Tests und grüne GitHub Actions | Tests vorhanden; letzte grüne Navigation-CI vor Layout-Änderung: 3da751c | Neueste CI abwarten, E2E ergänzen |
| Migration | r11 erst nach kontrollierter Freigabe ablösen | 1.0-Vorschau separat; PR #27 Entwurf | Abnahme, Umschaltplan, Rollback |

**Wichtig:** Keine erfolgreichen Home-Assistant-, Fully-Kiosk- oder Tablet-Tests durchgeführt. „Vorhanden“ bedeutet nicht „abgenommen“.
