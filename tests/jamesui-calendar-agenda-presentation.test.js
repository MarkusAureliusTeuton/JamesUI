import test from "node:test";
import assert from "node:assert/strict";

import {
  matchEventRule,
  presentationForEvent,
} from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/presentation.js";
import { validateCalendarAgendaConfig } from "../custom_components/jamesui/frontend/modules/widget.calendar-agenda/config.js";

function config(calendars) {
  return validateCalendarAgendaConfig({
    instance_id: "agenda-test",
    calendar_enabled: true,
    tasks_enabled: false,
    calendars,
    task_lists: [],
  });
}

test("matches exact contains and starts-with with de-DE case-insensitive collapsed whitespace", () => {
  const calendar = config([{
    entity_id: "calendar.family",
    rules: [
      { operator: "exact", query: " MÜLL ABHOLUNG ", icon_id: "home.waste" },
      { operator: "contains", query: "zahnarzt", icon_id: "home.task" },
      { operator: "starts_with", query: "Geburtstag", icon_id: "home.birthday" },
    ],
  }]).calendars[0];

  assert.equal(matchEventRule({ title: "  Müll   Abholung  " }, calendar).icon_id, "home.waste");
  assert.equal(matchEventRule({ title: "Termin beim ZAHNARZT morgen" }, calendar).icon_id, "home.task");
  assert.equal(matchEventRule({ title: "geburtstag Anna" }, calendar).icon_id, "home.birthday");
  assert.equal(matchEventRule({ title: "Kein Treffer" }, calendar), null);
});

test("title is always searched while description and location are opt-in additional fields", () => {
  const calendars = config([{
    entity_id: "calendar.family",
    rules: [
      { operator: "contains", query: "sondermüll", icon_id: "home.waste" },
      { operator: "contains", query: "Wertstoffhof", include_location: true, icon_id: "home.recycling" },
      { operator: "contains", query: "Papier", include_description: true, icon_id: "home.paper" },
    ],
  }]).calendars[0];

  assert.equal(matchEventRule({ title: "Sondermüll", description: null, location: null }, calendars).icon_id, "home.waste");
  assert.equal(matchEventRule({ title: "Abgabe", description: null, location: "Wertstoffhof Erding" }, calendars).icon_id, "home.recycling");
  assert.equal(matchEventRule({ title: "Abholung", description: "Papier blau", location: null }, calendars).icon_id, "home.paper");

  const noOptional = config([{
    entity_id: "calendar.family",
    rules: [{ operator: "contains", query: "Wertstoffhof", icon_id: "home.recycling" }],
  }]).calendars[0];
  assert.equal(matchEventRule({ title: "Abgabe", location: "Wertstoffhof" }, noOptional), null);
});

test("first matching rule wins and null overrides inherit calendar defaults while explicit notice zero disables", () => {
  const cfg = config([{
    entity_id: "calendar.family",
    icon_id: "home.calendar",
    accent: "#AABBCC",
    advance_notice_days: 7,
    rules: [
      { operator: "contains", query: "Müll", icon_id: "home.waste", accent: null, advance_notice_days: null },
      { operator: "contains", query: "Müll", icon_id: "home.recycling", accent: "#112233", advance_notice_days: 2 },
    ],
  }]);
  const logical = {
    title: "Müll Abholung",
    provenance: ["calendar.family"],
    source_variants: {
      "calendar.family": { description: null, location: null },
    },
  };
  assert.deepEqual(presentationForEvent(logical, cfg), {
    icon_id: "home.waste",
    accent: "#AABBCC",
    advance_notice_days: 7,
    owner_source_id: "calendar.family",
    description: null,
    description_source_id: null,
    location: null,
    location_source_id: null,
  });

  const disabled = config([{
    entity_id: "calendar.family",
    advance_notice_days: 7,
    rules: [{ operator: "exact", query: "Privat", advance_notice_days: 0 }],
  }]);
  assert.equal(presentationForEvent({
    title: "Privat",
    provenance: ["calendar.family"],
    source_variants: { "calendar.family": {} },
  }, disabled).advance_notice_days, 0);
});

test("presentation owner follows configured calendar order, not provider provenance order", () => {
  const cfg = config([
    { entity_id: "calendar.family", icon_id: "home.birthday", accent: "#111111", advance_notice_days: 5 },
    { entity_id: "calendar.shared", icon_id: "home.calendar", accent: "#222222", advance_notice_days: 1 },
  ]);
  const result = presentationForEvent({
    title: "Geburtstag",
    provenance: ["calendar.shared", "calendar.family"],
    source_variants: {
      "calendar.shared": { description: "shared", location: "B" },
      "calendar.family": { description: "family", location: "A" },
    },
  }, cfg);
  assert.equal(result.owner_source_id, "calendar.family");
  assert.equal(result.icon_id, "home.birthday");
  assert.equal(result.accent, "#111111");
  assert.equal(result.advance_notice_days, 5);
  assert.equal(result.description, "family");
  assert.equal(result.description_source_id, "calendar.family");
  assert.equal(result.location, "A");
  assert.equal(result.location_source_id, "calendar.family");
});

test("optional fields fall back to first non-empty contributing source in configured order and retain source identity", () => {
  const cfg = config([
    { entity_id: "calendar.owner" },
    { entity_id: "calendar.second" },
    { entity_id: "calendar.third" },
  ]);
  const result = presentationForEvent({
    title: "Termin",
    provenance: ["calendar.third", "calendar.owner", "calendar.second"],
    source_variants: {
      "calendar.owner": { description: null, location: "" },
      "calendar.second": { description: "Beschreibung B", location: null },
      "calendar.third": { description: "Beschreibung C", location: "Ort C" },
    },
  }, cfg);
  assert.equal(result.owner_source_id, "calendar.owner");
  assert.equal(result.description, "Beschreibung B");
  assert.equal(result.description_source_id, "calendar.second");
  assert.equal(result.location, "Ort C");
  assert.equal(result.location_source_id, "calendar.third");
});

test("owner optional field prevents conflicting secondary value from influencing owner rule matching", () => {
  const cfg = config([
    {
      entity_id: "calendar.owner",
      icon_id: "home.calendar",
      rules: [{
        operator: "contains",
        query: "secondary secret",
        include_description: true,
        icon_id: "home.waste",
      }],
    },
    { entity_id: "calendar.secondary" },
  ]);
  const result = presentationForEvent({
    title: "Termin",
    provenance: ["calendar.owner", "calendar.secondary"],
    source_variants: {
      "calendar.owner": { description: "Owner text", location: null },
      "calendar.secondary": { description: "Secondary secret", location: null },
    },
  }, cfg);
  assert.equal(result.icon_id, "home.calendar");
  assert.equal(result.description, "Owner text");
  assert.equal(result.description_source_id, "calendar.owner");
});

test("event with no configured contributing calendar returns neutral fallback without inventing provenance", () => {
  const cfg = config([{ entity_id: "calendar.family" }]);
  assert.deepEqual(presentationForEvent({
    title: "External",
    provenance: ["calendar.other"],
    source_variants: { "calendar.other": { description: "x", location: "y" } },
  }, cfg), {
    icon_id: null,
    accent: null,
    advance_notice_days: 0,
    owner_source_id: null,
    description: null,
    description_source_id: null,
    location: null,
    location_source_id: null,
  });
});
