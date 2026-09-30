const VERSION = "0.1.1";

const NAV_ITEMS = [
  { id: "home", label: "Start", icon: "⌂" },
  { id: "house", label: "Haus", icon: "◇" },
  { id: "climate", label: "Klima", icon: "◌" },
  { id: "media", label: "Medien", icon: "▶" },
  { id: "door", label: "Tür", icon: "▣" },
];

const PAGE_TITLES = {
  home: "Start",
  house: "Haus",
  climate: "Klima",
  media: "Medien",
  door: "Tür",
};

class JamesUIPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._page = "home";
    this._settings = false;
    this._appMenu = false;
    this._doorbellDemo = false;
    this._displaySetup = false;
    this._scene = "Alltag";
    this._timer = null;
    this._displayCalibration = this._loadDisplayCalibration();
  }

  set hass(value) {
    this._hass = value;
    this._updateLiveValues();
  }

  get hass() {
    return this._hass;
  }

  set narrow(value) {
    this._narrow = value;
  }

  set route(value) {
    this._route = value;
  }

  set panel(value) {
    this._panel = value;
  }

  connectedCallback() {
    this.render();
    this._timer = window.setInterval(() => this._updateClock(), 1000);
    this._updateClock();
  }

  disconnectedCallback() {
    if (this._timer) window.clearInterval(this._timer);
  }

  _loadDisplayCalibration() {
    try {
      return {
        top: 0, right: 0, bottom: 0, left: 0, scale: 100,
        ...JSON.parse(localStorage.getItem("jamesui-display-calibration") || "{}"),
      };
    } catch (_) {
      return { top: 0, right: 0, bottom: 0, left: 0, scale: 100 };
    }
  }

  _saveDisplayCalibration() {
    localStorage.setItem("jamesui-display-calibration", JSON.stringify(this._displayCalibration));
  }

  _displayMetrics() {
    const viewport = window.visualViewport;
    const rect = this.getBoundingClientRect();
    return {
      viewportWidth: Math.round(viewport?.width || window.innerWidth),
      viewportHeight: Math.round(viewport?.height || window.innerHeight),
      panelWidth: Math.round(rect.width),
      panelHeight: Math.round(rect.height),
      screenWidth: window.screen?.width || 0,
      screenHeight: window.screen?.height || 0,
      dpr: window.devicePixelRatio || 1,
      orientation: window.matchMedia("(orientation: landscape)").matches ? "Querformat" : "Hochformat",
      touch: navigator.maxTouchPoints > 0 ? "Touch erkannt" : "Kein Touch erkannt",
    };
  }

  _setDisplayCalibration(key, value) {
    this._displayCalibration[key] = Number(value);
    this._saveDisplayCalibration();
    this.render();
  }

  _resetDisplayCalibration() {
    this._displayCalibration = { top: 0, right: 0, bottom: 0, left: 0, scale: 100 };
    this._saveDisplayCalibration();
    this.render();
  }

  _updateClock() {
    const now = new Date();
    const time = this.shadowRoot?.querySelectorAll("[data-live-time]");
    const date = this.shadowRoot?.querySelectorAll("[data-live-date]");
    const timeText = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);
    const dateText = new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(now);
    time?.forEach((node) => (node.textContent = timeText));
    date?.forEach((node) => (node.textContent = dateText));
  }

  _updateLiveValues() {
    if (!this.shadowRoot) return;
    const count = Object.keys(this._hass?.states || {}).length;
    const node = this.shadowRoot.querySelector("[data-entity-count]");
    if (node) node.textContent = String(count);
    const connection = this.shadowRoot.querySelector("[data-connection]");
    if (connection) {
      connection.textContent = this._hass ? "Verbunden" : "Warte auf Home Assistant";
      connection.classList.toggle("ok", Boolean(this._hass));
    }
  }

  _setPage(page) {
    this._page = page;
    this._settings = false;
    this._appMenu = false;
    this.render();
  }

  _toggleSettings() {
    this._settings = !this._settings;
    this._appMenu = false;
    this.render();
  }

  _toggleAppMenu() {
    this._appMenu = !this._appMenu;
    this._settings = false;
    this.render();
  }

  _setScene(scene) {
    this._scene = scene;
    this.render();
  }

  _bindEvents() {
    this.shadowRoot.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => this._setPage(button.dataset.nav));
    });

    this.shadowRoot.querySelector("[data-settings]")?.addEventListener("click", () => this._toggleSettings());
    this.shadowRoot.querySelector("[data-app-menu]")?.addEventListener("click", () => this._toggleAppMenu());

    this.shadowRoot.querySelectorAll("[data-scene]").forEach((button) => {
      button.addEventListener("click", () => this._setScene(button.dataset.scene));
    });

    this.shadowRoot.querySelector("[data-demo-doorbell]")?.addEventListener("click", () => {
      this._appMenu = false;
      this._doorbellDemo = true;
      this.render();
    });

    this.shadowRoot.querySelectorAll("[data-close-doorbell]").forEach((button) => {
      button.addEventListener("click", () => {
        this._doorbellDemo = false;
        this.render();
      });
    });

    this.shadowRoot.querySelector("[data-reload]")?.addEventListener("click", () => window.location.reload());

    this.shadowRoot.querySelector("[data-display-setup]")?.addEventListener("click", () => {
      this._appMenu = false;
      this._displaySetup = true;
      this.render();
    });

    this.shadowRoot.querySelector("[data-close-display]")?.addEventListener("click", () => {
      this._displaySetup = false;
      this.render();
    });

    this.shadowRoot.querySelector("[data-reset-display]")?.addEventListener("click", () => this._resetDisplayCalibration());

    this.shadowRoot.querySelectorAll("[data-calibration]").forEach((input) => {
      input.addEventListener("input", () => this._setDisplayCalibration(input.dataset.calibration, input.value));
    });
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="app-shell" style="--cal-top:${this._displayCalibration.top}px;--cal-right:${this._displayCalibration.right}px;--cal-bottom:${this._displayCalibration.bottom}px;--cal-left:${this._displayCalibration.left}px;--ui-scale:${this._displayCalibration.scale / 100}">
        ${this._header()}
        <main class="content">
          ${this._settings ? this._settingsPage() : this._pageContent()}
        </main>
        ${this._bottomNav()}
        ${this._appMenu ? this._appMenuPanel() : ""}
        ${this._displaySetup ? this._displaySetupOverlay() : ""}
        ${this._doorbellDemo ? this._doorbellOverlay() : ""}
      </div>
    `;

    this._bindEvents();
    this._updateClock();
    this._updateLiveValues();
  }

  _header() {
    const title = this._settings ? `${PAGE_TITLES[this._page]} · Einstellungen` : PAGE_TITLES[this._page];
    return `
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">J</span>
          <div>
            <div class="eyebrow">JAMES UI</div>
            <div class="page-title">${title}</div>
          </div>
        </div>
        <div class="top-actions">
          <div class="top-clock">
            <span data-live-date></span>
            <strong data-live-time></strong>
          </div>
          <button class="icon-button ${this._appMenu ? "active" : ""}" data-app-menu aria-label="Anwendungssteuerung">⋯</button>
          <button class="icon-button ${this._settings ? "active" : ""}" data-settings aria-label="Einstellungen">⚙</button>
        </div>
      </header>
    `;
  }

  _pageContent() {
    switch (this._page) {
      case "house": return this._housePage();
      case "climate": return this._climatePage();
      case "media": return this._mediaPage();
      case "door": return this._doorPage();
      default: return this._homePage();
    }
  }

  _homePage() {
    return `
      <section class="home-grid">
        <article class="weather-hero">
          <div class="weather-sky">
            <div class="sun-disc"></div>
            <div class="weather-gradient"></div>
          </div>
          <div class="hero-content">
            <div>
              <div class="hero-date" data-live-date></div>
              <div class="hero-time" data-live-time></div>
            </div>
            <div class="weather-now">
              <span class="weather-symbol">◐</span>
              <div>
                <strong>Wetter</strong>
                <span>Modul folgt in v0.2</span>
              </div>
            </div>
          </div>
          <div class="hero-footer">
            <span>Aktuell</span>
            <span>Tagesprognose</span>
            <button class="text-button" disabled>3-Tage-Prognose →</button>
          </div>
        </article>

        <section class="section quick-section">
          <div class="section-heading">
            <div>
              <span class="eyebrow">AUF EINEN BLICK</span>
              <h2>Quickinfo</h2>
            </div>
          </div>
          <div class="quick-grid">
            ${this._quickCard("Haus", "Status folgt", "◇")}
            ${this._quickCard("Klima", "Raumdaten folgen", "◌")}
            ${this._quickCard("Energie", "Messwerte folgen", "ϟ")}
            ${this._quickCard("Anwesend", "Präsenz folgt", "◎")}
          </div>
        </section>

        <section class="section scene-section">
          <div class="section-heading compact">
            <div>
              <span class="eyebrow">HAUSMODUS</span>
              <h2>Szenen</h2>
            </div>
            <span class="muted">Auswahl wird später mit HA verknüpft</span>
          </div>
          <div class="scene-slider">
            ${["Morgen", "Alltag", "Fernsehen", "Abend", "Nacht"].map((scene) => `
              <button data-scene="${scene}" class="scene-pill ${this._scene === scene ? "selected" : ""}">
                <span class="scene-dot"></span>
                ${scene}
              </button>
            `).join("")}
          </div>
        </section>
      </section>
    `;
  }

  _quickCard(title, value, icon) {
    return `
      <article class="quick-card">
        <span class="quick-icon">${icon}</span>
        <div><strong>${title}</strong><span>${value}</span></div>
        <span class="chevron">›</span>
      </article>
    `;
  }

  _housePage() {
    return `
      <div class="page-stack">
        <section class="status-strip">
          <article class="status-primary">
            <span class="status-orb"></span>
            <div><span class="eyebrow">GESAMTSTATUS</span><h2>JamesUI ist bereit</h2><p>Hausdaten werden im nächsten Modul angebunden.</p></div>
          </article>
          ${this._metric("HA Entities", '<span data-entity-count>0</span>', "verfügbar")}
          ${this._metric("System", "Online", "Home Assistant")}
        </section>

        <section class="section">
          <div class="section-heading"><div><span class="eyebrow">STEUERUNG</span><h2>Bereiche</h2></div></div>
          <div class="area-grid">
            ${this._area("Licht", "Noch nicht konfiguriert", "✦")}
            ${this._area("Steckdosen", "Noch nicht konfiguriert", "⌁")}
            ${this._area("Geräte", "Noch nicht konfiguriert", "▦")}
            ${this._area("Lüftung", "Noch nicht konfiguriert", "≋")}
          </div>
        </section>

        <div class="two-column">
          <section class="section">
            <div class="section-heading"><div><span class="eyebrow">HEUTE</span><h2>Statistik</h2></div></div>
            <div class="chart-placeholder">
              <div class="bars">${[34,52,43,70,58,81,66,74,48,61,55,72].map(v => `<i style="height:${v}%"></i>`).join("")}</div>
              <span>Messwerte werden später aus HA-Statistiken geladen.</span>
            </div>
          </section>
          <section class="section">
            <div class="section-heading"><div><span class="eyebrow">SYSTEM</span><h2>Geräte</h2></div></div>
            <div class="device-list">
              ${this._device("Home Assistant", "Verbunden", true)}
              ${this._device("Raspberry Pi", "Monitoring folgt", false)}
              ${this._device("Dreame", "Zuordnung folgt", false)}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  _metric(label, value, sub) {
    return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;
  }

  _area(title, sub, icon) {
    return `<article class="area-card"><span class="area-icon">${icon}</span><div><strong>${title}</strong><span>${sub}</span></div><span class="chevron">›</span></article>`;
  }

  _device(name, state, active) {
    return `<div class="device-row"><span class="device-dot ${active ? "on" : ""}"></span><strong>${name}</strong><span>${state}</span><b>›</b></div>`;
  }

  _climatePage() {
    const rooms = ["Wohnzimmer", "Küche", "Schlafzimmer", "Kinderzimmer", "Bad", "Flur"];
    return `
      <div class="page-stack">
        <section class="section climate-program">
          <div>
            <span class="eyebrow">KLIMAPROGRAMM</span>
            <h2>Normal</h2>
          </div>
          <div class="program-pills">
            <button class="selected">Normal</button><button>Nacht</button><button>Abwesend</button><button>Urlaub</button>
          </div>
        </section>
        <section class="section room-section">
          <div class="room-header"><span>Raum</span><span>Ist</span><span>Solltemperatur</span><span>Status</span></div>
          ${rooms.map((room, index) => this._climateRoom(room, index)).join("")}
        </section>
        <section class="schedule-link">
          <div><span class="eyebrow">AUTOMATIK</span><strong>Wochenplan</strong></div>
          <span>Pläne & Programme konfigurieren →</span>
        </section>
      </div>
    `;
  }

  _climateRoom(room, index) {
    const demo = ["22,1°", "21,8°", "20,4°", "21,4°", "23,1°", "20,9°"][index];
    return `
      <div class="room-row">
        <strong>${room}</strong>
        <span class="temp-demo">${demo}<small>Demo</small></span>
        <div class="setpoint"><button disabled>−</button><span>--,-°</span><button disabled>+</button></div>
        <span class="room-state">nicht verknüpft</span>
      </div>
    `;
  }

  _mediaPage() {
    return `
      <div class="media-layout">
        <section class="section media-selector">
          <span class="eyebrow">1 · QUELLE</span>
          <h2>Was möchtest du hören oder sehen?</h2>
          <div class="source-grid">
            ${this._source("Spotify", "♫")}
            ${this._source("Fernsehen", "▣")}
            ${this._source("Radio", "◉")}
            ${this._source("Bluetooth", "⌁")}
          </div>
        </section>
        <section class="section media-selector">
          <span class="eyebrow">2 · WIEDERGABEGERÄT</span>
          <h2>Wo soll es wiedergegeben werden?</h2>
          <div class="playback-placeholder">
            <span class="large-symbol">◎</span>
            <strong>Routing folgt in v0.5</strong>
            <p>JamesUI wird nur kompatible Kombinationen aus Quelle und Wiedergabegerät anbieten.</p>
          </div>
        </section>
        <section class="now-playing">
          <div><span class="eyebrow">WIEDERGABE</span><strong>Nichts aktiv</strong></div>
          <div class="transport"><button disabled>‹‹</button><button disabled class="play">▶</button><button disabled>››</button></div>
          <div class="volume"><span>−</span><i></i><span>+</span></div>
        </section>
      </div>
    `;
  }

  _source(label, icon) {
    return `<button class="source-card" disabled><span>${icon}</span><strong>${label}</strong><small>noch nicht verknüpft</small></button>`;
  }

  _doorPage() {
    return `
      <div class="door-layout">
        <section class="camera-card">
          <div class="camera-placeholder">
            <span class="camera-icon">▣</span>
            <strong>Haustürkamera</strong>
            <span>Kamera-Entity wird später zugeordnet</span>
          </div>
          <div class="camera-caption"><span class="status-orb"></span><strong>Türsystem</strong><span>Siedle-Anbindung folgt</span></div>
        </section>
        <section class="door-side">
          <article class="section">
            <span class="eyebrow">AKTIONEN</span>
            <h2>Haustür</h2>
            <div class="door-actions">
              <button disabled>Tür öffnen</button>
              <button disabled>Außenlicht</button>
              <button data-demo-doorbell class="demo-action">Klingelansicht testen</button>
            </div>
          </article>
          <article class="section">
            <span class="eyebrow">VERLAUF</span>
            <h2>Letzte Ereignisse</h2>
            <div class="empty-state">Noch keine Ereignisquelle konfiguriert.</div>
          </article>
        </section>
      </div>
    `;
  }

  _settingsPage() {
    const descriptions = {
      home: "Wetterquelle, Darstellung, Quickinfo und Szenenreihenfolge",
      house: "Bereiche, Statistiken und Geräteanzeige",
      climate: "Räume, Programme, Sollwerte und Zeitpläne",
      media: "Quellen, Wiedergabegeräte, Standard-Playlist und Routing",
      door: "Kamera, Klingelereignis, Aktionen und Verlauf",
    };
    return `
      <div class="settings-layout">
        <section class="settings-intro">
          <span class="eyebrow">SEITENSPEZIFISCH</span>
          <h1>${PAGE_TITLES[this._page]}</h1>
          <p>${descriptions[this._page]}</p>
        </section>
        <section class="section settings-card">
          <div class="settings-row"><div><strong>Konfiguration</strong><span>Entity-Zuordnung wird in einer kommenden Version ergänzt.</span></div><span class="tag">geplant</span></div>
          <div class="settings-row"><div><strong>Darstellung</strong><span>Die Hauptansicht bleibt bewusst schlank; Detailoptionen liegen hier.</span></div><span class="tag">v0.1</span></div>
          <div class="settings-row"><div><strong>Home Assistant</strong><span>JamesUI sieht aktuell <b data-entity-count>0</b> Entities.</span></div><span class="connection" data-connection>Verbinden…</span></div>
        </section>
      </div>
    `;
  }

  _bottomNav() {
    return `
      <nav class="bottom-nav">
        ${NAV_ITEMS.map((item) => `
          <button data-nav="${item.id}" class="${this._page === item.id && !this._settings ? "active" : ""}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
          </button>
        `).join("")}
      </nav>
    `;
  }

  _appMenuPanel() {
    return `
      <div class="menu-scrim" data-app-menu></div>
      <aside class="app-menu">
        <div class="menu-head"><div><span class="eyebrow">ANWENDUNGSSTEUERUNG</span><h2>JamesUI</h2></div><span class="version">v${VERSION}</span></div>
        <div class="menu-status"><span class="connection" data-connection>Verbinden…</span><span><b data-entity-count>0</b> HA Entities</span></div>
        <button data-demo-doorbell><span>▣</span><div><strong>Türklingel-Overlay testen</strong><small>Nur UI-Demo, keine Türaktion</small></div><b>›</b></button>
        <button data-display-setup><span>⌗</span><div><strong>Display & Kalibrierung</strong><small>Automatische Erkennung und Randkorrektur</small></div><b>›</b></button>
        <button data-reload><span>↻</span><div><strong>Oberfläche neu laden</strong><small>Browseransicht aktualisieren</small></div><b>›</b></button>
        <div class="menu-foot">JamesUI Foundation · OnePlus Pad 2</div>
      </aside>
    `;
  }

  _displaySetupOverlay() {
    const m = this._displayMetrics();
    const c = this._displayCalibration;
    const control = (key, label, value, max = 80) => `
      <label class="cal-control">
        <div><strong>${label}</strong><span>${value}px</span></div>
        <input type="range" min="0" max="${max}" step="1" value="${value}" data-calibration="${key}">
      </label>`;

    return `
      <div class="display-overlay">
        <div class="calibration-frame"
          style="top:${c.top}px;right:${c.right}px;bottom:${c.bottom}px;left:${c.left}px">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
        </div>

        <section class="display-panel">
          <div class="display-head">
            <div><span class="eyebrow">JAMESUI · DISPLAY</span><h2>Bildschirm einrichten</h2></div>
            <button data-close-display class="display-close">×</button>
          </div>

          <div class="auto-detect">
            <div><span class="eyebrow">AUTOMATISCH ERKANNT</span><strong>${m.panelWidth} × ${m.panelHeight} CSS px</strong></div>
            <div><span>Viewport</span><b>${m.viewportWidth} × ${m.viewportHeight}</b></div>
            <div><span>Display</span><b>${m.screenWidth} × ${m.screenHeight}</b></div>
            <div><span>Pixeldichte</span><b>${m.dpr.toFixed(2)}×</b></div>
            <div><span>Ausrichtung</span><b>${m.orientation}</b></div>
            <div><span>Eingabe</span><b>${m.touch}</b></div>
          </div>

          <div class="calibration-help">
            <strong>Randkalibrierung</strong>
            <span>Die vier kupferfarbenen Eckmarken sollen gerade vollständig sichtbar sein. Korrigiere nur einen Rand, wenn JamesUI dort abgeschnitten wird.</span>
          </div>

          <div class="cal-grid">
            ${control("top", "Oben", c.top)}
            ${control("right", "Rechts", c.right)}
            ${control("bottom", "Unten", c.bottom)}
            ${control("left", "Links", c.left)}
          </div>

          <label class="cal-control scale-control">
            <div><strong>UI-Skalierung</strong><span>${c.scale}%</span></div>
            <input type="range" min="85" max="115" step="1" value="${c.scale}" data-calibration="scale">
          </label>

          <div class="display-actions">
            <button data-reset-display>Automatik / 100 % zurücksetzen</button>
            <button data-close-display class="primary">Übernehmen</button>
          </div>
          <small class="local-note">Diese Einstellung wird nur auf diesem Browser/Tablet gespeichert.</small>
        </section>
      </div>
    `;
  }

  _doorbellOverlay() {
    return `
      <div class="doorbell-overlay">
        <div class="doorbell-card">
          <div class="doorbell-top"><span class="pulse-ring"></span><div><span class="eyebrow">HAUSTÜR</span><h1>Es klingelt an der Haustür</h1></div><span class="demo-badge">DEMO</span></div>
          <div class="doorbell-camera"><span>▣</span><strong>Kamerabild</strong><small>wird später live eingebunden</small></div>
          <div class="doorbell-actions">
            <button disabled><span>⌂</span><strong>Tür öffnen</strong></button>
            <button disabled><span>✦</span><strong>Außenlicht</strong></button>
            <button data-close-doorbell class="dismiss"><span>×</span><strong>Ignorieren</strong></button>
          </div>
        </div>
      </div>
    `;
  }

  _styles() {
    return `
      :host {
        --bg: #0b0c0d;
        --surface: #121416;
        --surface-2: #181a1d;
        --surface-3: #202327;
        --line: rgba(255,255,255,.08);
        --line-strong: rgba(255,255,255,.14);
        --text: #f3f0ea;
        --muted: #989b9f;
        --accent: #b87948;
        --accent-soft: rgba(184,121,72,.16);
        --accent-bright: #d49a67;
        --good: #7fa58a;
        --danger: #b86d64;
        --radius: 22px;
        display: block;
        width: 100%;
        height: 100%;
        min-height: 100%;
        color: var(--text);
        background: var(--bg);
        font-family: Inter, "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      * { box-sizing: border-box; }
      button { font: inherit; color: inherit; }
      button:disabled { opacity: .55; cursor: default; }

      .app-shell {
        position: relative;
        display: grid;
        grid-template-rows: 76px minmax(0, 1fr) 88px;
        width: 100%;
        height: 100%;
        min-height: 720px;
        overflow: hidden;
        padding: var(--cal-top, 0px) var(--cal-right, 0px) var(--cal-bottom, 0px) var(--cal-left, 0px);
        background:
          radial-gradient(circle at 15% -10%, rgba(184,121,72,.08), transparent 30%),
          var(--bg);
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 clamp(22px, 2.5vw, 42px);
        border-bottom: 1px solid var(--line);
        background: rgba(11,12,13,.94);
        z-index: 5;
      }

      .brand, .top-actions, .hero-content, .weather-now, .status-primary,
      .section-heading, .quick-card, .area-card, .device-row, .camera-caption,
      .menu-head, .menu-status, .doorbell-top { display: flex; align-items: center; }

      .brand { gap: 13px; }
      .brand-mark {
        width: 38px; height: 38px; border-radius: 12px;
        display: grid; place-items: center;
        background: linear-gradient(145deg, #c58a59, #805033);
        color: #111; font-weight: 800; font-size: 20px;
        box-shadow: inset 0 1px rgba(255,255,255,.22);
      }

      .eyebrow {
        display: block;
        color: var(--accent-bright);
        font-size: 10px;
        font-weight: 750;
        letter-spacing: .16em;
        text-transform: uppercase;
      }

      .page-title { font-size: 17px; font-weight: 650; margin-top: 2px; }
      .top-actions { gap: 10px; }
      .top-clock { display: flex; flex-direction: column; align-items: flex-end; margin-right: 8px; color: var(--muted); font-size: 11px; }
      .top-clock strong { color: var(--text); font-size: 18px; font-weight: 620; }

      .icon-button {
        width: 43px; height: 43px; border-radius: 13px;
        border: 1px solid var(--line);
        background: var(--surface);
        cursor: pointer;
        font-size: 18px;
      }
      .icon-button.active, .icon-button:hover { border-color: rgba(184,121,72,.45); background: var(--accent-soft); }

      .content {
        min-height: 0;
        zoom: var(--ui-scale, 1);
        overflow: auto;
        padding: clamp(18px, 2vw, 32px) clamp(22px, 2.5vw, 42px);
        scrollbar-width: thin;
        scrollbar-color: var(--surface-3) transparent;
      }

      .bottom-nav {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        align-items: stretch;
        border-top: 1px solid var(--line);
        background: rgba(12,13,14,.98);
        padding: 8px clamp(22px, 4vw, 80px) 10px;
        z-index: 10;
      }

      .bottom-nav button {
        position: relative;
        border: 0;
        background: transparent;
        color: #7f8286;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      }

      .bottom-nav button::before {
        content: "";
        position: absolute;
        top: -8px;
        width: 54px;
        height: 2px;
        border-radius: 2px;
        background: transparent;
      }

      .bottom-nav button.active { color: var(--text); }
      .bottom-nav button.active::before { background: var(--accent-bright); }
      .nav-icon { font-size: 20px; line-height: 1; }

      .home-grid { display: grid; grid-template-columns: 1.45fr 1fr; grid-template-rows: minmax(280px, 1fr) auto; gap: 18px; height: 100%; }
      .weather-hero {
        position: relative; overflow: hidden; min-height: 300px;
        border: 1px solid var(--line); border-radius: 28px;
        background: #171a1d;
        grid-row: 1 / 3;
      }

      .weather-sky { position: absolute; inset: 0; background: linear-gradient(155deg,#31434a 0%,#242a2b 45%,#141618 100%); }
      .weather-sky::before {
        content: ""; position: absolute; left: -5%; right: -5%; bottom: 0; height: 48%;
        background:
          linear-gradient(150deg, transparent 0 18%, #171918 18% 32%, transparent 32%),
          linear-gradient(205deg, transparent 0 28%, #20211e 28% 46%, transparent 46%),
          linear-gradient(to top, #0c0e0e, transparent);
        opacity: .92;
      }
      .weather-sky::after {
        content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 27%;
        background: linear-gradient(to top, rgba(6,7,7,.95), transparent);
      }
      .sun-disc {
        position: absolute; width: 72px; height: 72px; border-radius: 50%;
        right: 18%; top: 17%;
        background: #d8b783;
        box-shadow: 0 0 60px rgba(216,183,131,.28);
        opacity: .9;
      }
      .weather-gradient { position: absolute; inset: 0; background: linear-gradient(90deg,rgba(6,7,8,.62),transparent 55%),linear-gradient(to top,rgba(6,7,8,.8),transparent 50%); }
      .hero-content { position: absolute; inset: 0 0 64px; padding: clamp(28px, 3vw, 50px); justify-content: space-between; align-items: flex-start; }
      .hero-date { font-size: 16px; color: rgba(255,255,255,.75); text-transform: capitalize; }
      .hero-time { font-size: clamp(64px, 7vw, 108px); line-height: .98; font-weight: 250; letter-spacing: -.055em; margin-top: 6px; }
      .weather-now { gap: 14px; margin-top: 6px; padding: 13px 16px; border: 1px solid rgba(255,255,255,.13); border-radius: 16px; background: rgba(10,12,13,.38); backdrop-filter: blur(12px); }
      .weather-now div { display: flex; flex-direction: column; gap: 2px; }
      .weather-now span { color: rgba(255,255,255,.7); font-size: 11px; }
      .weather-symbol { font-size: 30px !important; color: #e0c19b !important; }
      .hero-footer { position: absolute; left: 0; right: 0; bottom: 0; height: 64px; display: flex; align-items: center; gap: 22px; padding: 0 30px; border-top: 1px solid rgba(255,255,255,.1); background: rgba(8,9,10,.5); backdrop-filter: blur(14px); font-size: 12px; }
      .hero-footer span:first-child { color: var(--accent-bright); }
      .text-button { margin-left: auto; border: 0; background: transparent; font-size: 12px; }

      .section {
        background: linear-gradient(145deg, rgba(21,23,25,.98), rgba(16,18,20,.98));
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: clamp(18px, 2vw, 28px);
      }
      .section-heading { justify-content: space-between; margin-bottom: 16px; }
      .section-heading.compact { margin-bottom: 12px; }
      h1,h2,p { margin: 0; }
      h2 { font-size: clamp(19px, 1.55vw, 25px); font-weight: 620; margin-top: 3px; letter-spacing: -.02em; }
      .muted { color: var(--muted); font-size: 11px; }

      .quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .quick-card, .area-card {
        min-height: 74px; gap: 12px; padding: 12px 14px;
        border: 1px solid var(--line); border-radius: 16px;
        background: rgba(255,255,255,.018);
      }
      .quick-card div, .area-card div { display: flex; flex-direction: column; min-width: 0; }
      .quick-card strong, .area-card strong { font-size: 14px; }
      .quick-card div span, .area-card div span { color: var(--muted); font-size: 10px; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .quick-icon, .area-icon { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-bright); }
      .chevron { margin-left: auto; color: #666a6e; font-size: 20px; }

      .scene-slider { display: flex; gap: 8px; overflow: auto; scrollbar-width: none; }
      .scene-slider::-webkit-scrollbar { display: none; }
      .scene-pill {
        flex: 1 0 auto; min-width: 90px; height: 44px; border-radius: 14px;
        border: 1px solid var(--line); background: rgba(255,255,255,.018);
        color: var(--muted); cursor: pointer; font-size: 12px;
      }
      .scene-pill.selected { color: var(--text); background: var(--accent-soft); border-color: rgba(184,121,72,.45); }
      .scene-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: currentColor; margin-right: 6px; vertical-align: 2px; }

      .page-stack { display: flex; flex-direction: column; gap: 18px; min-height: 100%; }
      .status-strip { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px; }
      .status-primary, .metric { min-height: 112px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 20px 22px; }
      .status-primary { gap: 16px; }
      .status-primary p { color: var(--muted); font-size: 11px; margin-top: 5px; }
      .status-orb, .device-dot { width: 9px; height: 9px; border-radius: 50%; background: #666; flex: 0 0 auto; }
      .status-orb { width: 13px; height: 13px; background: var(--good); box-shadow: 0 0 0 6px rgba(127,165,138,.1); }
      .metric { display: flex; flex-direction: column; justify-content: center; }
      .metric > span { color: var(--muted); font-size: 11px; }
      .metric strong { font-size: 25px; margin: 5px 0 1px; font-weight: 560; }
      .metric small { color: #6f7377; }

      .area-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .area-card { min-height: 86px; }
      .two-column { display: grid; grid-template-columns: 1.25fr 1fr; gap: 18px; flex: 1; }
      .chart-placeholder { height: 150px; display: flex; flex-direction: column; justify-content: flex-end; gap: 12px; }
      .chart-placeholder > span { color: var(--muted); font-size: 10px; }
      .bars { display: flex; align-items: flex-end; gap: 7px; height: 105px; border-bottom: 1px solid var(--line); }
      .bars i { flex: 1; min-width: 5px; max-width: 22px; background: linear-gradient(to top, rgba(184,121,72,.18), rgba(212,154,103,.7)); border-radius: 5px 5px 0 0; }
      .device-list { display: flex; flex-direction: column; }
      .device-row { min-height: 48px; border-bottom: 1px solid var(--line); gap: 10px; font-size: 12px; }
      .device-row:last-child { border-bottom: 0; }
      .device-row strong { flex: 1; }
      .device-row span:nth-child(3) { color: var(--muted); }
      .device-row b { color: #65686b; font-size: 18px; }
      .device-dot.on { background: var(--good); }

      .climate-program { display: flex; align-items: center; justify-content: space-between; }
      .program-pills { display: flex; gap: 8px; }
      .program-pills button { border: 1px solid var(--line); background: transparent; color: var(--muted); border-radius: 13px; padding: 10px 17px; }
      .program-pills button.selected { background: var(--accent-soft); color: var(--text); border-color: rgba(184,121,72,.4); }
      .room-section { padding-top: 12px; padding-bottom: 12px; }
      .room-header, .room-row { display: grid; grid-template-columns: 1.2fr .65fr 1.25fr .8fr; align-items: center; gap: 12px; }
      .room-header { min-height: 34px; color: #6e7276; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; padding: 0 14px; }
      .room-row { min-height: 64px; padding: 0 14px; border-top: 1px solid var(--line); }
      .room-row > strong { font-size: 14px; }
      .temp-demo { font-size: 17px; }
      .temp-demo small { display: block; font-size: 8px; color: #65686c; text-transform: uppercase; letter-spacing: .1em; }
      .setpoint { display: grid; grid-template-columns: 34px 1fr 34px; align-items: center; text-align: center; max-width: 180px; }
      .setpoint button { height: 34px; border: 1px solid var(--line); background: var(--surface-2); border-radius: 10px; }
      .setpoint span { color: var(--muted); font-size: 14px; }
      .room-state { color: #6e7276; font-size: 10px; }
      .schedule-link { display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--line); border-radius: 18px; padding: 15px 20px; background: rgba(255,255,255,.015); }
      .schedule-link div { display: flex; flex-direction: column; gap: 2px; }
      .schedule-link > span { color: var(--muted); font-size: 11px; }

      .media-layout { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr auto; gap: 18px; min-height: 100%; }
      .media-selector h2 { margin: 4px 0 20px; }
      .source-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .source-card { min-height: 100px; border: 1px solid var(--line); border-radius: 17px; background: rgba(255,255,255,.018); text-align: left; padding: 15px; display: flex; flex-direction: column; gap: 3px; }
      .source-card > span { font-size: 22px; color: var(--accent-bright); margin-bottom: 8px; }
      .source-card small { color: var(--muted); }
      .playback-placeholder { height: calc(100% - 55px); min-height: 210px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--muted); }
      .playback-placeholder strong { color: var(--text); margin: 12px 0 5px; }
      .playback-placeholder p { max-width: 370px; font-size: 11px; line-height: 1.5; }
      .large-symbol { font-size: 44px; color: var(--accent-bright); }
      .now-playing { grid-column: 1 / 3; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 82px; padding: 12px 20px; border: 1px solid var(--line); border-radius: 20px; background: var(--surface); }
      .now-playing > div:first-child { display: flex; flex-direction: column; gap: 3px; }
      .transport { display: flex; gap: 8px; }
      .transport button { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface-2); }
      .transport .play { width: 46px; height: 46px; background: var(--accent-soft); }
      .volume { justify-self: end; display: flex; align-items: center; gap: 9px; color: var(--muted); }
      .volume i { display: block; width: 120px; height: 3px; background: var(--surface-3); border-radius: 3px; }

      .door-layout { display: grid; grid-template-columns: 1.55fr .8fr; gap: 18px; min-height: 100%; }
      .camera-card { overflow: hidden; border: 1px solid var(--line); border-radius: 24px; background: var(--surface); display: grid; grid-template-rows: 1fr 64px; }
      .camera-placeholder { min-height: 360px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at center, #24272a, #111315 68%); color: var(--muted); gap: 5px; }
      .camera-placeholder strong { color: var(--text); margin-top: 10px; }
      .camera-icon { font-size: 44px; color: var(--accent-bright); }
      .camera-caption { gap: 12px; padding: 0 20px; }
      .camera-caption span:last-child { margin-left: auto; color: var(--muted); font-size: 10px; }
      .door-side { display: flex; flex-direction: column; gap: 18px; }
      .door-side .section { flex: 1; }
      .door-actions { display: flex; flex-direction: column; gap: 9px; margin-top: 18px; }
      .door-actions button { min-height: 48px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,.02); text-align: left; padding: 0 14px; }
      .door-actions .demo-action { opacity: 1; cursor: pointer; color: var(--accent-bright); border-color: rgba(184,121,72,.3); background: var(--accent-soft); }
      .empty-state { margin-top: 18px; min-height: 80px; display: grid; place-items: center; color: var(--muted); font-size: 11px; border: 1px dashed var(--line-strong); border-radius: 14px; }

      .settings-layout { max-width: 980px; margin: 0 auto; padding-top: 4vh; }
      .settings-intro { margin-bottom: 28px; }
      .settings-intro h1 { font-size: clamp(42px, 5vw, 72px); font-weight: 300; letter-spacing: -.045em; margin: 5px 0 8px; }
      .settings-intro p { color: var(--muted); }
      .settings-card { padding-top: 4px; padding-bottom: 4px; }
      .settings-row { display: flex; align-items: center; min-height: 78px; border-bottom: 1px solid var(--line); gap: 20px; }
      .settings-row:last-child { border-bottom: 0; }
      .settings-row > div { display: flex; flex-direction: column; flex: 1; gap: 4px; }
      .settings-row span { color: var(--muted); font-size: 11px; }
      .tag { flex: 0 0 auto !important; border: 1px solid var(--line); border-radius: 99px; padding: 5px 9px; }
      .connection.ok { color: var(--good) !important; }

      .menu-scrim { position: absolute; inset: 76px 0 88px; background: rgba(0,0,0,.38); backdrop-filter: blur(3px); z-index: 30; }
      .app-menu { position: absolute; top: 66px; right: 28px; z-index: 40; width: min(390px, calc(100% - 40px)); border: 1px solid var(--line-strong); border-radius: 20px; background: #151719; box-shadow: 0 25px 80px rgba(0,0,0,.45); padding: 18px; }
      .menu-head { justify-content: space-between; margin-bottom: 14px; }
      .version { color: var(--muted); font-size: 11px; border: 1px solid var(--line); padding: 5px 8px; border-radius: 9px; }
      .menu-status { justify-content: space-between; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.025); color: var(--muted); font-size: 10px; margin-bottom: 10px; }
      .app-menu > button { width: 100%; min-height: 62px; display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: 10px; border: 0; border-top: 1px solid var(--line); background: transparent; text-align: left; cursor: pointer; }
      .app-menu > button > span { color: var(--accent-bright); font-size: 19px; }
      .app-menu > button div { display: flex; flex-direction: column; gap: 2px; }
      .app-menu > button small { color: var(--muted); }
      .app-menu > button > b { color: #666; font-size: 20px; }
      .menu-foot { color: #5f6265; font-size: 9px; padding-top: 10px; text-align: center; }

      .display-overlay { position: absolute; inset: 0; z-index: 90; background: rgba(4,5,6,.92); backdrop-filter: blur(16px); }
      .calibration-frame { position: absolute; pointer-events: none; z-index: 91; }
      .corner { position: absolute; width: 54px; height: 54px; border-color: var(--accent-bright); border-style: solid; opacity: .95; }
      .corner.tl { top: 0; left: 0; border-width: 3px 0 0 3px; border-radius: 8px 0 0 0; }
      .corner.tr { top: 0; right: 0; border-width: 3px 3px 0 0; border-radius: 0 8px 0 0; }
      .corner.bl { bottom: 0; left: 0; border-width: 0 0 3px 3px; border-radius: 0 0 0 8px; }
      .corner.br { bottom: 0; right: 0; border-width: 0 3px 3px 0; border-radius: 0 0 8px 0; }
      .display-panel { position: absolute; z-index: 92; width: min(720px, calc(100% - 100px)); max-height: calc(100% - 100px); overflow: auto; top: 50%; left: 50%; transform: translate(-50%,-50%); border: 1px solid var(--line-strong); border-radius: 24px; background: #141618; box-shadow: 0 35px 120px rgba(0,0,0,.65); padding: 24px; }
      .display-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
      .display-close { width: 38px; height: 38px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); cursor: pointer; font-size: 22px; }
      .auto-detect { display: grid; grid-template-columns: 1.4fr repeat(5,1fr); gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: rgba(255,255,255,.018); }
      .auto-detect > div { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; padding: 5px 7px; }
      .auto-detect span { color: var(--muted); font-size: 9px; }
      .auto-detect strong { font-size: 17px; font-weight: 580; }
      .auto-detect b { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .calibration-help { display: flex; flex-direction: column; gap: 4px; margin: 18px 2px 12px; }
      .calibration-help span { color: var(--muted); font-size: 10px; line-height: 1.45; }
      .cal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
      .cal-control { display: block; padding: 10px 12px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,.015); }
      .cal-control > div { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; font-size: 11px; }
      .cal-control > div span { color: var(--accent-bright); }
      .cal-control input { width: 100%; accent-color: var(--accent); }
      .scale-control { margin-top: 10px; }
      .display-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }
      .display-actions button { min-height: 42px; padding: 0 15px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); cursor: pointer; }
      .display-actions .primary { background: var(--accent-soft); border-color: rgba(184,121,72,.45); color: var(--accent-bright); }
      .local-note { display: block; text-align: right; color: #686b6e; margin-top: 8px; font-size: 9px; }

      .doorbell-overlay { position: absolute; inset: 0; z-index: 100; display: grid; place-items: center; padding: 4vw; background: rgba(5,6,7,.88); backdrop-filter: blur(20px); }
      .doorbell-card { width: min(1050px, 94%); max-height: 92%; border: 1px solid rgba(255,255,255,.14); border-radius: 30px; background: #111315; padding: clamp(20px, 2.5vw, 38px); box-shadow: 0 35px 120px rgba(0,0,0,.6); }
      .doorbell-top { gap: 18px; margin-bottom: 22px; }
      .doorbell-top h1 { font-size: clamp(30px, 3.5vw, 50px); font-weight: 360; letter-spacing: -.035em; margin-top: 2px; }
      .pulse-ring { width: 15px; height: 15px; border-radius: 50%; background: var(--accent-bright); box-shadow: 0 0 0 8px rgba(212,154,103,.12), 0 0 28px rgba(212,154,103,.4); }
      .demo-badge { margin-left: auto; border: 1px solid var(--line-strong); color: var(--muted); border-radius: 99px; padding: 6px 9px; font-size: 9px; }
      .doorbell-camera { min-height: 320px; border-radius: 20px; background: radial-gradient(circle at center,#292c2e,#0b0d0e 70%); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--muted); }
      .doorbell-camera > span { font-size: 50px; color: var(--accent-bright); }
      .doorbell-camera strong { color: var(--text); margin: 10px 0 3px; }
      .doorbell-actions { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-top: 18px; }
      .doorbell-actions button { min-height: 70px; border: 1px solid var(--line); border-radius: 17px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; gap: 9px; }
      .doorbell-actions button span { font-size: 20px; }
      .doorbell-actions .dismiss { opacity: 1; cursor: pointer; border-color: rgba(184,109,100,.3); color: #d49790; }

      @media (max-width: 900px) {
        .app-shell { grid-template-rows: 68px minmax(0,1fr) 78px; }
        .top-clock { display: none; }
        .home-grid { grid-template-columns: 1fr; grid-template-rows: auto; height: auto; }
        .weather-hero { grid-row: auto; min-height: 340px; }
        .status-strip { grid-template-columns: 1fr 1fr; }
        .status-primary { grid-column: 1 / 3; }
        .area-grid { grid-template-columns: 1fr 1fr; }
        .two-column, .media-layout, .door-layout { grid-template-columns: 1fr; }
        .now-playing { grid-column: 1; }
        .room-header, .room-row { grid-template-columns: 1fr .6fr 1.2fr; }
        .room-header span:last-child, .room-state { display: none; }
        .door-side { display: grid; grid-template-columns: 1fr 1fr; }
      }

      @media (max-height: 760px) and (min-width: 901px) {
        .app-shell { grid-template-rows: 66px minmax(0,1fr) 76px; min-height: 620px; }
        .content { padding-top: 14px; padding-bottom: 14px; }
        .hero-time { font-size: 62px; }
        .weather-hero { min-height: 250px; }
      }
    `;
  }
}

if (!customElements.get("jamesui-panel")) {
  customElements.define("jamesui-panel", JamesUIPanel);
}
