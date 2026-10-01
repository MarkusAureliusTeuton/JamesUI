(() => {
  const currentSrc = document.currentScript?.src || `${window.location.origin}/jamesui_static/jamesui-entry.js`;
  const current = new URL(currentSrc, window.location.origin);
  const root = new URL(".", current);
  const revision = current.searchParams.get("v") || "dev";

  const assetUrl = (path) => {
    const url = new URL(path, root);
    url.searchParams.set("v", revision);
    return url.href;
  };

  const findJamesPanels = () => {
    const panels = [];
    const visitedRoots = new Set();

    const visit = (searchRoot) => {
      if (!searchRoot?.querySelectorAll || visitedRoots.has(searchRoot)) return;
      visitedRoots.add(searchRoot);

      searchRoot.querySelectorAll("jamesui-panel").forEach((panel) => panels.push(panel));
      searchRoot.querySelectorAll("*").forEach((element) => {
        if (element.shadowRoot) visit(element.shadowRoot);
      });
    };

    visit(document);
    return panels;
  };

  window.__jamesUIFindPanels = findJamesPanels;

  const upgradePredefinedProperty = (element, property) => {
    if (!Object.prototype.hasOwnProperty.call(element, property)) return;
    const value = element[property];
    delete element[property];
    element[property] = value;
  };

  const panelUrl = assetUrl("jamesui-panel.js");
  const homeEntryUrl = assetUrl("jamesui-home-entry.js");

  const panelScript = document.createElement("script");
  panelScript.src = panelUrl;
  panelScript.async = false;
  panelScript.addEventListener("load", () => {
    findJamesPanels().forEach((panel) => {
      ["hass", "narrow", "route", "panel"].forEach((property) => {
        upgradePredefinedProperty(panel, property);
      });
    });

    const enhancementScript = document.createElement("script");
    enhancementScript.type = "module";
    enhancementScript.src = homeEntryUrl;
    document.head.appendChild(enhancementScript);
  });
  panelScript.addEventListener("error", () => {
    console.error("JamesUI: stable panel script could not be loaded", panelUrl);
  });
  document.head.appendChild(panelScript);
})();
