import test from 'node:test';
import assert from 'node:assert/strict';
import { MANIFEST } from '../custom_components/jamesui/frontend/modules/provider.house-lighting/manifest.js';
import { validateHouseLightingConfig } from '../custom_components/jamesui/frontend/modules/provider.house-lighting/config.js';
const light = (id, entity_id) => ({ id, name: id, state: { entity_id } });
test('declares lighting and ambient capabilities', () => { assert.deepEqual(MANIFEST.provides_capabilities, ['house.lights','house.ambientLights']); assert.equal(MANIFEST.id, 'provider.house-lighting'); assert.equal(MANIFEST.config_schema, 'provider.house-lighting/v1'); });
test('validates frozen explicit normal and ambient lists', () => { const cfg = validateHouseLightingConfig({ lights:[light('Decke','light.decke')], ambient_lights:[light('TV','light.tv')] }); assert.equal(cfg.lights[0].state.entity_id, 'light.decke'); assert.deepEqual(cfg.lights[0].state.true_values, ['on','true','1']); assert.ok(Object.isFrozen(cfg.ambient_lights)); });
test('rejects duplicate ids and any repeated physical source', () => { assert.throws(() => validateHouseLightingConfig({ lights:[light('A','light.a'),light('A','light.b')], ambient_lights:[] }), /duplicate light id/); assert.throws(() => validateHouseLightingConfig({ lights:[light('A','light.same')], ambient_lights:[light('B','light.same')] }), /source assigned more than once/); assert.throws(() => validateHouseLightingConfig({ lights:[light('A','light.same'),light('B','light.same')], ambient_lights:[] }), /source assigned more than once/); });
test('rejects unknown fields', () => { assert.throws(() => validateHouseLightingConfig({ lights:[], ambient_lights:[], extra:true }), /unknown field/); });
