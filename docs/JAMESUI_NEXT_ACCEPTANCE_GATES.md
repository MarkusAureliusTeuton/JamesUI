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

## Aktueller Editor- und Datensicherheitsnachweis (2026-10-10)

- **G2 erweitert:** Vorhandene konfigurierte Widget-Instanzen können über den Katalog bearbeitet und entfernt werden. Bei eindeutiger Nutzung wird die Widgetinstanz beim Entfernen ebenfalls gelöscht; geteilte Instanzen und globale Provider-/Buttondaten bleiben unangetastet. Advanced-Agendaoptionen werden beim Ändern der Quellliste erhalten.
- **G4 erweitert:** Chromium testet Bearbeiten, selektiven Widget-Runtime-Remount, Rückgängig, atomaren Save, Entfernen, vollständiges Abbrechen ohne Schreibzugriff, Reaktivierung und sichtbare Speicherfehler.
- **Konflikte:** Externe Änderungen an Seitengeometrie, Widgetdefinitionen oder Providerquellen werden nicht still überschrieben.
- **Grüne Qualitätsgates:** `validate` + `browser-smoke` in [Run 38043543481](https://github.com/MarkusAureliusTeuton/JamesUI/actions/runs/38043543481), Commit `777274dc9e`.
- **Nicht freigegeben:** Vollständige Erweitertenkonfiguration und Rückbau nicht mehr genutzter globaler Quellen, echte HA-WebSocket-/KNX-End-to-End-Aktionen, OnePlus Pad 2 und Fully Kiosk. G5/G6 weiter offen; Blöcke 15–21 gesperrt.

## Datenintegritäts-Nachweis: Ressourcen und mehrere Clients (2026-10-10)

- **G2 verbessert:** Freiwillige Bereinigung zentraler Dynamic-Button-Definitionen nur ohne Referenzen auf anderen Dashboard-Seiten oder in Widgetinstanzen; keine automatische Löschung von Datenquellen. Browser testet Undo, explizite Bereinigung und Save.
- **G1/G2 verbessert:** Der strukturierte Home-Assistant-WebSocket-Schreibweg setzt einen 64-stelligen **`expected_revision`**-Token voraus. Server verifiziert atomar gegen die aktuelle kanonische SHA-256-Konfigurationsrevision; stale Saves erhalten `config_conflict`. Alle bestehenden r11-Legacy-Updates ändern die Revision ebenfalls.
- **G4 verbessert:** Chromium simuliert parallel geänderte HA-Konfiguration und bestätigt: konfliktbehafteter Save schlägt sichtbar fehl; der Server behält die jüngeren Fremdänderungen, und der Editor kann den lokalen Entwurf verwerfen.
- **Prüfnachweis:** [GitHub Actions 38048180467](https://github.com/MarkusAureliusTeuton/JamesUI/actions/runs/38048180467), Commit `a355d719d2`; `validate` und `browser-smoke` grün.
- **Weitere Gates offen:** Reale HA-Integration einschließlich Authentifizierung, nutzerfreundlicher Reload/Rebase bei Fremdänderungen und echte OnePlus-Pad-2-/Fully-Kiosk-Prüfung. **Keine Freigabe der Blöcke 15–21.**

## Mehrclient-Konflikt: bedienbarer Wiederanlauf (2026-10-10)

- **G2/G4 nachgebessert:** Ein Server-`config_conflict` zeigt jetzt einen klaren Hinweis und einen nutzerseitigen Befehl zum Neuladen und erneuten Speichern. Der erste fehlgeschlagene Save verwirft keine lokalen Änderungen.
- **Sicherheitsentscheidung:** Bei unveränderter Zielseite bleiben unabhängige Fremdänderungen erhalten; ein Vergleich mit der ursprünglichen Edit-Baseline verhindert die Verschmelzung widersprüchlicher Änderungen an derselben Seite oder Instanz. Bei erneuter Ablehnung bleibt der Editor aktiv.
- **Automatisiert geprüft:** Node-Unit-/Integrationsprüfung sowie vollständiger Chromium-Ablauf mit CAS-Konflikt, ausdrücklicher erneuter Speicherung, erhaltenen Fremdänderungen und nicht auflösbarem Seitenkonflikt. CI `validate` und `browser-smoke` grün: [Run 38062640323](https://github.com/MarkusAureliusTeuton/JamesUI/actions/runs/38062640323), Commit `f3c07c690`.
- **Freigabe unverändert gesperrt:** Echte HA-/KNX-Integration, OnePlus Pad 2 und Fully Kiosk nicht getestet; weitere Architektur-/Funktionsabnahme im Umfang 0–14 ausstehend.

## Core-/Modulgrenze nachgezogen (2026-10-10)

- **G1 verbessert:** Fachliche Prüfung der zentralen Dynamic-Button-Referenzen verbleibt im `modules/`-Bereich. Der generische Dashboard-Edit-Session-Core bekommt nur die optional injizierte Bereinigungsfunktion; neue Architekturregression bewahrt diese Grenze.
- **G2/G4 unverändert:** Bestehende Speichern-/Abbrechen-/Undo-/Bereinigen- und Mehrclient-Konflikttests bleiben erfolgreich.
- **Prüfnachweis:** `validate` und Chromium `browser-smoke` erfolgreich in [Run 38062902006](https://github.com/MarkusAureliusTeuton/JamesUI/actions/runs/38062902006), Commit `4a068b957`.
- **Keine vollständige Basisabnahme:** Weiterhin keine reale Home-Assistant-/KNX-/Fully-Kiosk-/OnePlus-Pad-2-Prüfung. Keine Umsetzung von Block 15–21.

## Block-14-Lifecycle-Audit (2026-10-10)

- **G1/G3 nachgebessert:** Kalender- und Todo-Provider binden nach fehlgeschlagenem Update die letzte gültige Konfiguration wieder ein; Teil-Subscriptions werden bereinigt. Module Loader `reload()` lässt nach fehlgeschlagenem Remount keine scheinbar aktive Modulinstanz zurück und bewahrt die Fehlerdiagnose.
- **Nachweise:** Fehler-Injection-Unit-Tests auf echten Provider-Lebenszyklen und Module Loader, plus unveränderter Chromium-Gesamtsystemtest. CI `validate` und `browser-smoke` beide erfolgreich: [Run 38065899365](https://github.com/MarkusAureliusTeuton/JamesUI/actions/runs/38065899365), Commit `7ff1996c6`.
- **Offene Architekturprüfung:** Der generische Dashboard Page Composer importiert noch Modul-Integrationsbestandteile; außerdem ist die vollständige Fehler-Wiederherstellung des Wetterproviders separat zu prüfen. G1–G6 weiterhin nicht insgesamt abgenommen; Real-HA, KNX und Tablet weiterhin ungetestet.

## Lifecycle- und Kompositionsgrenze (2026-10-10)

- **G1 – Dependency Inversion:** Generischer Dashboard-Composer bekommt Layout/Widget-/Katalog-/Resource-Integrationen über explizite Funktionen; die fachlichen Imports sind zentral in `modules/dashboard-composition.js`. Architekturregression prüft die Core-Modul-Grenze.
- **G3 – Rückfall bei Provider-Update:** Kalender und Todo (vorheriger Stand) sowie nun Wetter stellen bei fehlerhaften Subscribe-Bindings die vorherige Laufzeit wieder her. Beim Wetter sind alte Quelle/Subscriptions, eine bestehende Timer-Instanz und danach vollständige Bereinigung gezielt getestet.
- **G4 – Browser/Unit:** Bereits vorhandene Tests wurden auf die neue Composer-Composition umgestellt; gezielte Core-Contract-Tests prüfen fehlende und unvollständige Injection.
- **Nicht geschlossen:** Die grüne CI bestätigt eine simulierte Umgebung, keine Live-HA-End-to-End-Verifikation. G5/G6 und finale Modul-/Geräteabnahme offen, spätere Blöcke 15–21 nicht freigegeben.

## Asynchrone Lebenszyklen und lokale Config-Konsistenz (2026-10-10)

- **G1/G3:** Schnelles Entfernen und Rückgängig während eines laufenden Widgetimports erzeugt eine neue unabhängige Importgeneration. Späte Antworten früherer Generationen können weder dessen neue Modulinstanz löschen noch deren Health-Meldung verändern. Ein kombinierter Grid/Module-Loader/Widget-Host-Test weist dies nach.
- **G2:** Config-Store-Client ordnet direkte CAS-Writes und danach angefragte Reads; dadurch kann keine verspätete Lesebestätigung einen zuvor abgeschlossenen Schreibvorgang lokal verdecken. Queue-Tests decken Zweitschreibvorgänge, Revisionen und Recovery nach einer Serverablehnung ab.
- **Automatisierter Nachweis:** `validate` + Chromium `browser-smoke` grün in [Run 38069408258](https://github.com/MarkusAureliusTeuton/JamesUI/actions/runs/38069408258), Commit `7708a784b`.
- **G5/G6 weiterhin offen:** Tests arbeiten mit simulierten HA-Quellen. Keine Live-HA-/KNX-/Tablet-Freigabe und keine Arbeit an Blöcken 15–21.
