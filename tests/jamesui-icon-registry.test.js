import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ICON_ID_PATTERN,
  ICON_REGISTRY,
  createIconRegistry,
  getIconDefinition,
  hasIcon,
  listIconIds,
} from "../custom_components/jamesui/frontend/icons/icon-registry.js";

function sampleDefinitions() {
  return [
    {
      id: "home.light",
      source: "tabler",
      sourceName: "bulb",
      sourceVersion: "3.48.0",
      nodes: [{ tag: "path", attrs: { d: "M9 18h6" } }],
    },
    {
      id: "weather.partly-cloudy",
      source: "jamesui",
      sourceName: null,
      sourceVersion: null,
      nodes: [
        { tag: "circle", attrs: { cx: 8, cy: 8, r: 3 } },
        { tag: "path", attrs: { d: "M7 17h10" } },
      ],
    },
  ];
}

const EXPECTED_CATALOG = Object.freeze({
  "nav.start": ["tabler", "home"],
  "nav.house": ["tabler", "building-cottage"],
  "nav.climate": ["tabler", "temperature"],
  "nav.media": ["tabler", "player-play"],
  "nav.door": ["tabler", "door"],
  "shell.settings": ["tabler", "settings"],
  "shell.more": ["tabler", "dots"],
  "shell.back": ["tabler", "arrow-left"],
  "shell.close": ["tabler", "x"],
  "weather.sunny": ["tabler", "sun"],
  "weather.partly-cloudy": ["jamesui", null],
  "weather.cloudy": ["tabler", "cloud"],
  "weather.rain": ["tabler", "cloud-rain"],
  "weather.heavy-rain": ["jamesui", null],
  "weather.snow": ["tabler", "snowflake"],
  "weather.storm": ["tabler", "cloud-storm"],
  "weather.wind": ["tabler", "wind"],
  "weather.fog": ["tabler", "mist"],
  "weather.temperature-high": ["tabler", "temperature-sun"],
  "weather.temperature-low": ["tabler", "temperature-snow"],
  "weather.sunrise": ["tabler", "sunrise"],
  "weather.sunset": ["tabler", "sunset"],
  "home.light": ["tabler", "bulb"],
  "home.outlet": ["tabler", "plug"],
  "home.window": ["tabler", "window"],
  "home.door": ["tabler", "door"],
  "home.shutter": ["jamesui", null],
  "home.ventilation": ["tabler", "propeller"],
  "home.climate": ["tabler", "temperature"],
  "home.media": ["tabler", "device-speaker"],
  "home.device": ["tabler", "device-desktop"],
  "home.energy": ["tabler", "bolt"],
  "moon.new": ["jamesui", null],
  "moon.waxing-crescent": ["jamesui", null],
  "moon.first-quarter": ["jamesui", null],
  "moon.waxing-gibbous": ["jamesui", null],
  "moon.full": ["jamesui", null],
  "moon.waning-gibbous": ["jamesui", null],
  "moon.last-quarter": ["jamesui", null],
  "moon.waning-crescent": ["jamesui", null],
});

test("creates a stable semantic icon registry", () => {
  const registry = createIconRegistry(sampleDefinitions());
  assert.equal(ICON_ID_PATTERN.test("home.light"), true);
  assert.equal(registry.hasIcon("home.light"), true);
  assert.equal(registry.hasIcon("weather.partly-cloudy"), true);
  assert.deepEqual(registry.listIconIds(), ["home.light", "weather.partly-cloudy"]);
  assert.equal(registry.getIconDefinition("home.light").sourceName, "bulb");
  assert.equal(Object.isFrozen(registry), true);
});

test("rejects duplicate or malformed IDs", () => {
  const duplicate = sampleDefinitions();
  duplicate.push(structuredClone(duplicate[0]));
  assert.throws(() => createIconRegistry(duplicate), /duplicate/i);
  assert.throws(() => createIconRegistry([{ ...sampleDefinitions()[0], id: "Home Light" }]), /icon id/i);
});

test("rejects unsafe or unsupported vector nodes and attributes", () => {
  const base = sampleDefinitions()[0];
  assert.throws(() => createIconRegistry([{ ...base, nodes: [{ tag: "script", attrs: {} }] }]), /tag/i);
  assert.throws(() => createIconRegistry([{ ...base, nodes: [{ tag: "path", attrs: { d: "M0 0", fill: "red" } }] }]), /attribute/i);
  assert.throws(() => createIconRegistry([{ ...base, nodes: [{ tag: "path", attrs: { d: "url(https://example.com)" } }] }]), /url|external/i);
  assert.throws(() => createIconRegistry([{ ...base, nodes: [{ tag: "path", attrs: { d: "M0 0", onclick: "x" } }] }]), /attribute/i);
});

test("enforces Tabler 3.48.0 and JamesUI provenance contracts", () => {
  const tabler = sampleDefinitions()[0];
  const jamesui = sampleDefinitions()[1];
  assert.throws(() => createIconRegistry([{ ...tabler, sourceVersion: "3.47.0" }]), /3\.48\.0/);
  assert.throws(() => createIconRegistry([{ ...tabler, sourceName: "" }]), /sourceName/i);
  assert.throws(() => createIconRegistry([{ ...jamesui, sourceName: "custom" }]), /sourceName/i);
  assert.throws(() => createIconRegistry([{ ...jamesui, sourceVersion: "3.48.0" }]), /sourceVersion/i);
});

test("deep-freezes registered definitions and isolates them from caller mutation", () => {
  const input = sampleDefinitions();
  const registry = createIconRegistry(input);
  input[0].id = "home.changed";
  input[0].nodes[0].attrs.d = "changed";
  const stored = registry.getIconDefinition("home.light");
  assert.equal(stored.id, "home.light");
  assert.equal(stored.nodes[0].attrs.d, "M9 18h6");
  assert.equal(Object.isFrozen(stored), true);
  assert.equal(Object.isFrozen(stored.nodes), true);
  assert.equal(Object.isFrozen(stored.nodes[0]), true);
  assert.equal(Object.isFrozen(stored.nodes[0].attrs), true);
});

test("returns false/null for syntactically valid unknown IDs", () => {
  const registry = createIconRegistry(sampleDefinitions());
  assert.equal(registry.hasIcon("home.window"), false);
  assert.equal(registry.getIconDefinition("home.window"), null);
});

test("exports the exact curated 40-icon production catalog", () => {
  const expectedIds = Object.keys(EXPECTED_CATALOG).sort();
  assert.equal(Object.isFrozen(ICON_REGISTRY), true);
  assert.deepEqual([...listIconIds()].sort(), expectedIds);
  assert.equal(listIconIds().length, 40);
  for (const id of expectedIds) {
    assert.equal(hasIcon(id), true);
    const definition = getIconDefinition(id);
    const [source, sourceName] = EXPECTED_CATALOG[id];
    assert.equal(definition.source, source, id);
    assert.equal(definition.sourceName, sourceName, id);
    assert.equal(definition.sourceVersion, source === "tabler" ? "3.48.0" : null, id);
    assert.ok(definition.nodes.length > 0, id);
  }
});

test("checks in pinned Tabler attribution for the vendored catalog", () => {
  const license = readFileSync(
    new URL("../custom_components/jamesui/frontend/icons/ICONS_LICENSE.md", import.meta.url),
    "utf8",
  );
  assert.match(license, /Tabler Icons/);
  assert.match(license, /3\.48\.0/);
  assert.match(license, /MIT License/);
});
