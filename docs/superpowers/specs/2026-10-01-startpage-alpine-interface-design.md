# JamesUI Start Page – Alpine Interface Design

Date: 2026-10-01
Status: Approved design direction, pending implementation plan

## Intent

The JamesUI Start page should become a bespoke wall-tablet interface rather than a generic smart-home dashboard. The primary goal is fast comprehension of weather, time and home state, with a premium modern visual language inspired by the home's chalet / alpine-chic style.

The design must avoid two failure modes:

- a dominant artificial/fake apartment scene that makes the UI feel like a decorative render instead of a control surface
- a generic grid of rounded cards/tiles that looks like a standard consumer app or Lovelace dashboard

## Design direction

Use a restrained **Alpine Interface** concept.

The interface carries approximately 70–80% of the visual weight. Atmosphere/background carries approximately 20–30%.

The background should communicate outside conditions quickly and realistically:

- daytime / dusk / night
- sunny / cloudy / rainy / snowy / foggy conditions
- brightness and sky mood
- moon phase at night where useful

The background should primarily use sky, horizon, mountains, trees or subtle architectural/terrace silhouettes. It should not show a prominent fictional living room, sofa, fireplace or other invented interior scene.

## Visual language

Style should feel:

- premium
- calm
- modern
- tailored to a fixed wall tablet
- closer to a high-end vehicle/HMI or architectural control interface than a normal mobile app

Alpine-chic character comes from material cues rather than literal chalet imagery:

- anthracite / smoked glass
- subtle natural-stone texture
- very restrained warm wood influence
- champagne / warm-metal accent instead of bright orange
- fine separators and typography hierarchy
- soft atmospheric depth, not stacks of cards

## Layout principle

The Start page should read as one composed surface.

### Primary information zone

Prominent but clean presentation of:

- current time
- date / weekday
- current outdoor temperature
- weather condition
- high / low
- precipitation
- humidity
- wind
- illuminance
- sunrise / sunset

Most information should appear free in the composition with spacing and fine separators rather than each item being enclosed by a card.

### Home status

A compact home-status area should show only relevant state:

- "Alles ruhig" in the normal state
- notable deviations only when present
- optional indoor average temperature
- door/open state
- active media
- offline devices / low batteries where relevant

Warnings should receive subtle attention styling; normal conditions should remain visually quiet.

### Functional shortcuts

Avoid four large standalone tiles for Haus / Klima / Medien / Tür.

Instead, use a low-profile functional strip or aligned status/navigation group such as:

- Haus – 3 Lichter an
- Klima – 21,4 °C
- Medien – aus
- Tür – geschlossen

Each item remains clickable through the existing JamesUI navigation, but should look like part of the interface rather than like a button card.

### Moon

Moon information should remain secondary.

At night, the background may show the moon/phase if technically practical. A small textual moon note can remain in the information hierarchy. Do not return to a large dedicated moon card.

### Bottom navigation

Keep the approved primary navigation unchanged:

`Start | Haus | Klima | Medien | Tür`

The bottom navigation should visually integrate into the overall surface and remain highly usable on the OnePlus Pad 2 in landscape.

## Dynamic background behavior

The implementation should use the existing weather/time-of-day inputs where possible and select a restrained realistic background state.

Initial target states:

- day / clear
- day / cloudy
- day / rain
- day / snow
- dusk / twilight
- night / clear
- night / cloudy
- night / rain
- night / snow
- fog / low visibility

The first implementation may use a smaller practical subset if necessary, but the architecture should allow expanding to these states later.

The background must always remain subordinate to readability. It should be darkened, blurred or gradient-masked where needed behind text.

## Technical constraints

- Home Assistant remains source of truth.
- Keep existing JamesUI navigation and functional logic intact.
- Do not introduce hard-coded entity IDs for normal operation.
- Do not add unnecessary frontend frameworks or large dependencies.
- Keep the current guarded classic-script loader architecture intact.
- Prefer implementing the visual redesign in the existing `jamesui-home.js` enhancement path so the stable base panel remains isolated.
- Maintain responsive behavior, with the OnePlus Pad 2 landscape as the primary target.

## Testing / acceptance

Automated checks should cover at least:

- classic Home Assistant entrypoint remains valid
- home status summary logic remains functional
- the Start page enhancement can load without breaking base panel registration

Practical acceptance on the real installation:

1. JamesUI loads on laptop and Fully/OnePlus Pad 2.
2. Weather/time information is readable at a glance.
3. The background communicates outside conditions without dominating.
4. The page no longer reads as a grid of generic tiles.
5. Haus / Klima / Medien / Tür remain directly reachable.
6. Normal-state UI is calm; deviations are visually distinct but restrained.
7. Overall style feels closer to a bespoke alpine-premium wall interface than a generic Home Assistant dashboard.

## Out of scope for this redesign step

- full room-level Haus redesign
- final Klima implementation
- new media backend work
- doorbell backend reliability
- photorealistic modeling of the user's actual house/interior
- replacing the approved bottom navigation
