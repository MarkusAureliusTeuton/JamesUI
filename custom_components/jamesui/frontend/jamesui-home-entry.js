const current = new URL(import.meta.url);
const revision = current.searchParams.get("v") || "dev";
const homeModuleUrl = new URL("./jamesui-home.js", current);
const dataModuleUrl = new URL("./jamesui-home-data.js", current);
const backgroundModuleUrl = new URL("./jamesui-home-background.js", current);
homeModuleUrl.searchParams.set("v", revision);
dataModuleUrl.searchParams.set("v", revision);
backgroundModuleUrl.searchParams.set("v", revision);

Promise.all([
  import(homeModuleUrl.href),
  import(dataModuleUrl.href),
  import(backgroundModuleUrl.href),
])
  .then(([{ installHomeExperience }, { installHomeDataExperience }, { installHomeBackgroundExperience }]) => customElements.whenDefined("jamesui-panel").then(() => {
    installHomeExperience();
    installHomeDataExperience();
    installHomeBackgroundExperience();
    requestAnimationFrame(() => {
      const panels = window.__jamesUIFindPanels?.() || [];
      panels.forEach((panel) => panel.render?.());
    });
  }))
  .catch((error) => {
    console.error("JamesUI: Start enhancement could not be loaded", error);
  });
