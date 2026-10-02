(function(root){
'use strict';
const V=typeof module!=='undefined'&&module.exports?require('./model.js'):root.VXT;
const text=(value,max,label)=>{const s=String(value||'').trim();if(s.length>max)throw Error(label+' is too long.');return s;};
function saveGroup(data,input,newId){
 data=V.validateData(data);const name=text(input.name,100,'Group name');if(!name)throw Error('Enter a group name.');
 const athleteIds=[...new Set(input.athleteIds||[])];if(!athleteIds.length||athleteIds.some(id=>!data.athletes.some(a=>a.id===id)))throw Error('Select athletes for the group.');
 if(input.id&&!data.trainingGroups?.some(g=>g.id===input.id))throw Error('Group no longer exists.');
 const group={id:input.id||newId(),name,athleteIds};return V.validateData({...data,trainingGroups:input.id?data.trainingGroups.map(g=>g.id===input.id?group:g):[...(data.trainingGroups||[]),group]});
}
function saveTemplate(data,input,newId){
 data=V.validateData(data);const name=text(input.name,100,'Template name'),workout=text(input.workout,10000,'Workout');if(!name||!workout)throw Error('Enter a template name and workout.');
 if(input.id&&!data.workoutTemplates?.some(t=>t.id===input.id))throw Error('Template no longer exists.');
 const template={id:input.id||newId(),name,workout,notes:text(input.notes,2000,'Notes'),event:input.event||'60m',reps:Number(input.reps??1),restAfter:input.restAfter==null||input.restAfter===''?null:Number(input.restAfter)};
 return V.validateData({...data,workoutTemplates:input.id?data.workoutTemplates.map(t=>t.id===input.id?template:t):[...(data.workoutTemplates||[]),template]});
}
function remove(data,collection,id){
 if(!['trainingGroups','workoutTemplates'].includes(collection))throw Error('Invalid collection.');data=V.validateData(data);if(!data[collection]?.some(x=>x.id===id))throw Error('Record no longer exists.');return V.validateData({...data,[collection]:data[collection].filter(x=>x.id!==id)});
}
function saveCheckin(data,workoutId,athleteId,input){
 data=V.validateData(data);const w=data.teamWorkouts?.find(w=>w.id===workoutId);if(!w?.assignments.some(a=>a.athleteId===athleteId))throw Error('Athlete is not assigned to this workout.');
 const number=value=>value==null||value===''?null:Number(value);
 const patch={target:text(input.target,500,'Target'),attendance:input.attendance||'Unrecorded',energy:number(input.energy),soreness:number(input.soreness),readinessNotes:text(input.readinessNotes,1000,'Readiness notes')};
 if(patch.attendance==='Absent'&&(data.sessions||[]).some(s=>s.sourceWorkoutId===workoutId&&s.efforts?.some(e=>e.athleteId===athleteId)))throw Error('This athlete has linked results. Remove that session before marking absent.');
 return V.validateData({...data,teamWorkouts:data.teamWorkouts.map(w=>w.id!==workoutId?w:{...w,assignments:w.assignments.map(a=>a.athleteId!==athleteId?a:{...a,...patch,completed:patch.attendance==='Absent'?false:a.completed})})});
}
function saveReportNotes(data,athleteId,notes){data=V.validateData(data);if(!data.athletes.some(a=>a.id===athleteId))throw Error('Select an athlete.');const record={athleteId,notes:text(notes,4000,'Coach notes')};return V.validateData({...data,athleteReports:[...(data.athleteReports||[]).filter(r=>r.athleteId!==athleteId),record]});}
function progress(data,athleteId){
 const groups=new Map();for(const r of data.results.filter(r=>r.athleteId===athleteId)){const key=r.event+' / '+(r.method||'Unknown');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 return [...groups].map(([label,rows])=>{const dated=rows.filter(r=>r.date.length===10).sort((a,b)=>a.date.localeCompare(b.date));const firstDate=dated[0]?.date,lastDate=dated.at(-1)?.date;const first=dated.filter(r=>r.date===firstDate).sort((a,b)=>a.time-b.time)[0],latest=dated.filter(r=>r.date===lastDate).sort((a,b)=>a.time-b.time)[0];const best=[...rows].sort((a,b)=>a.time-b.time)[0];return {label,best,first,latest,improvement:first&&latest&&firstDate!==lastDate?first.time-latest.time:null};}).sort((a,b)=>a.label.localeCompare(b.label));
}
function week(data,date,athleteId=''){
 const start=V.normalizeDate(date);if(start.length!==10)throw Error('Choose a date.');const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 return Array.from({length:7},(_,i)=>{const day=new Date(d);day.setUTCDate(day.getUTCDate()+i);const date=day.toISOString().slice(0,10);
 const workouts=(data.teamWorkouts||[]).filter(w=>w.date===date&&(!athleteId||w.assignments.some(a=>a.athleteId===athleteId)));
 const sessions=(data.sessions||[]).filter(s=>s.date===date&&(!athleteId||s.efforts?.some(e=>e.athleteId===athleteId)||data.results.some(r=>r.sessionId===s.id&&r.athleteId===athleteId)));
 const blocks=(data.trainingBlocks||[]).filter(b=>b.startDate<=date&&date<=b.endDate&&(!athleteId||b.athleteIds.includes(athleteId)));
 const conflicts=workouts.map(w=>({id:w.id,athletes:V.schedulingConflicts(data,{date,excludeTeamId:w.id,athleteIds:w.assignments.filter(a=>!athleteId||a.athleteId===athleteId).map(a=>a.athleteId)}).filter(c=>c.blocks.length||c.workouts.length||c.sessions.some(s=>s.sourceWorkoutId!==w.id))})).filter(c=>c.athletes.length);
 return {date,workouts:[...workouts].sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99')),sessions,blocks,conflicts};});
}
const api={saveGroup,saveTemplate,remove,saveCheckin,saveReportNotes,progress,week};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTCoaching=api;
})(globalThis);
