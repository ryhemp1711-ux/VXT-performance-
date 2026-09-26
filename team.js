'use strict';
(()=>{
 const el=id=>document.getElementById(id);let editing=null;
 const status=(text,error=false)=>{el('team-status').textContent=text;el('team-status').className=error?'error':'';};
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const selected=()=>[...el('team-athletes').querySelectorAll('input:checked')].map(i=>i.value);
 function count(){el('team-count').textContent=selected().length+' athletes selected';previewConflicts();}
 function previewConflicts(){
  el('team-conflict-policy').value='';el('team-conflicts').hidden=true;el('team-conflict-list').replaceChildren();
  if(!el('team-date').value)return;
  const data=VXTLocal.snapshot(),overlaps=VXTTeam.conflicts(data,{id:editing,date:el('team-date').value,athleteIds:selected()});
  el('team-conflicts').hidden=!overlaps.length;
  for(const c of overlaps){const item=document.createElement('li');item.textContent=data.athletes.find(a=>a.id===c.athleteId).name+': '+[...c.blocks.map(b=>b.name+' (block '+VXT.formatDate(b.startDate)+' – '+VXT.formatDate(b.endDate)+')'),...c.workouts.map(w=>w.name+' (team workout, '+VXT.formatStartTime(w.startTime)+')'),...c.sessions.map(s=>s.name+' (saved session, '+VXT.formatStartTime(s.startTime)+')')].join('; ');el('team-conflict-list').append(item);}
 }
 el('team-date').addEventListener('change',()=>{try{previewConflicts();}catch(e){status(e.message,true);}});
 function roster(ids=selected()){
  const athletes=VXTLocal.snapshot().athletes;el('team-athletes').replaceChildren();
  for(const a of athletes){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.value=a.id;input.checked=ids.includes(a.id);input.addEventListener('change',count);label.append(input,document.createTextNode(a.name));el('team-athletes').append(label);}if(!athletes.length)el('team-athletes').textContent='Add athletes in Overview first.';count();
 }
 function reset(){editing=null;el('team-form').reset();el('team-date').value=today();el('team-event').value='60m';roster([]);el('team-save').textContent='Assign workout';el('team-cancel').hidden=true;}
 function history(openId){
  const data=VXTLocal.snapshot();el('team-history').replaceChildren();
  if(!data.teamWorkouts?.length){el('team-history').textContent='No team workouts assigned yet.';return;}
  for(const w of [...data.teamWorkouts].sort((a,b)=>b.date.localeCompare(a.date))){
   const section=document.createElement('details');section.className='session-summary';section.open=w.id===openId;section.dataset.workoutId=w.id;
   const title=document.createElement('summary');title.textContent=`${VXT.formatDate(w.date)} · ${VXT.formatStartTime(w.startTime)} · ${w.name} · ${w.assignments.length} athletes · ${w.assignments.filter(a=>a.completed).length} completed`;section.append(title);
   const prescription=document.createElement('p');prescription.style.whiteSpace='pre-wrap';prescription.textContent=w.workout;section.append(prescription);
   if(w.notes){const notes=document.createElement('p');notes.style.whiteSpace='pre-wrap';notes.textContent=w.notes;section.append(notes);}
   if(!w.assignments.length){const empty=document.createElement('p');empty.textContent='No athletes currently assigned. Edit to assign this workout again.';section.append(empty);}
   for(const assignment of w.assignments){
    const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.checked=assignment.completed;const name=data.athletes.find(a=>a.id===assignment.athleteId)?.name||'Removed athlete';label.append(input,document.createTextNode('Completed — '+name));section.append(label);if(globalThis.VXTCoachingUI)VXTCoachingUI.checkin(section,w,assignment,()=>history(w.id));
    input.addEventListener('change',()=>{const next=input.checked;try{VXTLocal.appendReviewed(VXTTeam.setCompleted(VXTLocal.snapshot(),w.id,assignment.athleteId,next));history(w.id);status(name+': '+(next?'completed':'planned')+'.');}catch(e){input.checked=!next;status(e.message,true);}});
   }
   const log=document.createElement('button');log.type='button';log.textContent='Log results for '+w.name;log.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('vxt-log-workout',{detail:w.id})));section.append(log);
   const saveTemplate=document.createElement('button');saveTemplate.type='button';saveTemplate.textContent='Save '+w.name+' as template';saveTemplate.addEventListener('click',()=>{try{VXTLocal.appendReviewed(VXTCoaching.saveTemplate(VXTLocal.snapshot(),{...w,id:undefined,...(w.prescription||{})},()=>crypto.randomUUID()));status('Template saved. Open Templates to reuse or edit it.');}catch(e){status(e.message,true);}});section.append(saveTemplate);
   const edit=document.createElement('button');edit.type='button';edit.textContent='Edit '+w.name;edit.addEventListener('click',()=>{editing=w.id;el('team-name').value=w.name;el('team-date').value=w.date;el('team-start-time').value=w.startTime||'';el('team-workout').value=w.workout;el('team-notes').value=w.notes;el('team-event').value=w.prescription?.event||'60m';el('team-reps').value=w.prescription?.reps||1;el('team-rest').value=w.prescription?.restAfter??'';roster(w.assignments.map(a=>a.athleteId));el('team-save').textContent='Save team workout changes';el('team-cancel').hidden=false;status('Editing '+w.name+'. Changing the workout or date resets completion for all assigned athletes.');el('team-name').focus();});section.append(edit);
   const remove=document.createElement('button');remove.type='button';remove.textContent='Delete '+w.name;
   const confirmation=document.createElement('div');confirmation.hidden=true;const prompt=document.createElement('p');prompt.textContent='Delete this team workout and all its assignments? Measured results will be kept.';
   const yes=document.createElement('button');yes.type='button';yes.textContent='Confirm delete team workout';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel deletion';
   confirmation.append(prompt,yes,cancel);remove.addEventListener('click',()=>confirmation.hidden=false);cancel.addEventListener('click',()=>confirmation.hidden=true);
   yes.addEventListener('click',()=>{try{VXTLocal.appendReviewed(VXTTeam.remove(VXTLocal.snapshot(),w.id));if(editing===w.id)reset();else previewConflicts();history();status('Team workout deleted.');}catch(e){status(e.message,true);}});
   section.append(remove,confirmation);el('team-history').append(section);
  }
 }
 el('team-all').addEventListener('click',()=>{el('team-athletes').querySelectorAll('input').forEach(i=>i.checked=true);count();});
 el('team-none').addEventListener('click',()=>{el('team-athletes').querySelectorAll('input').forEach(i=>i.checked=false);count();});
 el('team-cancel').addEventListener('click',()=>{reset();status('Changes cancelled.');});
 el('team-form').addEventListener('submit',e=>{e.preventDefault();el('team-save').disabled=true;try{const r=VXTTeam.build(VXTLocal.snapshot(),{id:editing,name:el('team-name').value,date:el('team-date').value,startTime:el('team-start-time').value,workout:el('team-workout').value,notes:el('team-notes').value,prescription:{event:el('team-event').value,reps:Number(el('team-reps').value),restAfter:el('team-rest').value===''?null:Number(el('team-rest').value)},athleteIds:selected(),conflictPolicy:el('team-conflict-policy').value},()=>crypto.randomUUID());const n=r.assignedCount;VXTLocal.appendReviewed(r.data);reset();history(r.workoutId);status('Workout assigned to '+n+' athletes. '+(r.skippedCount?r.skippedCount+' conflicting athletes skipped. ':'')+'See the expanded workout below.');}catch(e){status(e.message,true);}finally{el('team-save').disabled=false;}});
 document.querySelector('[data-tab="team"]').addEventListener('click',()=>{try{roster();history();}catch(e){status(e.message,true);}});
 document.addEventListener('vxt-use-template',e=>{try{const t=VXTLocal.snapshot().workoutTemplates?.find(t=>t.id===e.detail);if(!t)throw Error('Choose a template.');el('team-name').value=t.name;el('team-workout').value=t.workout;el('team-notes').value=t.notes;el('team-event').value=t.event;el('team-reps').value=t.reps;el('team-rest').value=t.restAfter??'';status('Template loaded. Choose a date and athletes, then assign.');}catch(e){status(e.message,true);}});
 for(const event of VXTSessions.events){const o=document.createElement('option');o.value=o.textContent=event;el('team-event').append(o);}el('team-event').value='60m';
 try{reset();el('team-event').value='60m';}catch(e){status(e.message,true);}
})();
