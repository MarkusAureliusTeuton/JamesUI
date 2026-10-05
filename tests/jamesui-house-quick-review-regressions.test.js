import test from 'node:test';
import assert from 'node:assert/strict';
import { createHouseHeatingProvider } from '../custom_components/jamesui/frontend/modules/provider.house-heating/provider.js';
import { createHouseLightingProvider } from '../custom_components/jamesui/frontend/modules/provider.house-lighting/provider.js';
import { createHouseDevicesProvider } from '../custom_components/jamesui/frontend/modules/provider.house-devices/provider.js';
import { createHouseEnergyProvider } from '../custom_components/jamesui/frontend/modules/provider.house-energy/provider.js';
import { validateHouseQuickConfig } from '../custom_components/jamesui/frontend/modules/widget.house-quick/config.js';
import { buildHouseQuickModel } from '../custom_components/jamesui/frontend/modules/widget.house-quick/model.js';

function source(entity_id) { return { entity_id }; }
function state(entity_id, value, attributes={}) { return { entity_id, state:String(value), attributes }; }
function runtime(states={}) {
  const values=new Map(Object.entries(states));
  const listeners=new Map();
  const connectionListeners=new Set();
  return {
    api:{
      connectionState:()=> 'connected',
      getState:(id)=>values.get(id)??null,
      subscribeEntity(id,listener){if(!listeners.has(id))listeners.set(id,new Set());listeners.get(id).add(listener);return()=>{const set=listeners.get(id);set?.delete(listener);if(set?.size===0)listeners.delete(id);};},
      subscribeConnection(listener){connectionListeners.add(listener);return()=>connectionListeners.delete(listener);},
      async callWS(){return{};},
    },
    active:()=>[...listeners.values()].reduce((sum,set)=>sum+set.size,0)+connectionListeners.size,
  };
}
function capabilityHarness({reject=false}={}) {
  const handles=[];
  return {
    api:{register(moduleId,capability){if(reject)throw new Error('replacement registry rejected');const handle={moduleId,capability,unregisterCalls:0,available(){},unavailable(){},notConfigured(){},unregister(){this.unregisterCalls+=1;return true;}};handles.push(handle);return handle;}},
    handles,
  };
}
function assertRejectedRebindPreservesOld(factory, config) {
  const oldRuntime=runtime(); const oldCaps=capabilityHarness(); const provider=factory({homeAssistant:oldRuntime.api,capabilities:oldCaps.api},config);provider.mount();
  const before=oldRuntime.active(); assert.ok(before>0);
  const rejectedRuntime=runtime(); const rejectedCaps=capabilityHarness({reject:true});
  assert.throws(()=>provider.update({homeAssistant:rejectedRuntime.api,capabilities:rejectedCaps.api},config),/replacement registry rejected/);
  assert.equal(oldRuntime.active(),before,'old subscriptions must remain live');
  assert.ok(oldCaps.handles.every((handle)=>handle.unregisterCalls===0),'old capability registrations must remain active');
  provider.destroy();
}

test('provider registry rebind rejection preserves the previous live registration and subscriptions',()=>{
  assertRejectedRebindPreservesOld(createHouseHeatingProvider,{zones:[{id:'z',name:'Z',current_temperature:source('sensor.c'),target_temperature:source('sensor.t'),heating_demand:source('binary_sensor.d'),auto_regulation_enabled:source('binary_sensor.a')}]});
  assertRejectedRebindPreservesOld(createHouseLightingProvider,{lights:[{id:'l',name:'L',state:source('light.l')}],ambient_lights:[]});
  assertRejectedRebindPreservesOld(createHouseDevicesProvider,{devices:[{id:'d',name:'D',primary_entity_id:'sensor.d',active:source('binary_sensor.d')}]});
  assertRejectedRebindPreservesOld(createHouseEnergyProvider,{sources:[{id:'house',name:'House',power:source('sensor.power')}]});
});

test('a configured optional device signal becoming unavailable contributes a warning',()=>{
  const r=runtime({'sensor.washer':state('sensor.washer','idle'),'binary_sensor.active':state('binary_sensor.active','on'),'binary_sensor.warning':state('binary_sensor.warning','unavailable')});
  const caps=capabilityHarness(); let latest=null; caps.api.register=()=>({available(value){latest=value;},unavailable(){},notConfigured(){},unregister(){return true;}});
  const provider=createHouseDevicesProvider({homeAssistant:r.api,capabilities:caps.api},{devices:[{id:'washer',name:'Washer',primary_entity_id:'sensor.washer',active:source('binary_sensor.active'),warning:source('binary_sensor.warning')}]});
  provider.mount(); assert.equal(latest.items[0].reachable,true); assert.match(latest.items[0].reason,/warning:source_unavailable/); assert.equal(latest.warning_count,1); provider.destroy();
});

test('heating model keeps a valid current temperature visible when target temperature is unavailable',()=>{
  const config={buttons:[{id:'h',type:'heating_zone',source_id:'wohnen'}]};
  const heating={version:1,zones:[{id:'wohnen',name:'Wohnen',current_temperature_c:21.4,target_temperature_c:null,heating_demand:true,auto_regulation_enabled:true,availability:'unavailable',reason:'target_temperature:source_unavailable'}]};
  const model=buildHouseQuickModel({config,heating}); assert.equal(model[0].status,'warning'); assert.match(model[0].primary,/21,4 °C/); assert.match(model[0].primary,/—/);
});

test('House Quick config rejects an icon override that is not registered',()=>{
  assert.throws(()=>validateHouseQuickConfig({buttons:[{id:'l',type:'lights',icon:'home.not-real'}]}),/Unknown icon/);
});

test('lighting replacement rolls back its first new capability if the second registration is rejected',()=>{
  const oldRuntime=runtime();
  const oldCaps=capabilityHarness();
  const provider=createHouseLightingProvider({homeAssistant:oldRuntime.api,capabilities:oldCaps.api},{lights:[{id:'l',name:'L',state:source('light.l')}],ambient_lights:[{id:'a',name:'A',state:source('light.a')}]});
  provider.mount();
  const before=oldRuntime.active();
  const replacementHandles=[];
  let calls=0;
  const replacementCaps={api:{register(moduleId,capability){calls+=1;if(calls===2)throw new Error('second capability rejected');const handle={moduleId,capability,unregisterCalls:0,available(){},unavailable(){},notConfigured(){},unregister(){this.unregisterCalls+=1;return true;}};replacementHandles.push(handle);return handle;}}};
  const replacementRuntime=runtime();
  assert.throws(()=>provider.update({homeAssistant:replacementRuntime.api,capabilities:replacementCaps.api},{lights:[{id:'l',name:'L',state:source('light.l')}],ambient_lights:[{id:'a',name:'A',state:source('light.a')}]}),/second capability rejected/);
  assert.equal(replacementHandles.length,1);
  assert.equal(replacementHandles[0].unregisterCalls,1,'first replacement capability must be rolled back');
  assert.equal(oldRuntime.active(),before,'old lighting subscriptions remain live');
  assert.ok(oldCaps.handles.every((handle)=>handle.unregisterCalls===0),'old lighting registrations remain live');
  provider.destroy();
});
