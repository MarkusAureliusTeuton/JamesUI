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

## Home Assistant Installation über HACS

Die Testversion **JamesUI Next v1.0.0b1** wird als GitHub-*Prerelease* von diesem Entwicklungsbranch veröffentlicht, **ohne Merge nach `main`**. Das Bereitstellen erfolgt über `.github/workflows/publish-next-beta.yml`; die Freigabe wird erst nach erfolgreichem vollständigem `Validate JamesUI` einschließlich Chromium-Browsertest ausgeführt.

1. In Home Assistant eine Sicherung anlegen.
2. In **HACS → JamesUI → ⋮ → Erneut herunterladen** öffnen.
3. **Beta-Versionen anzeigen** aktivieren und **v1.0.0b1** auswählen. Falls JamesUI noch nicht als HACS-Custom-Repository hinzugefügt wurde: `https://github.com/MarkusAureliusTeuton/JamesUI` vom Typ **Integration** hinzufügen.
4. Herunterladen und **Home Assistant neu starten**.
5. Über `/jamesui` die eigenständige Next-Anwendung öffnen und ihre vier Startmodule mit echten Home-Assistant-Daten verbinden.

**Wichtig:** Nicht versehentlich den Standardbranch `main` installieren: Er enthält noch nicht den isolierten Next-Betastand. Die Next-Konfiguration wird unabhängig in `jamesui.next.config` erzeugt; bestehende r11-Daten bleiben unangetastet. Die Beta ist technisch automatisiert getestet, jedoch noch **nicht** an realem HA/KNX oder dem OnePlus Pad 2/Fully Kiosk abgenommen.

## Entwicklung und Freigabe

- Der Feature-Branch und Draft-PR #27 sind die aktive Entwicklungsbasis.
- GitHub Actions: Python, Frontend, Architektur-/Modultests und Chromium-Browser-Szenarien.
- Erst reale HA-/KNX-Daten prüfen, dann visuelle und Touch-Abnahme auf dem OnePlus Pad 2/Fully; erst danach eine reguläre Freigabe.
- Maßgebliche Nachweise und Grenzen: `PROJECT_STATUS.md` und `docs/JAMESUI_NEXT_ACCEPTANCE_GATES.md`.

