export const SURFACE_VARIANTS = Object.freeze(["default", "raised", "glass"]);
export const BUTTON_VARIANTS = Object.freeze(["default", "ghost", "accent"]);
export const BUTTON_SIZES = Object.freeze(["sm", "md", "lg"]);

function requireDocument(document) {
  if (!document || typeof document.createElement !== "function") {
    throw new TypeError("Visual primitive requires document");
  }
}

function requireChoice(value, allowed, name) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new TypeError(`${name} is not supported`);
  }
}

function requireTagName(tagName) {
  if (typeof tagName !== "string" || !/^[a-z][a-z0-9-]*$/i.test(tagName)) {
    throw new TypeError("tagName must be a valid element name");
  }
}

function optionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function createSurface(document, { tagName = "section", variant = "default" } = {}) {
  requireDocument(document);
  requireTagName(tagName);
  requireChoice(variant, SURFACE_VARIANTS, "surface variant");
  const element = document.createElement(tagName);
  element.setAttribute("data-jui-surface", variant);
  return element;
}

export function createButton(
  document,
  { label = "", ariaLabel = null, variant = "default", size = "md", type = "button" } = {},
) {
  requireDocument(document);
  requireChoice(variant, BUTTON_VARIANTS, "button variant");
  requireChoice(size, BUTTON_SIZES, "button size");
  const visibleLabel = optionalText(label);
  const accessibleLabel = optionalText(ariaLabel);
  if (!visibleLabel && !accessibleLabel) {
    throw new TypeError("button requires a visible label or ariaLabel");
  }
  if (typeof type !== "string" || !type.trim()) throw new TypeError("button type must be a non-empty string");

  const button = document.createElement("button");
  button.setAttribute("type", type.trim());
  button.setAttribute("data-jui-button", variant);
  button.setAttribute("data-jui-button-size", size);
  button.textContent = visibleLabel;
  if (accessibleLabel) button.setAttribute("aria-label", accessibleLabel);
  return button;
}

export function createOverlayFrame(document) {
  requireDocument(document);
  const root = document.createElement("div");
  root.setAttribute("data-jui-overlay", "");
  return root;
}

export function createDialog(document, { title } = {}) {
  requireDocument(document);
  const normalizedTitle = optionalText(title);
  if (!normalizedTitle) throw new TypeError("dialog requires a non-empty title");

  const root = document.createElement("div");
  root.setAttribute("data-jui-dialog", "");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", normalizedTitle);

  const titleElement = document.createElement("h2");
  titleElement.setAttribute("data-jui-dialog-title", "");
  titleElement.textContent = normalizedTitle;

  const body = document.createElement("div");
  body.setAttribute("data-jui-dialog-body", "");

  const actions = document.createElement("div");
  actions.setAttribute("data-jui-dialog-actions", "");

  root.appendChild(titleElement);
  root.appendChild(body);
  root.appendChild(actions);

  return Object.freeze({ root, title: titleElement, body, actions });
}
