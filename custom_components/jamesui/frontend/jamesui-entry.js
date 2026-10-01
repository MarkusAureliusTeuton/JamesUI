(() => {
  const current = document.currentScript?.src || `${window.location.origin}/jamesui_static/jamesui-entry.js`;
  const root = new URL(".", current);
  const panelUrl = new URL("jamesui-panel.js?v=0.5.0", root).href;
  const homeModuleUrl = new URL("jamesui-home.js?v=0.5.0", root).href;
  const homeEntryUrl = new URL("jamesui-home-entry.js?v=0.5.0", root).href;

  const panelScript = document.createElement("script");
  panelScript.src = panelUrl;
  panelScript.async = false;
  panelScript.addEventListener("load", () => {
    const enhancementScript = document.createElement("script");
    enhancementScript.type = "module";
    enhancementScript.src = homeEntryUrl;
    enhancementScript.dataset.homeModule = homeModuleUrl;
    document.head.appendChild(enhancementScript);
  });
  panelScript.addEventListener("error", () => {
    console.error("JamesUI: stable panel script could not be loaded", panelUrl);
  });
  document.head.appendChild(panelScript);
})();
