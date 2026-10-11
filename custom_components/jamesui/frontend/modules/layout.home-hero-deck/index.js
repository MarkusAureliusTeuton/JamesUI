import { HOME_HERO_DECK_STYLES } from "./styles.js";

export const SLOT_NAMES = Object.freeze(["hero", "content"]);

const DEFAULT_HERO_RATIO = 0.42;
const MIN_HERO_RATIO = 0.35;
const MAX_HERO_RATIO = 0.50;

function validateConfig(config) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("layout.home-hero-deck config must be a plain object");
  }
  const prototype = Object.getPrototypeOf(config);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("layout.home-hero-deck config must be a plain object");
  }
  for (const key of Object.keys(config)) {
    if (key !== "hero_ratio") throw new TypeError(`unsupported layout config key: ${key}`);
  }

  const heroRatio = Object.prototype.hasOwnProperty.call(config, "hero_ratio")
    ? config.hero_ratio
    : DEFAULT_HERO_RATIO;
  if (typeof heroRatio !== "number" || !Number.isFinite(heroRatio)) {
    throw new TypeError("hero_ratio must be a finite number");
  }
  if (heroRatio < MIN_HERO_RATIO || heroRatio > MAX_HERO_RATIO) {
    throw new RangeError(`hero_ratio must be between ${MIN_HERO_RATIO} and ${MAX_HERO_RATIO}`);
  }
  return Object.freeze({ hero_ratio: heroRatio });
}

function ratioPercent(value) {
  return `${Number((value * 100).toFixed(10))}%`;
}

function requireMountTarget(target) {
  if (!target || typeof target.appendChild !== "function") {
    throw new TypeError("layout.home-hero-deck mount requires an appendable target");
  }
  if (!target.ownerDocument || typeof target.ownerDocument.createElement !== "function") {
    throw new TypeError("layout.home-hero-deck mount target requires ownerDocument.createElement");
  }
}

function createNode(document, attribute, value) {
  const node = document.createElement("div");
  node.setAttribute(attribute, value);
  return node;
}

export function create(_context, config = {}) {
  let currentConfig = validateConfig(config);
  let root = null;
  let styleNode = null;
  let slots = new Map();

  const destroy = () => {
    if (styleNode?.parentNode) styleNode.parentNode.removeChild(styleNode);
    styleNode = null;
    if (root?.parentNode) root.parentNode.removeChild(root);
    root = null;
    slots = new Map();
  };

  const mount = (target) => {
    requireMountTarget(target);
    if (root) destroy();

    const document = target.ownerDocument;
    root = document.createElement("div");
    root.setAttribute("data-jui-layout", "home-hero-deck");
    root.style.setProperty("--jui-home-hero-ratio", ratioPercent(currentConfig.hero_ratio));

    const heroRegion = createNode(document, "data-jui-layout-region", "hero");
    const deck = createNode(document, "data-jui-layout-region", "deck");

    const nextSlots = new Map();
    for (const name of SLOT_NAMES) {
      const slot = createNode(document, "data-jui-layout-slot", name);
      nextSlots.set(name, slot);
    }

    heroRegion.appendChild(nextSlots.get("hero"));
    deck.appendChild(nextSlots.get("content"));
    root.appendChild(heroRegion);
    root.appendChild(deck);

    styleNode = document.createElement("style");
    styleNode.setAttribute("data-jui-layout-style", "home-hero-deck");
    styleNode.textContent = HOME_HERO_DECK_STYLES;
    root.appendChild(styleNode);

    target.appendChild(root);
    slots = nextSlots;
    return root;
  };

  const update = (_nextContext, nextConfig = {}) => {
    const validated = validateConfig(nextConfig);
    currentConfig = validated;
    if (root) root.style.setProperty("--jui-home-hero-ratio", ratioPercent(currentConfig.hero_ratio));
  };

  const getSlot = (name) => slots.get(name) ?? null;
  const listSlots = () => SLOT_NAMES;

  return Object.freeze({ mount, update, destroy, getSlot, listSlots });
}
