import test from "node:test";
import assert from "node:assert/strict";

import {
  ICON_ID_PATTERN,
  createIconRegistry,
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
