# JamesUI Next

Eigenständige Home-Assistant-Oberfläche für ein KNX-/Home-Assistant-Haus, entwickelt für das OnePlus Pad 2 im Hochformat.

## Architektur und aktueller Stand

- **Nur JamesUI Next.** Der Menüeintrag `JamesUI` unter `/jamesui` lädt ausschließlich `jamesui-entry.js` und `jamesui-app.js`; kein r11-Loader, keine alte Oberfläche und keine Legacy-Fallbacks.
- **Daten:** Home Assistant stellt Zustände, Kalender, Aufgaben, Wetter und Aktionen bereit. Die Entitätsbindungen werden im neuen Dashboard konfiguriert, niemals aus r11 übernommen.
- **Konfiguration:** Versionierter, atomarer Home-Assistant-Speicher `jamesui.next.config`; ausschließlich die strukturierten WebSocket-Befehle `jamesui/config/get` und `jamesui/config/replace`.
- **Startseite:** Wetter-Hero, Kalender-/Aufgaben-Widget, Hausstatus und dynamische Buttons. Freies 12-Spalten-Raster, Editor mit Speichern, Rückgängig und mehreren Widget-Instanzen.
- **Navigation:** Die fünf Zielbereiche Start, Haus, Klima, Medien und Tür bleiben sichtbar. Derzeit ist **nur Start** in JamesUI Next funktionsfähig. Die anderen Seiten werden nicht als funktionsfähig vorgetäuscht.
- **Grafiken:** Lokale Alpine-WebP-Hintergründe; keine alten r11-Wetter-SVGs.
- **Qualität:** Unit-/Integrationsprüfungen sowie Chromium-Browsertests mit simulierten HA-Quellen. **Noch keine Abnahme mit realem HA/KNX oder auf dem OnePlus Pad 2/Fully Kiosk.**

Die Anwendung wird **nicht aus dem alten r11-Projektzustand aufgebaut**. Nicht mehr verwendete r11-Programmdateien, deren Assets und Tests wurden aus dem Entwicklungsbranch entfernt. Historische Dokumente und Git-Verlauf dienen ausschließlich als Archiv, nicht als Laufzeitquelle.

## Home Assistant Installation

Die bereinigte Version liegt zunächst im Entwicklungsbranch `feat/jamesui-1-0-block-14-start-configuration` und in Draft-PR #27. **Ein normales HACS-Update von `main` installiert nicht automatisch den Entwicklungsbranch.**

Für eine separate Testinstallation `custom_components/jamesui` aus dem geprüften Branch nach `/config/custom_components/jamesui` übernehmen, vorher die Home-Assistant-Konfiguration sichern, Home Assistant neu starten und die bestehende JamesUI-Integration laden beziehungsweise einmalig unter Einstellungen → Geräte & Dienste hinzufügen. Danach `/jamesui` als Administrator öffnen und die vier Startmodule mit echten HA-Quellen konfigurieren.

Diese Version verwendet **nicht** das alte `jamesui.config`, sondern den eigenen Speicher `jamesui.next.config`. Die bisherige Konfiguration wird nicht importiert.

## Entwicklung und Freigabe

- Der Feature-Branch und Draft-PR #27 sind die aktive Entwicklungsbasis.
- GitHub Actions: Python, Frontend, Architektur-/Modultests und Chromium-Browser-Szenarien.
- Erst reale HA-/KNX-Daten prüfen, dann visuelle und Touch-Abnahme auf dem OnePlus Pad 2/Fully; erst danach eine reguläre Freigabe.
- Maßgebliche Nachweise und Grenzen: `PROJECT_STATUS.md` und `docs/JAMESUI_NEXT_ACCEPTANCE_GATES.md`.

