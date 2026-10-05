import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDocument } from './helpers/fake-dom.js';
import { createHouseQuickWidget } from '../custom_components/jamesui/frontend/modules/widget.house-quick/widget.js';

function snapshot(capability, status='unavailable', value=null, reason=null) { return { capability, status, value, reason, provider: status === 'available' ? 'fake' : null }; }
function capabilityHarness(initial={}) {
  const values = new Map(Object.entries(initial));
  const listeners = new Map();
  return {
    api: {
      subscribe(capability, listener, { emitCurrent=true }={}) { if(!listeners.has(capability)) listeners.set(capability,new Set()); listeners.get(capability).add(listener); if(emitCurrent) listener(values.get(capability) ?? snapshot(capability)); let active=true; return()=>{if(!active)return false;active=false;const set=listeners.get(capability);set?.delete(listener);if(set?.size===0)listeners.delete(capability);return true;}; },
    },
    emit(capability,next){values.set(capability,next);for(const fn of listeners.get(capability)??[])fn(next);},
    count(capability){return listeners.get(capability)?.size??0;},
  };
}
function energyService(name='Haus gesamt') { const consumers=[]; let releases=0; return { version:1, configured_sources:[{id:'house',name},{id:'wallbox',name:'Wallbox'}], consumers, get releases(){return releases;}, subscribe_windows(request,listener){const record={request,listener,active:true};consumers.push(record);return()=>{if(!record.active)return false;record.active=false;releases++;return true;};} }; }
function contextWith(capabilities, calls=[]) { return { module:{id:'widget.house-quick'}, capabilities, actions:{ async execute(action){calls.push(action); return {status:'rejected',type:action.type,value:null,error:null};} } }; }
function mountTarget() { const doc=createFakeDocument(); return {doc,target:doc.createElement('div')}; }
function available(cap,value){return snapshot(cap,'available',value);}
const heating={version:1,zones:[{id:'wohnen',name:'Wohnen',current_temperature_c:21.4,target_temperature_c:22,heating_demand:true,auto_regulation_enabled:true,availability:'available',reason:null},{id:'buero',name:'Büro',current_temperature_c:20,target_temperature_c:21,heating_demand:false,auto_regulation_enabled:true,availability:'available',reason:null}]};
const lights={version:1,items:[],on_count:3,total_count:8,unavailable_count:0};
const ambient={version:1,items:[],on_count:1,total_count:4,unavailable_count:0};
const devices={version:1,items:[],active_count:2,update_count:1,warning_count:0,fault_count:0,unreachable_count:0};

function allSnapshots(energy=energyService()){return {'house.heatingZones':available('house.heatingZones',heating),'house.lights':available('house.lights',lights),'house.ambientLights':available('house.ambientLights',ambient),'house.devices':available('house.devices',devices),'house.energy':available('house.energy',energy)};}

test('renders arbitrary configured buttons in exact order including multiple heating and energy buttons', () => {
  const energy=energyService(); const caps=capabilityHarness(allSnapshots(energy)); const {target}=mountTarget();
  const config={buttons:[{id:'h2',type:'heating_zone',source_id:'buero'},{id:'e1',type:'energy',source_id:'house',average_window_minutes:15,warning_threshold_w:3000,critical_threshold_w:5000},{id:'h1',type:'heating_zone',source_id:'wohnen'},{id:'e2',type:'energy',source_id:'house',average_window_minutes:30,warning_threshold_w:2500,critical_threshold_w:4500},{id:'l',type:'lights'}]};
  const widget=createHouseQuickWidget(contextWith(caps.api),config); assert.equal(widget.mount(target),true);
  assert.deepEqual(target.querySelectorAll('button[data-jui-house-quick-button]').map(n=>n.getAttribute('data-jui-house-quick-button-id')),['h2','e1','h1','e2','l']);
  assert.deepEqual(energy.consumers[0].request.windows.map(w=>({id:w.request_id,source:w.source_id,window:w.window_minutes})),[{id:'e1',source:'house',window:15},{id:'e2',source:'house',window:30}]);
  widget.destroy();
});

test('energy results and sibling capability updates rerender without blanking healthy buttons', () => {
  const energy=energyService(); const caps=capabilityHarness(allSnapshots(energy)); const {target}=mountTarget(); const config={buttons:[{id:'l',type:'lights'},{id:'e',type:'energy',source_id:'house',average_window_minutes:15,warning_threshold_w:3000,critical_threshold_w:5000}]};
  const widget=createHouseQuickWidget(contextWith(caps.api),config);widget.mount(target);
  energy.consumers[0].listener({results:[{request_id:'e',source_id:'house',window_minutes:15,current_power_w:1840,average_power_w:3500,quality:'full',reason:null}]});
  let buttons=target.querySelectorAll('button[data-jui-house-quick-button]');assert.equal(buttons[1].getAttribute('data-jui-house-quick-status'),'warning');assert.equal(buttons[1].querySelector('[data-jui-house-quick-primary]').textContent,'1,84 kW');
  caps.emit('house.lights',snapshot('house.lights','unavailable',null,'down')); buttons=target.querySelectorAll('button[data-jui-house-quick-button]');assert.equal(buttons[0].getAttribute('data-jui-house-quick-status'),'warning');assert.equal(buttons[1].getAttribute('data-jui-house-quick-status'),'warning');widget.destroy();
});

test('energy service replacement releases old consumer and binds new service', () => {
  const oldService=energyService('Alt'),nextService=energyService('Neu');const caps=capabilityHarness(allSnapshots(oldService));const {target}=mountTarget();const widget=createHouseQuickWidget(contextWith(caps.api),{buttons:[{id:'e',type:'energy',source_id:'house',average_window_minutes:15,warning_threshold_w:3000,critical_threshold_w:5000}]});widget.mount(target);assert.equal(oldService.consumers.length,1);caps.emit('house.energy',available('house.energy',nextService));assert.equal(oldService.releases,1);assert.equal(nextService.consumers.length,1);widget.destroy();assert.equal(nextService.releases,1);
});

test('two direct widget instances keep independent config and local state', () => {
  const caps=capabilityHarness(allSnapshots());const one=mountTarget(),two=mountTarget();const w1=createHouseQuickWidget(contextWith(caps.api),{buttons:[{id:'l',type:'lights'}]});const w2=createHouseQuickWidget(contextWith(caps.api),{buttons:[{id:'d',type:'devices'}]});w1.mount(one.target);w2.mount(two.target);assert.equal(one.target.querySelector('[data-jui-house-quick-label]').textContent,'Licht');assert.equal(two.target.querySelector('[data-jui-house-quick-label]').textContent,'Geräte');w1.destroy();assert.equal(caps.count('house.lights'),1);w2.destroy();assert.equal(caps.count('house.lights'),0);
});

test('whole button dispatches semantic navigation once and rejected navigation remains stable', async () => {
  const calls=[];const caps=capabilityHarness(allSnapshots());const {target}=mountTarget();const widget=createHouseQuickWidget(contextWith(caps.api,calls),{buttons:[{id:'h',type:'heating_zone',source_id:'wohnen',navigation:{route:'climate',target_id:'zone:wohnen'}}]});widget.mount(target);const button=target.querySelector('button[data-jui-house-quick-button]');button.dispatchEvent('click');await new Promise(r=>setImmediate(r));assert.deepEqual(calls,[{type:'navigate',route:'climate',target_id:'zone:wohnen'}]);assert.equal(target.querySelectorAll('button[data-jui-house-quick-button]').length,1);widget.destroy();
});

test('update rebinds changed capability registry and destroy removes subscriptions and DOM', () => {
  const first=capabilityHarness(allSnapshots()),second=capabilityHarness(allSnapshots());const {target}=mountTarget();const widget=createHouseQuickWidget(contextWith(first.api),{buttons:[{id:'l',type:'lights'}]});widget.mount(target);assert.equal(first.count('house.lights'),1);widget.update(contextWith(second.api),{buttons:[{id:'d',type:'devices'}]});assert.equal(first.count('house.lights'),0);assert.equal(second.count('house.devices'),1);assert.equal(target.querySelector('[data-jui-house-quick-label]').textContent,'Geräte');assert.equal(widget.destroy(),true);assert.equal(second.count('house.devices'),0);assert.equal(target.children.length,0);assert.equal(widget.destroy(),false);
});
