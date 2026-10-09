# JamesUI 1.0 – Soll-/Ist-Matrix

Stand: 2026-10-09. Arbeitsstand des Draft-PR #27, keine Freigabe oder Tablet-Abnahme.

| Bereich | Soll | Ist / Nachweis | Offen |
| --- | --- | --- | --- |
| Core / Architektur | Modularer Core, getrennt von r11 | Core, Loader, Registry und HA-Adapter vorhanden | End-to-End-Integration prüfen |
| Navigation | Nur nutzbare Ziele anwählbar | 1.0-Vorschau beschränkt Router und Buttons auf Start; separate Regressionstests | Echte HA-Vorschau prüfen |
| Dashboard-Komposition | Konfigurierte Widgetinstanzen im Layout | Composer, Grid, Widget-Hosts und Editor im Feature-Branch vorhanden; konfigurierte Provider werden aus data_sources geladen | Konfiguration und Provider im HA-Verbund prüfen |
| Start-Widgets | Weather Today, Calendar Agenda, House Quick, Dynamic Buttons | Module und acht Datenprovider in Vorschau registriert; Provider-Lifecycle- und vier-Widget-Kompositionstest ergänzt | Datenbindung und Funktion auf HA prüfen |
| Layout / Tablet | Hochformat, feste Startseite, Bottom-Navigation | Viewport-begrenztes Shell-Grid; Hero-Deck und internes Dashboard-Raster implementiert | Reale OnePlus-Pad-2-Maße, Fully Kiosk und Touch prüfen |
| Persistenz | Konfigurationsspeicher statt r11-Fallback | Config Service mit HA-WebSocket get/replace; Vorschau lehnt fehlende Konfiguration ab | Realen HA-Konfigurationsstand prüfen |
| Qualität | Automatisierte Tests und grüne GitHub Actions | Tests vorhanden; letzte grüne Navigation-CI vor Layout-Änderung: 3da751c | Vier-Widget-Komposition CI grün (`57b12772`); neue Fehlerpfad-CI abwarten, E2E mit echtem HA ergänzen |
| Migration | r11 erst nach kontrollierter Freigabe ablösen | 1.0-Vorschau separat; PR #27 Entwurf | Abnahme, Umschaltplan, Rollback |

**Wichtig:** Keine erfolgreichen Home-Assistant-, Fully-Kiosk- oder Tablet-Tests durchgeführt. „Vorhanden“ bedeutet nicht „abgenommen“.

## Integrationsgrenzen

- Provider werden ausschließlich aus `data_sources[provider-id]` aktiviert; nicht konfigurierte Provider liefern keine erfundenen Daten. Die HA-Entity-Zuordnung muss auf dem Zielsystem konfiguriert werden.
- Die vier Start-Widgets sind im Modulregister vorhanden. Vollständige Widget-/Provider-Interaktion unter realen HA-Daten ist noch nicht abgenommen.
- Die Dashboard-Hülle ist auf feste Höhe ausgelegt; sichtbare Widget-Anordnung und Touch-Bedienung im Hochformat sind noch nicht praktisch validiert.
- CI ist eine technische Prüfung und kein Ersatz für einen Home-Assistant-/Fully-Kiosk-Test.

## Bootstrap-Abnahme (2026-10-09)

- Automatisierte Vorschau-Tests inklusive HA-Panel-Eigenschaften (`hass`, `narrow`, `route`, `panel`) erfolgreich: CI `4ee13127`.
- Home-Assistant-Instanz, reale Entitäten, Tablet-Hochformat und Fully Kiosk: weiterhin **nicht getestet**.
- Produktiv-Umschaltung auf JamesUI 1.0: **nicht freigegeben**.

## Provider-Startfehler (2026-10-09)

- Soll: Bei ungültiger gespeicherter Provider-Konfiguration darf keine teilweise aktive Dashboard-Laufzeit zurückbleiben.
- Ist: Fehlerpfad räumt alle geladenen und ausstehenden Module auf; Regressionstest ergänzt, neue CI ausstehend.
- Reale HA-Entitäten müssen später explizit zugeordnet und am Zielgerät getestet werden.
