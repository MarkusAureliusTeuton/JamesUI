import { validateHouseSourceBinding } from "../../shared/house-source.js";
function isPlainObject(v){if(!v||typeof v!=="object"||Array.isArray(v))return false;const p=Object.getPrototypeOf(v);return p===Object.prototype||p===null;}
function nonEmpty(v,n){if(typeof v!=="string"||v.trim()==="")throw new TypeError(`${n} must be a non-empty string`);return v.trim();}
function rejectUnknown(v,a,n){for(const k of Object.keys(v))if(!a.has(k))throw new TypeError(`${n} has unknown field: ${k}`);}
export function validateHouseDevicesConfig(config={}){
 if(!isPlainObject(config))throw new TypeError("House devices config must be a plain object"); rejectUnknown(config,new Set(["devices"]),"House devices config"); if(!Array.isArray(config.devices))throw new TypeError("House devices config.devices must be an array");
 const ids=new Set(); const devices=config.devices.map((v,i)=>{const n=`devices[${i}]`; if(!isPlainObject(v))throw new TypeError(`${n} must be a plain object`);rejectUnknown(v,new Set(["id","name","primary_entity_id","active","update_available","warning","fault"]),n);const id=nonEmpty(v.id,`${n}.id`);if(ids.has(id))throw new TypeError(`duplicate device id: ${id}`);ids.add(id);const present=["active","update_available","warning","fault"].filter((k)=>v[k]!==undefined);if(present.length===0)throw new TypeError(`${n} requires at least one status signal`);const out={id,name:nonEmpty(v.name,`${n}.name`),primary_entity_id:nonEmpty(v.primary_entity_id,`${n}.primary_entity_id`)};for(const k of present)out[k]=validateHouseSourceBinding(v[k],`${n}.${k}`,{boolean:true});return Object.freeze(out);});
 return Object.freeze({devices:Object.freeze(devices)});
}
