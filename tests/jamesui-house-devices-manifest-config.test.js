import test from 'node:test'; import assert from 'node:assert/strict';
import { MANIFEST } from '../custom_components/jamesui/frontend/modules/provider.house-devices/manifest.js';
import { validateHouseDevicesConfig } from '../custom_components/jamesui/frontend/modules/provider.house-devices/config.js';
const device=(id='washer')=>({id,name:'Waschmaschine',primary_entity_id:'sensor.washer_status',active:{entity_id:'binary_sensor.washer_active'},update_available:{entity_id:'update.washer'}});
test('declares house devices capability',()=>{assert.deepEqual(MANIFEST.provides_capabilities,['house.devices']);assert.equal(MANIFEST.config_schema,'provider.house-devices/v1');});
test('validates normalized device config',()=>{const cfg=validateHouseDevicesConfig({devices:[device()]});assert.equal(cfg.devices[0].id,'washer');assert.deepEqual(cfg.devices[0].active.true_values,['on','true','1']);assert.ok(Object.isFrozen(cfg.devices));});
test('requires unique ids primary entity and one status signal',()=>{assert.throws(()=>validateHouseDevicesConfig({devices:[device(),device()]}),/duplicate device id/);const noPrimary=device();delete noPrimary.primary_entity_id;assert.throws(()=>validateHouseDevicesConfig({devices:[noPrimary]}),/primary_entity_id/);assert.throws(()=>validateHouseDevicesConfig({devices:[{id:'x',name:'X',primary_entity_id:'sensor.x'}]}),/at least one/);});
test('rejects unknown fields',()=>{assert.throws(()=>validateHouseDevicesConfig({devices:[{...device(),foo:true}]}),/unknown field/);});
