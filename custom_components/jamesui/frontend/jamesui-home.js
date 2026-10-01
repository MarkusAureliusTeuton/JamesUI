const ALPINE_ASSET_ROOT = "/jamesui_static/assets/alpine";

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
  if (openDoors.length) {
    alerts.push(
      openDoors.length === 1
        ? `${states[openDoors[0]]?.attributes?.friendly_name || "Tür"} offen`
        : `${openDoors.length} Türen/Tore offen`
    );
  }

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
      value: playing.length
        ? (playing.length === 1 ? "Wiedergabe aktiv" : `${playing.length} Wiedergaben aktiv`)
        : "Keine Wiedergabe",
      tone: playing.length ? "active" : "quiet",
    },
    door: {
      value: openDoors.length ? (openDoors.length === 1 ? "Offen" : `${openDoors.length} offen`) : "Geschlossen",
      tone: openDoors.length ? "alert" : "quiet",
    },
  };
}

export function resolveHomeAtmosphere(condition, period) {
  const phase = ["day", "golden", "twilight", "night"].includes(period) ? period : "day";
  const normalized = ({
    sunny: "clear",
    "clear-night": "clear",
    partlycloudy: "cloudy",
    cloudy: "cloudy",
    windy: "cloudy",
    "windy-variant": "cloudy",
    rainy: "rain",
    pouring: "rain",
    "snowy-rainy": "rain",
    lightning: "rain",
    "lightning-rainy": "rain",
    hail: "rain",
    exceptional: "cloudy",
    snowy: "snow",
    fog: "fog",
  })[condition] || "cloudy";

  let key;
  let filename;

  if (normalized === "fog") {
    key = "fog";
    filename = "fog.webp";
  } else if (phase === "twilight" || phase === "golden") {
    key = "dusk";
    filename = "dusk.webp";
  } else if (phase === "night") {
    if (normalized === "clear") {
      key = "clear-night";
      filename = "clear-night.webp";
    } else if (normalized === "snow") {
      key = "snow-night";
      filename = "cloudy-night.webp";
    } else if (normalized === "rain") {
      key = "rain-night";
      filename = "cloudy-night.webp";
    } else {
      key = "cloudy-night";
      filename = "cloudy-night.webp";
    }
  } else {
    key = `${normalized}-day`;
    filename = `${normalized}-day.webp`;
  }

  return {
    key,
    asset: `${ALPINE_ASSET_ROOT}/${filename}`,
    tone: phase === "night" ? "night" : phase === "twilight" || phase === "golden" ? "dusk" : "day",
    weatherClass: normalized,
  };
}

export function homeNavItems(status) {
  return [
    { target: "house", label: "Haus", value: status?.house?.value || "–", tone: status?.house?.tone || "quiet" },
    { target: "climate", label: "Klima", value: status?.climate?.value || "–", tone: status?.climate?.tone || "quiet" },
    { target: "media", label: "Medien", value: status?.media?.value || "–", tone: status?.media?.tone || "quiet" },
    { target: "door", label: "Tür", value: status?.door?.value || "–", tone: status?.door?.tone || "quiet" },
  ];
}

function functionIcon(target) {
  return ({ house: "⌂", climate: "◌", media: "▶", door: "▣" })[target] || "•";
}

function formatPeriod(period) {
  return ({ night: "Nacht", twilight: "Dämmerung", golden: "Goldene Stunde", day: "Tag" })[period] || "Tag";
}

export function renderAlpineHome(panel) {
  const hass = panel?._hass;
  const weatherId = panel?._weatherEntityId?.();
  const weather = weatherId ? hass?.states?.[weatherId] : null;
  const sun = hass?.states?.["sun.sun"];
  const forecast = panel?._normalizedDailyForecast?.() || [];
  const today = forecast[0] || {};
  const moon = panel?._moonInfo?.() || ["Mondphase nicht eingerichtet", "○", "unknown"];
  const moonDetails = panel?._moonDetails?.() || { illumination: 0 };
  const ambient = panel?._ambientLight?.() || { label: "Automatisch", dim: 0 };
  const condition = weather?.state || "unknown";
  const period = panel?._sunPeriod?.() || "day";
  const atmosphere = resolveHomeAtmosphere(condition, period);
  const unit = weather?.attributes?.temperature_unit || "°C";
  const high = panel?._formatTemperature?.(today.temperature, unit) || "–";
  const low = panel?._formatTemperature?.(today.templow, unit) || "–";
  const precip = Number.isFinite(Number(today.precipitation_probability))
    ? `${Math.round(Number(today.precipitation_probability))}%`
    : "–";
  const humidity = Number.isFinite(Number(weather?.attributes?.humidity))
    ? `${Math.round(Number(weather.attributes.humidity))}%`
    : "–";
  const wind = Number.isFinite(Number(weather?.attributes?.wind_speed))
    ? `${Math.round(Number(weather.attributes.wind_speed))} ${weather.attributes.wind_speed_unit || ""}`.trim()
    : "–";
  const nextRising = panel?._formatSunEvent?.(sun?.attributes?.next_rising) || "–";
  const nextSetting = panel?._formatSunEvent?.(sun?.attributes?.next_setting) || "–";
  const temperature = panel?._currentTemperature?.() || "–";
  const conditionLabel = panel?._weatherConditionLabel?.(condition) || "Keine Wetterdaten";
  const symbol = panel?._weatherSymbol?.(condition, panel?._isNight?.()) || "◌";
  const elevation = Number(sun?.attributes?.elevation);
  const status = summarizeHomeState(panel);
  const navItems = homeNavItems(status);
  const calm = status.headline === "Alles ruhig";

  return `
    <section class="alpine-home alpine-home-v2 alpine-home-v3 tone-${atmosphere.tone} weather-${atmosphere.weatherClass}" data-atmosphere="${atmosphere.key}">
      <div class="alpine-atmosphere" style="background-image:linear-gradient(90deg,rgba(8,10,11,.84) 0%,rgba(8,10,11,.52) 38%,rgba(8,10,11,.15) 68%,rgba(8,10,11,.24) 100%),linear-gradient(0deg,rgba(8,9,10,.88) 0%,rgba(8,9,10,.08) 50%,rgba(8,9,10,.12) 100%),url('${atmosphere.asset}')" aria-hidden="true"></div>
      <div class="alpine-atmosphere-fallback" aria-hidden="true"></div>
      <div class="alpine-ambient-shade" style="opacity:${Math.max(0, Math.min(.32, Number(ambient.dim) || 0))}"></div>

      <div class="alpine-surface">
        <header class="alpine-overview-head">
          <div class="alpine-clock-block">
            <div class="alpine-date" data-live-date></div>
            <div class="alpine-time" data-live-time></div>
            <div class="alpine-period-line"><span>${formatPeriod(period)}</span><i></i><span>${Number.isFinite(elevation) ? `Sonne ${elevation.toFixed(1)}°` : "Sonnenstand –"}</span></div>
          </div>
          <div class="alpine-connection"><span class="alpine-live-dot ${hass ? "online" : ""}"></span><span>${hass ? "Zuhause verbunden" : "Home Assistant offline"}</span></div>
        </header>

        <div class="alpine-primary-grid">
          <section class="alpine-weather-main">
            <div class="alpine-weather-topline"><span class="alpine-weather-symbol" data-weather-symbol>${symbol}</span><div><strong class="alpine-temperature" data-weather-temp>${temperature}</strong><span class="alpine-condition" data-weather-condition>${conditionLabel}</span></div></div>
            <div class="alpine-weather-range"><span><b>H</b> ${high}</span><span><b>T</b> ${low}</span><span><b>Regen</b> ${precip}</span></div>
            <dl class="alpine-weather-facts">
              <div><dt>Feuchte</dt><dd>${humidity}</dd></div>
              <div><dt>Wind</dt><dd>${wind}</dd></div>
              <div><dt>Helligkeit</dt><dd>${ambient.label || "Automatisch"}</dd></div>
              <div><dt>Sonne</dt><dd>${nextRising} · ${nextSetting}</dd></div>
            </dl>
            <button class="alpine-forecast-link" data-open-forecast ${forecast.length ? "" : "disabled"}>${forecast.length ? "3-Tage-Prognose" : "Keine Prognosedaten"} <span>→</span></button>
          </section>

          <aside class="alpine-home-status ${calm ? "calm" : "attention"}">
            <div class="alpine-status-kicker"><span>ZUHAUSE</span><i class="alpine-status-dot"></i></div>
            <h2>${status.headline}</h2>
            <p>${status.detail}</p>
            <div class="alpine-status-quietline"><span>${status.climate.value}</span><i></i><span>${status.door.value === "Geschlossen" ? "Türen geschlossen" : `Tür: ${status.door.value}`}</span><i></i><span>${status.media.tone === "active" ? "Medien aktiv" : "Medien aus"}</span></div>
            <div class="alpine-moon-note"><span class="alpine-moon-symbol">${moon[1]}</span><div><strong>${moon[0]}</strong><small>${Number.isFinite(Number(moonDetails.illumination)) ? `${moonDetails.illumination}% beleuchtet` : "Mondphase"}</small></div></div>
          </aside>
        </div>

        <nav class="alpine-function-strip" aria-label="JamesUI Bereiche">
          ${navItems.map((item) => `<button class="alpine-function ${item.tone}" data-nav="${item.target}"><span class="alpine-function-icon">${functionIcon(item.target)}</span><span class="alpine-function-copy"><strong>${item.label}</strong><small>${item.value}</small></span><span class="alpine-function-line"></span></button>`).join("")}
        </nav>
      </div>
    </section>
  `;
}

export function installHomeExperience() {
  if (typeof customElements === "undefined") return false;
  const Panel = customElements.get("jamesui-panel");
  if (!Panel || Panel.prototype.__jamesHomeExperienceInstalled) return Boolean(Panel);
  const originalStyles = Panel.prototype._styles;

  Panel.prototype._homePage = function () { return renderAlpineHome(this); };
  Panel.prototype._styles = function () {
    return `${originalStyles.call(this)}
      .alpine-home{--alpine-accent:#d1b793;--alpine-line:rgba(255,255,255,.115);position:relative;min-height:clamp(520px,72vh,790px);overflow:hidden;isolation:isolate;color:#f2efe9;border:1px solid rgba(255,255,255,.045);border-radius:12px;background:#0a0c0d;box-shadow:0 18px 54px rgba(0,0,0,.24)}
      .alpine-home.tone-dusk{--alpine-accent:#e0b987}.alpine-home.tone-night{--alpine-accent:#c8c5bd}
      .alpine-atmosphere,.alpine-atmosphere-fallback,.alpine-ambient-shade{position:absolute;inset:0;pointer-events:none}
      .alpine-atmosphere{z-index:-3;background-color:#11161a;background-size:cover;background-position:center 46%;filter:saturate(.90) contrast(1.02);transform:scale(1.006)}
      .alpine-atmosphere-fallback{z-index:-4;background:radial-gradient(circle at 78% 24%,rgba(181,159,127,.10),transparent 24%),linear-gradient(135deg,#111416,#090b0c 64%,#08090a)}
      .alpine-ambient-shade{z-index:-2;background:#050607}.alpine-home.weather-rain .alpine-atmosphere{filter:saturate(.72) contrast(1.05) brightness(.91)}.alpine-home.weather-snow .alpine-atmosphere{filter:saturate(.68) contrast(.98) brightness(.98)}.alpine-home.weather-fog .alpine-atmosphere{filter:saturate(.52) contrast(.90) brightness(.88)}.alpine-home.tone-night .alpine-atmosphere{filter:saturate(.78) contrast(1.04) brightness(.82)}
      .alpine-surface{min-height:inherit;display:grid;grid-template-rows:auto 1fr auto;gap:18px;padding:clamp(24px,3vw,42px) clamp(26px,4vw,54px) 18px;background:linear-gradient(90deg,rgba(7,8,9,.21),transparent 43%),linear-gradient(0deg,rgba(7,8,9,.62),transparent 36%)}
      .alpine-overview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px}.alpine-clock-block{min-width:0}.alpine-date{color:rgba(240,236,229,.66);font-size:clamp(10px,.9vw,13px);letter-spacing:.08em;text-transform:uppercase}.alpine-time{margin-top:2px;font-size:clamp(54px,7vw,96px);font-weight:230;letter-spacing:-.055em;line-height:.95;color:#f5f1e9;text-shadow:0 3px 22px rgba(0,0,0,.34)}
      .alpine-period-line{margin-top:14px;display:flex;align-items:center;gap:10px;color:rgba(235,230,220,.65);font-size:10px;letter-spacing:.04em}.alpine-period-line i{width:28px;height:1px;background:color-mix(in srgb,var(--alpine-accent) 52%,transparent)}
      .alpine-connection{display:flex;align-items:center;gap:8px;padding-top:4px;color:rgba(240,236,229,.62);font-size:9px;letter-spacing:.05em;text-transform:uppercase}.alpine-live-dot{width:6px;height:6px;border-radius:50%;background:#8c6663;box-shadow:0 0 0 4px rgba(140,102,99,.08)}.alpine-live-dot.online{background:#8fa58e;box-shadow:0 0 0 4px rgba(143,165,142,.08)}
      .alpine-primary-grid{align-self:center;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.72fr);gap:clamp(38px,5.5vw,86px);align-items:end}.alpine-weather-main{min-width:0;max-width:760px}.alpine-weather-topline{display:flex;align-items:center;gap:18px}.alpine-weather-symbol{width:54px;color:var(--alpine-accent);font-size:clamp(34px,4vw,52px);line-height:1;text-shadow:0 2px 16px rgba(0,0,0,.4)}.alpine-weather-topline>div{display:flex;flex-direction:column;gap:2px}.alpine-temperature{font-size:clamp(42px,5.5vw,76px);font-weight:270;letter-spacing:-.045em;line-height:.95}.alpine-condition{color:rgba(244,240,232,.82);font-size:clamp(13px,1.35vw,18px);font-weight:420}
      .alpine-weather-range{margin:18px 0 0 72px;display:flex;gap:20px;flex-wrap:wrap;color:rgba(240,236,228,.70);font-size:10px}.alpine-weather-range b{color:var(--alpine-accent);font-weight:620}
      .alpine-weather-facts{position:relative;margin:28px 0 0;padding:15px 0 0;display:flex;align-items:flex-start;gap:clamp(22px,3vw,46px);border:0}.alpine-weather-facts::before{content:"";position:absolute;left:0;right:9%;top:0;height:1px;background:linear-gradient(90deg,var(--alpine-line),rgba(255,255,255,.025),transparent)}.alpine-weather-facts>div{min-width:0}.alpine-weather-facts dt,.alpine-weather-facts dd{margin:0}.alpine-weather-facts dt{margin-bottom:5px;color:rgba(235,230,220,.48);font-size:8px;text-transform:uppercase;letter-spacing:.10em}.alpine-weather-facts dd{color:rgba(247,243,235,.88);font-size:10px;font-weight:520;white-space:nowrap}
      .alpine-forecast-link{margin-top:14px;padding:0;border:0;background:none;color:var(--alpine-accent);font:inherit;font-size:9px;letter-spacing:.04em;cursor:pointer}.alpine-forecast-link span{display:inline-block;margin-left:4px;transition:transform .18s ease}.alpine-forecast-link:hover:not(:disabled) span{transform:translateX(3px)}.alpine-forecast-link:disabled{color:rgba(235,230,220,.32);cursor:default}
      .alpine-home-status{min-width:0;align-self:end;padding:0 0 2px 32px;border-left:1px solid var(--alpine-line)}.alpine-status-kicker{display:flex;align-items:center;gap:9px;color:rgba(232,226,216,.54);font-size:8px;letter-spacing:.16em}.alpine-status-dot{width:6px;height:6px;border-radius:50%;background:#8fa58e;box-shadow:0 0 0 4px rgba(143,165,142,.07)}.alpine-home-status.attention .alpine-status-dot{background:#b97c73;box-shadow:0 0 0 4px rgba(185,124,115,.08)}.alpine-home-status h2{margin:8px 0 7px;font-size:clamp(27px,3vw,42px);font-weight:300;letter-spacing:-.035em}.alpine-home-status>p{max-width:390px;margin:0;color:rgba(237,232,223,.65);font-size:10px;line-height:1.55}.alpine-home-status.attention h2{color:#e5b0a8}.alpine-status-quietline{margin-top:17px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;color:rgba(240,235,226,.72);font-size:9px}.alpine-status-quietline i{width:2px;height:2px;border-radius:50%;background:var(--alpine-accent);opacity:.74}
      .alpine-moon-note{margin-top:21px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;max-width:280px}.alpine-moon-symbol{color:#d8d3c9;font-size:22px;line-height:1}.alpine-moon-note>div{display:flex;flex-direction:column;gap:2px}.alpine-moon-note strong{color:rgba(246,241,232,.76);font-size:9px;font-weight:540}.alpine-moon-note small{color:rgba(235,230,221,.46);font-size:8px}
      .alpine-function-strip{min-width:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--alpine-line);background:linear-gradient(90deg,rgba(8,9,10,.14),rgba(8,9,10,.30))}.alpine-function{position:relative;min-width:0;min-height:64px;display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:center;padding:9px clamp(12px,1.6vw,22px);border:0;border-right:1px solid rgba(255,255,255,.055);background:transparent;color:rgba(246,242,234,.88);text-align:left;cursor:pointer}.alpine-function:last-child{border-right:0}.alpine-function::after{content:"";position:absolute;left:18%;right:18%;bottom:0;height:1px;background:var(--alpine-accent);opacity:0;transform:scaleX(.5);transition:opacity .18s ease,transform .18s ease}.alpine-function:hover::after,.alpine-function:focus-visible::after{opacity:.78;transform:scaleX(1)}.alpine-function:focus-visible{outline:1px solid color-mix(in srgb,var(--alpine-accent) 36%,transparent);outline-offset:-1px}.alpine-function-icon{color:var(--alpine-accent);font-size:16px;text-align:center;opacity:.90}.alpine-function-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.alpine-function-copy strong{font-size:10px;font-weight:610;letter-spacing:.02em}.alpine-function-copy small{color:rgba(236,231,221,.50);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.alpine-function.active .alpine-function-copy small{color:var(--alpine-accent)}.alpine-function.alert .alpine-function-icon,.alpine-function.alert .alpine-function-copy small{color:#d59a91}
      @media(max-width:1050px){.alpine-home{min-height:clamp(540px,76vh,760px)}.alpine-surface{padding:25px 28px 17px;gap:14px}.alpine-primary-grid{grid-template-columns:minmax(0,1.28fr) minmax(245px,.72fr);gap:30px}.alpine-time{font-size:64px}.alpine-temperature{font-size:54px}.alpine-weather-facts{gap:22px;flex-wrap:wrap}.alpine-weather-facts>div{min-width:calc(50% - 22px)}.alpine-function{padding-left:12px;padding-right:12px}}
      @media(max-width:820px){.alpine-home{min-height:auto;border-radius:6px}.alpine-surface{min-height:610px;padding:22px 22px 15px}.alpine-primary-grid{grid-template-columns:1fr;gap:22px;align-items:start}.alpine-home-status{padding:18px 0 0;border-left:0;border-top:1px solid var(--alpine-line)}.alpine-home-status h2{font-size:28px}.alpine-moon-note{margin-top:14px}.alpine-function-strip{grid-template-columns:1fr 1fr}.alpine-function:nth-child(2){border-right:0}.alpine-function:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.055)}}
      @media(orientation:portrait){
        .alpine-home{height:calc(100dvh - 172px);min-height:900px;max-height:none;border:0;border-radius:0;box-shadow:none;background:#090b0c}
        .alpine-atmosphere{background-size:100% 100%,100% 100%,100% auto;background-position:center,center,center top;background-repeat:no-repeat;transform:none;filter:saturate(.94) contrast(1.01)}
        .alpine-home.weather-rain .alpine-atmosphere{filter:saturate(.76) contrast(1.04) brightness(.94)}.alpine-home.weather-snow .alpine-atmosphere{filter:saturate(.72) contrast(.98) brightness(1)}.alpine-home.weather-fog .alpine-atmosphere{filter:saturate(.55) contrast(.90) brightness(.91)}.alpine-home.tone-night .alpine-atmosphere{filter:saturate(.80) contrast(1.03) brightness(.84)}
        .alpine-atmosphere-fallback{background:radial-gradient(circle at 80% 16%,rgba(193,158,112,.09),transparent 24%),linear-gradient(180deg,#171a1b 0%,#0d0f10 42%,#090a0a 72%,#070808 100%)}
        .alpine-surface{height:100%;min-height:0;grid-template-rows:auto minmax(0,1fr) auto;gap:16px;padding:26px 28px 14px;background:linear-gradient(180deg,rgba(7,8,9,.05) 0%,rgba(7,8,9,.10) 34%,rgba(8,9,9,.72) 52%,rgba(8,9,9,.96) 68%,#080909 100%),linear-gradient(90deg,rgba(7,8,9,.28),transparent 48%)}
        .alpine-overview-head{gap:18px}.alpine-time{font-size:clamp(64px,9.2vw,86px)}.alpine-date{font-size:11px}.alpine-period-line{margin-top:10px}.alpine-connection{padding-top:2px;font-size:8px}
        .alpine-primary-grid{align-self:stretch;grid-template-columns:1fr;grid-template-rows:minmax(360px,1fr) auto;gap:14px;align-items:end}.alpine-weather-main{align-self:end;max-width:none;padding-bottom:10px}.alpine-weather-topline{gap:16px}.alpine-weather-symbol{width:48px;font-size:42px}.alpine-temperature{font-size:58px}.alpine-condition{font-size:15px}.alpine-weather-range{margin:13px 0 0 64px;gap:18px}
        .alpine-weather-facts{margin-top:18px;padding-top:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0}.alpine-weather-facts::before{right:0;background:linear-gradient(90deg,var(--alpine-line),rgba(255,255,255,.04),transparent)}.alpine-weather-facts>div{min-width:0;padding-right:12px}.alpine-weather-facts>div:not(:last-child){margin-right:12px;border-right:1px solid rgba(255,255,255,.06)}.alpine-weather-facts dd{overflow:hidden;text-overflow:ellipsis}.alpine-forecast-link{margin-top:11px}
        .alpine-home-status{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:22px;align-items:start;padding:16px 0 0;border-left:0;border-top:1px solid var(--alpine-line)}.alpine-status-kicker,.alpine-home-status h2,.alpine-home-status>p,.alpine-status-quietline{grid-column:1}.alpine-home-status h2{margin:5px 0 4px;font-size:30px}.alpine-home-status>p{font-size:9px}.alpine-status-quietline{margin-top:9px}.alpine-moon-note{grid-column:2;grid-row:1/5;align-self:center;min-width:150px;max-width:190px;margin:0;padding:0 0 0 18px;border-top:0;border-left:1px solid rgba(255,255,255,.08)}
        .alpine-function-strip{grid-template-columns:repeat(4,minmax(0,1fr));background:linear-gradient(90deg,rgba(14,12,10,.20),rgba(8,9,10,.34));border-top:1px solid color-mix(in srgb,var(--alpine-accent) 18%,rgba(255,255,255,.08))}.alpine-function{min-height:72px;padding:10px 14px}.alpine-function-icon{font-size:17px}.alpine-function-copy strong{font-size:11px}.alpine-function-copy small{font-size:8px}
      }
      @media(orientation:portrait) and (max-width:760px){.alpine-home{height:auto;min-height:760px}.alpine-surface{height:auto;min-height:760px;padding:22px 20px 14px}.alpine-primary-grid{grid-template-rows:minmax(300px,1fr) auto}.alpine-home-status{grid-template-columns:1fr}.alpine-moon-note{grid-column:1;grid-row:auto;margin-top:11px;padding:11px 0 0;border-left:0;border-top:1px solid rgba(255,255,255,.08)}.alpine-weather-facts{grid-template-columns:1fr 1fr}.alpine-weather-facts>div:nth-child(2){border-right:0}.alpine-function-strip{grid-template-columns:1fr 1fr}.alpine-function:nth-child(2){border-right:0}.alpine-function:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.055)}}
    `;
  };

  Panel.prototype.__jamesHomeExperienceInstalled = true;
  return true;
}
