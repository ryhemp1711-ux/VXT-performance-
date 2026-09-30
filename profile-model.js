(function(root){
'use strict';
const fields={preferredName:60,pronouns:40,birthYear:4,grade:40,team:100,events:200,goals:1000,notes:2000};
function clean(value){return String(value??'').trim();}
function validate(profile){
 if(profile==null)return {};
 if(!profile||typeof profile!=='object'||Array.isArray(profile))throw Error('Invalid athlete profile.');
 const out={};
 for(const [key,max] of Object.entries(fields)){const value=profile[key];if(value==null||value==='')continue;if(typeof value!=='string'||value.length>max)throw Error('Invalid athlete profile '+key+'.');out[key]=value.trim();}
 if(out.birthYear&&(!/^\d{4}$/.test(out.birthYear)||Number(out.birthYear)<1900||Number(out.birthYear)>new Date().getFullYear()+1))throw Error('Birth year must be a valid four-digit year.');
 return out;
}
function displayName(athlete){return athlete.profile?.preferredName?.trim()||athlete.name;}
const api={fields,validate,displayName};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTProfile=api;
})(globalThis);
