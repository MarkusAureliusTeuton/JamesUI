# JamesUI 1.0 – Next Chat / New ChatGPT Project Handover

_Date: 2026-10-05_

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
6. `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`
7. `docs/superpowers/specs/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda-design.md`
8. `docs/superpowers/plans/2026-10-04-jamesui-1.0-block-11-calendar-tasks-agenda.md`
9. inspect only files relevant to the active block

`docs/JAMESUI_1_0_BLOCK_11_PLANNING_NOTES.md` is now a historical planning record; the approved Block-11 spec/plan and merged code/tests are binding.

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
- Block 11 – Calendar/task providers + `widget.calendar-agenda` ✅ PR #23

Block 11 merge: `63e0b8dc6072eed885f591161180f7082f6f7f2c`.
Final branch run `37284834614` and merged-main run `37285828629` both passed.

r11 is still production/reference. The new runtime has not been cut over.

**Next formal gate: Block 12 – House capability providers + House Quick widget. No Block-12 product code has started.**

## Current architecture

Foundation rules remain binding:
- pages select layout instances
- layouts arrange regions/slots and do not know Home Assistant
- widgets consume capabilities/actions
- provider modules own HA-backed data subscriptions/normalization
- user/control commands go through Action Registry
- lifecycle: `create(context, config)`, `mount(target)`, `update(nextContext, nextConfig)`, `destroy()`
- layout/widget context: `events`, `overlays`, `capabilities`, `actions`, `module`
- provider/action context additionally receives `homeAssistant`
- no raw `hass`, Router, Health, Config Service, Design System or Registry/Loader in normal modules

Configuration remains one versioned `.storage` store with `pages`, `layouts`, `widget_instances`, `dynamic_buttons`, `data_sources`, `module_settings`.

## Completed Block-11 contracts to preserve

- `calendar.events` is range-based and uses validated HA timezone metadata
- `tasks.items` is a live normalized snapshot of explicitly configured Todo lists
- `task.update` owns Todo mutation translation; Agenda never calls HA Todo services directly
- Agenda supports `grouped`, `timeline`, `day`
- direct task completion + exact 5 s Undo + supported task editing are implemented
- overdue carry-forward, all-day/multi-day projection, duplicate collapse/provenance and source-specific failures are implemented
- JamesUI-owned advance notices are implemented; source reminder metadata is never fabricated
- fixed/auto complete-row sizing respects host allocation and internal overflow
- multiple direct Agenda instances are isolated; generic Loader/page instance orchestration remains Block 14
- icon registry now contains 46 semantic IDs

## Layout direction to preserve

Read `docs/JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md`.

Important:
- page-level scrolling belongs to the selected layout
- `fixed` layouts stay inside the available viewport; child overflow belongs inside widgets where supported
- `vertical` layouts may grow/page-scroll
- do not force every page into one universal full-page grid
- Start remains `layout.home-hero-deck`: hero above, lower widget deck below
- final Start lower-deck grid, generic widget-instance placement and composed OnePlus/Fully acceptance remain Block 14

## Block 12 gate

Block 12 should add **House capability providers + House Quick widget**, not final Start composition.

Proceed in this order:
1. inspect current repository contracts and retained r11 house/status behavior
2. identify the real HA/KNX-backed entities/data needed for the compact House Quick presentation
3. separate read capabilities from user actions; do not leak raw HA into the widget
4. clarify only genuinely open product decisions, one at a time
5. compare architectural approaches where there is a real ownership choice
6. write/approve a Block-12 design/spec if the provider/widget contract is architectural enough to require it
7. create/approve a detailed implementation plan before product code
8. implement on an isolated branch with TDD
9. whole-branch review, fresh unchanged-head CI, merge, then verify main CI

Do not implement Dynamic Buttons (Block 13), final Start composition/grid (Block 14), later page migrations or production cutover inside Block 12.

## Working preferences / AI rules

- German, concise, technical, direct.
- Every JamesUI response begins `✅ Fertig:`, `⚠️ Test nötig:` or `🚧 Nicht fertig:`.
- Every response ends with a short summary.
- Repository edits directly through GitHub when available; do not give the user manual copy/paste instructions for changes the assistant can perform itself.
- The repository is the source of truth; do not work from old chat memory when current repository documents exist.
- Do not re-ask decisions that are already settled in the current conversation or repository.
- During design/clarification, ask only one genuinely open product/design question at a time.
- Short approvals such as `ok`, `passt`, `ja` or `freigegeben` apply to the immediately preceding concrete proposal/gate unless the context clearly says otherwise; do not ask for the same approval again.
- Work one roadmap block at a time.
- TDD is mandatory for behavior changes; intentionally red tests never go to `main`.
- Draft PRs should not spam failed-CI mails for intentional RED states; run full CI at meaningful green checkpoints.
- Approved green work may be merged without repeated repository confirmation when the user has already given the relevant merge/plan approval.
- No monkey-patches, Prototype overrides, version-polish files/layers, parallel implementations or permanent legacy shims.
- OnePlus Pad 2 portrait is the primary visual target; Fully is only the kiosk shell.
- Persist confirmed product/cross-block decisions in the appropriate repository document, but batch conversational design decisions where frequent repository writes would slow the discussion.
- Keep tool traffic compact to protect the input stream: prefer targeted file reads, targeted failed steps and compact status checks over full logs or repeated broad repository reads.
- Bundle related repository/tool work into meaningful checkpoints instead of narrating every micro-step or emitting a status message after every individual tool call.
- When debugging CI, read the smallest failing step/log segment that can identify the cause; do not stream complete logs unless necessary.
- After a merged block, update status/roadmap/handover documentation once in a clean consolidated pass and verify there are no stale active statements for the completed block.

## Fresh-chat prompt

```text
Wir setzen mein Projekt JamesUI aus dem Repository MarkusAureliusTeuton/JamesUI fort.

Arbeite nicht aus Erinnerung. Lies zuerst PROJECT_STATUS.md, die Foundation-Spec, die Execution Roadmap, die Baseline, JAMESUI_1_0_NEXT_CHAT.md und JAMESUI_1_0_LAYOUT_PLANNING_NOTES.md. Lies danach die Block-11-Spec/den Block-11-Plan als zuletzt abgeschlossenen Architekturblock und nur die Dateien, die du für den aktiven Block brauchst.

Variante B ist verbindlich. Blocks 0–11 sind abgeschlossen und auf main. Block 11 wurde mit PR #23 gemergt; finaler Branch- und main-CI waren grün. r11 läuft weiterhin produktiv; kein Cutover.

Nächster Gate ist Block 12: House capability providers + House Quick widget. Prüfe zuerst den aktuellen Repository-Stand und das retained r11-Haus/Status-Verhalten. Definiere saubere Capability-/Action-/Widget-Grenzen, bevor Produktcode geschrieben wird. Dynamic Buttons gehören in Block 13, finale Start-Komposition/Grid/Multi-Instance-Orchestrierung in Block 14.

Wichtig: Deutsch, kurz und technisch sauber. Repository direkt bearbeiten, wenn GitHub-Zugriff vorhanden ist; keine manuellen Copy/Paste-Anweisungen für Änderungen, die du selbst ausführen kannst. Bereits entschiedene Fragen nicht erneut stellen. Bei offenen Designfragen immer nur eine Frage gleichzeitig. Kurze Antworten wie ok/passt/freigegeben gelten als Freigabe des unmittelbar vorherigen konkreten Vorschlags. TDD für Verhaltensänderungen; rote Tests nie nach main. Keine Monkey-Patches, Prototype-Overrides, Versions-Polish-Dateien, parallelen Implementierungen oder dauerhaften Legacy-Krücken. OnePlus Pad 2 Hochformat ist das primäre Ziel; Fully ist nur die Kiosk-Hülle. Halte Tool-/Log-Ausgaben kompakt, bündele Repo-Arbeit in sinnvolle Schritte und lies bei CI-Fehlern nur den kleinsten nötigen Fehlerausschnitt, damit der Input-Stream stabil bleibt.
```
