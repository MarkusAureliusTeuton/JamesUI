// Separate Home Assistant panel bootstrap; r11's entry and element remain untouched.
(() => {
  const TAG = "jamesui-1-preview-panel";
  if (customElements.get(TAG)) return;
  class JamesUI1PreviewPanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._preview = null;
      this._hass = null;
      this._generation = 0;
    }
    set hass(value) {
      this._hass = value;
      if (this._preview) this._preview.core.hass = value;
    }
    set narrow(value) { if (this._preview) this._preview.core.narrow = value; }
    set route(value) { if (this._preview) this._preview.core.route = value; }
    set panel(value) { if (this._preview) this._preview.core.panel = value; }
    connectedCallback() {
      const generation = ++this._generation;
      const root = this.shadowRoot;
      const host = document.createElement("div");
      host.style.height = "100dvh";
      root.replaceChildren(host);
      import("./jamesui-1-preview.js").then(async ({ createJamesUI1Preview }) => {
        if (generation !== this._generation) return;
        const preview = createJamesUI1Preview({ document: root.ownerDocument });
        this._preview = preview;
        if (this._hass) preview.core.hass = this._hass;
        try {
          await preview.mount(host);
        } catch (error) {
          if (generation !== this._generation) return;
          preview.destroy();
          this._preview = null;
          host.textContent = "JamesUI 1.0 Testansicht nicht verfügbar: " + (error?.message ?? "Konfiguration fehlt");
        }
      }).catch(() => {
        if (generation === this._generation) host.textContent = "JamesUI 1.0 konnte nicht geladen werden";
      });
    }
    disconnectedCallback() {
      this._generation += 1;
      this._preview?.destroy();
      this._preview = null;
    }
  }
  customElements.define(TAG, JamesUI1PreviewPanel);
})();
