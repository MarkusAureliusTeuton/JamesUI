const TABLER_VERSION = "3.48.0";

const p = (d) => ({ tag: "path", attrs: { d } });
const circle = (cx, cy, r) => ({ tag: "circle", attrs: { cx, cy, r } });
const rect = (x, y, width, height, rx = undefined, ry = undefined) => {
  const attrs = { x, y, width, height };
  if (rx !== undefined) attrs.rx = rx;
  if (ry !== undefined) attrs.ry = ry;
  return { tag: "rect", attrs };
};

function tabler(id, sourceName, nodes) {
  return { id, source: "tabler", sourceName, sourceVersion: TABLER_VERSION, nodes };
}

function jamesui(id, nodes) {
  return { id, source: "jamesui", sourceName: null, sourceVersion: null, nodes };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const HOME = [
  p("M5 12l-2 0l9 -9l9 9l-2 0"),
  p("M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"),
  p("M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"),
];
const COTTAGE = [
  p("M3 21l18 0"),
  p("M4 21v-11l2.5 -4.5l5.5 -2.5l5.5 2.5l2.5 4.5v11"),
  p("M10 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"),
  p("M9 21v-5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v5"),
];
const TEMPERATURE = [p("M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5"), p("M10 9l4 0")];
const PLAYER_PLAY = [p("M7 4v16l13 -8l-13 -8")];
const DOOR = [p("M14 12v.01"), p("M3 21h18"), p("M6 21v-16a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16")];
const SETTINGS = [
  p("M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065"),
  p("M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"),
];
const DOTS = [p("M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"), p("M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"), p("M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0")];
const ARROW_LEFT = [p("M5 12l14 0"), p("M5 12l6 6"), p("M5 12l6 -6")];
const CLOSE = [p("M18 6l-12 12"), p("M6 6l12 12")];
const SUN = [p("M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"), p("M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7")];
const CLOUD = [p("M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878")];
const CLOUD_RAIN = [p("M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7"), p("M11 13v2m0 3v2m4 -5v2m0 3v2")];
const SNOWFLAKE = [
  p("M10 4l2 1l2 -1"), p("M12 2v6.5l3 1.72"), p("M17.928 6.268l.134 2.232l1.866 1.232"),
  p("M20.66 7l-5.629 3.25l.01 3.458"), p("M19.928 14.268l-1.866 1.232l-.134 2.232"),
  p("M20.66 17l-5.629 -3.25l-2.99 1.738"), p("M14 20l-2 -1l-2 1"), p("M12 22v-6.5l-3 -1.72"),
  p("M6.072 17.732l-.134 -2.232l-1.866 -1.232"), p("M3.34 17l5.629 -3.25l-.01 -3.458"),
  p("M4.072 9.732l1.866 -1.232l.134 -2.232"), p("M3.34 7l5.629 3.25l2.99 -1.738"),
];
const CLOUD_STORM = [p("M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1"), p("M13 14l-2 4l3 0l-2 4")];
const WIND = [p("M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24"), p("M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24"), p("M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24")];
const MIST = [p("M5 5h3m4 0h9"), p("M3 10h11m4 0h1"), p("M5 15h5m4 0h7"), p("M3 20h9m4 0h3")];
const TEMPERATURE_SUN = [
  p("M4 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 1 0 -4 0v8.5"), p("M4 9h4"),
  p("M13 16a4 4 0 1 0 0 -8a4.07 4.07 0 0 0 -1 .124"), p("M13 3v1"), p("M21 12h1"),
  p("M13 20v1"), p("M19.4 5.6l-.7 .7"), p("M18.7 17.7l.7 .7"),
];
const TEMPERATURE_SNOW = [
  p("M4 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 1 0 -4 0v8.5"), p("M4 9h4"), p("M14.75 4l1 2h2.25"),
  p("M17 4l-3 5l2 3"), p("M20.25 10l-1.25 2l1.25 2"), p("M22 12h-6l-2 3"), p("M18 18h-2.25l-1 2"),
  p("M17 20l-3 -5h-1"), p("M12 9l2.088 .008"),
];
const SUNRISE = [p("M3 17h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 0 1 8 0"), p("M3 21l18 0"), p("M12 9v-6l3 3m-6 0l3 -3")];
const SUNSET = [p("M3 17h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 0 1 8 0"), p("M3 21l18 0"), p("M12 3v6l3 -3m-6 0l3 3")];
const BULB = [p("M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"), p("M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"), p("M9.7 17l4.6 0")];
const PLUG = [p("M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054"), p("M4 20l3.5 -3.5"), p("M15 4l-3.5 3.5"), p("M20 9l-3.5 3.5")];
const WINDOW = [p("M12 3c-3.866 0 -7 3.272 -7 7v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1 -1v-10c0 -3.728 -3.134 -7 -7 -7"), p("M5 13l14 0"), p("M12 3l0 18")];
const PROPELLER = [
  p("M9 13a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"),
  p("M14.167 10.5c.722 -1.538 1.156 -3.043 1.303 -4.514c.22 -1.63 -.762 -2.986 -3.47 -2.986s-3.69 1.357 -3.47 2.986c.147 1.471 .581 2.976 1.303 4.514"),
  p("M13.169 16.751c.97 1.395 2.057 2.523 3.257 3.386c1.3 1 2.967 .833 4.321 -1.512c1.354 -2.345 .67 -3.874 -.85 -4.498c-1.348 -.608 -2.868 -.985 -4.562 -1.128"),
  p("M8.664 13c-1.693 .143 -3.213 .52 -4.56 1.128c-1.522 .623 -2.206 2.153 -.852 4.498s3.02 2.517 4.321 1.512c1.2 -.863 2.287 -1.991 3.258 -3.386"),
];
const DEVICE_SPEAKER = [p("M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14"), p("M9 14a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"), p("M12 7l0 .01")];
const DEVICE_DESKTOP = [p("M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10"), p("M7 20h10"), p("M9 16v4"), p("M15 16v4")];
const BOLT = [p("M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11")];
const CALENDAR = [p("M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12"), p("M16 3v4"), p("M8 3v4"), p("M4 11h16"), p("M11 15h1"), p("M12 15v3")];
const CHECKBOX = [p("M9 11l3 3l8 -8"), p("M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9")];
const CAKE = [p("M3 20h18v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -3 3v8"), p("M3 14.803c.312 .135 .654 .204 1 .197a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1c.35 .007 .692 -.062 1 -.197"), p("M12 4l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737")];
const TRASH = [p("M4 7l16 0"), p("M10 11l0 6"), p("M14 11l0 6"), p("M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"), p("M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3")];
const RECYCLE = [p("M12 17l-2 2l2 2"), p("M10 19h9a2 2 0 0 0 1.75 -2.75l-.55 -1"), p("M8.536 11l-.732 -2.732l-2.732 .732"), p("M7.804 8.268l-4.5 7.794a2 2 0 0 0 1.506 2.89l1.141 .024"), p("M15.464 11l2.732 .732l.732 -2.732"), p("M18.196 11.732l-4.5 -7.794a2 2 0 0 0 -3.256 -.14l-.591 .976")];
const FILE_TEXT = [p("M14 3v4a1 1 0 0 0 1 1h4"), p("M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"), p("M9 9l1 0"), p("M9 13l6 0"), p("M9 17l6 0")];

const PARTLY_CLOUDY = [circle(7.5, 7.5, 3), p("M7 17h10a3 3 0 0 0 0 -6h-.7a4.5 4.5 0 0 0 -8.5 1.4a2.7 2.7 0 0 0 -.8 4.6")];
const HEAVY_RAIN = [p("M6.5 15.5h11a3.5 3.5 0 0 0 .2 -7a5.5 5.5 0 0 0 -10.5 -1.1a4.2 4.2 0 0 0 -.7 8.1"), p("M8 18l-1 3"), p("M12 18l-1 3"), p("M16 18l-1 3")];
const SHUTTER = [rect(5, 3, 14, 18, 1), p("M5 8h14"), p("M5 11h14"), p("M5 14h14"), p("M5 17h14")];
const MOON_OUTER = [circle(12, 12, 9)];

export const ICON_DEFINITIONS = deepFreeze([
  tabler("nav.start", "home", HOME),
  tabler("nav.house", "building-cottage", COTTAGE),
  tabler("nav.climate", "temperature", TEMPERATURE),
  tabler("nav.media", "player-play", PLAYER_PLAY),
  tabler("nav.door", "door", DOOR),
  tabler("shell.settings", "settings", SETTINGS),
  tabler("shell.more", "dots", DOTS),
  tabler("shell.back", "arrow-left", ARROW_LEFT),
  tabler("shell.close", "x", CLOSE),
  tabler("weather.sunny", "sun", SUN),
  jamesui("weather.partly-cloudy", PARTLY_CLOUDY),
  tabler("weather.cloudy", "cloud", CLOUD),
  tabler("weather.rain", "cloud-rain", CLOUD_RAIN),
  jamesui("weather.heavy-rain", HEAVY_RAIN),
  tabler("weather.snow", "snowflake", SNOWFLAKE),
  tabler("weather.storm", "cloud-storm", CLOUD_STORM),
  tabler("weather.wind", "wind", WIND),
  tabler("weather.fog", "mist", MIST),
  tabler("weather.temperature-high", "temperature-sun", TEMPERATURE_SUN),
  tabler("weather.temperature-low", "temperature-snow", TEMPERATURE_SNOW),
  tabler("weather.sunrise", "sunrise", SUNRISE),
  tabler("weather.sunset", "sunset", SUNSET),
  tabler("home.light", "bulb", BULB),
  tabler("home.outlet", "plug", PLUG),
  tabler("home.window", "window", WINDOW),
  tabler("home.door", "door", DOOR),
  jamesui("home.shutter", SHUTTER),
  tabler("home.ventilation", "propeller", PROPELLER),
  tabler("home.climate", "temperature", TEMPERATURE),
  tabler("home.media", "device-speaker", DEVICE_SPEAKER),
  tabler("home.device", "device-desktop", DEVICE_DESKTOP),
  tabler("home.energy", "bolt", BOLT),
  tabler("home.calendar", "calendar", CALENDAR),
  tabler("home.task", "checkbox", CHECKBOX),
  tabler("home.birthday", "cake", CAKE),
  tabler("home.waste", "trash", TRASH),
  tabler("home.recycling", "recycle", RECYCLE),
  tabler("home.paper", "file-text", FILE_TEXT),
  jamesui("moon.new", [...MOON_OUTER, circle(12, 12, 5.5)]),
  jamesui("moon.waxing-crescent", [...MOON_OUTER, p("M8 4c7 4 7 12 0 16")]),
  jamesui("moon.first-quarter", [...MOON_OUTER, p("M12 3v18"), p("M12 12h3")]),
  jamesui("moon.waxing-gibbous", [...MOON_OUTER, p("M15 4c-4 4 -4 12 0 16")]),
  jamesui("moon.full", MOON_OUTER),
  jamesui("moon.waning-gibbous", [...MOON_OUTER, p("M9 4c4 4 4 12 0 16")]),
  jamesui("moon.last-quarter", [...MOON_OUTER, p("M12 3v18"), p("M12 12h-3")]),
  jamesui("moon.waning-crescent", [...MOON_OUTER, p("M16 4c-7 4 -7 12 0 16")]),
]);
