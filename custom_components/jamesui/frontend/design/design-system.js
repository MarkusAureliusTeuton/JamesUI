import { BASE_DESIGN_STYLES } from "./base-styles.js";
import { JAMESUI_DESIGN_TOKENS } from "./tokens.js";

function requireDocument(document) {
  if (!document || typeof document.createElement !== "function") {
    throw new TypeError("createDesignSystem requires document");
  }
}

function requireRoot(root) {
  if (!root || typeof root.appendChild !== "function" || typeof root.setAttribute !== "function" || typeof root.removeAttribute !== "function") {
    throw new TypeError("Design System mount requires an appendable root");
  }
}

export function buildDesignStyleText() {
  const declarations = Object.entries(JAMESUI_DESIGN_TOKENS)
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n  ");
  return `[data-jui-design-root] {\n  ${declarations}\n}\n${BASE_DESIGN_STYLES}`;
}

export function createDesignSystem({ document } = {}) {
  requireDocument(document);
  let root = null;
  let styleElement = null;

  const destroy = () => {
    if (!root && !styleElement) return false;
    if (styleElement?.parentNode) styleElement.parentNode.removeChild(styleElement);
    root?.removeAttribute("data-jui-design-root");
    root = null;
    styleElement = null;
    return true;
  };

  const mount = (nextRoot) => {
    requireRoot(nextRoot);
    if (root === nextRoot && styleElement?.parentNode === nextRoot) return styleElement;
    if (root || styleElement) destroy();

    root = nextRoot;
    root.setAttribute("data-jui-design-root", "");
    styleElement = document.createElement("style");
    styleElement.setAttribute("data-jui-design-system", "1");
    styleElement.textContent = buildDesignStyleText();
    root.appendChild(styleElement);
    return styleElement;
  };

  return Object.freeze({ mount, destroy });
}
