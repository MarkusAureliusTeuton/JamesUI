import test from "node:test";
import assert from "node:assert/strict";

import { WEATHER_TODAY_STYLES } from "../custom_components/jamesui/frontend/modules/widget.weather-today/styles.js";

test("Weather Today styles are root-scoped token-driven and preserve one-row tablet facts", () => {
  assert.match(WEATHER_TODAY_STYLES, /\[data-jui-widget="weather-today"\]/);
  assert.match(WEATHER_TODAY_STYLES, /container-type:\s*inline-size/);
  assert.match(WEATHER_TODAY_STYLES, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(WEATHER_TODAY_STYLES, /@container\s*\(max-width:\s*44rem\)/);
  assert.match(WEATHER_TODAY_STYLES, /var\(--jui-/);

  assert.doesNotMatch(WEATHER_TODAY_STYLES, /#[0-9a-f]{3,8}|rgba?\s*\(|hsla?\s*\(/i);
  assert.doesNotMatch(WEATHER_TODAY_STYLES, /!important/i);
  assert.doesNotMatch(WEATHER_TODAY_STYLES, /url\s*\(/i);
  assert.doesNotMatch(WEATHER_TODAY_STYLES, /(?:^|[,{]\s*)(html|body|:root)(?=[\s,{])/im);
  assert.doesNotMatch(WEATHER_TODAY_STYLES, /jamesui-home|start-v\d|weather\.home/i);
});

test("facts stay one continuous information row rather than seven card surfaces", () => {
  assert.match(WEATHER_TODAY_STYLES, /data-jui-weather-facts/);
  assert.doesNotMatch(WEATHER_TODAY_STYLES, /data-jui-weather-fact[^}]*background\s*:/s);
  assert.doesNotMatch(WEATHER_TODAY_STYLES, /data-jui-weather-fact[^}]*box-shadow\s*:/s);
});
