# JamesUI Next – Integrations- und Abnahme-Gate

Stand: 2026-10-09. Technischer Audit anhand des Feature-Branches und der GitHub-Actions-Konfiguration. Kein HA-/Browser-/Tablet-Test.

## Prüfbare Fakten

- Blöcke 0–13 sind laut Ausführungsroadmap zusammengeführt. Die neue Vorschau liegt separat unter `jamesui-1-preview`; r11 bleibt produktiv.
- Die Vorschau registriert vier Widgettypen und acht Provider. Der Router lässt aktuell nur `home` zu.
- Ein Startseiten-Dashboard muss bereits als strukturierte Konfiguration in `pages.home` vorliegen. Die Vorschau erzeugt es nicht selbst; ohne Konfiguration bricht der Start mit einer Fehlermeldung ab.
- Das Backend speichert die kanonische Konfiguration in HA `.storage` und stellt WebSocket `jamesui/config/get` und `jamesui/config/replace` bereit.
- Die Provider werden nur für konfigurierte Datenquellen aktiviert. Wetter übernimmt zusätzlich das kanonisch migrierte `data_sources.weather`; andere HA-Entitäten werden nicht geraten.
- GitHub Actions führt Python-/Node-Syntax- und Modul-/Integrations-Vertragstests aus. Die letzte geprüfte CI `68005c2b` ist grün.
- Im Repository gibt es aktuell keine Playwright-/Puppeteer-/Selenium-Konfiguration und damit keinen nachgewiesenen echten Browser-Renderingtest.
- Keine tatsächliche Home-Assistant-Instanz, kein OnePlus Pad 2 und kein Fully Kiosk wurden in dieser Arbeitssitzung getestet.

## Freigabegates (Reihenfolge verbindlich)

| Gate | Nachweis | Status |
| --- | --- | --- |
| G1 Architektur/Abhängigkeiten | Neue Vorschau unabhängig von r11, Modulgrenzen und HA-Adapter kontrolliert | Teilweise: getrennte Entry-Points, vollständiger Audit offen |
| G2 Konfiguration | Reproduzierbarer, schema-konformer Startstand mit expliziten HA-Bindings; keine unbeabsichtigte r11-Überschreibung | Offen |
| G3 Komponenten/Provider | Erfolgs-, Fehler-, Abbruch- und Wiederanlaufpfade in automatisierten Tests | Teilweise: viele Tests grün, Vollständigkeit nicht belegt |
| G4 Gesamtsystem | Browserbasierter E2E-Test von Start, Navigation, Widgets, Layout, Interaktion und simulierten HA-Updates | Offen |
| G5 HA-Integration | Installation und echte Entity-/Action-Bindings in einer Testinstanz geprüft | Offen |
| G6 Tablet | Hochformat, Touch, Fully Kiosk, Skalierung und Wiederverbindung auf OnePlus Pad 2 | Offen |

## Sofortige technische Risiken

1. **Startblocker:** `pages.home` fehlt bei einer frisch initialisierten bzw. ausschließlich aus r11 migrierten Konfiguration; der Preview-Start ist dann bewusst nicht möglich.
2. **Datenvollständigkeit:** Vorhandene r11-Wetterwerte können übernommen werden. Für Kalender, Todo, KNX/Haus und dynamische Buttons ist kein realer, vollständiger Zielsystem-Binding-Nachweis vorhanden.
3. **Darstellung:** DOM-Vertragstests belegen keine Pixel-/Touch-/Viewport-Korrektheit.
4. **Lebenszyklus:** Asynchrone Mount-/Unmount-Rennen und Netzwerkunterbrechungen müssen systematisch im Gesamtsystem geprüft werden.
5. **Rollout:** PR #27 bleibt Draft; r11 darf erst nach G1–G6 und Rollback-Nachweis abgelöst werden.

## Nächste Umsetzung ohne Tablet-Update

1. Reproduzierbare Testkonfiguration und HA-Simulator-Fälle für die vier Start-Widgets schaffen, ohne reale Entity-IDs zu erfinden.
2. Browser-E2E-Lauf in CI ergänzen; Lade-/Fehler-/Reconnect-, Touch- und Viewport-Szenarien prüfen.
3. Gefundene Integrationsfehler beheben und Regressionstests hinzufügen.
4. Erst nach grünen G1–G4 eine **einzige** gezielte HA-/Tablet-Abnahmerunde vorbereiten.

**Regel:** Implementiert, Unit-Test grün, Integrationstest grün, Browser-E2E grün, HA geprüft und Tablet geprüft sind getrennte Aussagen. Keine Freigabe aus einer grünen CI allein ableiten.

## Fortschritt 2026-10-10

- **G3:** Vier-Widget-Komposition wird erst nach erfolgreichem Laden aller Widgetruntimes freigegeben; ungültige Konfigurationen werden durch die Regressionstests erkannt.
- **G4 teilweise:** Echter Headless-Chromium-Smoke-Test in CI: zwei generische Tablet-Portrait-Viewports, Navigation, DOM-Widgets, horizontales Overflow und App-Destroy erfolgreich. Vollständige Browser-Interaktions-, Fehler- und Reconnect-Tests stehen aus.
- **CI-Nachweis:** Run `38028254684`, beide Jobs `validate` und `browser-smoke` erfolgreich.
- **G5/G6:** Reale Home-Assistant-Integration, OnePlus Pad 2 und Fully Kiosk unverändert nicht geprüft; kein Rollout.

## Ergänzung zum Browser-Gate (2026-10-10)

- Chromium prüft Interaktion und Störfälle zusätzlich zum Layout: Forecast-Overlay, Core-Navigations-Trigger, Wetter-/Licht-Wertänderungen, fehlende HA-Entitäten und Disconnect/Reconnect.
- Simulationsstatus bleibt explizit: Test benutzt ausschließlich `weather.browser_fixture` und `light.browser_fixture` (keine Nutzer-IDs).
- Run `38028627815` ist grün (beide Jobs); im Modul-Loader zählt `mount() === false` nicht mehr als Erfolg.
- **G4 weiterhin teilweise**, **G5/G6 offen**; weder Tablet-Test noch Produktionsfreigabe.
