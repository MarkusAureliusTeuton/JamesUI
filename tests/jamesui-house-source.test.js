import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateHouseSourceBinding,
  readHouseSourceValue,
  readHouseSourceNumber,
  readHouseSourceBoolean,
} from '../custom_components/jamesui/frontend/shared/house-source.js';

const state = (value, attributes = {}) => ({ entity_id: 'sensor.test', state: value, attributes });

test('validates and freezes plain and attribute bindings', () => {
  const plain = validateHouseSourceBinding({ entity_id: 'sensor.temp' }, 'temp');
  assert.deepEqual(plain, { entity_id: 'sensor.temp' });
  assert.ok(Object.isFrozen(plain));
  const attr = validateHouseSourceBinding({ entity_id: 'climate.room', attribute: 'current_temperature' }, 'temp');
  assert.equal(attr.attribute, 'current_temperature');
});

test('reads plain state and attribute values', () => {
  assert.deepEqual(readHouseSourceValue(state('21.5'), { entity_id: 'sensor.test' }), { status: 'available', value: '21.5', reason: null });
  assert.deepEqual(readHouseSourceValue(state('heat', { target: 22 }), { entity_id: 'sensor.test', attribute: 'target' }), { status: 'available', value: 22, reason: null });
});

test('reads finite numbers and rejects unavailable or malformed values', () => {
  assert.deepEqual(readHouseSourceNumber(state('21.5'), { entity_id: 'sensor.test' }), { status: 'available', value: 21.5, reason: null });
  assert.equal(readHouseSourceNumber(state('NaN'), { entity_id: 'sensor.test' }).reason, 'value_unrecognized');
  assert.equal(readHouseSourceNumber(state('unknown'), { entity_id: 'sensor.test' }).reason, 'source_unavailable');
  assert.equal(readHouseSourceNumber(null, { entity_id: 'sensor.test' }).reason, 'source_missing');
  assert.equal(readHouseSourceNumber(state('ok', {}), { entity_id: 'sensor.test', attribute: 'missing' }).reason, 'attribute_missing');
});

test('uses default boolean mappings', () => {
  const binding = validateHouseSourceBinding({ entity_id: 'binary_sensor.test' }, 'active', { boolean: true });
  assert.deepEqual(binding.true_values, ['on', 'true', '1']);
  assert.deepEqual(binding.false_values, ['off', 'false', '0']);
  assert.equal(readHouseSourceBoolean(state('on'), binding).value, true);
  assert.equal(readHouseSourceBoolean(state('OFF'), binding).value, false);
});

test('uses custom boolean mappings and rejects unmatched values', () => {
  const binding = validateHouseSourceBinding({ entity_id: 'sensor.mode', true_values: ['heating'], false_values: ['idle'] }, 'mode', { boolean: true });
  assert.equal(readHouseSourceBoolean(state('heating'), binding).value, true);
  assert.equal(readHouseSourceBoolean(state('idle'), binding).value, false);
  assert.equal(readHouseSourceBoolean(state('standby'), binding).reason, 'value_unrecognized');
});

test('rejects invalid binding shapes and overlapping boolean mappings', () => {
  assert.throws(() => validateHouseSourceBinding(null, 'x'), /plain object/);
  assert.throws(() => validateHouseSourceBinding({ entity_id: '' }, 'x'), /entity_id/);
  assert.throws(() => validateHouseSourceBinding({ entity_id: 'sensor.x', extra: true }, 'x'), /unknown field/);
  assert.throws(() => validateHouseSourceBinding({ entity_id: 'sensor.x', true_values: ['on'], false_values: ['ON'] }, 'x', { boolean: true }), /overlap/);
});
