function dataAttributeToKey(name) {
  return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function matchesSelector(node, selector) {
  const match = selector.match(/^([a-z0-9-]+)?(?:\[([^=\]]+)(?:="([^"]*)")?\])?$/i);
  if (!match) return false;
  const [, tag, attribute, expected] = match;
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  if (!attribute) return true;
  let actual;
  if (attribute.startsWith("data-")) actual = node.dataset[dataAttributeToKey(attribute)];
  else actual = node.getAttribute(attribute);
  if (expected === undefined) return actual !== undefined && actual !== null;
  return String(actual) === expected;
}

export class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.textContent = "";
    this.hidden = false;
    this.listeners = new Map();
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  replaceChildren(...children) {
    for (const child of [...this.children]) this.removeChild(child);
    for (const child of children) this.appendChild(child);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith("data-")) this.dataset[dataAttributeToKey(name)] = String(value);
  }

  getAttribute(name) {
    if (name.startsWith("data-")) return this.dataset[dataAttributeToKey(name)] ?? null;
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) delete this.dataset[dataAttributeToKey(name)];
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    const normalized = typeof event === "string" ? { type: event } : event;
    for (const listener of [...(this.listeners.get(normalized.type) ?? [])]) listener(normalized);
  }

  querySelectorAll(selector) {
    const results = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) results.push(child);
        visit(child);
      }
    };
    visit(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

export function createFakeDocument() {
  return { createElement: (tagName) => new FakeElement(tagName) };
}
