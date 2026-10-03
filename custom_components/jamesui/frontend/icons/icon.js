import { ICON_ID_PATTERN, getIconDefinition } from "./icon-registry.js";

export const SVG_NS = "http://www.w3.org/2000/svg";
export const ICON_SIZES = Object.freeze(["sm", "md", "lg", "xl", "hero"]);

function requireDocument(document) {
  if (!document || typeof document.createElementNS !== "function") {
    throw new TypeError("createIcon requires SVG DOM createElementNS support");
  }
}

function requireIconId(id) {
  if (typeof id !== "string" || !ICON_ID_PATTERN.test(id)) {
    throw new TypeError(`Invalid icon id: ${String(id)}`);
  }
}

function requireSize(size) {
  if (typeof size !== "string" || !ICON_SIZES.includes(size)) {
    throw new TypeError(`Unsupported icon size: ${String(size)}`);
  }
}

function normalizeLabel(label) {
  if (label === null) return null;
  if (typeof label !== "string" || !label.trim()) {
    throw new TypeError("Icon label must be a non-empty string when supplied");
  }
  return label.trim();
}

export function createIcon(document, id, { size = "md", label = null } = {}) {
  requireDocument(document);
  requireIconId(id);
  requireSize(size);
  const accessibleLabel = normalizeLabel(label);
  const definition = getIconDefinition(id);
  if (!definition) throw new Error(`Unknown icon: ${id}`);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("data-jui-icon", id);
  svg.setAttribute("data-jui-icon-size", size);
  svg.setAttribute("focusable", "false");

  if (accessibleLabel === null) {
    svg.setAttribute("aria-hidden", "true");
  } else {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", accessibleLabel);
  }

  for (const node of definition.nodes) {
    const child = document.createElementNS(SVG_NS, node.tag);
    for (const [name, value] of Object.entries(node.attrs)) child.setAttribute(name, value);
    svg.appendChild(child);
  }

  return svg;
}
