import test from "node:test";
import assert from "node:assert/strict";

import { create } from "../custom_components/jamesui/frontend/modules/layout.home-hero-deck/index.js";
import { createFakeDocument } from "./helpers/fake-dom.js";

const SLOT_NAMES = ["hero", "widget-left", "widget-right-main", "widget-right-footer"];

function setup(config = {}) {
  const document = createFakeDocument();
  const target = document.createElement("main");
  const instance = create(Object.freeze({ module: Object.freeze({ id: "layout.home-hero-deck" }) }), config);
  return { document, target, instance };
}

test("exposes the exact frozen slot contract and no stale lookup before mount", () => {
  const { instance } = setup();
  const slots = instance.listSlots();
  assert.deepEqual(slots, SLOT_NAMES);
  assert.equal(Object.isFrozen(slots), true);
  assert.equal(instance.getSlot("hero"), null);
  assert.equal(instance.getSlot("unknown"), null);
});

test("mount creates one canonical structure with stable slot markers and default ratio", () => {
  const { target, instance } = setup();
  instance.mount(target);

  const root = target.querySelector('[data-jui-layout="home-hero-deck"]');
  assert.ok(root);
  assert.equal(target.querySelectorAll('[data-jui-layout="home-hero-deck"]').length, 1);
  assert.equal(root.style.getPropertyValue("--jui-home-hero-ratio"), "42%");

  const heroRegion = root.children[0];
  const deck = root.children[1];
  assert.equal(heroRegion.getAttribute("data-jui-layout-region"), "hero");
  assert.equal(deck.getAttribute("data-jui-layout-region"), "deck");
  assert.equal(heroRegion.children[0], instance.getSlot("hero"));

  const left = deck.children[0];
  const right = deck.children[1];
  assert.equal(left.getAttribute("data-jui-layout-region"), "left");
  assert.equal(right.getAttribute("data-jui-layout-region"), "right");
  assert.equal(left.children[0], instance.getSlot("widget-left"));
  assert.equal(right.children[0], instance.getSlot("widget-right-main"));
  assert.equal(right.children[1], instance.getSlot("widget-right-footer"));

  for (const name of SLOT_NAMES) {
    assert.equal(instance.getSlot(name).getAttribute("data-jui-layout-slot"), name);
    assert.equal(root.querySelectorAll(`[data-jui-layout-slot="${name}"]`).length, 1);
  }
});

test("valid boundary ratios update geometry without replacing slots or children", () => {
  const { document, target, instance } = setup({ hero_ratio: 0.35 });
  instance.mount(target);
  const root = target.querySelector('[data-jui-layout="home-hero-deck"]');
  assert.equal(root.style.getPropertyValue("--jui-home-hero-ratio"), "35%");

  const before = new Map(SLOT_NAMES.map((name) => [name, instance.getSlot(name)]));
  const child = document.createElement("article");
  before.get("widget-right-main").appendChild(child);

  instance.update(Object.freeze({ module: Object.freeze({ id: "layout.home-hero-deck" }) }), { hero_ratio: 0.50 });
  assert.equal(root.style.getPropertyValue("--jui-home-hero-ratio"), "50%");
  for (const name of SLOT_NAMES) assert.equal(instance.getSlot(name), before.get(name));
  assert.equal(instance.getSlot("widget-right-main").children[0], child);
});

test("rejects malformed config with exact TypeError and RangeError classes", () => {
  const typeInvalid = [
    null,
    [],
    new Date(),
    { extra: true },
    { hero_ratio: "0.42" },
    { hero_ratio: Number.NaN },
    { hero_ratio: Number.POSITIVE_INFINITY },
    { hero_ratio: Number.NEGATIVE_INFINITY },
  ];
  for (const config of typeInvalid) assert.throws(() => create({}, config), TypeError);
  assert.throws(() => create({}, { hero_ratio: 0.349 }), RangeError);
  assert.throws(() => create({}, { hero_ratio: 0.501 }), RangeError);

  const nullPrototype = Object.create(null);
  nullPrototype.hero_ratio = 0.42;
  assert.doesNotThrow(() => create({}, nullPrototype));
});

test("invalid update is atomic and preserves ratio, slot identity and slot content", () => {
  const { document, target, instance } = setup({ hero_ratio: 0.42 });
  instance.mount(target);
  const root = target.querySelector('[data-jui-layout="home-hero-deck"]');
  const before = new Map(SLOT_NAMES.map((name) => [name, instance.getSlot(name)]));
  const child = document.createElement("span");
  before.get("widget-left").appendChild(child);

  assert.throws(() => instance.update({}, { hero_ratio: 0.60 }), RangeError);
  assert.equal(root.style.getPropertyValue("--jui-home-hero-ratio"), "42%");
  for (const name of SLOT_NAMES) assert.equal(instance.getSlot(name), before.get(name));
  assert.equal(instance.getSlot("widget-left").children[0], child);

  assert.throws(() => instance.update({}, { unknown: true }), TypeError);
  assert.equal(root.style.getPropertyValue("--jui-home-hero-ratio"), "42%");
});

test("repeated mount replaces only owned DOM and destroy is idempotent", () => {
  const { document, target, instance } = setup();
  const unrelated = document.createElement("aside");
  target.appendChild(unrelated);

  instance.mount(target);
  const firstRoot = target.querySelector('[data-jui-layout="home-hero-deck"]');
  const firstSlots = SLOT_NAMES.map((name) => instance.getSlot(name));

  instance.mount(target);
  const secondRoot = target.querySelector('[data-jui-layout="home-hero-deck"]');
  const secondSlots = SLOT_NAMES.map((name) => instance.getSlot(name));
  assert.notEqual(secondRoot, firstRoot);
  assert.equal(firstRoot.parentNode, null);
  assert.equal(target.children.includes(unrelated), true);
  assert.equal(target.querySelectorAll('[data-jui-layout="home-hero-deck"]').length, 1);
  secondSlots.forEach((slot, index) => assert.notEqual(slot, firstSlots[index]));

  assert.doesNotThrow(() => instance.destroy());
  assert.equal(secondRoot.parentNode, null);
  for (const name of SLOT_NAMES) assert.equal(instance.getSlot(name), null);
  assert.doesNotThrow(() => instance.destroy());
});

test("mount requires a target owned by a usable document", () => {
  const { instance } = setup();
  assert.throws(() => instance.mount(null), TypeError);
  assert.throws(() => instance.mount({ appendChild() {} }), TypeError);
});
