(function(root){
'use strict';
const V=typeof module!=='undefined'&&module.exports?require('./model.js'):root.VXT;
function conflicts(data,input){
 const date=V.normalizeDate(input.date);if(date.length!==10)throw Error('Choose an exact workout date.');
 return (input.athleteIds||[]).map(athleteId=>({athleteId,
  blocks:(data.trainingBlocks||[]).filter(b=>b.athleteIds.includes(athleteId)&&b.startDate<=date&&date<=b.endDate),
  workouts:(data.teamWorkouts||[]).filter(w=>w.id!==input.id&&w.date===date&&w.assignments.some(a=>a.athleteId===athleteId))
 })).filter(c=>c.blocks.length||c.workouts.length);
}
function build(data,input,newId){
 data=V.validateData(data);const name=String(input.name||'').trim(),date=V.normalizeDate(input.date),workout=String(input.workout||'').trim(),notes=String(input.notes||'').trim();
 if(!name||name.length>100)throw Error('Enter a workout name (up to 100 characters).');
 if(date.length!==10)throw Error('Choose an exact workout date.');
 if(!workout||workout.length>10000)throw Error('Enter the shared workout (up to 10,000 characters).');
 if(notes.length>2000)throw Error('Notes must be 2,000 characters or fewer.');
 let ids=input.athleteIds;if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!data.athletes.some(a=>a.id===id)))throw Error('Select at least one athlete from the roster.');
 const existing=input.id?(data.teamWorkouts||[]).find(w=>w.id===input.id):null;if(input.id&&!existing)throw Error('This workout is no longer available. Reopen a saved workout.');
 const overlaps=conflicts(data,{...input,date});
 if(overlaps.length){
  if(!['skip','include'].includes(input.conflictPolicy))throw Error('Scheduling conflicts found. Choose Skip conflicting athletes or Include anyway before saving.');
  if(input.conflictPolicy==='skip')ids=ids.filter(id=>!overlaps.some(c=>c.athleteId===id));
  if(!ids.length)throw Error('All selected athletes have scheduling conflicts. Nothing was saved. Select other athletes or choose Include anyway.');
 }
 const changed=existing&&(existing.workout!==workout||existing.date!==date);
 const assignments=ids.map(athleteId=>({athleteId,completed:!changed&&(existing?.assignments.find(a=>a.athleteId===athleteId)?.completed||false)}));
 const record={id:existing?.id||newId(),name,date,workout,notes,assignments};const workouts=existing?data.teamWorkouts.map(w=>w.id===existing.id?record:w):[...(data.teamWorkouts||[]),record];
 return {data:V.validateData({...data,teamWorkouts:workouts}),workoutId:record.id,assignedCount:ids.length,skippedCount:input.athleteIds.length-ids.length};
}
function setCompleted(data,workoutId,athleteId,completed){
 data=V.validateData(data);if(typeof completed!=='boolean')throw Error('Choose a completion status.');
 const workout=data.teamWorkouts?.find(w=>w.id===workoutId);if(!workout?.assignments.some(a=>a.athleteId===athleteId))throw Error('This athlete is no longer assigned.');
 return V.validateData({...data,teamWorkouts:data.teamWorkouts.map(w=>w.id===workoutId?{...w,assignments:w.assignments.map(a=>a.athleteId===athleteId?{...a,completed}:a)}:w)});
}
const api={build,setCompleted,conflicts};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTTeam=api;
})(globalThis);
