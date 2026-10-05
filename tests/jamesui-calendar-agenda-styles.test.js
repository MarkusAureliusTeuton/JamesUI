import test from "node:test";
import assert from "node:assert/strict";

import { CALENDAR_AGENDA_STYLES } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/styles.js";

test("Agenda stylesheet is root-scoped and token-driven", () => {
  assert.match(CALENDAR_AGENDA_STYLES, /\[data-jui-widget="calendar-agenda"\]/);
  assert.doesNotMatch(CALENDAR_AGENDA_STYLES, /(^|\n)\s*(html|body|:root|\*)\s*\{/m);
  assert.doesNotMatch(CALENDAR_AGENDA_STYLES, /!important/);
  assert.doesNotMatch(CALENDAR_AGENDA_STYLES, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(CALENDAR_AGENDA_STYLES, /rgba?\s*\(/i);
  assert.doesNotMatch(CALENDAR_AGENDA_STYLES, /url\s*\(/i);
  assert.match(CALENDAR_AGENDA_STYLES, /var\(--jui-/);
});

test("Agenda styles expose stable row geometry, internal scrolling and too-small state", () => {
  assert.match(CALENDAR_AGENDA_STYLES, /data-jui-agenda-scroll/);
  assert.match(CALENDAR_AGENDA_STYLES, /overflow-y:\s*auto/);
  assert.match(CALENDAR_AGENDA_STYLES, /data-jui-agenda-row/);
  assert.match(CALENDAR_AGENDA_STYLES, /--jui-agenda-row-height/);
  assert.match(CALENDAR_AGENDA_STYLES, /data-jui-agenda-too-small/);
  assert.match(CALENDAR_AGENDA_STYLES, /text-overflow:\s*ellipsis/);
  assert.match(CALENDAR_AGENDA_STYLES, /white-space:\s*nowrap/);
});

test("Agenda styles contain focus-visible, timeline continuation and reduced-motion behavior", () => {
  assert.match(CALENDAR_AGENDA_STYLES, /:focus-visible/);
  assert.match(CALENDAR_AGENDA_STYLES, /data-jui-agenda-continuation/);
  assert.match(CALENDAR_AGENDA_STYLES, /border-(top|bottom):\s*[^;]*dashed/);
  assert.match(CALENDAR_AGENDA_STYLES, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("configured accents are consumed only through the Agenda custom property", () => {
  assert.match(CALENDAR_AGENDA_STYLES, /--jui-agenda-accent/);
  assert.match(CALENDAR_AGENDA_STYLES, /var\(--jui-agenda-accent,\s*var\(--jui-color-accent-strong\)\)/);
});
