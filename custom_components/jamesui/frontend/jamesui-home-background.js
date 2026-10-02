const ALPINE_ASSET_ROOT = "/jamesui_static/assets/alpine";

export const HOME_BACKGROUND_SCENES = [
  { key: "clear-day", label: "Klarer Tag", asset: `${ALPINE_ASSET_ROOT}/clear-day.webp`, tone: "day", weatherClass: "clear" },
  { key: "cloudy-day", label: "Bewölkter Tag", asset: `${ALPINE_ASSET_ROOT}/cloudy-day.webp`, tone: "day", weatherClass: "cloudy" },
  { key: "rain-day", label: "Regen", asset: `${ALPINE_ASSET_ROOT}/rain-day.webp`, tone: "day", weatherClass: "rain" },
  { key: "snow-day", label: "Schnee", asset: `${ALPINE_ASSET_ROOT}/snow-day.webp`, tone: "day", weatherClass: "snow" },
  { key: "fog", label: "Nebel", asset: `${ALPINE_ASSET_ROOT}/fog.webp`, tone: "day", weatherClass: "fog" },
  { key: "dusk", label: "Dämmerung", asset: `${ALPINE_ASSET_ROOT}/dusk.webp`, tone: "dusk", weatherClass: "clear" },
  { key: "clear-night", label: "Klare Nacht", asset: `${ALPINE_ASSET_ROOT}/clear-night.webp`, tone: "night", weatherClass: "clear" },
  { key: "cloudy-night", label: "Bewölkte Nacht", asset: `${ALPINE_ASSET_ROOT}/cloudy-night.webp`, tone: "night", weatherClass: "cloudy" },
];

const SCENES_BY_KEY = new Map(HOME_BACKGROUND_SCENES.map((scene) => [scene.key, scene]));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function resolveConfiguredAtmosphere(autoAtmosphere, config = {}) {
  if (config?.background_mode !== "manual") return autoAtmosphere;
  const manual = SCENES_BY_KEY.get(config?.background_scene);
  return manual ? { ...manual } : autoAtmosphere;
}

function normalizeBackgroundSelection(root, config = {}) {
  const mode = root?.querySelector?.("[data-config-background-mode]")?.value === "manual" ? "manual" : "auto";
  const requestedScene = root?.querySelector?.("[data-config-background-scene]")?.value || config?.background_scene;
  const scene = SCENES_BY_KEY.has(requestedScene) ? requestedScene : "cloudy-night";
  return { mode, scene };
}

function normalizeHomeSceneSelection(root) {
  if (!root?.querySelectorAll) return [];
  const selected = [...root.querySelectorAll("[data-config-home-scene]")]
    .map((element) => String(element.value || "").trim())
    .filter((value) => value.startsWith("scene."));
  return [...new Set(selected)].slice(0, 4);
}

function previewLabel(mode, scene) {
  const selected = SCENES_BY_KEY.get(scene);
  return mode === "manual"
    ? `Manuell · ${selected?.label || "Szene"}`
    : "Automatisch · Wetter + Tageszeit";
}

function renderHomeSceneSelect(index, selectedId, sceneOptions) {
  const options = Array.isArray(sceneOptions) ? sceneOptions : [];
  return `
    <div class="config-field start-scene-config-field">
      <div><strong>Szene ${index + 1}</strong><span>Favorit auf der Startseite</span></div>
      <select data-config-home-scene="${index}">
        <option value="">Keine Auswahl</option>
        ${options.map((item) => {
          const entityId = escapeHtml(item?.entityId || "");
          const name = escapeHtml(item?.name || item?.entityId || "Szene");
          return `<option value="${entityId}" ${item?.entityId === selectedId ? "selected" : ""}>${name}</option>`;
        }).join("")}
      </select>
    </div>`;
}

export function renderBackgroundSettings(config = {}, sceneOptions = []) {
  const mode = config?.background_mode === "manual" ? "manual" : "auto";
  const scene = SCENES_BY_KEY.has(config?.background_scene) ? config.background_scene : "cloudy-night";
  const configuredScenes = Array.isArray(config?.home_scene_entities) ? config.home_scene_entities.slice(0, 4) : [];
  return `
    <section class="section config-section alpine-background-config">
      <div class="section-head">
        <div><span>STARTSEITE</span><h3>Atmosphäre & Favoriten</h3></div>
      </div>
      <div class="config-field">
        <div><strong>Hintergrundmodus</strong><span>Automatisch folgt Wetter und Sonnenstand; manuell dient zum Testen einer festen Szene.</span></div>
        <select data-config-background-mode>
          <option value="auto" ${mode === "auto" ? "selected" : ""}>Automatisch</option>
          <option value="manual" ${mode === "manual" ? "selected" : ""}>Manuell</option>
        </select>
      </div>
      <div class="config-field">
        <div><strong>Testszenario</strong><span>Wird nur im manuellen Modus als Hintergrund verwendet. Wetterwerte bleiben weiterhin live.</span></div>
        <select data-config-background-scene>
          ${HOME_BACKGROUND_SCENES.map((item) => `<option value="${item.key}" ${item.key === scene ? "selected" : ""}>${item.label}</option>`).join("")}
        </select>
      </div>
      <div class="alpine-background-preview" style="--preview:url('${SCENES_BY_KEY.get(scene)?.asset || HOME_BACKGROUND_SCENES[0].asset}')">
        <span>${previewLabel(mode, scene)}</span>
      </div>
      <div class="start-scene-settings">
        <div class="start-scene-settings-head"><strong>Lieblingsszenen</strong><span>Bis zu vier Szenen für den Hausstatus auf Start.</span></div>
        ${[0, 1, 2, 3].map((index) => renderHomeSceneSelect(index, configuredScenes[index] || "", sceneOptions)).join("")}
      </div>
      <div class="config-actions alpine-background-actions">
        <span data-background-message></span>
        <button data-save-background>Start speichern</button>
      </div>
    </section>
  `;
}

function automaticAtmosphereFromMarkup(html) {
  const key = html.match(/data-atmosphere="([^"]+)"/)?.[1] || "cloudy-day";
  const asset = html.match(/url\('([^']+\/assets\/alpine\/[^']+)'\)/)?.[1] || `${ALPINE_ASSET_ROOT}/cloudy-day.webp`;
  const tone = html.match(/\btone-(day|dusk|night)\b/)?.[1] || "day";
  const weatherClass = html.match(/\bweather-(clear|cloudy|rain|snow|fog)\b/)?.[1] || "cloudy";
  return { key, asset, tone, weatherClass };
}

function photoOverlay(asset) {
  return `background-image:linear-gradient(90deg,rgba(8,10,11,.34) 0%,rgba(8,10,11,.18) 38%,rgba(8,10,11,.03) 68%,rgba(8,10,11,.07) 100%),linear-gradient(0deg,rgba(8,9,10,.48) 0%,rgba(8,9,10,.03) 50%,rgba(8,9,10,.04) 100%),url('${asset}')`;
}

export function applyConfiguredBackground(html, config = {}) {
  const autoAtmosphere = automaticAtmosphereFromMarkup(html);
  const selected = resolveConfiguredAtmosphere(autoAtmosphere, config);
  let result = html
    .replace(/background-image:[^"]*url\('[^']+'\)/, photoOverlay(selected.asset));

  if (selected.key !== autoAtmosphere.key) {
    result = result
      .replace(/data-atmosphere="[^"]+"/, `data-atmosphere="${selected.key}"`)
      .replace(/\btone-(day|dusk|night)\b/, `tone-${selected.tone}`)
      .replace(/\bweather-(clear|cloudy|rain|snow|fog)\b/, `weather-${selected.weatherClass}`);
  }
  return result;
}

function sceneOptionsFromPanel(panel) {
  if (Array.isArray(panel?._jamesHomeAllScenes)) return panel._jamesHomeAllScenes;
  return Object.entries(panel?._hass?.states || {})
    .filter(([entityId, entity]) => entityId.startsWith("scene.") && entity?.state !== "unavailable")
    .map(([entityId, entity]) => ({ entityId, name: entity?.attributes?.friendly_name || entityId }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function updateBackgroundPreview(panel) {
  const root = panel?.shadowRoot;
  if (!root) return;
  const { mode, scene } = normalizeBackgroundSelection(root, panel._config || {});
  const selected = SCENES_BY_KEY.get(scene) || HOME_BACKGROUND_SCENES[0];
  const preview = root.querySelector(".alpine-background-preview");
  const label = preview?.querySelector("span");
  const sceneSelect = root.querySelector("[data-config-background-scene]");
  if (preview) preview.style.setProperty("--preview", `url('${selected.asset}')`);
  if (label) label.textContent = previewLabel(mode, scene);
  if (sceneSelect) sceneSelect.disabled = mode !== "manual";
}

export async function saveBackgroundConfig(panel) {
  const root = panel?.shadowRoot;
  if (!root || !panel?._hass?.connection) return false;
  const { mode, scene } = normalizeBackgroundSelection(root, panel._config || {});
  const homeSceneEntities = normalizeHomeSceneSelection(root);
  const message = root.querySelector("[data-background-message]");
  const button = root.querySelector("[data-save-background]");
  if (message) message.textContent = "Speichere …";
  if (button) button.disabled = true;

  try {
    const response = await panel._hass.connection.sendMessagePromise({
      type: "jamesui/config/update",
      background_mode: mode,
      background_scene: scene,
      home_scene_entities: homeSceneEntities,
    });
    panel._config = response?.result?.options || response?.options || {
      ...(panel._config || {}),
      background_mode: mode,
      background_scene: scene,
      home_scene_entities: homeSceneEntities,
    };
    panel._configMessage = "";
    panel.render?.();
    const nextMessage = panel.shadowRoot?.querySelector("[data-background-message]");
    if (nextMessage) nextMessage.textContent = "Startseite gespeichert.";
    return true;
  } catch (error) {
    console.error("JamesUI: Start configuration save failed", error);
    if (message) message.textContent = "Startseite konnte nicht gespeichert werden.";
    if (button) button.disabled = false;
    return false;
  }
}

function bindBackgroundSettings(panel) {
  const root = panel?.shadowRoot;
  if (!root) return;
  const mode = root.querySelector("[data-config-background-mode]");
  const scene = root.querySelector("[data-config-background-scene]");
  const save = root.querySelector("[data-save-background]");
  if (!mode || !scene || !save) return;

  const refreshPreview = () => updateBackgroundPreview(panel);
  mode.addEventListener("change", refreshPreview);
  scene.addEventListener("change", refreshPreview);
  save.addEventListener("click", () => saveBackgroundConfig(panel));
  updateBackgroundPreview(panel);
}

export function installHomeBackgroundExperience() {
  if (typeof customElements === "undefined") return false;
  const Panel = customElements.get("jamesui-panel");
  if (!Panel || Panel.prototype.__jamesHomeBackgroundInstalled) return Boolean(Panel);

  const originalHomePage = Panel.prototype._homePage;
  const originalHomeSettingsPage = Panel.prototype._homeSettingsPage;
  const originalStyles = Panel.prototype._styles;
  const originalRender = Panel.prototype.render;

  Panel.prototype._homePage = function () {
    return applyConfiguredBackground(originalHomePage.call(this), this._config || {});
  };

  if (typeof originalHomeSettingsPage === "function") {
    Panel.prototype._homeSettingsPage = function () {
      const base = originalHomeSettingsPage.call(this);
      const controls = renderBackgroundSettings(this._config || {}, sceneOptionsFromPanel(this));
      const marker = '<section class="settings-note">';
      return base.includes(marker) ? base.replace(marker, `${controls}${marker}`) : `${base}${controls}`;
    };
  }

  if (typeof originalRender === "function") {
    Panel.prototype.render = function (...args) {
      const result = originalRender.apply(this, args);
      bindBackgroundSettings(this);
      return result;
    };
  }

  Panel.prototype._styles = function () {
    return `${originalStyles.call(this)}
      .alpine-home .alpine-atmosphere{filter:saturate(1.02) contrast(1.01) brightness(1.08)}
      .alpine-home.weather-rain .alpine-atmosphere{filter:saturate(.92) contrast(1.03) brightness(1.06)}
      .alpine-home.weather-snow .alpine-atmosphere{filter:saturate(.94) contrast(1.00) brightness(1.08)}
      .alpine-home.weather-fog .alpine-atmosphere{filter:saturate(.82) contrast(.96) brightness(1.07)}
      .alpine-home.tone-night .alpine-atmosphere{filter:saturate(.98) contrast(1.02) brightness(1.18)}
      .alpine-background-config{margin-top:18px}.alpine-background-preview{min-height:112px;margin-top:14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background-image:linear-gradient(0deg,rgba(7,8,9,.36),rgba(7,8,9,.03)),var(--preview);background-size:cover;background-position:center;display:flex;align-items:flex-end;padding:14px 16px;overflow:hidden}.alpine-background-preview span{font-size:10px;color:rgba(246,242,234,.92);text-shadow:0 2px 12px rgba(0,0,0,.8)}
      .start-scene-settings{margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07)}.start-scene-settings-head{display:flex;justify-content:space-between;gap:18px;margin-bottom:6px}.start-scene-settings-head strong{font-size:13px}.start-scene-settings-head span{color:rgba(235,230,220,.58);font-size:10px}.start-scene-config-field{margin-top:0}
      .alpine-background-actions{margin-top:14px}.alpine-background-actions [data-background-message]{min-height:1em}.alpine-background-config select:disabled{opacity:.48}
      @media(orientation:portrait){.alpine-home.tone-night .alpine-atmosphere{filter:saturate(1) contrast(1.02) brightness(1.22)}.alpine-home .alpine-surface{background:linear-gradient(180deg,rgba(7,8,9,.01) 0%,rgba(7,8,9,.02) 30%,rgba(7,8,9,.06) 46%,rgba(8,9,9,.22) 60%,rgba(8,9,9,.58) 76%,rgba(8,9,9,.86) 90%,#080909 100%),linear-gradient(90deg,rgba(7,8,9,.08),transparent 56%)}}
    `;
  };

  Panel.prototype.__jamesHomeBackgroundInstalled = true;
  return true;
}
