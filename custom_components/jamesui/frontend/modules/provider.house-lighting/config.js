import { validateHouseSourceBinding } from "../../shared/house-source.js";

function isPlainObject(value) { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const p=Object.getPrototypeOf(value); return p===Object.prototype || p===null; }
function nonEmpty(value,name){ if(typeof value!=="string"||value.trim()==="") throw new TypeError(`${name} must be a non-empty string`); return value.trim(); }
function rejectUnknown(value, allowed, name){ for(const key of Object.keys(value)) if(!allowed.has(key)) throw new TypeError(`${name} has unknown field: ${key}`); }

export function validateHouseLightingConfig(config={}){
  if(!isPlainObject(config)) throw new TypeError("House lighting config must be a plain object");
  rejectUnknown(config,new Set(["lights","ambient_lights"]),"House lighting config");
  if(!Array.isArray(config.lights)||!Array.isArray(config.ambient_lights)) throw new TypeError("lights and ambient_lights must be arrays");
  const allSources=new Set();
  const normalizeGroup=(entries, groupName)=>{
    const ids=new Set();
    const items=entries.map((value,index)=>{
      const name=`${groupName}[${index}]`;
      if(!isPlainObject(value)) throw new TypeError(`${name} must be a plain object`);
      rejectUnknown(value,new Set(["id","name","state"]),name);
      const id=nonEmpty(value.id,`${name}.id`);
      if(ids.has(id)) throw new TypeError(`duplicate light id: ${id}`);
      ids.add(id);
      const state=validateHouseSourceBinding(value.state,`${name}.state`,{boolean:true});
      if(allSources.has(state.entity_id)) throw new TypeError(`source assigned more than once: ${state.entity_id}`);
      allSources.add(state.entity_id);
      return Object.freeze({id,name:nonEmpty(value.name,`${name}.name`),state});
    });
    return Object.freeze(items);
  };
  return Object.freeze({lights:normalizeGroup(config.lights,"lights"),ambient_lights:normalizeGroup(config.ambient_lights,"ambient_lights")});
}
