(function(root){
'use strict';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),recordKey=r=>r?.id??r?.athleteId;
function hasDeletion(before,after){return Object.keys(before).some(k=>Array.isArray(before[k])&&Array.isArray(after[k])&&before[k].some(r=>recordKey(r)&&!after[k].some(n=>recordKey(n)===recordKey(r))));}
function undoDeletion(before,after,current){
 const next={...current};
 for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
  if(!Array.isArray(before[key])||!Array.isArray(after[key]))continue;
  let rows=[...(current[key]||[])];
  for(const old of before[key]){const id=recordKey(old),changed=after[key].find(r=>recordKey(r)===id);if(!id||same(old,changed))continue;
   const index=rows.findIndex(r=>recordKey(r)===id),now=index<0?undefined:rows[index];
   if(same(now,old))continue;
   if(!same(now,changed))throw Error('Undo would overwrite a later change. Restore this record from a backup instead.');
   if(index<0)rows.splice(Math.min(before[key].indexOf(old),rows.length),0,old);else rows[index]=old;
  }next[key]=rows;
 }return next;
}
function draftStore(storage,prefix='vxt-draft-v1:'){
 return {
  read(name){const raw=storage.getItem(prefix+name);if(!raw)return null;let parsed;try{parsed=JSON.parse(raw);}catch{throw Error('Saved draft could not be read. Discard it to start a new draft.');}if(parsed?.version!==1||!parsed.value||typeof parsed.value!=='object')throw Error('Saved draft is not supported. Discard it to start a new draft.');return parsed.value;},
  write(name,value){const existing=storage.getItem(prefix+name);if(existing)this.read(name);const text=JSON.stringify({version:1,value});if(text.length>2000000)throw Error('Draft is too large. Save a smaller session.');storage.setItem(prefix+name,text);},
  clear(name){storage.removeItem(prefix+name);}
 };
}
function practiceSignature(w){return JSON.stringify({date:w.date,workout:w.workout,prescription:w.prescription,athletes:w.assignments.map(a=>a.athleteId).sort()});}
function practiceEntries(data,w,state){
 if(!state||state.workoutId!==w.id||state.signature!==practiceSignature(w))throw Error('The planned workout changed after this draft started. Review the plan and discard the outdated practice draft before entering new times.');
 if(!state.times||typeof state.times!=='object'||Array.isArray(state.times))throw Error('Invalid practice draft.');
 const done=new Set((data.sessions||[]).filter(s=>s.sourceWorkoutId===w.id).flatMap(s=>s.efforts.map(e=>e.athleteId))),reps=[];
 for(const a of w.assignments){if(a.attendance==='Absent'||done.has(a.athleteId))continue;for(let i=0;i<(w.prescription?.reps||1);i++){const time=state.times[a.athleteId+':'+i];if(time==null||String(time).trim()==='')continue;if(!['Present','Modified'].includes(a.attendance))throw Error('Set attendance to Present or Modified for athletes with entered times.');reps.push({athleteId:a.athleteId,event:w.prescription?.event||'60m',time,restAfter:w.prescription?.restAfter});}}
 if(!reps.length)throw Error('Enter at least one measured time for a present athlete.');return reps;
}
const api={practiceSignature,practiceEntries,hasDeletion,undoDeletion,draftStore};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTUXModel=api;
})(globalThis);
