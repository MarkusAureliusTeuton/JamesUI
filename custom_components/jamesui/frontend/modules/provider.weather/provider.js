import { MANIFEST } from "./manifest.js";
import { validateWeatherProviderConfig } from "./config.js";
import { deepFreeze, finiteOrNull, normalizeCurrentWeather, selectWeatherSource, weatherUnits } from "./normalize.js";
import {
  FORECAST_FEATURE_DAILY,
  FORECAST_FEATURE_HOURLY,
  FORECAST_FEATURE_TWICE_DAILY,
  aggregateHourlyForecastToDaily,
  aggregateTwiceDailyForecast,
  findNextPrecipitation,
  isValidTimeZone,
  normalizeHourlyForecast,
  normalizeTrueDailyForecast,
} from "./forecast.js";
import { normalizeSun, resolveAtmosphere } from "./atmosphere.js";
import { calculateMoon, resolveMoon } from "./moon.js";

const REFRESH_MS = 300000;
const FORECAST_TYPES = Object.freeze([
  ["daily", FORECAST_FEATURE_DAILY],
  ["hourly", FORECAST_FEATURE_HOURLY],
  ["twice_daily", FORECAST_FEATURE_TWICE_DAILY],
]);

function validateContext(context) {
  if (!context || typeof context !== "object") throw new TypeError("weather provider context is required");
  if (!context.capabilities || typeof context.capabilities.register !== "function") throw new TypeError("weather provider requires capabilities");
  if (!context.homeAssistant || typeof context.homeAssistant.connectionState !== "function") throw new TypeError("weather provider requires homeAssistant");
  if (context.module?.id !== MANIFEST.id) throw new TypeError(`weather provider module id must be ${MANIFEST.id}`);
  return context;
}

function validateRuntime(runtime) {
  if (!runtime || typeof runtime.now !== "function" || typeof runtime.setInterval !== "function" || typeof runtime.clearInterval !== "function") {
    throw new TypeError("weather provider runtime is invalid");
  }
  return runtime;
}

function bestEffortUnsubscribe(unsubscribe) {
  try {
    Promise.resolve(unsubscribe()).catch(() => {});
  } catch (_) {
    // Cleanup is best-effort and must never block sibling cleanup.
  }
}

function supportedFeatures(entity) {
  const value = finiteOrNull(entity?.attributes?.supported_features);
  return value === null ? 0 : Math.trunc(value);
}

function eventForecast(event) {
  if (Array.isArray(event)) return event;
  return event?.forecast;
}

export function createWeatherProvider(initialContext, initialConfig, runtime) {
  let context = validateContext(initialContext);
  let config = validateWeatherProviderConfig(initialConfig);
  validateRuntime(runtime);

  let mounted = false;
  let destroyed = false;
  let timerHandle = null;
  let localUnsubscribes = [];
  let remoteUnsubscribes = [];
  let handles = new Map();
  let generation = 0;
  let forecastKey = null;
  let forecastPayloads = { daily: null, hourly: null, twice_daily: null };
  let forecastFailures = { daily: null, hourly: null, twice_daily: null };
  let selectedWeatherEntity = null;
  let selectedWeatherId = null;
  let cachedTimeZone = null;
  let cachedHourlyValue = null;
  let currentBase = null;
  let moonState = null;

  const handle = (capability) => handles.get(capability);

  const publishWeatherStatus = (status, reason) => {
    for (const capability of ["weather.current", "weather.daily", "weather.hourly"]) {
      const capabilityHandle = handle(capability);
      if (!capabilityHandle) continue;
      if (status === "not_configured") capabilityHandle.notConfigured(reason);
      else capabilityHandle.unavailable(reason);
    }
  };

  const clearRemoteForecasts = () => {
    generation += 1;
    for (const unsubscribe of remoteUnsubscribes) bestEffortUnsubscribe(unsubscribe);
    remoteUnsubscribes = [];
    forecastKey = null;
    forecastPayloads = { daily: null, hourly: null, twice_daily: null };
    forecastFailures = { daily: null, hourly: null, twice_daily: null };
    cachedHourlyValue = null;
  };

  const publishCurrentFromCache = () => {
    if (!mounted || !currentBase) return;
    const next = findNextPrecipitation(cachedHourlyValue, { now: runtime.now(), timeZone: cachedTimeZone });
    handle("weather.current")?.available(deepFreeze({
      ...currentBase,
      next_precipitation_at: next?.datetime ?? null,
      next_precipitation_probability: next?.probability ?? null,
    }));
  };

  const dailyFromCaches = () => {
    if (!isValidTimeZone(cachedTimeZone)) return { value: null, reason: "timezone_unavailable" };
    const units = weatherUnits(selectedWeatherEntity);
    const sourceEntityId = selectedWeatherId;
    const candidates = [];

    if ((supportedFeatures(selectedWeatherEntity) & FORECAST_FEATURE_DAILY) !== 0 && !forecastFailures.daily && forecastPayloads.daily !== null) {
      candidates.push(normalizeTrueDailyForecast({ sourceEntityId, units, forecast: forecastPayloads.daily, timeZone: cachedTimeZone }));
    }
    if ((supportedFeatures(selectedWeatherEntity) & FORECAST_FEATURE_TWICE_DAILY) !== 0 && !forecastFailures.twice_daily && forecastPayloads.twice_daily !== null) {
      candidates.push(aggregateTwiceDailyForecast({ sourceEntityId, units, forecast: forecastPayloads.twice_daily, timeZone: cachedTimeZone }));
    }
    if ((supportedFeatures(selectedWeatherEntity) & FORECAST_FEATURE_HOURLY) !== 0 && cachedHourlyValue) {
      candidates.push(aggregateHourlyForecastToDaily({ sourceEntityId, units, hourlyValue: cachedHourlyValue, timeZone: cachedTimeZone }));
    }
    const usable = candidates.find((candidate) => candidate?.value);
    if (usable) return usable;

    const featureMask = supportedFeatures(selectedWeatherEntity);
    if ((featureMask & (FORECAST_FEATURE_DAILY | FORECAST_FEATURE_TWICE_DAILY | FORECAST_FEATURE_HOURLY)) === 0) {
      return { value: null, reason: "unsupported" };
    }
    if (forecastFailures.daily || forecastFailures.twice_daily || forecastFailures.hourly) {
      return { value: null, reason: "subscription_failed" };
    }
    const firstReason = candidates.find((candidate) => candidate?.reason)?.reason ?? "empty_data";
    return { value: null, reason: firstReason };
  };

  const publishForecastCapabilities = () => {
    if (!mounted || !selectedWeatherEntity) return;
    const units = weatherUnits(selectedWeatherEntity);
    const featureMask = supportedFeatures(selectedWeatherEntity);

    if ((featureMask & FORECAST_FEATURE_HOURLY) === 0) {
      cachedHourlyValue = null;
      handle("weather.hourly")?.unavailable("unsupported");
    } else if (forecastFailures.hourly) {
      cachedHourlyValue = null;
      handle("weather.hourly")?.unavailable("subscription_failed");
    } else if (forecastPayloads.hourly === null) {
      cachedHourlyValue = null;
      handle("weather.hourly")?.unavailable("empty_data");
    } else {
      const hourly = normalizeHourlyForecast({ sourceEntityId: selectedWeatherId, units, forecast: forecastPayloads.hourly, timeZone: cachedTimeZone });
      cachedHourlyValue = hourly.value;
      if (hourly.value) handle("weather.hourly")?.available(hourly.value);
      else handle("weather.hourly")?.unavailable(hourly.reason);
    }

    const daily = dailyFromCaches();
    if (daily.value) handle("weather.daily")?.available(daily.value);
    else handle("weather.daily")?.unavailable(daily.reason);
    publishCurrentFromCache();
  };

  const handleForecastEvent = (type, event, eventGeneration, sourceEntityId) => {
    if (!mounted || destroyed || eventGeneration !== generation || sourceEntityId !== selectedWeatherId) return;
    forecastPayloads = { ...forecastPayloads, [type]: eventForecast(event) };
    forecastFailures = { ...forecastFailures, [type]: null };
    publishForecastCapabilities();
  };

  const ensureForecastSubscriptions = (weatherEntity) => {
    const featureMask = supportedFeatures(weatherEntity);
    const nextKey = `${weatherEntity.entity_id}:${featureMask}`;
    if (forecastKey === nextKey) return;

    clearRemoteForecasts();
    forecastKey = nextKey;
    const eventGeneration = generation;
    const sourceEntityId = weatherEntity.entity_id;
    publishForecastCapabilities();

    for (const [type, bit] of FORECAST_TYPES) {
      if ((featureMask & bit) === 0) continue;
      const message = { type: "weather/subscribe_forecast", forecast_type: type, entity_id: sourceEntityId };
      Promise.resolve(context.homeAssistant.subscribeMessage(
        (event) => handleForecastEvent(type, event, eventGeneration, sourceEntityId),
        message,
      )).then((unsubscribe) => {
        if (!mounted || destroyed || eventGeneration !== generation || sourceEntityId !== selectedWeatherId) {
          bestEffortUnsubscribe(unsubscribe);
          return;
        }
        remoteUnsubscribes.push(unsubscribe);
      }).catch(() => {
        if (!mounted || destroyed || eventGeneration !== generation || sourceEntityId !== selectedWeatherId) return;
        forecastFailures = { ...forecastFailures, [type]: "subscription_failed" };
        publishForecastCapabilities();
      });
    }
  };

  const publishMoonFromHaState = (sensorEntities) => {
    const moonEntities = [...sensorEntities];
    if (config.moon_entity_id && !moonEntities.some((entity) => entity?.entity_id === config.moon_entity_id)) {
      const configuredMoon = context.homeAssistant.getState(config.moon_entity_id);
      if (configuredMoon) moonEntities.push(configuredMoon);
    }
    const value = resolveMoon({ now: runtime.now(), configuredEntityId: config.moon_entity_id ?? null, sensorEntities: moonEntities });
    moonState = {
      phase: value.phase,
      phase_source: value.phase_source,
      source_entity_id: value.source_entity_id,
      source_issue: value.source_issue,
    };
    handle("weather.moon")?.available(value);
  };

  const publishCalculatedMoonFromCache = () => {
    if (!mounted) return;
    const calculated = calculateMoon(runtime.now());
    const useHaPhase = moonState?.phase_source === "home_assistant";
    const value = deepFreeze({
      phase: useHaPhase ? moonState.phase : calculated.phase,
      illumination_percent: calculated.illumination_percent,
      waxing: calculated.waxing,
      phase_source: useHaPhase ? "home_assistant" : "calculated",
      illumination_source: "calculated",
      source_entity_id: useHaPhase ? moonState.source_entity_id : null,
      source_issue: moonState?.source_issue ?? null,
    });
    handle("weather.moon")?.available(value);
  };

  const reconcileIndependentCapabilities = (connected) => {
    if (!connected) {
      handle("weather.sun")?.unavailable("home_assistant_disconnected");
      handle("weather.atmosphere")?.unavailable("home_assistant_disconnected");
      const value = resolveMoon({ now: runtime.now(), configuredEntityId: config.moon_entity_id ?? null, sensorEntities: [] });
      moonState = { phase: value.phase, phase_source: "calculated", source_entity_id: null, source_issue: value.source_issue };
      handle("weather.moon")?.available(value);
      return;
    }

    const sunValue = normalizeSun(context.homeAssistant.getState("sun.sun"), cachedTimeZone);
    if (sunValue) handle("weather.sun")?.available(sunValue);
    else handle("weather.sun")?.unavailable("sun_unavailable");

    const sensors = context.homeAssistant.entities("sensor");
    publishMoonFromHaState(sensors);

    const ambientEntity = config.illuminance_entity_id ? context.homeAssistant.getState(config.illuminance_entity_id) : null;
    const atmosphere = resolveAtmosphere({
      condition: currentBase?.condition ?? null,
      period: sunValue?.period ?? null,
      ambientLux: ambientEntity?.state ?? null,
    });
    if (atmosphere.scene_key !== null) handle("weather.atmosphere")?.available(atmosphere);
    else handle("weather.atmosphere")?.unavailable("insufficient_data");
  };

  const reconcile = () => {
    if (!mounted || destroyed) return;
    const connected = context.homeAssistant.connectionState() === "connected";
    if (!connected) {
      selectedWeatherEntity = null;
      selectedWeatherId = null;
      cachedTimeZone = null;
      currentBase = null;
      clearRemoteForecasts();
      publishWeatherStatus("unavailable", "home_assistant_disconnected");
      reconcileIndependentCapabilities(false);
      return;
    }

    cachedTimeZone = context.homeAssistant.timeZone();
    const weatherEntities = context.homeAssistant.entities("weather");
    const selection = selectWeatherSource(config.entity_id ?? null, weatherEntities);
    if (selection.status !== "available") {
      selectedWeatherEntity = null;
      selectedWeatherId = null;
      currentBase = null;
      clearRemoteForecasts();
      publishWeatherStatus(selection.status, selection.reason);
      reconcileIndependentCapabilities(true);
      return;
    }

    const nextWeatherEntity = context.homeAssistant.getState(selection.entityId);
    if (!nextWeatherEntity) {
      selectedWeatherEntity = null;
      selectedWeatherId = null;
      currentBase = null;
      clearRemoteForecasts();
      publishWeatherStatus("unavailable", "source_missing");
      reconcileIndependentCapabilities(true);
      return;
    }

    selectedWeatherEntity = nextWeatherEntity;
    selectedWeatherId = selection.entityId;
    const override = config.outdoor_temperature_entity_id
      ? context.homeAssistant.getState(config.outdoor_temperature_entity_id)
      : null;
    currentBase = normalizeCurrentWeather({ weatherEntity: nextWeatherEntity, overrideEntity: override, nextPrecipitation: null, timeZone: cachedTimeZone });
    ensureForecastSubscriptions(nextWeatherEntity);
    publishCurrentFromCache();
    reconcileIndependentCapabilities(true);
  };

  const teardownLocalSubscriptions = () => {
    for (const unsubscribe of localUnsubscribes) {
      try { unsubscribe(); } catch (_) { /* local cleanup is best-effort */ }
    }
    localUnsubscribes = [];
  };

  const setupLocalSubscriptions = () => {
    const ha = context.homeAssistant;
    localUnsubscribes.push(ha.subscribeConnection(() => reconcile()));
    localUnsubscribes.push(ha.subscribeDomain("weather", () => reconcile()));
    localUnsubscribes.push(ha.subscribeDomain("sensor", () => reconcile()));
    localUnsubscribes.push(ha.subscribeEntity("sun.sun", () => reconcile()));
    const optional = new Set([
      config.outdoor_temperature_entity_id,
      config.moon_entity_id,
      config.illuminance_entity_id,
    ].filter(Boolean));
    for (const entityId of optional) localUnsubscribes.push(ha.subscribeEntity(entityId, () => reconcile()));
  };

  const refreshTimeDerived = () => {
    if (!mounted || destroyed) return;
    publishCalculatedMoonFromCache();
    publishCurrentFromCache();
  };

  return Object.freeze({
    mount(_target) {
      if (destroyed) throw new Error("weather provider is destroyed");
      if (mounted) return false;
      for (const capability of MANIFEST.provides_capabilities) {
        handles.set(capability, context.capabilities.register(context.module.id, capability));
      }
      mounted = true;
      setupLocalSubscriptions();
      reconcile();
      timerHandle = runtime.setInterval(refreshTimeDerived, REFRESH_MS);
      return true;
    },

    update(nextContext, nextConfig) {
      if (destroyed) throw new Error("weather provider is destroyed");
      const validatedContext = validateContext(nextContext);
      const validatedConfig = validateWeatherProviderConfig(nextConfig);
      if (!mounted) {
        context = validatedContext;
        config = validatedConfig;
        return true;
      }
      teardownLocalSubscriptions();
      clearRemoteForecasts();
      context = validatedContext;
      config = validatedConfig;
      selectedWeatherEntity = null;
      selectedWeatherId = null;
      currentBase = null;
      cachedTimeZone = null;
      setupLocalSubscriptions();
      reconcile();
      return true;
    },

    destroy() {
      if (destroyed) return false;
      destroyed = true;
      mounted = false;
      generation += 1;
      teardownLocalSubscriptions();
      for (const unsubscribe of remoteUnsubscribes) bestEffortUnsubscribe(unsubscribe);
      remoteUnsubscribes = [];
      if (timerHandle !== null) {
        runtime.clearInterval(timerHandle);
        timerHandle = null;
      }
      for (const capabilityHandle of handles.values()) capabilityHandle.unregister();
      handles = new Map();
      return true;
    },
  });
}
