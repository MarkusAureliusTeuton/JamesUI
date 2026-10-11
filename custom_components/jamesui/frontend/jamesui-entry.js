// JamesUI Next is the only Home Assistant frontend entry. No r11 imports.
(() => {
  const TAG = "jamesui-next-panel";
  if (customElements.get(TAG)) return;
  class JamesUINextPanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._app = null;
      this._hass = null;
      this._narrow = undefined;
      this._route = undefined;
      this._panel = undefined;
      this._generation = 0;
    }
    set hass(value) {
      this._hass = value;
      if (this._app) this._app.core.hass = value;
    }
    set narrow(value) {
      this._narrow = value;
      if (this._app) this._app.core.narrow = value;
    }
    set route(value) {
      this._route = value;
      if (this._app) this._app.core.route = value;
    }
    set panel(value) {
      this._panel = value;
      if (this._app) this._app.core.panel = value;
    }
    connectedCallback() {
      const generation = ++this._generation;
      const root = this.shadowRoot;
      const host = document.createElement("div");
      host.style.height = "100dvh";
      root.replaceChildren(host);
      import("./jamesui-app.js").then(async ({ createJamesUIApp }) => {
        if (generation !== this._generation) return;
        const app = createJamesUIApp({ document: root.ownerDocument });
        this._app = app;
        if (this._hass) app.core.hass = this._hass;
        if (this._narrow !== undefined) app.core.narrow = this._narrow;
        if (this._route !== undefined) app.core.route = this._route;
        if (this._panel !== undefined) app.core.panel = this._panel;
        try {
          await app.mount(host);
          // A disconnect may happen while configuration/providers are loading.
          // Never leave a completed, detached preview running.
          if (generation !== this._generation) {
            app.destroy();
            return;
          }
        } catch (error) {
          if (generation !== this._generation) return;
          app.destroy();
          this._app = null;
          host.textContent = "JamesUI Next nicht verfügbar: " + (error?.message ?? "Konfiguration fehlt");
        }
      }).catch(() => {
        if (generation === this._generation) host.textContent = "JamesUI Next konnte nicht geladen werden";
      });
    }
    disconnectedCallback() {
      this._generation += 1;
      this._app?.destroy();
      this._app = null;
    }
  }
  customElements.define(TAG, JamesUINextPanel);
})();
