import { ICON_DEFINITIONS } from "./icon-definitions.js";

export const ICON_ID_PATTERN = /^(nav|shell|weather|home|moon)\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ALLOWED_ATTRIBUTES = Object.freeze({
  path: Object.freeze(new Set(["d"])),
  line: Object.freeze(new Set(["x1", "y1", "x2", "y2"])),
  polyline: Object.freeze(new Set(["points"])),
  circle: Object.freeze(new Set(["cx", "cy", "r"])),
  rect: Object.freeze(new Set(["x", "y", "width", "height", "rx", "ry"])),
});

function requireIconId(id) {
  if (typeof id !== "string" || !ICON_ID_PATTERN.test(id)) {
    throw new TypeError(`Invalid icon id: ${String(id)}`);
  }
}

function requireSafeGeometryValue(value, attribute) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`Icon attribute ${attribute} must be finite`);
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`Icon attribute ${attribute} must be a non-empty string or finite number`);
  }
  if (/url\s*\(|https?:|data:/i.test(value)) {
    throw new TypeError(`Icon attribute ${attribute} must not contain a URL or external reference`);
  }
  return value;
}

function normalizeNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw new TypeError("Icon node must be an object");
  }
  if (typeof node.tag !== "string" || !Object.hasOwn(ALLOWED_ATTRIBUTES, node.tag)) {
    throw new TypeError(`Unsupported icon tag: ${String(node.tag)}`);
  }
  if (!node.attrs || typeof node.attrs !== "object" || Array.isArray(node.attrs)) {
    throw new TypeError("Icon node attrs must be an object");
  }

  const allowed = ALLOWED_ATTRIBUTES[node.tag];
  const attrs = {};
  for (const [name, value] of Object.entries(node.attrs)) {
    if (!allowed.has(name)) throw new TypeError(`Unsupported icon attribute: ${name}`);
    attrs[name] = requireSafeGeometryValue(value, name);
  }
  if (Object.keys(attrs).length === 0) throw new TypeError(`Icon ${node.tag} requires geometry attributes`);

  return Object.freeze({ tag: node.tag, attrs: Object.freeze(attrs) });
}

function normalizeDefinition(definition) {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new TypeError("Icon definition must be an object");
  }
  requireIconId(definition.id);
  if (definition.source !== "tabler" && definition.source !== "jamesui") {
    throw new TypeError(`Unsupported icon source for ${definition.id}`);
  }

  if (definition.source === "tabler") {
    if (typeof definition.sourceName !== "string" || !definition.sourceName.trim()) {
      throw new TypeError(`Tabler icon ${definition.id} requires sourceName`);
    }
    if (definition.sourceVersion !== "3.48.0") {
      throw new TypeError(`Tabler icon ${definition.id} requires sourceVersion 3.48.0`);
    }
  } else {
    if (definition.sourceName !== null) {
      throw new TypeError(`JamesUI icon ${definition.id} requires sourceName null`);
    }
    if (definition.sourceVersion !== null) {
      throw new TypeError(`JamesUI icon ${definition.id} requires sourceVersion null`);
    }
  }

  if (!Array.isArray(definition.nodes) || definition.nodes.length === 0) {
    throw new TypeError(`Icon ${definition.id} requires non-empty nodes`);
  }

  const nodes = Object.freeze(definition.nodes.map(normalizeNode));
  return Object.freeze({
    id: definition.id,
    source: definition.source,
    sourceName: definition.source === "tabler" ? definition.sourceName.trim() : null,
    sourceVersion: definition.sourceVersion,
    nodes,
  });
}

export function createIconRegistry(definitions) {
  if (!Array.isArray(definitions)) throw new TypeError("createIconRegistry requires definitions array");

  const entries = new Map();
  for (const definition of definitions) {
    const normalized = normalizeDefinition(definition);
    if (entries.has(normalized.id)) throw new TypeError(`Duplicate icon id: ${normalized.id}`);
    entries.set(normalized.id, normalized);
  }

  const ids = Object.freeze([...entries.keys()]);
  return Object.freeze({
    hasIcon(id) {
      return typeof id === "string" && ICON_ID_PATTERN.test(id) && entries.has(id);
    },
    getIconDefinition(id) {
      if (typeof id !== "string" || !ICON_ID_PATTERN.test(id)) return null;
      return entries.get(id) ?? null;
    },
    listIconIds() {
      return ids;
    },
  });
}

export const ICON_REGISTRY = createIconRegistry(ICON_DEFINITIONS);
export const hasIcon = (id) => ICON_REGISTRY.hasIcon(id);
export const getIconDefinition = (id) => ICON_REGISTRY.getIconDefinition(id);
export const listIconIds = () => ICON_REGISTRY.listIconIds();
