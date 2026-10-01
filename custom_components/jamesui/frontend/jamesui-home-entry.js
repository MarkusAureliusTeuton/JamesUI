const current = new URL(import.meta.url);
const revision = current.searchParams.get("v") || "dev";
const homeModuleUrl = new URL("./jamesui-home.js", current);
homeModuleUrl.searchParams.set("v", revision);

import(homeModuleUrl.href)
  .then(({ installHomeExperience }) => customElements.whenDefined("jamesui-panel").then(() => {
    installHomeExperience();
    requestAnimationFrame(() => {
      const panels = window.__jamesUIFindPanels?.() || [];
      panels.forEach((panel) => panel.render?.());
    });
  }))
  .catch((error) => {
    console.error("JamesUI: Start enhancement could not be loaded", error);
  });
