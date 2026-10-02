# JamesUI 1.0 – Next Chat / New ChatGPT Project Handover

_Date: 2026-10-02_

Use this document to start a completely fresh conversation or a dedicated ChatGPT Project without relying on old chat history.

## Canonical repository

`MarkusAureliusTeuton/JamesUI`

Default branch: `main`

The repository is the source of truth. Do not reconstruct architecture from memory when these files are available.

## Required reading order for a new chat

1. `PROJECT_STATUS.md`
2. `docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`
3. `docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`
4. inspect current production files only when a specific block needs them

The r11 implementation is a design/reference runtime only. The approved strategic direction is **Variant B: clean JamesUI 1.0 foundation in parallel, controlled cutover, then delete the old implementation**.

## Current process state

Architecture direction has been approved conversationally and written into the repository.

The next formal gate is **review/approval of the written architecture specification**. After that approval, create the detailed implementation plan for **Block 0 – Baseline and preservation tests** from the execution roadmap.

Do not start product-code implementation before that detailed block plan has been reviewed according to the project workflow.

## Working preferences

- German communication
- concise technical collaboration
- repository changes should be done directly through GitHub when access is available
- do not ask the user to manually copy/paste code when repository edits can be made directly
- approved green work should be merged to `main` without repeatedly asking whether repository changes are desired
- one implementation block at a time
- TDD for behavior changes
- intentionally red tests never go to `main`
- keep `PROJECT_STATUS.md` and roadmap status current after substantive work
- OnePlus Pad 2 portrait is the primary visual acceptance target
- Fully is the normal kiosk/display shell, but the frontend architecture should not depend on Fully
- Home Assistant is the backend/source of truth; KNX remains the main building-automation layer
- no new monkey-patches, version-specific polish layers, duplicate implementations or permanent compatibility shims

## Product goal in one paragraph

JamesUI is a permanent wall-tablet interface that shows important household information at a glance and gives fast access to common KNX/Home Assistant controls, while also allowing deeper control pages for functions such as ventilation schedules, heating modes, shutters, appliances, media and door/camera functions. The application must be modular: pages select layouts, layouts expose slots, widgets consume registered capabilities, actions are dispatched through an Action Registry, configuration is structured/versioned/migratable, modules have independent versions and lifecycles, and the visual language comes from one design system and icon library.

## Start page direction to preserve

The current visual direction is intentional:

- persistent bottom navigation `Start | Haus | Klima | Medien | Tür`
- upper Alpine/weather hero
- weekday/date + large time
- current temperature and weather
- max/min, rain/time, wind/storm, snow relevance, sunrise/sunset, moon
- tap current temperature for forecast overlay without layout shift
- lower shared widget deck starting below/overlapping the hero and extending to the bottom navigation
- deck top corners rounded, bottom corners square
- Calendar on the left
- House Quick on the right
- four configurable Dynamic Buttons below House Quick
- subtle dark/translucent gradient and warm shimmer line
- no labels `Home`, `HEUTE & DANACH`, `ZUHAUSE`

## Dynamic Buttons direction

Dynamic Buttons are reusable configured action buttons, not special hard-coded scene controls.

Configurable presentation:
- text
- pictogram
- pictogram color
- background preset
- text color

Configurable action:
- entity toggle
- HA service
- scene
- JamesUI navigation
- URL

Initial visual presets:
- Ankommen
- Abend
- Kino
- Alles aus

The user manually assigns four created buttons to the Start page’s dynamic-button area.

## Legacy policy

Keep old r11 only until the new architecture reaches the cutover gate. After cutover, delete obsolete production code and assets. Git history is the archive.

Expected old files to be removed/superseded at cutover include the monolithic old panel, old Start modules, r11 polish layer, unused legacy weather SVGs, Klima demo data, doorbell demo and release-patch-specific tests.

## Copy/paste start prompt for a fresh chat

```text
Wir setzen mein Projekt JamesUI aus dem Repository MarkusAureliusTeuton/JamesUI fort.

Bitte arbeite NICHT aus Erinnerung oder aus alten Chat-Zusammenfassungen, sondern lies zuerst im Repository in dieser Reihenfolge:
1. PROJECT_STATUS.md
2. docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md
3. docs/JAMESUI_1_0_EXECUTION_ROADMAP.md
4. docs/JAMESUI_1_0_NEXT_CHAT.md

Wir haben uns für Variante B entschieden: eine neue saubere modulare JamesUI-1.0-Basis parallel aufbauen, danach kontrolliert umschalten und die alte r11-Architektur vollständig löschen. Der bestehende r11-Stand ist bis dahin nur Design-/Verhaltensreferenz und soll nicht weiter mit normalen Features bepflastert werden.

Wichtig für die Zusammenarbeit:
- Deutsch, kurz und technisch sauber.
- Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist.
- Keine manuellen Copy/Paste-Anweisungen an mich, wenn du selbst committen kannst.
- Einen Programmierblock nach dem anderen bearbeiten.
- TDD; absichtlich rote Tests niemals nach main.
- Fertige grüne freigegebene Arbeit nach main integrieren und PROJECT_STATUS.md sowie die Roadmap aktualisieren.
- Keine neuen Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken.
- OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.

Prozessstand: Die Architekturrichtung ist freigegeben und die schriftliche Spezifikation liegt jetzt im Repository. Lies sie vollständig, prüfe sie auf Widersprüche/Unklarheiten und gib mir zuerst eine kurze Zusammenfassung der verbindlichen Zielarchitektur sowie eventuelle konkrete Punkte, die vor der endgültigen Spec-Freigabe noch geklärt werden müssen. Wenn nichts Wesentliches offen ist, sag mir klar, dass als nächster Schritt die Freigabe der schriftlichen Spec und danach der detaillierte Implementierungsplan für Block 0 ansteht. Noch keinen Produktcode ändern.
```

## Recommended dedicated ChatGPT Project name

`JamesUI 1.0`

Optional Project instruction text:

```text
Dieses Projekt dient ausschließlich der Entwicklung von JamesUI im Repository MarkusAureliusTeuton/JamesUI. Das Repository ist die Quelle der Wahrheit. Zu Beginn eines Chats zuerst PROJECT_STATUS.md und die dort referenzierten aktuellen Architektur-/Roadmap-Dateien lesen. Änderungen direkt im Repository durchführen, TDD verwenden, immer nur einen Roadmap-Block gleichzeitig umsetzen und nach erfolgreicher Validierung PROJECT_STATUS.md/Roadmap aktualisieren. Keine parallelen Legacy-Implementierungen oder Monkey-Patches einführen. Primäres Zielgerät ist das OnePlus Pad 2 im Hochformat; Home Assistant ist Backend, KNX die primäre Gebäudeautomation, Fully nur die Kiosk-Hülle.
```
