# JamesUI Next – Integrations- und Abnahme-Gates

**Stand:** 2026-10-10 · Feature-Branch `feat/jamesui-1-0-block-14-start-configuration` · Draft-PR #27. **Keine HA-/Tablet-Freigabe.**

## Nachweis und Reichweite

- **Letzte vollständig grüne Prüfung:** GitHub Actions [Run 38030663272](https://github.com/MarkusAureliusTeuton/JamesUI/actions/runs/38030663272), Commit `1c47d75e`. Sowohl `validate` als auch `browser-smoke` erfolgreich.
- **Architektur:** Die Next-Vorschau ist von der alten r11-Ansicht getrennt; `home` ist bislang die einzige freigegebene Route. Vier Widgettypen und acht Provider sind registriert. Das allein belegt keine vollständige HA-Integration.
- **Persistenz:** Kanonische Konfiguration in Home Assistants `.storage`, WebSocket-Endpunkte `jamesui/config/get` und `jamesui/config/replace`.
- **Erststart:** Fehlt `pages.home`, legt Next eine **leere**, editierbare Dashboard-Seite mit Layout an und erhält vorhandene Einstellungen; eine inkompatible bestehende Seite wird nicht überschrieben. Der vollständige Vier-Widget-Start ist bisher nur mit einer expliziten Testkonfiguration belegt.
- **Daten:** Provider verwenden explizite `data_sources`; Wetter kann kanonisch migrierte Wetter-IDs übernehmen. Keine erfundenen produktiven HA-Entitäten.
- **Automatisierte Browserprüfung:** Echtes Headless Chromium in **zwei generischen Hochformat-Viewports** (800 × 1280, 1024 × 1366); simulierte HA-Daten, kein echter HA-Server.
- **Nicht getestet:** tatsächliche Home-Assistant-Installation, die dortigen Entitätszuordnungen und Berechtigungen, OnePlus Pad 2, Fully Kiosk und längerer Realbetrieb.

## Verbindliche Gates

| Gate | Prüfgegenstand | Aktueller Status |
| --- | --- | --- |
| **G1 Architektur** | Eigenständigkeit, Modulgrenzen, Lebenszyklen, Altlasten | **Teilweise:** getrennte Entry-Points und Lifecycle-Tests vorhanden; vollständige Abhängigkeitsprüfung offen |
| **G2 Konfiguration** | Nutzbare Erstkonfiguration, Widget-Instanzen und HA-Bindings | **Teilweise:** sichere leere Erstseite und persistente Editier-Operationen geprüft; vollständige nutzerseitige Datenquellen-/Widgetkonfiguration offen |
| **G3 Modul-Integration** | Vier Widgets, Provider, Aktionen, Störfälle | **Teilweise:** alle vier Widget-Runtimes im Integrationstest geprüft; vollständige Kombinationen/Quelleinstellungen offen |
| **G4 Browser-Gesamtsystem** | Rendering, Interaktionen, Touch, Persistenz, Fehler/Reconnect | **Teilweise:** grüne Chromium-E2E-Szenarien; weitere Zustände und Langlauf-/Visual-Regressionen offen |
| **G5 Real-HA** | Installation, WebSocket, konkrete Quellen und Befehle | **Offen** |
| **G6 Zieltablet** | OnePlus Pad 2, Hochformat, Fully Kiosk, Alltag | **Offen** |

## Bereits nachgewiesene Browser-E2E-Szenarien

- Wetter-Hero + Kalender-Agenda + House Quick + Dynamic Buttons werden gleichzeitig real im Browser gemountet, ohne vorgespiegelten Erfolg bei fehlgeschlagenen Widget-Starts.
- Navigation ist auf `home` beschränkt; Prognose-Overlay lässt sich öffnen und schließen; der Dynamic-Button-Trigger führt eine Core-Aktion aus.
- Explizite Testentitäten `weather.browser_fixture` und `light.browser_fixture`: Werteänderungen gelangen über Adapter → Provider → Capability → Widget; fehlende Entitäten zeigen Warn-/Leerzustände; Disconnect/Reconnect stellt aktuelle Daten ohne Remount wieder her.
- Long-Press öffnet den Dashboard-Editor. Elementverschiebung, Rückgängig, einmaliges Speichern, gescheiterter Speicherversuch ohne Verlust der lokalen Änderung und anschließender erfolgreicher Retry sind automatisiert geprüft.
- Tatsächliche Browsergeometrie: keine horizontal abgeschnittenen oder überlappenden Dashboard-Kacheln in den geprüften Viewports; Navigation bleibt sichtbar. App-Destroy entfernt die Shell.

**Einschränkung:** „Browser-E2E grün“ heißt **nicht** „alle denkbaren Funktionalitäten vollständig getestet“. Insbesondere keine echten KNX-/HA-Steuerbefehle, keine echte Kalender-/Todo-Abfrage und keine reale Hardware.

## Verbleibende Risiken / nächste Reihenfolge

1. **Produktive Konfigurierbarkeit:** Für Kalender, Aufgaben, Haus/KNX, Steuerbuttons und ihre Provider fehlen nachgewiesene vollständige nutzerseitige Konfigurations- und Initialisierungswege. Der leere Erststart ist stabil, aber noch kein fertig eingerichteter Homescreen.
2. **Fehler- und Lebenszyklen:** Wiederholtes Laden, Modulwechsel, fehlende Berechtigungen, verzögerte/fehlerhafte HA-WebSocket-Antworten und unerwartete Datenkombinationen weiter prüfen.
3. **Visuelle Abnahme:** Weitere Browser-Vergleiche und tatsächliche Tablet-Skalierung, Gesten und Fully Kiosk prüfen. Zwei generische Chromium-Viewports ersetzen das Gerät nicht.
4. **Real-HA:** Entitätsmapping und reale Funktionsketten erst nach grünen technischen Gates gemeinsam testen.
5. **Rollout/Rollback:** PR #27 bleibt Draft; r11 erst nach G1–G6 und dokumentiertem Rollback kontrolliert ablösen.

**Regel:** „Implementiert“, „Unit-Test grün“, „Integration grün“, „Browser grün“, „Real-HA geprüft“ und „Tablet geprüft“ sind getrennte Aussagen. Keine Produktivfreigabe allein aufgrund grüner CI.

## Block-14-Konfiguration: ergänzter Nachweis (2026-10-10)

- **G2 erweitert, aber nicht abgeschlossen:** Neue leere Startseite kann direkt bearbeitet werden. Im Katalog werden Eingaben vor dem Hinzufügen validiert; Agenda erhält explizite Kalender-/Todo-Quellen, House Quick einen belegten Lichtstatus, Dynamic Buttons zentral vorhandene oder ausdrücklich konfigurierte URL-Aktionen.
- **Persistenz:** Widgetinstanz, neue Provider-Bindings und Buttondefinitionen werden zusammen gespeichert; Rückgängig entfernt den kompletten lokalen Entwurf, externe Quelländerungen werden konfliktfrei nicht überschrieben.
- **Browser-Smoke:** Zusätzlich zu vorhandenen Vier-Widget- und Gestentests wird eine echte leere Erstkonfiguration durchgespielt und anschließend ein weiteres Agenda-Widget mit Kalender-/Todo-Bindings erzeugt.
- **Grenzen:** Nicht alle fortgeschrittenen Quellentypen und Widgetoptionen sind in der UI konfigurierbar. Bereits vorhandene Provider werden nach gespeicherten Änderungen ohne Neustart synchronisiert (Browser-/Integrationsprüfung). Echte HA-Systemtests/Tablet/Fully weiter offen.

## Scope- und Live-Provider-Gate (2026-10-10)

- **Keine Folgeblöcke:** Bis zur vollständigen technischen Basisabnahme ausschließlich Blöcke 0–14; spätere Blöcke 15–21 nicht starten.
- **Core-Korrektur:** Explizites `update() === false` gilt als Fehler und kann nicht mehr grün durchlaufen.
- **Provider-Laufzeit:** Der Coordinator in `modules/` reagiert auf *gespeicherte* Änderungen der kanonischen `data_sources`: neue Provider laden, bestehende aktualisieren, entfernte abmelden. Sequenzierung und Destroy bei spätem Import sind getestet; Fehler werden im Health-Service angezeigt.
- **Prüfnachweis:** `validate` + Chromium-`browser-smoke` grün, GitHub Actions `38033578889`; Browser überprüft sofortige Verfügbarkeit der nach dem Speichern hinzugefügten Kalender-/Todo-Provider.
- **G1–G4 nicht vollständig freigegeben:** Es fehlen weiterhin erweiterte Quellkonfigurationen der bestehenden Module, reale HA-Services/Autorisierung sowie visuelle/device-spezifische Abnahmen; G5/G6 ausdrücklich offen.

## Verifizierter Integrationsfortschritt (2026-10-10)

- **CI:** `validate` und `browser-smoke` erfolgreich: Run `38041841417`, Commit `e065e7bae6`.
- **G2 teilweise:** Katalog erlaubt explizite Wetter-, Kalender-, Todo-, Licht-, Ambientelicht-, Heizungs-, Geräte- und Energiebinding-Eingaben; einfache State-Backed Toggles mit Core-HA-Aktionen. Ungeeignete Entitäten und ungültige Energiegrenzen werden vor der Persistenz abgewiesen. Nicht alle erweiterten Widget-/Provider-Optionen sind bedienbar.
- **G3/G4 teilweise:** Browser simulierter HA-Statuswechsel und `entity.toggle`-Serviceaufruf; Toggle-Farbe folgt der *wirklichen* State-Aktualisierung, nicht einem optimistischen Klick. Wetter-, Heizungs- und Steuerzustands-Provider werden nach Save live geladen. Neues First-Fit-Raster packt drei 4-Spalten-Widgets in eine Zeile; Browser prüft horizontale Kachelgrenzen.
- **Offen G2/G4:** Konfiguration *bestehender* Instanzen und Entfernen/Rückbau, freie Mapping-/Serviceparameter, weitere Fehlerfälle und umfassende Design-/Browserabnahme.
- **Offen G5/G6:** echte HA-Installation, KNX-Entitäten/Serviceberechtigungen, OnePlus Pad 2, Fully Kiosk und Dauerbetrieb. Kein Gerätetest und kein Cutover vor der Freigabe.
- **Scope:** Ausschließlich bestehende Module/Core und Block 14. Blöcke 15–21 bleiben vollständig zurückgestellt.
