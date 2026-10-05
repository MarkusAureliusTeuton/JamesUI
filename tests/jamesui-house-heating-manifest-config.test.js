import test from 'node:test';
import assert from 'node:assert/strict';
import { MANIFEST } from '../custom_components/jamesui/frontend/modules/provider.house-heating/manifest.js';
import { validateHouseHeatingConfig } from '../custom_components/jamesui/frontend/modules/provider.house-heating/config.js';

const binding = (entity_id) => ({ entity_id });
const zone = (id = 'wohnen') => ({
  id,
  name: id === 'wohnen' ? 'Wohnen' : 'Büro',
  current_temperature: binding(`sensor.${id}_ist`),
  target_temperature: binding(`sensor.${id}_soll`),
  heating_demand: binding(`binary_sensor.${id}_demand`),
  auto_regulation_enabled: binding(`binary_sensor.${id}_auto`),
});

test('declares the heating capability manifest', () => {
  assert.deepEqual(MANIFEST, {
    id: 'provider.house-heating', type: 'provider', version: '1.0.0', core_api: '1.x',
    depends_on: [], requires_capabilities: [], provides_capabilities: ['house.heatingZones'],
    config_schema: 'provider.house-heating/v1',
  });
});

test('validates and freezes explicit heating zones', () => {
  const config = validateHouseHeatingConfig({ zones: [zone('wohnen'), zone('buero')] });
  assert.equal(config.zones.length, 2);
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.zones));
  assert.deepEqual(config.zones[0].heating_demand.true_values, ['on','true','1']);
});

test('rejects duplicate ids and missing required bindings', () => {
  assert.throws(() => validateHouseHeatingConfig({ zones: [zone(), zone()] }), /duplicate zone id/);
  const bad = zone(); delete bad.target_temperature;
  assert.throws(() => validateHouseHeatingConfig({ zones: [bad] }), /target_temperature/);
});

test('rejects unknown fields', () => {
  assert.throws(() => validateHouseHeatingConfig({ zones: [], extra: true }), /unknown field/);
  assert.throws(() => validateHouseHeatingConfig({ zones: [{ ...zone(), extra: true }] }), /unknown field/);
});
