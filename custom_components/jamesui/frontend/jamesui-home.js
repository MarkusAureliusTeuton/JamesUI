const ALPINE_ASSET_ROOT = "/jamesui_static/assets/alpine";
const RAIN_PROBABILITY_THRESHOLD = 40;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stateName(entityId, entity) {
  return `${entityId} ${entity?.attributes?.friendly_name || ""}`.toLowerCase();
}

function isOpenState(entity) {
  return ["on", "open", "opening"].includes(entity?.state);
}

function binarySensors(panel) {
  const states = panel?._hass?.states || {};
  return (panel?._entityIds?.("binary_sensor") || [])
    .map((entityId) => [entityId, states[entityId]])
    .filter(([, entity]) => entity && entity.state !== "unavailable");
}

function windowSensors(panel) {
  return binarySensors(panel).filter(([entityId, entity]) => {
    const deviceClass = entity?.attributes?.device_class;
    const name = stateName(entityId, entity);
    return deviceClass === "window" || (deviceClass === "opening" && /fenster|window/.test(name));
  });
}

function doorSensors(panel) {
  return binarySensors(panel).filter(([entityId, entity]) => {
    const deviceClass = entity?.attributes?.device_class;
    const name = stateName(entityId, entity);
    if (["door", "garage_door"].includes(deviceClass)) return true;
    return deviceClass === "opening" && /tür|tur|door|tor|gate|garage/.test(name);
  });
}

function compactOpenValue(entries) {
  if (!entries.length) return { value: "–", tone: "quiet" };
  const open = entries.filter(([, entity]) => isOpenState(entity)).length;
  return open
    ? { value: `${open} offen`, tone: "alert" }
    : { value: "Alle zu", tone: "quiet" };
}

export function summarizeHomeState(panel) {
  const states = panel?._hass?.states || {};
  const house = panel?._houseSummary?.() || {};
  const entityIds = (domain) => panel?._entityIds?.(domain) || [];

  const climateTemps = entityIds("climate")
    .map((id) => Number(states[id]?.attributes?.current_temperature))
    .filter(Number.isFinite);
  const avgClimate = climateTemps.length
    ? `${(climateTemps.reduce((sum, value) => sum + value, 0) / climateTemps.length).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°`
    : "–";

  const mediaIds = entityIds("media_player");
  const playing = mediaIds.filter((id) => states[id]?.state === "playing");
  const windows = compactOpenValue(windowSensors(panel));
  const doors = compactOpenValue(doorSensors(panel));
  const lightsOn = Number(house.lightsOn || 0);
  const socketsOn = Number(house.socketsOn || 0);
  const fansOn = Number(house.fansOn || 0);

  const alerts = [];
  if (house.unavailable) alerts.push(`${house.unavailable} Gerät${house.unavailable === 1 ? "" : "e"} offline`);
  if (house.lowBattery) alerts.push(`${house.lowBattery} Batterie${house.lowBattery === 1 ? "" : "n"} niedrig`);
  if (windows.tone === "alert") alerts.push(`Fenster: ${windows.value}`);
  if (doors.tone === "alert") alerts.push(`Türen/Tore: ${doors.value}`);

  const lights = { value: lightsOn ? `${lightsOn} an` : "Aus", tone: lightsOn ? "active" : "quiet" };
  const sockets = { value: socketsOn ? `${socketsOn} an` : "Aus", tone: socketsOn ? "active" : "quiet" };
  const ventilation = { value: fansOn ? `${fansOn} an` : "Aus", tone: fansOn ? "active" : "quiet" };
  const climate = { value: avgClimate, tone: "quiet" };
  const media = {
    value: playing.length ? (playing.length === 1 ? "Aktiv" : `${playing.length} aktiv`) : (mediaIds.length ? "Aus" : "–"),
    tone: playing.length ? "active" : "quiet",
  };

  return {
    headline: alerts.length ? "Aufmerksamkeit nötig" : "Alles in Ordnung",
    detail: alerts.length ? alerts.join(" · ") : "Keine wichtigen Abweichungen erkannt.",
    lights,
    sockets,
    windows,
    doors,
    ventilation,
    climate,
    media,
    house: {
      value: house.unavailable ? `${house.unavailable} offline` : lights.value,
      tone: house.unavailable || house.lowBattery ? "alert" : lights.tone,
    },
    door: { value: doors.value === "Alle zu" ? "Geschlossen" : doors.value, tone: doors.tone },
    activity: [
      lightsOn ? `${lightsOn} ${lightsOn === 1 ? "Licht" : "Lichter"} an` : "Licht aus",
      socketsOn ? `${socketsOn} ${socketsOn === 1 ? "Steckdose" : "Steckdosen"} an` : "Steckdosen aus",
      fansOn ? `${fansOn} ${fansOn === 1 ? "Lüftung" : "Lüftungen"} aktiv` : "Lüftung aus",
    ],
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
    } else {
      key = normalized === "rain" ? "rain-night" : normalized === "snow" ? "snow-night" : "cloudy-night";
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

function isRainForecast(item) {
  const probability = Number(item?.precipitation_probability);
  const rainyConditions = new Set(["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"]);
  return (Number.isFinite(probability) && probability >= RAIN_PROBABILITY_THRESHOLD) || rainyConditions.has(item?.condition);
}

export function weatherTrendSummary(forecast = []) {
  const next = Array.isArray(forecast) ? forecast.slice(0, 3) : [];
  const highs = next.map((item) => Number(item?.temperature)).filter(Number.isFinite);
  let direction = "stable";
  let label = "Stabil";
  if (highs.length >= 2) {
    const delta = highs.at(-1) - highs[0];
    if (delta >= 1.5) {
      direction = "up";
      label = "Wärmer";
    } else if (delta <= -1.5) {
      direction = "down";
      label = "Kühler";
    }
  }
  return {
    label,
    direction,
    rainExpected: next.some(isRainForecast),
  };
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function firstExpectedRainTime(panel) {
  if (!["hourly", "twice_daily"].includes(panel?._forecastType)) return null;
  const now = new Date();
  const candidates = Array.isArray(panel?._forecast) ? panel._forecast : [];
  for (const item of candidates) {
    if (!item?.datetime || !isRainForecast(item)) continue;
    const date = new Date(item.datetime);
    if (Number.isNaN(date.getTime()) || !sameLocalDay(date, now)) continue;
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return null;
}

function trendIcon(direction) {
  return direction === "up" ? "↗" : direction === "down" ? "↘" : "→";
}

function formatCalendarWhen(event, now = new Date()) {
  const start = event?.start instanceof Date ? event.start : new Date(event?.start);
  if (Number.isNaN(start.getTime())) return event?.allDay ? "Ganztägig" : "–";
  const today = sameLocalDay(start, now);
  const day = start.toLocaleDateString("de-DE", today
    ? { weekday: "short" }
    : { weekday: "short", day: "2-digit", month: "2-digit" });
  if (event?.allDay) return today ? "Ganztägig" : `${day} · Ganztägig`;
  const time = start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return today ? time : `${day} · ${time}`;
}

function renderCalendar(panel) {
  const events = Array.isArray(panel?._jamesHomeCalendarEvents)
    ? [...panel._jamesHomeCalendarEvents].sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 4)
    : [];
  if (!events.length) {
    return `<div class="start-v9-empty"><span>○</span><div><strong>Keine Kalenderdaten</strong><small>Home Assistant liefert aktuell keine Termine.</small></div></div>`;
  }
  return `<div class="start-v9-timeline">${events.map((event) => `
    <article class="start-v9-event">
      <time>${escapeHtml(formatCalendarWhen(event))}</time>
      <i></i>
      <div><strong>${escapeHtml(event.title || "Termin")}</strong>${event.location ? `<small>${escapeHtml(event.location)}</small>` : ""}</div>
    </article>`).join("")}</div>`;
}

function renderHouseStatusItem(label, model, icon) {
  return `<div class="start-v9-house-item ${model?.tone || "quiet"}"><span class="start-v9-house-icon">${icon}</span><div><small>${label}</small><strong>${escapeHtml(model?.value || "–")}</strong></div></div>`;
}

function renderFavoriteScenes(panel) {
  const scenes = Array.isArray(panel?._jamesHomeScenes) ? panel._jamesHomeScenes.slice(0, 4) : [];
  if (!scenes.length) return `<span class="start-v9-scenes-empty">Keine Szenen eingerichtet</span>`;
  return scenes.map((scene) => `<button class="start-v9-scene" data-home-scene="${escapeHtml(scene.entityId)}"><span>✦</span><strong>${escapeHtml(scene.name)}</strong></button>`).join("");
}

export function renderAlpineHome(panel) {
  const hass = panel?._hass;
  const weatherId = panel?._weatherEntityId?.();
  const weather = weatherId ? hass?.states?.[weatherId] : null;
  const sun = hass?.states?.["sun.sun"];
  const forecast = panel?._normalizedDailyForecast?.() || [];
  const today = forecast[0] || {};
  const moon = panel?._moonInfo?.() || ["Mondphase nicht eingerichtet", "○", "unknown"];
  const moonDetails = panel?._moonDetails?.() || { illumination: null };
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
  const wind = Number.isFinite(Number(weather?.attributes?.wind_speed))
    ? `${Math.round(Number(weather.attributes.wind_speed))} ${weather.attributes.wind_speed_unit || ""}`.trim()
    : "–";
  const nextRising = panel?._formatSunEvent?.(sun?.attributes?.next_rising) || "–";
  const nextSetting = panel?._formatSunEvent?.(sun?.attributes?.next_setting) || "–";
  const temperature = panel?._currentTemperature?.() || "–";
  const conditionLabel = panel?._weatherConditionLabel?.(condition) || "Keine Wetterdaten";
  const symbol = panel?._weatherSymbol?.(condition, panel?._isNight?.()) || "◌";
  const trend = weatherTrendSummary(forecast);
  const rainTime = firstExpectedRainTime(panel);
  const status = summarizeHomeState(panel);
  const locationName = hass?.config?.location_name || weather?.attributes?.friendly_name || "Zuhause";
  const illumination = Number(moonDetails?.illumination);
  const moonValue = `${moon[0]}${Number.isFinite(illumination) ? ` · ${Math.round(illumination)}%` : ""}`;
  const rainLabel = rainTime ? `ab ${rainTime}` : precip;

  return `
    <section class="alpine-home start-v9 tone-${atmosphere.tone} weather-${atmosphere.weatherClass}" data-atmosphere="${atmosphere.key}">
      <section class="start-v9-hero">
        <div class="alpine-atmosphere" style="background-image:linear-gradient(90deg,rgba(6,8,9,.48) 0%,rgba(6,8,9,.18) 46%,rgba(6,8,9,.03) 72%,rgba(6,8,9,.10) 100%),linear-gradient(0deg,rgba(7,8,9,.60) 0%,rgba(7,8,9,.05) 48%,rgba(7,8,9,.03) 100%),url('${atmosphere.asset}')" aria-hidden="true"></div>
        <div class="alpine-atmosphere-fallback" aria-hidden="true"></div>
        <div class="alpine-ambient-shade" style="opacity:${Math.max(0, Math.min(.26, Number(ambient.dim) || 0))}"></div>
        <div class="alpine-surface start-v9-hero-content">
          <button class="start-v9-menu" data-start-menu aria-label="Menü öffnen">•••</button>
          <div class="start-v9-clock">
            <div class="alpine-date" data-live-date></div>
            <div class="alpine-time" data-live-time></div>
            <div class="start-v9-location">${escapeHtml(locationName)}</div>
          </div>

          <div class="start-v9-weather-now">
            <span class="start-v9-weather-symbol" data-weather-symbol>${symbol}</span>
            <div><strong data-weather-temp>${temperature}</strong><span data-weather-condition>${escapeHtml(conditionLabel)}</span></div>
          </div>

          <dl class="start-v9-weather-facts">
            <div><dt>Max</dt><dd>${high}</dd></div>
            <div><dt>Min</dt><dd>${low}</dd></div>
            <div><dt>Regen</dt><dd>${rainLabel}</dd></div>
            <div><dt>Wind</dt><dd>${wind}</dd></div>
            <div><dt>Sonnenaufgang</dt><dd>${nextRising}</dd></div>
            <div><dt>Sonnenuntergang</dt><dd>${nextSetting}</dd></div>
            <div class="start-v9-moon-fact"><dt>${moon[1]} Mond</dt><dd>${escapeHtml(moonValue)}</dd></div>
          </dl>

          <button class="start-v9-forecast" data-open-forecast ${forecast.length ? "" : "disabled"}>
            <span><strong>3-Tage-Prognose</strong><small>${forecast.length ? `${trendIcon(trend.direction)} ${trend.label} · ${trend.rainExpected ? "Regen erwartet" : "eher trocken"}` : "Keine Prognosedaten"}</small></span>
            <b>›</b>
          </button>
        </div>
      </section>

      <div class="start-v9-lower-grid">
        <section class="start-v9-section start-v9-calendar">
          <header class="start-v9-section-head"><div><span>HEUTE & DANACH</span><h2>Kalender</h2></div><button data-home-calendar-more>Weitere Termine <b>›</b></button></header>
          ${renderCalendar(panel)}
        </section>

        <section class="start-v9-section start-v9-house ${status.headline === "Alles in Ordnung" ? "calm" : "attention"}">
          <header class="start-v9-section-head"><div><span>ZUHAUSE</span><h2>Hausstatus</h2><p>${escapeHtml(status.headline)}</p></div><button data-home-house-more>Weitere <b>›</b></button></header>
          <div class="start-v9-house-grid">
            ${renderHouseStatusItem("Licht", status.lights, "✦")}
            ${renderHouseStatusItem("Steckdosen", status.sockets, "⌁")}
            ${renderHouseStatusItem("Fenster", status.windows, "▱")}
            ${renderHouseStatusItem("Türen", status.doors, "▥")}
            ${renderHouseStatusItem("Lüftung", status.ventilation, "≋")}
            ${renderHouseStatusItem("Klima", status.climate, "◌")}
            ${renderHouseStatusItem("Medien", status.media, "▶")}
          </div>
          <div class="start-v9-scenes">
            <div class="start-v9-scenes-head"><span>SZENEN</span><button data-home-scenes-more>Weitere</button></div>
            <div class="start-v9-scene-grid">${renderFavoriteScenes(panel)}</div>
          </div>
        </section>
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
      .alpine-home.start-v9{--start-accent:#d8b58a;--start-text:#f4f0e8;--start-muted:rgba(235,230,220,.58);--start-line:rgba(255,255,255,.09);position:relative;overflow:hidden;color:var(--start-text);background:#070809;border:0;border-radius:0;box-shadow:none}
      .start-v9-hero{position:relative;min-height:clamp(430px,52vh,620px);overflow:hidden;isolation:isolate;background:#0b0e10}
      .start-v9-hero .alpine-atmosphere,.start-v9-hero .alpine-atmosphere-fallback,.start-v9-hero .alpine-ambient-shade{position:absolute;inset:0;pointer-events:none}
      .start-v9-hero .alpine-atmosphere{z-index:1;background-color:#11161a;background-size:cover;background-position:center 46%;filter:saturate(1.02) contrast(1.01);transform:scale(1.004)}
      .start-v9-hero .alpine-atmosphere-fallback{z-index:0;background:radial-gradient(circle at 78% 24%,rgba(181,159,127,.12),transparent 24%),linear-gradient(135deg,#111416,#090b0c 64%,#08090a)}
      .start-v9-hero .alpine-ambient-shade{z-index:2;background:#050607}
      .start-v9-hero-content{position:relative;z-index:3;min-height:inherit;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto 1fr auto auto;gap:18px;padding:clamp(26px,3.4vw,48px) clamp(28px,4.2vw,58px) 26px;background:linear-gradient(90deg,rgba(5,7,8,.28),transparent 48%),linear-gradient(0deg,rgba(5,6,7,.62),transparent 46%)}
      .start-v9-menu{position:absolute;top:22px;right:26px;z-index:4;width:42px;height:42px;border:0;border-radius:50%;background:rgba(8,10,11,.30);backdrop-filter:blur(10px);color:rgba(255,255,255,.84);font-size:15px;letter-spacing:2px;cursor:pointer}
      .start-v9-clock{grid-column:1;align-self:start}.alpine-date{font-size:12px;letter-spacing:.10em;text-transform:uppercase;color:rgba(246,241,233,.68)}.alpine-time{margin-top:2px;font-size:clamp(68px,8.6vw,108px);font-weight:230;letter-spacing:-.06em;line-height:.92;text-shadow:0 5px 28px rgba(0,0,0,.38)}.start-v9-location{margin-top:10px;color:rgba(246,241,233,.70);font-size:12px;letter-spacing:.04em}
      .start-v9-weather-now{grid-column:1;align-self:end;display:flex;align-items:center;gap:15px;text-shadow:0 4px 20px rgba(0,0,0,.38)}.start-v9-weather-symbol{color:var(--start-accent);font-size:42px;line-height:1}.start-v9-weather-now>div{display:flex;align-items:baseline;gap:12px}.start-v9-weather-now strong{font-size:42px;font-weight:300;letter-spacing:-.04em}.start-v9-weather-now span:not(.start-v9-weather-symbol){color:rgba(248,244,236,.82);font-size:15px}
      .start-v9-weather-facts{grid-column:1/-1;margin:0;padding:16px 0 0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid rgba(255,255,255,.16)}.start-v9-weather-facts>div{min-width:0;padding:0 14px}.start-v9-weather-facts>div:first-child{padding-left:0}.start-v9-weather-facts>div:not(:last-child){border-right:1px solid rgba(255,255,255,.09)}.start-v9-weather-facts dt,.start-v9-weather-facts dd{margin:0}.start-v9-weather-facts dt{margin-bottom:5px;color:rgba(242,237,228,.55);font-size:9px;letter-spacing:.08em;text-transform:uppercase}.start-v9-weather-facts dd{color:#f6f1e9;font-size:12px;font-weight:560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.start-v9-moon-fact dd{color:#e8dccb}
      .start-v9-forecast{grid-column:1/-1;justify-self:start;display:flex;align-items:center;gap:16px;margin-top:0;padding:9px 0;border:0;background:none;color:var(--start-text);cursor:pointer;text-align:left}.start-v9-forecast>span{display:flex;flex-direction:column;gap:3px}.start-v9-forecast strong{font-size:11px;font-weight:650}.start-v9-forecast small{color:var(--start-accent);font-size:10px}.start-v9-forecast b{color:var(--start-accent);font-size:20px;font-weight:300}.start-v9-forecast:disabled{opacity:.42;cursor:default}
      .start-v9-lower-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;background:#070809}.start-v9-section{min-width:0;padding:28px clamp(28px,4vw,54px) 32px;background:linear-gradient(180deg,rgba(255,255,255,.018),transparent 58%);border-top:1px solid var(--start-line)}.start-v9-section+ .start-v9-section{border-left:1px solid var(--start-line)}
      .start-v9-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px}.start-v9-section-head>div>span,.start-v9-scenes-head>span{color:rgba(235,230,220,.48);font-size:9px;letter-spacing:.14em}.start-v9-section-head h2{margin:5px 0 0;font-size:25px;font-weight:330;letter-spacing:-.025em}.start-v9-section-head p{margin:5px 0 0;color:var(--start-accent);font-size:10px}.start-v9-section-head button,.start-v9-scenes-head button{padding:4px 0;border:0;background:none;color:rgba(244,239,231,.64);font-size:10px;cursor:pointer}.start-v9-section-head button b{margin-left:5px;color:var(--start-accent);font-size:16px;font-weight:300}
      .start-v9-timeline{display:flex;flex-direction:column}.start-v9-event{display:grid;grid-template-columns:72px 10px minmax(0,1fr);gap:10px;align-items:start;min-height:48px}.start-v9-event time{padding-top:2px;color:rgba(241,236,227,.60);font-size:10px}.start-v9-event i{position:relative;width:5px;height:5px;margin-top:5px;border-radius:50%;background:var(--start-accent)}.start-v9-event i::after{content:"";position:absolute;top:8px;left:2px;width:1px;height:34px;background:rgba(255,255,255,.08)}.start-v9-event:last-child i::after{display:none}.start-v9-event>div{display:flex;flex-direction:column;gap:3px;padding-bottom:14px}.start-v9-event strong{font-size:12px;font-weight:560}.start-v9-event small{color:rgba(235,230,220,.48);font-size:9px}.start-v9-empty{display:flex;align-items:center;gap:12px;padding:18px 0;color:rgba(241,236,227,.55)}.start-v9-empty>span{font-size:24px}.start-v9-empty>div{display:flex;flex-direction:column;gap:3px}.start-v9-empty strong{font-size:12px}.start-v9-empty small{font-size:9px}
      .start-v9-house-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0}.start-v9-house-item{min-width:0;display:flex;align-items:center;gap:10px;padding:12px 10px;border-bottom:1px solid rgba(255,255,255,.065)}.start-v9-house-item:nth-child(odd){padding-left:0;border-right:1px solid rgba(255,255,255,.065)}.start-v9-house-icon{width:22px;color:var(--start-accent);font-size:16px;text-align:center}.start-v9-house-item>div{display:flex;flex-direction:column;gap:2px;min-width:0}.start-v9-house-item small{color:rgba(235,230,220,.48);font-size:9px}.start-v9-house-item strong{font-size:12px;font-weight:570;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.start-v9-house-item.alert strong,.start-v9-house-item.alert .start-v9-house-icon{color:#e7aaa0}
      .start-v9-scenes{margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}.start-v9-scenes-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.start-v9-scene-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.start-v9-scene{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px 10px;border:0;border-radius:10px;background:rgba(255,255,255,.035);color:rgba(247,242,234,.86);cursor:pointer;text-align:left;transition:background .16s ease,transform .16s ease}.start-v9-scene:hover{background:rgba(255,255,255,.065)}.start-v9-scene:active{transform:scale(.98)}.start-v9-scene span{color:var(--start-accent);font-size:14px}.start-v9-scene strong{max-width:100%;font-size:10px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.start-v9-scenes-empty{color:rgba(235,230,220,.48);font-size:10px}
      @media(max-width:960px){.start-v9-weather-facts{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:14px}.start-v9-weather-facts>div:nth-child(4){border-right:0}.start-v9-weather-facts>div:nth-child(n+5){padding-top:12px}.start-v9-lower-grid{grid-template-columns:1fr}.start-v9-section+ .start-v9-section{border-left:0}.start-v9-section{padding-left:28px;padding-right:28px}}
      @media(orientation:portrait){.start-v9-hero{min-height:clamp(460px,50vh,620px)}.start-v9-hero .alpine-atmosphere{background-size:cover;background-position:center 34%;transform:none}.start-v9-hero-content{grid-template-columns:1fr;grid-template-rows:auto 1fr auto auto;padding:28px 30px 24px}.alpine-time{font-size:clamp(72px,11vw,96px)}.start-v9-weather-now{align-self:end}.start-v9-weather-facts{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:14px}.start-v9-weather-facts>div{padding:0 10px}.start-v9-weather-facts>div:nth-child(4){border-right:0}.start-v9-weather-facts>div:nth-child(n+5){padding-top:12px}.start-v9-lower-grid{grid-template-columns:1fr}.start-v9-section+ .start-v9-section{border-left:0}.start-v9-section{padding:25px 30px 30px}}
      @media(orientation:landscape) and (min-width:961px){.start-v9-lower-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
      @media(max-width:620px){.start-v9-hero-content{padding:24px 20px 20px}.alpine-time{font-size:68px}.start-v9-weather-now strong{font-size:36px}.start-v9-weather-facts{grid-template-columns:1fr 1fr}.start-v9-weather-facts>div:nth-child(2n){border-right:0}.start-v9-weather-facts>div:nth-child(n+3){padding-top:10px}.start-v9-section{padding:22px 20px 26px}.start-v9-scene-grid{grid-template-columns:1fr 1fr}}
    `;
  };

  Panel.prototype.__jamesHomeExperienceInstalled = true;
  return true;
}
