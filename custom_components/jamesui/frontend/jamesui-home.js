export function summarizeHomeState(panel) {
  const states = panel?._hass?.states || {};
  const house = panel?._houseSummary?.() || {};
  const entityIds = (domain) => panel?._entityIds?.(domain) || [];

  const climateTemps = entityIds("climate")
    .map((id) => Number(states[id]?.attributes?.current_temperature))
    .filter(Number.isFinite);
  const avgClimate = climateTemps.length
    ? `${(climateTemps.reduce((sum, value) => sum + value, 0) / climateTemps.length).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°`
    : "Noch nicht verknüpft";

  const playing = entityIds("media_player").filter((id) => states[id]?.state === "playing");
  const doorEntities = entityIds("binary_sensor").filter((id) => {
    const entity = states[id];
    const deviceClass = entity?.attributes?.device_class;
    const name = `${id} ${entity?.attributes?.friendly_name || ""}`.toLowerCase();
    return ["door", "garage_door", "opening"].includes(deviceClass)
      && /tür|tur|door|tor|gate|garage/.test(name);
  });
  const openDoors = doorEntities.filter((id) => states[id]?.state === "on");

  const alerts = [];
  if (house.unavailable) alerts.push(`${house.unavailable} Gerät${house.unavailable === 1 ? "" : "e"} offline`);
  if (house.lowBattery) alerts.push(`${house.lowBattery} Batterie${house.lowBattery === 1 ? "" : "n"} niedrig`);
  if (openDoors.length) alerts.push(openDoors.length === 1 ? `${states[openDoors[0]]?.attributes?.friendly_name || "Tür"} offen` : `${openDoors.length} Türen/Tore offen`);

  return {
    headline: alerts.length ? "Aufmerksamkeit nötig" : "Alles ruhig",
    detail: alerts.length ? alerts.join(" · ") : "Keine wichtigen Abweichungen erkannt.",
    house: {
      value: house.unavailable
        ? `${house.unavailable} offline`
        : house.lightsOn
          ? `${house.lightsOn} Licht${house.lightsOn === 1 ? "" : "er"} an`
          : "Alles ruhig",
      tone: house.unavailable || house.lowBattery ? "alert" : house.lightsOn ? "active" : "quiet",
    },
    climate: { value: avgClimate, tone: "quiet" },
    media: {
      value: playing.length ? (playing.length === 1 ? "Wiedergabe aktiv" : `${playing.length} Wiedergaben aktiv`) : "Keine Wiedergabe",
      tone: playing.length ? "active" : "quiet",
    },
    door: {
      value: openDoors.length ? (openDoors.length === 1 ? "Offen" : `${openDoors.length} offen`) : "Geschlossen",
      tone: openDoors.length ? "alert" : "quiet",
    },
  };
}

function navCard(target, icon, label, value, tone = "quiet") {
  return `
    <button class="home-nav-card ${tone}" data-nav="${target}">
      <span class="home-nav-icon">${icon}</span>
      <span class="home-nav-copy"><strong>${label}</strong><small>${value}</small></span>
      <span class="home-nav-arrow">›</span>
    </button>
  `;
}

export function installHomeExperience() {
  if (typeof customElements === "undefined") return false;
  const Panel = customElements.get("jamesui-panel");
  if (!Panel || Panel.prototype.__jamesHomeExperienceInstalled) return Boolean(Panel);

  const originalStyles = Panel.prototype._styles;

  Panel.prototype._homePage = function () {
    const weather = this._hass?.states?.[this._weatherEntityId()];
    const sun = this._hass?.states?.["sun.sun"];
    const forecast = this._normalizedDailyForecast();
    const today = forecast[0] || {};
    const moon = this._moonInfo();
    const moonDetails = this._moonDetails();
    const ambient = this._ambientLight();
    const condition = weather?.state || "unknown";
    const period = this._sunPeriod();
    const background = this._weatherBackground(condition, period);
    const unit = weather?.attributes?.temperature_unit || "°C";
    const high = this._formatTemperature(today.temperature, unit);
    const low = this._formatTemperature(today.templow, unit);
    const precip = Number.isFinite(Number(today.precipitation_probability)) ? `${Math.round(Number(today.precipitation_probability))}%` : "–";
    const humidity = Number.isFinite(Number(weather?.attributes?.humidity)) ? `${Math.round(Number(weather.attributes.humidity))}%` : "–";
    const wind = Number.isFinite(Number(weather?.attributes?.wind_speed))
      ? `${Math.round(Number(weather.attributes.wind_speed))} ${weather.attributes.wind_speed_unit || ""}`.trim() : "–";
    const elevation = Number(sun?.attributes?.elevation);
    const azimuth = Number(sun?.attributes?.azimuth);
    const nextRising = this._formatSunEvent(sun?.attributes?.next_rising);
    const nextSetting = this._formatSunEvent(sun?.attributes?.next_setting);
    const status = summarizeHomeState(this);

    return `
      <section class="home-grid home-grid-refined">
        <div class="home-top-grid refined-home-top-grid">
          <article class="weather-hero weather-${condition} period-${period}">
            <div class="weather-sky">
              <div class="weather-background" style="background-image:url('${background}')"></div>
              <div class="weather-stars"></div>
              <div class="weather-cloud cloud-a"></div>
              <div class="weather-cloud cloud-b"></div>
              <div class="weather-precip"></div>
              <div class="sun-disc" style="--sun-x:${Number.isFinite(azimuth) ? Math.max(8, Math.min(92, azimuth / 360 * 100)) : 75}%"></div>
              <div class="ambient-dimmer" style="opacity:${ambient.dim}"></div>
              <div class="weather-gradient"></div>
            </div>

            <div class="hero-content">
              <div class="hero-clock">
                <div class="hero-date" data-live-date></div>
                <div class="hero-time" data-live-time></div>
                <div class="solar-line">
                  <span>${period === "night" ? "Nacht" : period === "twilight" ? "Dämmerung" : period === "golden" ? "Goldene Stunde" : "Tag"}</span>
                  <i></i>
                  <span>Sonne <b data-sun-elevation>${Number.isFinite(elevation) ? elevation.toFixed(1) + "°" : "–"}</b></span>
                </div>
              </div>

              <div class="weather-current">
                <span class="weather-main-symbol" data-weather-symbol>${this._weatherSymbol(condition, this._isNight())}</span>
                <strong class="weather-temperature" data-weather-temp>${this._currentTemperature()}</strong>
                <span class="weather-condition" data-weather-condition>${this._weatherConditionLabel(condition)}</span>
                <div class="weather-detail-row"><span>↑ ${high}</span><span>↓ ${low}</span><span>Regen ${precip}</span></div>
              </div>
            </div>

            <div class="hero-footer weather-footer">
              <div><span>Feuchte</span><strong>${humidity}</strong></div>
              <div><span>Wind</span><strong>${wind}</strong></div>
              <div><span>Helligkeit</span><strong>${ambient.label}</strong></div>
              <div><span>Auf · Unter</span><strong>${nextRising} · ${nextSetting}</strong></div>
              <button class="forecast-button" data-open-forecast ${forecast.length ? "" : "disabled"}>3-Tage-Prognose →</button>
            </div>
          </article>

          <aside class="home-status-card ${status.headline === "Alles ruhig" ? "calm" : "attention"}">
            <div class="home-status-head">
              <div><span class="eyebrow">ZUHAUSE</span><h2>${status.headline}</h2></div>
              <span class="home-status-orb"></span>
            </div>
            <p>${status.detail}</p>
            <div class="home-status-links">
              ${navCard("house", "◇", "Haus", status.house.value, status.house.tone)}
              ${navCard("climate", "◌", "Klima", status.climate.value, status.climate.tone)}
              ${navCard("media", "▶", "Medien", status.media.value, status.media.tone)}
              ${navCard("door", "▣", "Tür", status.door.value, status.door.tone)}
            </div>
            <div class="home-sky-note">
              <span>${moon[1]}</span>
              <div><strong>${moon[0]}</strong><small>${moonDetails.illumination}% beleuchtet</small></div>
            </div>
          </aside>
        </div>

        <section class="home-action-row">
          <div class="home-action-heading">
            <div><span class="eyebrow">DIREKTZUGRIFF</span><h2>Haus auf einen Blick</h2></div>
            <span class="live-badge">${this._hass ? "LIVE" : "OFFLINE"}</span>
          </div>
          <div class="home-nav-grid">
            ${navCard("house", "◇", "Haus", status.house.value, status.house.tone)}
            ${navCard("climate", "◌", "Klima", status.climate.value, status.climate.tone)}
            ${navCard("media", "▶", "Medien", status.media.value, status.media.tone)}
            ${navCard("door", "▣", "Tür", status.door.value, status.door.tone)}
          </div>
        </section>

        <section class="home-scenes-row">
          <div class="home-scenes-copy"><span class="eyebrow">HAUSMODUS</span><strong>Szenen</strong><small>Auswahl vorbereitet · Verknüpfung folgt</small></div>
          <div class="scene-slider compact-scenes">
            ${["Morgen", "Alltag", "Fernsehen", "Abend", "Nacht"].map((scene) => `
              <button data-scene="${scene}" class="scene-pill ${this._scene === scene ? "selected" : ""}">
                <span class="scene-dot"></span>${scene}
              </button>`).join("")}
          </div>
        </section>
      </section>
    `;
  };

  Panel.prototype._styles = function () {
    return `${originalStyles.call(this)}
      .home-grid-refined { gap: 14px; }
      .refined-home-top-grid { grid-template-columns: minmax(0, 2.55fr) minmax(280px, .82fr); min-height: clamp(360px, 52vh, 520px); }
      .home-status-card { display:flex; flex-direction:column; min-width:0; padding:22px; border:1px solid var(--line); border-radius:28px; background:linear-gradient(160deg,rgba(25,27,29,.98),rgba(14,16,17,.98)); }
      .home-status-card.attention { border-color:rgba(184,109,100,.28); }
      .home-status-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
      .home-status-head h2 { font-size:clamp(22px,2vw,30px); font-weight:420; margin-top:4px; }
      .home-status-orb { width:11px; height:11px; margin-top:9px; border-radius:50%; background:var(--good); box-shadow:0 0 0 6px rgba(127,165,138,.08); }
      .home-status-card.attention .home-status-orb { background:var(--danger); box-shadow:0 0 0 6px rgba(184,109,100,.08); }
      .home-status-card > p { margin:10px 0 17px; color:var(--muted); font-size:10px; line-height:1.45; }
      .home-status-links { display:flex; flex-direction:column; gap:7px; }
      .home-nav-card { width:100%; min-width:0; display:grid; grid-template-columns:34px 1fr auto; align-items:center; gap:10px; min-height:54px; padding:8px 10px; border:1px solid var(--line); border-radius:14px; background:rgba(255,255,255,.018); text-align:left; cursor:pointer; }
      .home-nav-card:hover { border-color:rgba(184,121,72,.35); background:rgba(184,121,72,.055); }
      .home-nav-card.active { border-color:rgba(184,121,72,.26); }
      .home-nav-card.alert { border-color:rgba(184,109,100,.25); background:rgba(184,109,100,.045); }
      .home-nav-icon { width:32px; height:32px; display:grid; place-items:center; border-radius:10px; background:rgba(255,255,255,.035); color:var(--accent-bright); font-size:16px; }
      .home-nav-card.alert .home-nav-icon { color:#d49790; }
      .home-nav-copy { min-width:0; display:flex; flex-direction:column; gap:2px; }
      .home-nav-copy strong { font-size:11px; font-weight:650; }
      .home-nav-copy small { color:var(--muted); font-size:9px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .home-nav-arrow { color:#696d70; font-size:20px; }
      .home-sky-note { margin-top:auto; display:grid; grid-template-columns:30px 1fr; align-items:center; gap:9px; padding-top:15px; border-top:1px solid var(--line); color:var(--muted); }
      .home-sky-note > span { font-size:24px; color:#b6b8ba; }
      .home-sky-note > div { display:flex; flex-direction:column; gap:2px; }
      .home-sky-note strong { color:#c8c5c0; font-size:9px; font-weight:600; }
      .home-sky-note small { font-size:8px; }
      .home-action-row { padding:16px 18px 18px; border:1px solid var(--line); border-radius:20px; background:linear-gradient(145deg,rgba(21,23,25,.9),rgba(16,18,20,.9)); }
      .home-action-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
      .home-action-heading h2 { font-size:18px; font-weight:520; }
      .home-nav-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; }
      .home-nav-grid .home-nav-card { min-height:62px; }
      .home-scenes-row { min-height:66px; display:flex; align-items:center; gap:18px; padding:10px 14px 10px 18px; border:1px solid var(--line); border-radius:18px; background:rgba(255,255,255,.012); }
      .home-scenes-copy { min-width:155px; display:flex; flex-direction:column; gap:1px; }
      .home-scenes-copy strong { font-size:12px; }
      .home-scenes-copy small { color:var(--muted); font-size:8px; }
      .compact-scenes { margin-left:auto; flex-wrap:nowrap; }
      .compact-scenes .scene-pill { min-height:36px; padding:0 12px; }
      @media (max-width: 1050px) {
        .refined-home-top-grid { grid-template-columns:minmax(0,2fr) minmax(250px,.9fr); }
        .home-nav-grid { grid-template-columns:1fr 1fr; }
      }
      @media (max-width: 900px) {
        .refined-home-top-grid { grid-template-columns:1fr; }
        .home-status-card { min-height:300px; }
        .home-scenes-row { align-items:flex-start; flex-direction:column; }
        .compact-scenes { margin-left:0; flex-wrap:wrap; }
      }
    `;
  };

  Panel.prototype.__jamesHomeExperienceInstalled = true;
  return true;
}
