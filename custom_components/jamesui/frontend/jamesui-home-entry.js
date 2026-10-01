import { installHomeExperience } from "./jamesui-home.js?v=0.5.0";

customElements.whenDefined("jamesui-panel").then(() => {
  installHomeExperience();
  requestAnimationFrame(() => {
    document.querySelectorAll("jamesui-panel").forEach((panel) => panel.render?.());
  });
});
