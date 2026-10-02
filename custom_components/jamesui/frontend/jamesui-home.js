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

  const lightsOn = Number(house.lightsOn || 0);
  const socketsOn = Number(house.socketsOn || 0);
  const fansOn = Number(house.fansOn || 0);

  return {
    headline: alerts.length ? "Aufmerksamkeit nötig" : "Alles ruhig",
    detail: alerts.length ? alerts.join(" · ") : "Keine wichtigen Abweichungen erkannt.",
    activity: [
      lightsOn ? `${lightsOn} ${lightsOn === 1 ? "Licht" : "Lichter"} an` : "Licht aus",
      socketsOn ? `${socketsOn} ${socketsOn === 1 ? "Steckdose" : "Steckdosen"} an` : "Steckdosen aus",
      fansOn ? `${fansOn} ${fansOn === 1 ? "Lüftung" : "Lüftungen"} aktiv` : "Lüftung aus",
    ],
    house: {
      value: house.unavailable
        ? `${house.unavailable} offline`
        : lightsOn
          ? `${lightsOn} Licht${lightsOn === 1 ? "" : "er"} an`
          : "Alles ruhig",
      tone: house.unavailable || house.lowBattery ? "alert" : lightsOn ? "active" : "quiet",
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
  const calm = status.headline === "Alles ruhig";

  return `
    <section class="alpine-home alpine-home-v2 alpine-home-v3 tone-${atmosphere.tone} weather-${atmosphere.weatherClass}" data-atmosphere="${atmosphere.key}">
      <div class="alpine-atmosphere" style="background-image:linear-gradient(90deg,rgba(8,10,11,.58) 0%,rgba(8,10,11,.30) 38%,rgba(8,10,11,.08) 68%,rgba(8,10,11,.13) 100%),linear-gradient(0deg,rgba(8,9,10,.62) 0%,rgba(8,9,10,.05) 50%,rgba(8,9,10,.06) 100%),url('${atmosphere.asset}')" aria-hidden="true"></div>
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
            <div class="alpine-house-activity">${status.activity.map((item) => `<span>${item}</span>`).join("")}</div>
            <div class="alpine-moon-note"><span class="alpine-moon-symbol">${moon[1]}</span><div><strong>${moon[0]}</strong><small>${Number.isFinite(Number(moonDetails.illumination)) ? `${moonDetails.illumination}% beleuchtet` : "Mondphase"}</small></div></div>
          </aside>
        </div>
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
      .alpine-home{--alpine-accent:#d7b78d;--alpine-line:rgba(255,255,255,.14);position:relative;min-height:clamp(520px,72vh,790px);overflow:hidden;isolation:isolate;color:#f5f1e9;border:1px solid rgba(255,255,255,.055);border-radius:12px;background:#0a0c0d;box-shadow:0 18px 54px rgba(0,0,0,.24)}
      .alpine-home.tone-dusk{--alpine-accent:#e3bc8a}.alpine-home.tone-night{--alpine-accent:#d4d0c7}
      .alpine-atmosphere,.alpine-atmosphere-fallback,.alpine-ambient-shade{position:absolute;inset:0;pointer-events:none}
      .alpine-atmosphere{z-index:1;background-color:#11161a;background-size:cover;background-position:center 46%;filter:saturate(.94) contrast(1.01);transform:scale(1.006)}
      .alpine-atmosphere-fallback{z-index:0;background:radial-gradient(circle at 78% 24%,rgba(181,159,127,.10),transparent 24%),linear-gradient(135deg,#111416,#090b0c 64%,#08090a)}
      .alpine-ambient-shade{z-index:2;background:#050607}.alpine-home.weather-rain .alpine-atmosphere{filter:saturate(.80) contrast(1.03) brightness(.96)}.alpine-home.weather-snow .alpine-atmosphere{filter:saturate(.78) contrast(.99) brightness(1.02)}.alpine-home.weather-fog .alpine-atmosphere{filter:saturate(.62) contrast(.92) brightness(.96)}.alpine-home.tone-night .alpine-atmosphere{filter:saturate(.86) contrast(1.02) brightness(.93)}
      .alpine-surface{position:relative;z-index:3;min-height:inherit;display:grid;grid-template-rows:auto 1fr;gap:22px;padding:clamp(24px,3vw,42px) clamp(26px,4vw,54px) 26px;background:linear-gradient(90deg,rgba(7,8,9,.17),transparent 44%),linear-gradient(0deg,rgba(7,8,9,.48),transparent 38%)}
      .alpine-overview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px}.alpine-clock-block{min-width:0}.alpine-date{color:rgba(245,240,231,.78);font-size:clamp(11px,.95vw,14px);letter-spacing:.08em;text-transform:uppercase}.alpine-time{margin-top:2px;font-size:clamp(58px,7vw,96px);font-weight:230;letter-spacing:-.055em;line-height:.95;color:#faf6ef;text-shadow:0 3px 22px rgba(0,0,0,.40)}
      .alpine-period-line{margin-top:14px;display:flex;align-items:center;gap:10px;color:rgba(243,237,227,.78);font-size:11px;letter-spacing:.04em;text-shadow:0 2px 12px rgba(0,0,0,.45)}.alpine-period-line i{width:28px;height:1px;background:color-mix(in srgb,var(--alpine-accent) 58%,transparent)}
      .alpine-connection{display:flex;align-items:center;gap:8px;padding-top:4px;color:rgba(245,240,231,.76);font-size:10px;letter-spacing:.05em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.55)}.alpine-live-dot{width:7px;height:7px;border-radius:50%;background:#8c6663;box-shadow:0 0 0 4px rgba(140,102,99,.10)}.alpine-live-dot.online{background:#98b197;box-shadow:0 0 0 4px rgba(143,165,142,.11)}
      .alpine-primary-grid{align-self:center;display:grid;grid-template-columns:minmax(0,1.42fr) minmax(320px,.78fr);gap:clamp(40px,5vw,84px);align-items:end}.alpine-weather-main{min-width:0;max-width:780px;padding:18px 20px 20px 0}.alpine-weather-topline{display:flex;align-items:center;gap:18px}.alpine-weather-symbol{width:58px;color:var(--alpine-accent);font-size:clamp(38px,4vw,54px);line-height:1;text-shadow:0 2px 16px rgba(0,0,0,.45)}.alpine-weather-topline>div{display:flex;flex-direction:column;gap:4px}.alpine-temperature{font-size:clamp(48px,5.6vw,78px);font-weight:270;letter-spacing:-.045em;line-height:.95;text-shadow:0 3px 20px rgba(0,0,0,.38)}.alpine-condition{color:rgba(249,245,237,.92);font-size:clamp(15px,1.4vw,20px);font-weight:480;text-shadow:0 2px 14px rgba(0,0,0,.55)}
      .alpine-weather-range{margin:17px 0 0 76px;display:flex;gap:24px;flex-wrap:wrap;color:rgba(247,241,231,.82);font-size:12px;text-shadow:0 2px 10px rgba(0,0,0,.50)}.alpine-weather-range b{color:var(--alpine-accent);font-weight:650}
      .alpine-weather-facts{position:relative;margin:26px 0 0;padding:16px 0 0;display:flex;align-items:flex-start;gap:clamp(26px,3vw,50px);border:0}.alpine-weather-facts::before{content:"";position:absolute;left:0;right:5%;top:0;height:1px;background:linear-gradient(90deg,var(--alpine-line),rgba(255,255,255,.05),transparent)}.alpine-weather-facts>div{min-width:0}.alpine-weather-facts dt,.alpine-weather-facts dd{margin:0}.alpine-weather-facts dt{margin-bottom:6px;color:rgba(241,235,225,.68);font-size:10px;text-transform:uppercase;letter-spacing:.10em;text-shadow:0 2px 10px rgba(0,0,0,.45)}.alpine-weather-facts dd{color:rgba(252,248,240,.96);font-size:12px;font-weight:590;white-space:nowrap;text-shadow:0 2px 10px rgba(0,0,0,.48)}
      .alpine-forecast-link{margin-top:16px;padding:0;border:0;background:none;color:#e3c69f;font:inherit;font-size:11px;font-weight:560;letter-spacing:.04em;cursor:pointer;text-shadow:0 2px 10px rgba(0,0,0,.45)}.alpine-forecast-link span{display:inline-block;margin-left:4px;transition:transform .18s ease}.alpine-forecast-link:hover:not(:disabled) span{transform:translateX(3px)}.alpine-forecast-link:disabled{color:rgba(235,230,220,.45);cursor:default}
      .alpine-home-status{min-width:0;align-self:end;padding:20px 0 18px 30px;border-left:1px solid var(--alpine-line);background:linear-gradient(90deg,rgba(8,9,10,.20),transparent 85%)}.alpine-status-kicker{display:flex;align-items:center;gap:9px;color:rgba(242,236,226,.70);font-size:9px;letter-spacing:.16em}.alpine-status-dot{width:7px;height:7px;border-radius:50%;background:#8fa58e;box-shadow:0 0 0 4px rgba(143,165,142,.09)}.alpine-home-status.attention .alpine-status-dot{background:#c78980;box-shadow:0 0 0 4px rgba(185,124,115,.10)}.alpine-home-status h2{margin:8px 0 7px;font-size:clamp(30px,3vw,44px);font-weight:300;letter-spacing:-.035em;text-shadow:0 2px 14px rgba(0,0,0,.35)}.alpine-home-status>p{max-width:420px;margin:0;color:rgba(247,241,232,.82);font-size:12px;line-height:1.5;text-shadow:0 2px 10px rgba(0,0,0,.42)}.alpine-home-status.attention h2{color:#efb9b0}.alpine-status-quietline{margin-top:15px;display:flex;align-items:center;flex-wrap:wrap;gap:9px;color:rgba(248,242,233,.86);font-size:11px}.alpine-status-quietline i{width:3px;height:3px;border-radius:50%;background:var(--alpine-accent);opacity:.86}
      .alpine-house-activity{margin-top:13px;display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;color:rgba(248,242,233,.78);font-size:11px}.alpine-house-activity span{display:inline-flex;align-items:center;gap:6px}.alpine-house-activity span::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--alpine-accent);opacity:.75}
      .alpine-moon-note{margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.11);display:flex;align-items:center;gap:10px;max-width:300px}.alpine-moon-symbol{color:#e2ddd3;font-size:23px;line-height:1}.alpine-moon-note>div{display:flex;flex-direction:column;gap:2px}.alpine-moon-note strong{color:rgba(250,246,238,.88);font-size:10px;font-weight:560}.alpine-moon-note small{color:rgba(241,235,225,.62);font-size:9px}
      @media(max-width:1050px){.alpine-home{min-height:clamp(540px,76vh,760px)}.alpine-surface{padding:25px 28px 22px;gap:16px}.alpine-primary-grid{grid-template-columns:minmax(0,1.22fr) minmax(275px,.78fr);gap:30px}.alpine-time{font-size:68px}.alpine-temperature{font-size:58px}.alpine-weather-facts{gap:22px;flex-wrap:wrap}.alpine-weather-facts>div{min-width:calc(50% - 22px)}}
      @media(max-width:820px){.alpine-home{min-height:auto;border-radius:6px}.alpine-surface{min-height:610px;padding:22px}.alpine-primary-grid{grid-template-columns:1fr;gap:22px;align-items:start}.alpine-home-status{padding:18px 0 0;border-left:0;border-top:1px solid var(--alpine-line);background:linear-gradient(180deg,rgba(8,9,10,.18),transparent 80%)}.alpine-home-status h2{font-size:30px}.alpine-moon-note{margin-top:14px}}
      @media(orientation:portrait){
        .alpine-home{height:calc(100dvh - 172px);min-height:900px;max-height:none;border:0;border-radius:0;box-shadow:none;background:#090b0c}
        .alpine-atmosphere{background-size:100% 100%,100% 100%,cover;background-position:center,center,center 28%;background-repeat:no-repeat;transform:none;filter:saturate(.98) contrast(1.02) brightness(.96)}
        .alpine-home.weather-rain .alpine-atmosphere{filter:saturate(.82) contrast(1.03) brightness(.95)}.alpine-home.weather-snow .alpine-atmosphere{filter:saturate(.76) contrast(.99) brightness(1.02)}.alpine-home.weather-fog .alpine-atmosphere{filter:saturate(.62) contrast(.92) brightness(.95)}.alpine-home.tone-night .alpine-atmosphere{filter:saturate(.86) contrast(1.02) brightness(.93)}
        .alpine-atmosphere-fallback{background:radial-gradient(circle at 80% 16%,rgba(193,158,112,.10),transparent 24%),linear-gradient(180deg,#171a1b 0%,#101314 38%,#0b0d0e 66%,#070808 100%)}
        .alpine-surface{height:100%;min-height:0;grid-template-rows:auto minmax(0,1fr);gap:16px;padding:26px 28px 24px;background:linear-gradient(180deg,rgba(7,8,9,.015) 0%,rgba(7,8,9,.04) 28%,rgba(7,8,9,.12) 44%,rgba(8,9,9,.36) 58%,rgba(8,9,9,.70) 76%,rgba(8,9,9,.90) 90%,#080909 100%),linear-gradient(90deg,rgba(7,8,9,.16),transparent 55%)}
        .alpine-overview-head{gap:18px}.alpine-time{font-size:clamp(66px,9.2vw,88px);text-shadow:0 6px 28px rgba(0,0,0,.42)}.alpine-date{font-size:12px}.alpine-period-line{margin-top:10px;font-size:11px}.alpine-connection{padding-top:2px;font-size:9px}
        .alpine-primary-grid{align-self:stretch;grid-template-columns:1fr;grid-template-rows:minmax(430px,58vh) auto;gap:16px;align-items:end}.alpine-weather-main{align-self:end;max-width:none;padding:0 0 18px}.alpine-weather-topline{gap:16px}.alpine-weather-symbol{width:50px;font-size:44px;text-shadow:0 4px 18px rgba(0,0,0,.40)}.alpine-temperature{font-size:62px;text-shadow:0 6px 28px rgba(0,0,0,.38)}.alpine-condition{font-size:16px;text-shadow:0 4px 18px rgba(0,0,0,.34)}.alpine-weather-range{margin:13px 0 0 66px;gap:20px;font-size:12px}
        .alpine-weather-facts{margin-top:18px;padding-top:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0}.alpine-weather-facts::before{right:0;background:linear-gradient(90deg,var(--alpine-line),rgba(255,255,255,.04),transparent)}.alpine-weather-facts>div{min-width:0;padding-right:12px}.alpine-weather-facts>div:not(:last-child){margin-right:12px;border-right:1px solid rgba(255,255,255,.08)}.alpine-weather-facts dd{overflow:hidden;text-overflow:ellipsis}.alpine-forecast-link{margin-top:12px}
        .alpine-home-status{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:22px;align-items:start;padding:18px 0 0;border-left:0;border-top:1px solid var(--alpine-line);background:linear-gradient(180deg,rgba(8,9,10,.16),transparent 85%)}.alpine-status-kicker,.alpine-home-status h2,.alpine-home-status>p,.alpine-status-quietline,.alpine-house-activity{grid-column:1}.alpine-home-status h2{margin:6px 0 5px;font-size:32px}.alpine-home-status>p{font-size:12px}.alpine-status-quietline{margin-top:10px;font-size:11px}.alpine-house-activity{margin-top:10px;font-size:11px}.alpine-moon-note{grid-column:2;grid-row:1/6;align-self:center;min-width:150px;max-width:200px;margin:0;padding:0 0 0 18px;border-top:0;border-left:1px solid rgba(255,255,255,.10)}
      }
      @media(orientation:portrait) and (max-width:760px){.alpine-home{height:auto;min-height:760px}.alpine-surface{height:auto;min-height:760px;padding:22px 20px 18px}.alpine-primary-grid{grid-template-rows:minmax(300px,1fr) auto}.alpine-home-status{grid-template-columns:1fr}.alpine-moon-note{grid-column:1;grid-row:auto;margin-top:12px;padding:12px 0 0;border-left:0;border-top:1px solid rgba(255,255,255,.10)}.alpine-weather-facts{grid-template-columns:1fr 1fr}.alpine-weather-facts>div:nth-child(2){border-right:0}}
    `;
  };

  Panel.prototype.__jamesHomeExperienceInstalled = true;
  return true;
}
