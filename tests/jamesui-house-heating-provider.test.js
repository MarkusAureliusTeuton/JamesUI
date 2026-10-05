import test from 'node:test';
import assert from 'node:assert/strict';
import { createHouseHeatingProvider } from '../custom_components/jamesui/frontend/modules/provider.house-heating/provider.js';

function state(entity_id, value, attributes = {}) { return { entity_id, state: value, attributes }; }
function zone(id, shared = null) {
  return { id, name: id === 'wohnen' ? 'Wohnen' : 'Büro', current_temperature: { entity_id: shared ?? `sensor.${id}_ist` }, target_temperature: { entity_id: `sensor.${id}_soll` }, heating_demand: { entity_id: `binary_sensor.${id}_demand` }, auto_regulation_enabled: { entity_id: `binary_sensor.${id}_auto` } };
}
function makeContext(initialStates = {}, connection = 'connected') {
  let connectionState = connection;
  const states = new Map(Object.entries(initialStates));
  const entityListeners = new Map();
  const connectionListeners = new Set();
  const publications = [];
  let unregistered = 0;
  const context = {
    homeAssistant: {
      connectionState: () => connectionState,
      getState: (id) => connectionState === 'connected' ? states.get(id) ?? null : null,
      subscribeEntity(id, listener) {
        if (!entityListeners.has(id)) entityListeners.set(id, new Set());
        entityListeners.get(id).add(listener);
        return () => { const listeners = entityListeners.get(id); listeners?.delete(listener); if (listeners?.size === 0) entityListeners.delete(id); };
      },
      subscribeConnection(listener) { connectionListeners.add(listener); return () => connectionListeners.delete(listener); },
      entities() { throw new Error('auto-discovery forbidden'); },
    },
    capabilities: { register(moduleId, capability) { assert.equal(moduleId, 'provider.house-heating'); assert.equal(capability, 'house.heatingZones'); return { available(value) { publications.push({ status: 'available', value }); }, unavailable(reason) { publications.push({ status: 'unavailable', reason }); }, notConfigured(reason) { publications.push({ status: 'not_configured', reason }); }, unregister() { unregistered += 1; } }; } },
  };
  return { context, publications, states, entityListeners, unregistered: () => unregistered, setState(id, next) { states.set(id, next); for (const fn of entityListeners.get(id) ?? []) fn(next); }, setConnection(next) { connectionState = next; for (const fn of connectionListeners) fn(next); } };
}
function healthyStates(ids = ['wohnen','buero']) {
  const out = {};
  for (const id of ids) {
    out[`sensor.${id}_ist`] = state(`sensor.${id}_ist`, id === 'wohnen' ? '21.4' : '20.2');
    out[`sensor.${id}_soll`] = state(`sensor.${id}_soll`, id === 'wohnen' ? '22' : '21');
    out[`binary_sensor.${id}_demand`] = state(`binary_sensor.${id}_demand`, id === 'wohnen' ? 'on' : 'off');
    out[`binary_sensor.${id}_auto`] = state(`binary_sensor.${id}_auto`, 'on');
  }
  return out;
}

test('publishes not_configured for zero zones', () => { const env = makeContext(); const provider = createHouseHeatingProvider(env.context, { zones: [] }); assert.equal(provider.mount(), true); assert.equal(env.publications.at(-1).status, 'not_configured'); assert.equal(env.publications.at(-1).reason, 'no_heating_zones'); });
test('publishes normalized independent KNX zones without deriving values', () => { const env = makeContext(healthyStates()); const provider = createHouseHeatingProvider(env.context, { zones: [zone('wohnen'), zone('buero')] }); provider.mount(); const value = env.publications.at(-1).value; assert.equal(value.zones.length, 2); assert.deepEqual(value.zones[0], { id:'wohnen', name:'Wohnen', current_temperature_c:21.4, target_temperature_c:22, heating_demand:true, auto_regulation_enabled:true, availability:'available', reason:null }); assert.equal(value.zones[1].heating_demand, false); });
test('missing target source only makes that zone unavailable', () => { const states = healthyStates(); delete states['sensor.wohnen_soll']; const env = makeContext(states); createHouseHeatingProvider(env.context, { zones: [zone('wohnen'), zone('buero')] }).mount(); const [wohnen, buero] = env.publications.at(-1).value.zones; assert.equal(wohnen.availability, 'unavailable'); assert.match(wohnen.reason, /target_temperature/); assert.equal(wohnen.current_temperature_c, 21.4); assert.equal(wohnen.target_temperature_c, null); assert.equal(buero.availability, 'available'); });
test('subscribes each physical entity once and updates snapshots', () => { const states = healthyStates(['wohnen']); states['sensor.shared'] = state('sensor.shared', '21'); const env = makeContext(states); const cfg = zone('wohnen', 'sensor.shared'); cfg.target_temperature = { entity_id: 'sensor.shared' }; const provider = createHouseHeatingProvider(env.context, { zones: [cfg] }); provider.mount(); assert.equal(env.entityListeners.get('sensor.shared').size, 1); env.setState('sensor.shared', state('sensor.shared','23')); const z = env.publications.at(-1).value.zones[0]; assert.equal(z.current_temperature_c, 23); assert.equal(z.target_temperature_c, 23); });
test('disconnect invalidates capability and reconnect rebuilds state', () => { const env = makeContext(healthyStates(['wohnen'])); const provider = createHouseHeatingProvider(env.context, { zones: [zone('wohnen')] }); provider.mount(); env.setConnection('disconnected'); assert.equal(env.publications.at(-1).status, 'unavailable'); assert.equal(env.publications.at(-1).reason, 'home_assistant_disconnected'); env.setConnection('connected'); assert.equal(env.publications.at(-1).status, 'available'); });
test('update rebinds to validated config and destroy cleans up', () => { const env = makeContext(healthyStates()); const provider = createHouseHeatingProvider(env.context, { zones: [zone('wohnen')] }); provider.mount(); assert.ok(env.entityListeners.size > 0); provider.update(env.context, { zones: [zone('buero')] }); assert.equal(env.publications.at(-1).value.zones[0].id, 'buero'); assert.equal(provider.destroy(), true); assert.equal(env.entityListeners.size, 0); assert.equal(env.unregistered(), 1); assert.equal(provider.destroy(), false); });
