import test from "node:test";
import assert from "node:assert/strict";
import { createCapabilityRegistry } from "../custom_components/jamesui/frontend/core/capability-registry.js";
import { createModuleLoader } from "../custom_components/jamesui/frontend/core/module-loader.js";
import { createModuleRegistry } from "../custom_components/jamesui/frontend/core/module-registry.js";
import { MANIFEST as PROVIDER_MANIFEST } from "../custom_components/jamesui/frontend/modules/provider.control-state/manifest.js";
import { MANIFEST as WIDGET_MANIFEST } from "../custom_components/jamesui/frontend/modules/widget.dynamic-buttons/manifest.js";

class FakeElement { constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.attributes=new Map();this.children=[];this.parentNode=null;this.textContent="";this.listeners=new Map();} setAttribute(n,v){this.attributes.set(n,String(v));} getAttribute(n){return this.attributes.get(n)??null;} appendChild(c){c.parentNode=this;this.children.push(c);return c;} replaceChildren(...cs){this.children=[];for(const c of cs)this.appendChild(c);} remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter((c)=>c!==this);} addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f);} click(){for(const f of [...(this.listeners.get("click")??[])])f({preventDefault(){}});} }
class FakeDocument { createElement(t){return new FakeElement(t,this);} createElementNS(_n,t){return new FakeElement(t,this);} }
function host(){const d=new FakeDocument();return new FakeElement("host",d);} function find(root,a,v){if(root.getAttribute?.(a)===v)return root;for(const c of root.children??[]){const f=find(c,a,v);if(f)return f;}return null;}
function fakeHA(){const states=new Map([["binary_sensor.scene_evening",{state:"off",attributes:{}}]]);const listeners=new Map();const connections=new Set();return {connectionState:()=>"connected",getState:(id)=>states.get(id)??null,subscribeEntity(id,fn,{emitCurrent=true}={}){if(!listeners.has(id))listeners.set(id,new Set());listeners.get(id).add(fn);if(emitCurrent)fn(states.get(id)??null);return()=>{listeners.get(id)?.delete(fn);return true;}},subscribeConnection(fn,{emitCurrent=true}={}){connections.add(fn);if(emitCurrent)fn("connected");return()=>{connections.delete(fn);return true;}},set(id,state){states.set(id,state);for(const fn of [...(listeners.get(id)??[])])fn(state);},active(){return [...listeners.values()].reduce((n,s)=>n+s.size,0);}};}

test("Block 13 integrates provider capability, widget action path, and real feedback without production orchestration", async () => {
  const registry=createModuleRegistry();
  const providerUrl=new URL("../custom_components/jamesui/frontend/modules/provider.control-state/index.js",import.meta.url).href;
  const widgetUrl=new URL("../custom_components/jamesui/frontend/modules/widget.dynamic-buttons/index.js",import.meta.url).href;
  registry.register(PROVIDER_MANIFEST,{entryUrl:providerUrl}); registry.register(WIDGET_MANIFEST,{entryUrl:widgetUrl});
  assert.equal(registry.getCapabilityProvider("control.states"),"provider.control-state");
  const capabilities=createCapabilityRegistry({moduleRegistry:registry}); const ha=fakeHA(); const calls=[]; const actions={execute(action){calls.push(action);return {status:"success"};}};
  const loader=createModuleLoader({registry,health:{report(){},clear(){}},getContext:({id,manifest})=>{const common={events:{},overlays:{},capabilities,actions,module:{id,type:manifest.type,version:manifest.version}};return manifest.type==="provider"?{...common,homeAssistant:ha}:common;}});
  const providerConfig={sources:[{id:"evening",entity_id:"binary_sensor.scene_evening",active_values:["on"],inactive_values:["off"],intermediate:[]}]};
  const widgetConfig={buttons:[{id:"evening-use",button_id:"evening",size:"normal",definition:{name:"Abend",mode:"toggle",icon:"home.light",state_source_id:"evening",activate_action:{type:"scene.activate",entity_id:"scene.evening"},deactivate_action:{type:"ha.service",domain:"scene",service:"turn_off",target:{entity_id:"scene.evening"}},timeout_ms:100}}]};
  assert.equal(await loader.load(PROVIDER_MANIFEST.id,{config:providerConfig}),true); assert.equal(loader.mount(PROVIDER_MANIFEST.id,{kind:"provider"}),true); assert.equal(capabilities.get("control.states").status,"available");
  const root=host(); assert.equal(await loader.load(WIDGET_MANIFEST.id,{config:widgetConfig}),true); assert.equal(loader.mount(WIDGET_MANIFEST.id,root),true);
  const button=find(root,"data-jui-dynamic-use-id","evening-use"); assert.ok(button); assert.equal(button.getAttribute("data-jui-dynamic-real-status"),"inactive"); button.click(); assert.deepEqual(calls,[{type:"scene.activate",entity_id:"scene.evening"}]);
  ha.set("binary_sensor.scene_evening",{state:"on",attributes:{}}); assert.equal(find(root,"data-jui-dynamic-use-id","evening-use").getAttribute("data-jui-dynamic-real-status"),"active");
  assert.equal(loader.destroy(WIDGET_MANIFEST.id),true); assert.equal(loader.destroy(PROVIDER_MANIFEST.id),true); assert.equal(ha.active(),0); capabilities.destroy();
});
