# JamesUI 1.0 – Next Chat / New ChatGPT Project Handover

_Date: 2026-10-04_

Use this document to start a fresh JamesUI conversation without relying on old chat history. The repository is the source of truth.

## Canonical repository

`MarkusAureliusTeuton/JamesUI`

Default branch: `main`

## Required reading order

1. `PROJECT_STATUS.md`
2. `docs/superpowers/specs/2026-10-02-jamesui-1.0-foundation-design.md`
3. `docs/JAMESUI_1_0_EXECUTION_ROADMAP.md`
4. `docs/JAMESUI_1_0_BASELINE.md`
5. `docs/JAMESUI_1_0_NEXT_CHAT.md`
6. `docs/JAMESUI_1_0_BLOCK_11_PLANNING_NOTES.md`
7. `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`
8. `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-8-home-hero-deck-design.md`
9. `docs/superpowers/specs/2026-10-03-jamesui-1.0-block-9-weather-provider-design.md`
10. `docs/superpowers/specs/2026-10-04-jamesui-1.0-block-10-weather-today-design.md`
11. `docs/superpowers/plans/2026-10-04-jamesui-1.0-block-10-weather-today.md`
12. inspect only files relevant to the active block

The Block-11 and Layout planning notes are mandatory reading while Block 11 is being designed. New confirmed product decisions, deferred requirements and cross-page layout rules must be persisted in the appropriate repository note; do not leave them only in chat memory.

## Binding direction

Variant B remains binding:

- build the clean JamesUI 1.0 runtime in parallel
- r11 remains production/reference until controlled cutover
- port desired behavior, not legacy architecture
- delete obsolete legacy implementation after cutover
- Git history is the archive
- no normal feature development on r11

## Current execution state

Completed and merged:

- Block 0 – Baseline ✅
- Block 1 – Core shell ✅ PR #13
- Block 2 – Module system ✅ PR #14
- Block 3 – Capability/Action registries ✅ PR #15
- Block 4 – Home Assistant Adapter ✅ PR #16
- Block 5 – Versioned Config Store + migrations ✅ PR #17
- Block 6 – Design System + base components ✅ PR #18
- Block 7 – Icon Library + Asset Registry ✅ PR #19
- Block 8 – `layout.home-hero-deck` ✅ PR #20
- Block 9 – `provider.weather` ✅ PR #21
- Block 10 – `widget.weather-today` + forecast overlay ✅ PR #22

Block 10 merge: `f8abbbb28588e210e87727f5fcb3a68984766887`.

r11 is still production/reference. The new runtime has not been cut over.

**Next formal gate: Block 11 – Calendar/task providers + Agenda widget. No Block-11 product code has started.**

## Current architecture

Foundation rules remain binding:

- pages select layout instances
- layouts arrange regions/slots and do not know Home Assistant
- widgets consume capabilities
- provider modules own data subscriptions/normalization
- user/control commands go through Action Registry
- module lifecycle: `create(context, config)`, `mount(target)`, `update(nextContext, nextConfig)`, `destroy()`
- layout/widget context: `events`, `overlays`, `capabilities`, `actions`, `module`
- provider/action context additionally receives `homeAssistant`
- no raw `hass`, Router, Health, Config Service, Design System or Registry/Loader in normal modules

Configuration remains one versioned `.storage` store with `pages`, `layouts`, `widget_instances`, `dynamic_buttons`, `data_sources`, `module_settings`.

## Layout clarification – binding planning direction

Read `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`.

Important:

- page-level scroll behavior belongs to the selected **layout**, not globally to the application or route
- initial layout behaviors: `fixed` and vertically scrollable (`vertical`)
- a `fixed` layout stays inside the available viewport; child overflow belongs inside widgets where supported
- a `vertical` layout may grow and use page-level vertical scrolling
- layouts may contain multiple structural regions; do not force every page into one universal full-page grid

For Start, the approved mockup is represented as a specialized `layout.home-hero-deck` family:

- upper full-width hero/global presentation region for `widget.weather-today`
- Alpine/weather/time-of-day background and weather fact strip remain Weather widget/domain content, not Core-owned fields
- lower widget deck contains Agenda, House Quick and Dynamic Buttons
- the lower deck gets a logical widget grid/raster for placement and spans
- grid sizing uses logical units/spans, not arbitrary pixel heights
- exact grid dimensions are still open and must be chosen from the composed OnePlus Pad 2 portrait design

Other layouts may later use a full-page grid, scrollable grid, split/detail structure, etc. Add them only when a real page needs them.

## Block 11 confirmed product direction

Read the full binding planning record in `docs/JAMESUI_1_0_BLOCK_11_PLANNING_NOTES.md` before asking already-answered questions.

Current confirmed direction includes:

- `provider.calendar` + `provider.tasks` + `widget.calendar-agenda`
- only explicitly configured `calendar.*` / `todo.*` sources
- Agenda modes: `grouped`, `timeline`, `day`
- `day`: horizontal swipe changes calendar day; vertical scroll handles entries within that day; empty days remain visible
- day header example: `Heute · So, 4. Oktober`
- global calendar look-ahead = 30 days, optionally overridden per calendar
- task `lookahead_days = 0` means unrestricted/not applicable
- visible-row modes: `fixed` and `auto`
- fixed default = 5, allowed 3–8
- auto derives complete visible rows from host-allocated widget height
- Agenda does not own page scroll behavior; it respects its host layout
- vertical point/line timeline; dashed line continuation indicates additional hidden entries above/below, replacing separate up/down arrows
- task ordering globally configurable: chronological / tasks before / tasks after; untimed before/after applies only to chronological mode
- completed tasks disappear; completion offers short Undo
- overdue incomplete tasks are presented under Today without modifying provider due date and without special overdue styling
- row geometry remains fixed; title consumes remaining width and ellipsizes
- optional `show_location` reserves stable second-line geometry
- event tap opens detail overlay with real available fields only
- calendar default icon/accent plus ordered event rules that can override both; title default matching, optional description/location scope
- future task editing is required and the normalized model must preserve source/list/UID and editable fields
- reminder/advance-notice behavior is important and remains open; never invent unavailable reminder metadata

## Block 11 design gate

Block 11 is now architectural enough that the design/spec gate must be completed before product code.

Continue in this order:

1. inspect actual HA adapter, Config Store, Capability/Action contracts and retained r11 calendar behavior
2. verify current Home Assistant Calendar/Todo APIs needed for events, todo items, completion/Undo and source identity
3. resolve remaining design questions one at a time; do not re-ask confirmed items from the planning notes
4. compare 2–3 viable architecture approaches where a real architectural choice remains, especially task update/action ownership
5. write the binding Block-11 design/spec under `docs/superpowers/specs/`
6. self-review spec and ask user to review/approve it
7. only then create the detailed implementation plan under `docs/superpowers/plans/`
8. get plan approval before implementation
9. implement in an isolated branch with TDD, whole-branch review and fresh CI

Do not implement House Quick, Dynamic Buttons, final Start composition, production bootstrap switch or cutover in Block 11.

## Working preferences / AI rules

- German, concise, technical, direct
- every JamesUI response begins `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:`
- every response ends with a short summary
- repository edits directly through GitHub when available
- repository is source of truth; do not work from old chat memory when current docs exist
- one roadmap block at a time
- TDD for behavior changes; intentionally red tests never to `main`
- approved green work may be merged without repeated repository confirmation
- no monkey-patches, Prototype overrides, version-polish files, parallel implementations or permanent legacy shims
- OnePlus Pad 2 portrait is primary visual target; Fully is kiosk shell only
- when a new confirmed product decision or future requirement appears, persist it in the repository in the same work sequence
- when AI/agent handling rules change, persist those too

## Fresh-chat prompt

```text
Wir setzen mein Projekt JamesUI aus dem Repository MarkusAureliusTeuton/JamesUI fort.

Arbeite nicht aus Erinnerung. Lies zuerst PROJECT_STATUS.md, die Foundation-Spec, die Execution Roadmap, die Baseline, JAMESUI_1_0_NEXT_CHAT.md, JAMESUI_1_0_BLOCK_11_PLANNING_NOTES.md und JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md. Lies danach die relevanten Block-8-/9-/10-Specs und nur die Dateien, die du für den aktiven Block brauchst.

Variante B ist verbindlich. Blocks 0–10 sind abgeschlossen und auf main. r11 läuft weiterhin produktiv; kein Cutover.

Nächster Gate ist Block 11: provider.calendar + provider.tasks + widget.calendar-agenda. Die bisherigen Produktentscheidungen stehen in der Block-11-Planungsnotiz; frage sie nicht erneut ab. Die Layout-/Scroll-Regeln stehen in der Layout-Planungsnotiz. Page-Scrolling ist eine Layout-Eigenschaft, keine globale Startseitenregel.

Block 11 ist noch in der Design-/Spec-Phase. Schreibe keinen Produktcode vor Spec- und Planfreigabe. Kläre die verbleibenden Punkte, prüfe die echten Home-Assistant-Kalender-/Todo-Verträge und halte neue bestätigte Entscheidungen sowie spätere Anforderungen im Repository fest.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist. TDD für Verhaltensänderungen; rote Tests nie nach main. Keine Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle.
```
