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

## Wetter-Datenquelle (2026-10-09)

- Soll: Bereits konfigurierte r11-Wetter-Entitäten aus der kanonischen Migration wiederverwenden, ohne künstliche HA-IDs.
- Ist: Preview berücksichtigt `data_sources.weather` als Fallback für `provider.weather`; Regressionstest ergänzt, CI ausstehend.

## Verbindliche Freigabe-Gates (2026-10-09)

- Nachweis und Risiken: `docs/JAMESUI_NEXT_ACCEPTANCE_GATES.md`.
- CI bis `68005c2b` grün; echte Browser-/HA-/Fully-Kiosk-/Tablet-Prüfungen fehlen.
- **Startblocker:** Ohne explizites `pages.home`-Dashboard startet die 1.0-Vorschau nicht. Konfigurations- und E2E-Gates sind offen.

## Integration und Browser-Smoke (2026-10-10)

- `validate` und `browser-smoke` sind im CI-Lauf `38028254684` grün (Commit `0cfadf65`).
- **Widget-Readiness:** Der Preview-Mount wartet, bis die konfigurierten Widgets fertig geladen und gemountet sind. Ein fehlgeschlagener Start wird nicht mehr als Erfolg gemeldet.
- **Echter Chromium-Browser:** Tests in `tests/browser/` prüfen Startseite, Widget-DOM, Navigation, Overflow, Portrait-Viewports und Zerstörung der App. Dies ist ein **simulierter HA-Browser-Smoke-Test**, keine Abnahme mit realem HA, OnePlus Pad 2 oder Fully Kiosk.
- Browser-Interaktions- und Reconnect-Szenarien sind noch nicht vollständig abgedeckt.

## Browser-Störfallprüfung (2026-10-10)

- Grüne CI für `validate` und `browser-smoke`: Run `38028627815` / Commit `88d3667f`.
- Echte Chromium-Interaktionen: Forecast öffnen/schließen, konfigurierten Navigations-Trigger betätigen.
- Getestete Datenkette: Wetter und Licht aus **simulierter HA-State-Liste** in die sichtbare UI; Wertänderung, fehlende Entity, Disconnect/Reconnect. Fehlende Kalenderquelle zeigt eine Nichtverfügbarkeitsmeldung statt Beispieltermine.
- Gefundene Loader-Lücke geschlossen: Rückgabe `false` bei `mount()` ist ein Fehler.
- **Nicht getestet:** produktive HA-WebSocket-/Entity-Konfiguration, echte KNX-/Geräteaktionen, Fully Kiosk und Hardware des OnePlus Pad 2. Für G4 fehlen weitere Interaktions- und Visual-Regressionsfälle.

## Browser-Editor und Persistenz (2026-10-10)

| Gegenstand | Nachweis | Rest |
| --- | --- | --- |
| Editor-Gesten und Raster | Chromium: Long-Press, Drag, Undo; zwei generische Hochformate | Reales Tablet, weitere Gesten-/Grenzfälle |
| Konfiguration speichern | Chromium: eine erfolgreiche HA-WebSocket-Schreibtransaktion; Save-Fehler erhält den lokalen Entwurf und Remote-Daten; Retry erfolgreich | Echte HA-Authentifizierung/-Berechtigungen und reale Konfiguration |
| Sichtbare Positionierung | Chromium: Kacheln nicht überlappend/abgeschnitten; Navigation sichtbar | Pixel-/Screenshot-Abnahme, Fully Kiosk |
| Widget hinzufügen | Katalog und Edit-Session im Code und Node-Tests | **Offen:** vollständige UI-Formulare, gültige Widget-Defaults und Quellenbindung; leere Standardconfig funktioniert nicht für Agenda |
| Qualitätsnachweis | Run `38030663272`: `validate` + `browser-smoke` grün | Keine Produktiv-/Tablet-Freigabe |

## Block 14 – konfigurierte Widget-Instanzen und Erststart (2026-10-10)

| Funktion | Aktueller Nachweis | Noch offen |
| --- | --- | --- |
| Leere Neuinstallation | Chromium: Dashboard wird initialisiert, `Bearbeiten` erreichbar, Widget anlegbar und speicherbar | Echte Home-Assistant-Installation |
| Widget-Katalog | Geführte Eingaben und Validierung für Wetter, Agenda, Licht-Kurzstatus und vorhandene/URL-Buttons | Erweiterte Konfiguration für alle Haus-/Steuerungs-/Widget-Varianten |
| Kalender/Aufgaben | Explizite `calendar.*`/`todo.*`-IDs; Provider-Bindings zusammen mit Widget gespeichert | Echte Kalender-/Todo-Berechtigungen, Abruf und Bearbeitung |
| Quellenänderungen | Undo, atomarer Save, Konfliktschutz; bestehende Provider nach Save live gestartet/aktualisiert (CI 38033578889) | Reale Home-Assistant-Anbindung und zusätzliche Quellenformulare |
| Dynamic Buttons | Zentrale Definition oder gültige URL-Action; keine implizite HA-Aktion | Eigene Toggle-/KNX-/Service-Action-Konfiguration |
| Rollout | Testbereit nur in simulierter Browser-Umgebung | HA-, OnePlus-Pad-2- und Fully-Kiosk-Abnahme |

## Beschränkung der laufenden Arbeit (2026-10-10)

- Nur Basis/Core, bestehende Module aus Block 0–13 und deren Abschluss/Integration in Block 14.
- Keine Folgeblöcke 15–21 und keine produktive Umschaltung; PR #27 bleibt Draft.
- Live-Konfigurationsübernahme vorhandener Provider in Unit-/Integration-/Chromium-Tests grün (`38033578889`), echte HA-/Tablet-Tests offen.
- Abschluss der vorhandenen Module bedeutet auch vollständige nutzerseitige Konfiguration der bereits spezifizierten Heizungs-, Geräte-, Energie- und Steuerzustandsfähigkeiten; diese ist **noch offen**.
