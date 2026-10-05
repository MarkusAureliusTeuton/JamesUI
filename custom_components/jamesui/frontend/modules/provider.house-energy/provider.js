import { readHouseSourceNumber } from "../../shared/house-source.js";
import { validateHouseEnergyConfig } from "./config.js";
import { normalizePowerWatts, timeWeightedAverageWatts } from "./history.js";

function requireContext(context){if(!context?.capabilities||typeof context.capabilities.register!=="function")throw new TypeError("house energy provider requires capabilities");for(const m of ["connectionState","getState","subscribeEntity","subscribeConnection","callWS"]){if(!context.homeAssistant||typeof context.homeAssistant[m]!=="function")throw new TypeError(`house energy provider requires homeAssistant.${m}`);}return context;}
function invoke(fn){try{fn?.();}catch{/* best effort */}}
function nonEmpty(v,n){if(typeof v!=="string"||v.trim()==="")throw new TypeError(`${n} must be a non-empty string`);return v.trim();}

export function createHouseEnergyProvider(initialContext,initialConfig){
 let context=requireContext(initialContext),config=validateHouseEnergyConfig(initialConfig),mounted=false,destroyed=false,handle=null,connectionUnsubscribe=null,serviceGeneration=0;
 const entityUnsubscribes=new Map(), records=new Map();
 const sourceMap=()=>new Map(config.sources.map((s)=>[s.id,s]));
 const keyFor=(sourceId,windowMinutes)=>`${sourceId}\u0000${windowMinutes}`;
 const currentPower=(source)=>{const state=context.homeAssistant.getState(source.power.entity_id);const raw=readHouseSourceNumber(state,source.power);if(raw.status!=="available")return{quality:"unavailable",current_power_w:null,unit:null,reason:raw.reason};const unit=state?.attributes?.unit_of_measurement;const watts=normalizePowerWatts(raw.value,unit);if(watts===null)return{quality:"unavailable",current_power_w:null,unit,reason:"unsupported_unit"};return{quality:"full",current_power_w:watts,unit,reason:null};};
 const notifyConsumer=(consumer)=>{if(!consumer.active||consumer.generation!==serviceGeneration)return;if(consumer.requests.some((r)=>r.record.result===null))return;const results=Object.freeze(consumer.requests.map(({requestId,record})=>Object.freeze({...record.result,request_id:requestId})));try{consumer.listener(Object.freeze({results}));}catch{/* one consumer cannot break siblings */}};
 const notifyRecord=(record)=>{for(const consumer of [...record.consumers])notifyConsumer(consumer);};
 const setResult=(record,result)=>{if(!record.active)return;record.result=Object.freeze(result);notifyRecord(record);};
 const refreshRecord=async(record)=>{
   if(!record.active||record.consumers.size===0||destroyed||!mounted)return;
   const token=++record.fetchToken;const generation=serviceGeneration;const current=currentPower(record.source);
   if(current.quality!=="full"){setResult(record,{source_id:record.source.id,window_minutes:record.windowMinutes,current_power_w:current.current_power_w,average_power_w:null,quality:"unavailable",reason:current.reason});return;}
   const endMs=Date.now(),startMs=endMs-record.windowMinutes*60_000;
   const message={type:"history/history_during_period",start_time:new Date(startMs).toISOString(),end_time:new Date(endMs).toISOString(),entity_ids:[record.source.power.entity_id],include_start_time_state:true,significant_changes_only:false,minimal_response:true,no_attributes:true};
   try{
     const payload=await context.homeAssistant.callWS(message);
     if(!record.active||record.fetchToken!==token||generation!==serviceGeneration||destroyed||!mounted)return;
     const average=timeWeightedAverageWatts(payload?.[record.source.power.entity_id]??[],{start_ms:startMs,end_ms:endMs,unit:current.unit});
     setResult(record,{source_id:record.source.id,window_minutes:record.windowMinutes,current_power_w:current.current_power_w,average_power_w:average.average_power_w,quality:average.quality,reason:average.reason});
   }catch{
     if(!record.active||record.fetchToken!==token||generation!==serviceGeneration||destroyed||!mounted)return;
     setResult(record,{source_id:record.source.id,window_minutes:record.windowMinutes,current_power_w:current.current_power_w,average_power_w:null,quality:"insufficient",reason:"history_unavailable"});
   }
 };
 const releaseRecord=(record,consumer)=>{record.consumers.delete(consumer);if(record.consumers.size!==0)return;record.active=false;record.fetchToken++;if(record.timer!==null)globalThis.clearInterval(record.timer);record.timer=null;if(records.get(record.key)===record)records.delete(record.key);};
 const clearRecords=()=>{for(const record of records.values()){record.active=false;record.fetchToken++;if(record.timer!==null)globalThis.clearInterval(record.timer);record.timer=null;record.consumers.clear();}records.clear();};
 const makeService=()=>{
   const generation=serviceGeneration;const configured=Object.freeze(config.sources.map((s)=>Object.freeze({id:s.id,name:s.name})));const allowed=sourceMap();
   return Object.freeze({version:1,configured_sources:configured,subscribe_windows(request,listener){if(generation!==serviceGeneration||destroyed||!mounted)throw new Error("house energy service is stale");if(typeof listener!=="function")throw new TypeError("energy window listener must be a function");if(!request||typeof request!=="object"||!Array.isArray(request.windows)||request.windows.length===0)throw new TypeError("energy request requires windows");const seen=new Set();const normalized=request.windows.map((window,index)=>{if(!window||typeof window!=="object"||Array.isArray(window))throw new TypeError(`windows[${index}] must be an object`);const requestId=nonEmpty(window.request_id,`windows[${index}].request_id`),sourceId=nonEmpty(window.source_id,`windows[${index}].source_id`),minutes=Number(window.window_minutes);if(seen.has(requestId))throw new TypeError(`duplicate request_id: ${requestId}`);seen.add(requestId);if(!allowed.has(sourceId))throw new TypeError(`energy source is not configured: ${sourceId}`);if(!Number.isFinite(minutes)||minutes<=0)throw new TypeError("window_minutes must be positive");return{requestId,sourceId,minutes};});const consumer={active:true,generation,listener,requests:[]};for(const item of normalized){const key=keyFor(item.sourceId,item.minutes);let record=records.get(key);let created=false;if(!record){record={key,source:allowed.get(item.sourceId),windowMinutes:item.minutes,result:null,consumers:new Set(),active:true,fetchToken:0,timer:null};records.set(key,record);created=true;}record.consumers.add(consumer);consumer.requests.push({requestId:item.requestId,record});if(created){record.timer=globalThis.setInterval(()=>{void refreshRecord(record);},60_000);void refreshRecord(record);}}notifyConsumer(consumer);let active=true;return()=>{if(!active)return false;active=false;consumer.active=false;for(const {record} of consumer.requests)releaseRecord(record,consumer);consumer.requests.length=0;return true;};}});
 };
 const publishTop=()=>{if(!handle)return;if(config.sources.length===0){handle.notConfigured("no_energy_sources");return;}if(context.homeAssistant.connectionState()!=="connected"){handle.unavailable("home_assistant_disconnected");return;}handle.available(makeService());};
 const replaceService=()=>{serviceGeneration++;clearRecords();publishTop();};
 const unbind=()=>{serviceGeneration++;clearRecords();invoke(connectionUnsubscribe);connectionUnsubscribe=null;for(const fn of entityUnsubscribes.values())invoke(fn);entityUnsubscribes.clear();};
 const bind=()=>{const ids=new Set(config.sources.map((s)=>s.power.entity_id));for(const id of ids)entityUnsubscribes.set(id,context.homeAssistant.subscribeEntity(id,()=>{for(const record of records.values())if(record.source.power.entity_id===id)void refreshRecord(record);},{emitCurrent:false}));connectionUnsubscribe=context.homeAssistant.subscribeConnection(()=>replaceService(),{emitCurrent:false});};
 const register=()=>{handle=context.capabilities.register("provider.house-energy","house.energy");};
 return Object.freeze({mount(){if(destroyed||mounted)return false;mounted=true;register();bind();serviceGeneration++;publishTop();return true;},update(nextContext,nextConfig){if(destroyed)throw new Error("house energy provider is destroyed");const c=requireContext(nextContext),cfg=validateHouseEnergyConfig(nextConfig);if(!mounted){context=c;config=cfg;return true;}const same=c.capabilities===context.capabilities;const replacementHandle=same?null:c.capabilities.register("provider.house-energy","house.energy");const previousHandle=handle;unbind();context=c;config=cfg;if(!same)handle=replacementHandle;bind();serviceGeneration++;publishTop();if(!same)previousHandle?.unregister();return true;},destroy(){if(destroyed)return false;destroyed=true;unbind();handle?.unregister();handle=null;mounted=false;return true;}});
}
