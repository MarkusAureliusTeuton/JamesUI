const V11_POLISH_STYLES = `
  .alpine-home.start-v9{isolation:isolate}
  .alpine-home.start-v9::before{content:"";position:absolute;z-index:0;left:0;right:0;top:clamp(386px,42vh,516px);height:150px;background-image:linear-gradient(180deg,rgba(7,8,9,.02) 0%,rgba(7,8,9,.34) 42%,#070809 100%),var(--v11-bleed);background-size:cover;background-position:center 76%;filter:saturate(.9) brightness(.68);pointer-events:none}
  .alpine-home[data-atmosphere="clear-day"]{--v11-bleed:url('/jamesui_static/assets/alpine/clear-day.webp')}
  .alpine-home[data-atmosphere="cloudy-day"]{--v11-bleed:url('/jamesui_static/assets/alpine/cloudy-day.webp')}
  .alpine-home[data-atmosphere="rain-day"],.alpine-home[data-atmosphere="rain-night"]{--v11-bleed:url('/jamesui_static/assets/alpine/rain-day.webp')}
  .alpine-home[data-atmosphere="snow-day"],.alpine-home[data-atmosphere="snow-night"]{--v11-bleed:url('/jamesui_static/assets/alpine/snow-day.webp')}
  .alpine-home[data-atmosphere="fog"]{--v11-bleed:url('/jamesui_static/assets/alpine/fog.webp')}
  .alpine-home[data-atmosphere="dusk"]{--v11-bleed:url('/jamesui_static/assets/alpine/dusk.webp')}
  .alpine-home[data-atmosphere="clear-night"]{--v11-bleed:url('/jamesui_static/assets/alpine/clear-night.webp')}
  .alpine-home[data-atmosphere="cloudy-night"]{--v11-bleed:url('/jamesui_static/assets/alpine/cloudy-night.webp')}

  .start-v9-weather-facts{border-top:0!important;padding-top:10px!important}
  .start-v9-weather-fact{opacity:.96}
  .start-v9-weather-fact:not(:last-child){border-right:1px solid rgba(255,255,255,.075)!important}
  .start-v9-fact-icon{width:22px!important;height:22px!important;stroke-width:1.35!important}

  .start-v9-weather-symbol{display:block;width:58px;height:42px;font-size:0!important;color:transparent!important;background-position:center;background-repeat:no-repeat;background-size:contain;filter:drop-shadow(0 4px 14px rgba(0,0,0,.28))}
  .weather-cloudy .start-v9-weather-symbol{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 44'%3E%3Cg fill='none' stroke='%23e4c49b' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='18' cy='13' r='7'/%3E%3Cpath d='M18 2v4M7 13h4M10.3 5.3l2.8 2.8'/%3E%3Cpath fill='%23f2eee7' fill-opacity='.18' d='M17 35h31c7 0 11-4 11-9s-4-9-10-9c-2-7-8-11-15-11-8 0-14 5-16 12-7 0-12 4-12 9 0 5 4 8 11 8Z'/%3E%3Cpath d='M17 35h31c7 0 11-4 11-9s-4-9-10-9c-2-7-8-11-15-11-8 0-14 5-16 12-7 0-12 4-12 9 0 5 4 8 11 8Z'/%3E%3C/g%3E%3C/svg%3E")}
  .weather-clear .start-v9-weather-symbol{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 52 44'%3E%3Cg fill='none' stroke='%23e4c49b' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='26' cy='22' r='9'/%3E%3Cpath d='M26 3v6M26 35v6M7 22h6M39 22h6M12.5 8.5l4.2 4.2M35.3 31.3l4.2 4.2M39.5 8.5l-4.2 4.2M16.7 31.3l-4.2 4.2'/%3E%3C/g%3E%3C/svg%3E")}
  .weather-rain .start-v9-weather-symbol{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 58 44'%3E%3Cg fill='none' stroke='%23e4c49b' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 27h31c6 0 10-4 10-9s-4-9-10-9C41 4 36 2 31 2c-8 0-14 5-16 12-7 0-11 3-11 7s3 6 9 6Z'/%3E%3Cpath d='m17 33-2 5M29 33l-2 5M41 33l-2 5'/%3E%3C/g%3E%3C/svg%3E")}
  .weather-snow .start-v9-weather-symbol{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 58 44'%3E%3Cg fill='none' stroke='%23e4c49b' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 25h31c6 0 10-4 10-9s-4-9-10-9C41 3 36 1 31 1c-8 0-14 5-16 12-7 0-11 3-11 7s3 5 9 5Z'/%3E%3Cpath d='M18 32v8M14.5 34l7 4M21.5 34l-7 4M39 32v8M35.5 34l7 4M42.5 34l-7 4'/%3E%3C/g%3E%3C/svg%3E")}
  .weather-fog .start-v9-weather-symbol{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 58 44'%3E%3Cg fill='none' stroke='%23e4c49b' stroke-width='2.1' stroke-linecap='round'%3E%3Cpath d='M12 23h32c6 0 10-4 10-9s-4-9-10-9C40 2 36 1 31 1c-8 0-14 5-16 12-7 0-11 3-11 6s3 4 8 4Z'/%3E%3Cpath d='M8 31h40M13 38h32'/%3E%3C/g%3E%3C/svg%3E")}

  .start-v9-lower-grid{position:relative;z-index:2;margin:-24px 14px 0;border:1px solid rgba(255,255,255,.105);border-radius:18px;overflow:hidden;background:rgba(10,11,12,.90)!important;backdrop-filter:blur(14px);box-shadow:0 18px 48px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.045)}
  .start-v9-lower-grid::before{content:"";position:absolute;z-index:4;left:22px;right:22px;top:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(216,181,138,.20),rgba(255,255,255,.34),rgba(216,181,138,.20),transparent);pointer-events:none}
  .start-v9-section{border-top:0!important;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,0) 46%)!important}
  .start-v9-section+.start-v9-section{border-left:1px solid rgba(255,255,255,.085)!important}

  .start-v9-house-grid{gap:8px!important}
  .start-v9-house-item{min-height:46px!important;padding:9px 10px!important;border:1px solid rgba(255,255,255,.075)!important;border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 5px 14px rgba(0,0,0,.12)}
  .start-v9-house-item:nth-child(3n),.start-v9-house-item:nth-child(3n+1){border-right:1px solid rgba(255,255,255,.075)!important;padding-left:10px!important}
  .start-v9-house-icon{display:grid!important;place-items:center;width:26px!important;height:26px;border-radius:8px;background:rgba(216,181,138,.07);font-size:15px!important}
  .start-v9-house-item small{font-size:8px!important}.start-v9-house-item strong{font-size:10.5px!important}
  .start-v9-house-item.active{border-color:rgba(216,181,138,.18)!important;background:linear-gradient(180deg,rgba(216,181,138,.095),rgba(255,255,255,.028))}

  .start-v9-scenes{margin-top:12px!important;padding-top:10px!important;border-top:1px solid rgba(255,255,255,.065)!important}
  .start-v9-scene-grid{gap:7px!important}
  .start-v9-scene{position:relative;isolation:isolate;overflow:hidden;min-height:54px!important;padding:9px 9px!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:10px!important;background-image:linear-gradient(180deg,rgba(7,8,9,.12),rgba(7,8,9,.82)),url('/jamesui_static/assets/alpine/clear-day.webp')!important;background-size:cover!important;background-position:center!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 5px 14px rgba(0,0,0,.14)}
  .start-v9-scene:nth-child(2){background-image:linear-gradient(180deg,rgba(7,8,9,.10),rgba(7,8,9,.84)),url('/jamesui_static/assets/alpine/cloudy-night.webp')!important}
  .start-v9-scene:nth-child(3){background-image:linear-gradient(180deg,rgba(7,8,9,.10),rgba(7,8,9,.84)),url('/jamesui_static/assets/alpine/dusk.webp')!important}
  .start-v9-scene:nth-child(4){background-image:linear-gradient(180deg,rgba(7,8,9,.12),rgba(7,8,9,.86)),url('/jamesui_static/assets/alpine/fog.webp')!important}
  .start-v9-scene span,.start-v9-scene strong{position:relative;z-index:1;text-shadow:0 2px 8px rgba(0,0,0,.58)}
  .start-v9-scene span{font-size:14px!important}.start-v9-scene strong{font-size:9.5px!important;color:rgba(255,255,255,.94)}
  .start-v9-scene:hover{border-color:rgba(216,181,138,.24)!important;transform:translateY(-1px)}
  .start-v9-scene.activated{border-color:rgba(216,181,138,.42)!important;box-shadow:inset 0 0 0 1px rgba(216,181,138,.18),0 7px 18px rgba(0,0,0,.18)}

  .start-v9-event i{width:7px!important;height:7px!important;margin-top:3px!important;box-shadow:0 0 0 3px rgba(216,181,138,.07)}
  .start-v9-event{border-bottom:1px solid rgba(255,255,255,.045)}.start-v9-event:last-child{border-bottom:0}

  @media(max-width:759px){.start-v9-lower-grid{margin:-16px 8px 0;border-radius:15px}.start-v9-section+.start-v9-section{border-left:0!important}.start-v9-house-grid{gap:6px!important}}
`;

export function installV11Polish() {
  if (typeof customElements === "undefined") return false;
  const Panel = customElements.get("jamesui-panel");
  if (!Panel || Panel.prototype.__jamesV11PolishInstalled) return Boolean(Panel);
  const originalStyles = Panel.prototype._styles;
  Panel.prototype._styles = function () {
    return `${originalStyles.call(this)}\n${V11_POLISH_STYLES}`;
  };
  Panel.prototype.__jamesV11PolishInstalled = true;
  return true;
}
