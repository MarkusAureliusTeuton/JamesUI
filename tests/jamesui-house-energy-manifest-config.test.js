import test from 'node:test'; import assert from 'node:assert/strict';
import { MANIFEST } from '../custom_components/jamesui/frontend/modules/provider.house-energy/manifest.js';
import { validateHouseEnergyConfig } from '../custom_components/jamesui/frontend/modules/provider.house-energy/config.js';
const source=(id='house')=>({id,name:id==='house'?'Haus gesamt':id,power:{entity_id:`sensor.${id}_power`}});
test('declares house energy query capability',()=>{assert.deepEqual(MANIFEST.provides_capabilities,['house.energy']);assert.equal(MANIFEST.config_schema,'provider.house-energy/v1');});
test('validates explicit frozen energy sources',()=>{const cfg=validateHouseEnergyConfig({sources:[source()]});assert.equal(cfg.sources[0].power.entity_id,'sensor.house_power');assert.ok(Object.isFrozen(cfg.sources));});
test('rejects duplicate ids missing power and provider-side thresholds',()=>{assert.throws(()=>validateHouseEnergyConfig({sources:[source(),source()]}),/duplicate energy source id/);const bad=source();delete bad.power;assert.throws(()=>validateHouseEnergyConfig({sources:[bad]}),/power/);assert.throws(()=>validateHouseEnergyConfig({sources:[{...source(),warning_threshold_w:2000}]}),/unknown field/);});
