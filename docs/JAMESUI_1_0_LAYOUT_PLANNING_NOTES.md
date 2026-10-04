# JamesUI 1.0 – Layout Planning Notes

_Date: 2026-10-04_
_Status: persistent cross-block layout requirements; not yet a formal implementation spec_

This file records layout-level requirements that apply beyond one widget or one page. It complements the approved foundation rule that a page selects a layout and the layout owns visual arrangement. Future JamesUI chats that change page/layout behavior must read and update this file so cross-page layout decisions do not remain only in chat memory.

## Layout owns page scroll behavior

Page scrolling is not a global application rule and not a permanent Start-page rule. It belongs to the selected layout instance.

A layout must declare its page-level vertical behavior explicitly. Initial required modes:

- `fixed` – the layout is bounded to the available application viewport; the page itself does not vertically scroll
- `vertical` – the layout may grow vertically and the page may scroll through its content

A page therefore becomes scrollable or non-scrollable because of the selected/configured layout, not because of its route name.

For a `fixed` layout:

- all layout regions must stay inside the available viewport above the persistent bottom navigation
- a widget must stay inside the region/grid area allocated by the layout
- content overflow may be handled inside the widget when the widget supports internal scrolling
- a widget may not force the page itself to grow beyond the fixed layout boundary

For a `vertical` layout:

- the layout may extend beyond one viewport and use normal page-level vertical scrolling
- widgets may still receive explicit grid spans/min/max sizes where the layout design requires them

The exact configuration property names and schema belong in the later formal layout/configuration spec.

## Region-based layouts instead of one universal page grid

Do not force every page into one monolithic full-page grid. A layout may define multiple structural regions and may embed a grid only where useful.

This is the preferred model for the Start page because its approved visual language has two fundamentally different areas:

1. a full-width global/hero presentation region
2. a lower widget deck region

The upper area is intentionally not treated like an ordinary dashboard-widget grid cell. The lower area is where configurable widget placement/sizing needs the grid.

Other page layouts may use different structures, including:

- a full-page widget grid
- a vertically scrollable full-page grid
- fixed header/detail regions plus a widget grid
- split-pane/detail-control layouts
- room/device-specific layouts introduced when later page migrations require them

Do not implement speculative layout variants before a real page requires them, but preserve the layout contract so these variants can be added without changing widget contracts.

## Reusable widget instances across pages

A widget **module** is reusable code; a widget **instance** is one configured placement of that module.

The same widget module must be instantiable multiple times on the same page or on different pages. Every instance must have:

- its own stable instance ID
- its own widget configuration
- its own selected data-source subset where the widget supports source selection
- its own presentation/interaction settings
- its own layout placement and grid span/region assignment
- independent lifecycle state

Changing one instance must not silently change another instance of the same widget module.

Examples:

- two `widget.calendar-agenda` instances may use different calendars/task lists and different presentation modes
- one Agenda instance may enable tasks while another disables them
- later generic widgets such as Dynamic Buttons may also have different configured content per instance

Shared providers remain shared. Reusing a widget module must not require cloning its provider architecture; instances consume shared capabilities and independently select/filter/present the data they need.

This rule is already compatible with the foundation configuration model's top-level `widget_instances` section and must be preserved by the page/layout configuration experience in Block 14 and later pages.

## Start layout – `layout.home-hero-deck`

The existing `layout.home-hero-deck` remains the Start layout family. The current stable slot contract from Block 8 remains valid unless a future approved spec deliberately migrates it.

The Start composition follows the approved mockup:

### Full-width hero/global region

The top area spans the full page width and carries the Alpine weather presentation. The `widget.weather-today` remains the owner of weather-domain presentation; the layout only provides the full-width region.

The visible composition includes the existing hero elements such as:

- changing Alpine/weather/time-of-day background
- date/time/location presentation
- current condition and temperature
- full-width weather fact strip such as high/low, rain, wind, sunrise, sunset and moon

These are not Core-owned fixed fields. They remain widget/domain content hosted inside a layout-defined full-width region.

### Lower widget region

Below the hero/weather region sits the lower Start widget deck containing, initially:

- Calendar / Agenda
- House Quick / Hausstatus
- Dynamic Buttons / scenes

This lower region should use a shared raster/grid system for widget allocation and sizing.

The grid is local to the lower widget region rather than stretching through the hero. Named Start slots may map onto grid areas/spans; using a grid internally does not require discarding the stable slot/lifecycle contract.

## Grid sizing contract

The layout grid must support configuration in logical grid units rather than arbitrary pixel heights.

Requirements:

- widgets can receive width/height spans from the layout
- manual maximum widget height is expressed through layout/grid span, not raw pixels
- height-aware widgets can derive their own visible capacity from the actual allocated region height
- changing widget content must not silently change its allocated grid span
- layouts may define their own column/row structure appropriate to their design
- a later shared grid primitive may standardize placement mechanics, but each layout remains responsible for which regions are gridded and what its structural rules are

The exact Start grid dimensions / row-unit count are still open and must be chosen from the composed OnePlus Pad 2 portrait layout, not from an arbitrary round number.

## Interaction with Block 11 Agenda

`widget.calendar-agenda` must not own or assume page scrolling. It only reacts to the height allocated by its host layout.

- `visible_items_mode = fixed` uses configured row count within the allocated region
- `visible_items_mode = auto` derives how many complete agenda rows fit in that allocated region
- if the host/layout bounds the widget and more agenda content exists, overflow remains inside the Agenda through its own vertical scrolling
- the widget must not resize its parent layout to make more rows fit

This same widget contract must remain valid if the Agenda is later placed on a different, vertically scrollable page layout.

## Block ownership

- Block 11: Agenda respects host bounds, supports fixed/automatic visible-row capacity and exposes per-instance source/presentation configuration.
- Block 14: define the page/layout configuration experience, formalize layout scroll behavior and the Start lower-deck grid, preserve generic multi-instance widget placement/configuration, and compose the approved Start page.
- Later page migrations: introduce additional layout modules/variants only when those pages need them, using the same layout-level scroll/grid and widget-instance principles.

## Persistent AI/chat rule

Future JamesUI chats must record new confirmed cross-page layout rules, widget-instance rules, layout variants, scroll semantics and deferred layout requirements in this file (or a later canonical spec that explicitly supersedes it). Do not leave such decisions only in chat summaries.

If a later decision supersedes an item here, update/remove the old active wording rather than accumulating contradictory rules.
