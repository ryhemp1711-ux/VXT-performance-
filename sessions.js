'use strict';
(()=>{
 const el=id=>document.getElementById(id);let rowNumber=0;
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const status=(text,error=false)=>{const node=el('session-status');node.textContent=text;node.className=error?'error':'';node.scrollIntoView?.({block:'center',behavior:'smooth'});};
 const field=(row,name)=>row.querySelector(`[data-field="${name}"]`);
 function fillAthletes(select,chosen){select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose athlete';select.append(placeholder);
  for(const a of VXTLocal.snapshot().athletes){const option=document.createElement('option');option.value=a.id;option.textContent=a.name;select.append(option);}select.value=chosen||'';
 }
 function addRep(copy){
  const row=document.createElement('fieldset');row.className='session-rep';const legend=document.createElement('legend');legend.textContent='Rep entry '+(++rowNumber);row.append(legend);
  function control(label,name,type='text'){
   const wrapper=document.createElement('label');wrapper.textContent=label;const input=document.createElement(type==='select'?'select':'input');if(type!=='select')input.type=type;input.dataset.field=name;wrapper.append(input);row.append(wrapper);return input;
  }
  const athlete=control('Athlete','athleteId','select');athlete.required=true;fillAthletes(athlete,copy?.athleteId||el('active-athlete').value);
  const event=control('Effort / finish distance','event','select');for(const e of VXTSessions.events){const o=document.createElement('option');o.value=e;o.textContent=e.startsWith('Fly ')?e:e+' — standing start';event.append(o);}event.value=copy?.event||'60m';
  const total=control('Finish time (seconds)','time','number');total.min='0.01';total.max='3600';total.step='0.01';total.required=true;
  const intro=document.createElement('p');intro.className='muted';intro.textContent='Optional cumulative splits from the same start, not individual segment times.';row.append(intro);
  const grid=document.createElement('div');grid.className='session-splits';row.append(grid);
  for(const distance of [10,20,30,60]){const input=control(distance+'m split (seconds)','split'+distance,'number');input.min='0.01';input.max='3600';input.step='0.01';grid.append(input.parentElement);}
  const notes=control('Rep notes','notes');notes.maxLength=500;notes.placeholder='Surface, start, wind, or coaching cue';
  function adjust(){const distance=Number(event.value.replace(/\D/g,'')),fly=event.value.startsWith('Fly ');for(const d of [10,20,30,60]){const input=field(row,'split'+d);input.disabled=fly||d>=distance;input.parentElement.hidden=input.disabled;}intro.hidden=fly;}
  event.addEventListener('change',adjust);adjust();
  const actions=document.createElement('div');actions.className='session-rep-actions';
  const another=document.createElement('button');another.type='button';another.textContent='Next rep for this athlete';another.addEventListener('click',()=>{addRep({athleteId:athlete.value,event:event.value});});actions.append(another);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove entry';remove.addEventListener('click',()=>row.remove());actions.append(remove);row.append(actions);el('session-reps').append(row);
 }
 function history(){
  const data=VXTLocal.snapshot(),container=el('session-history');container.replaceChildren();
  const sessions=[...(data.sessions||[])].sort((a,b)=>b.date.localeCompare(a.date));
  if(!sessions.length){container.textContent='Saved sessions will appear here.';return;}
  for(const session of sessions){
   const section=document.createElement('details');section.className='session-summary';const summary=document.createElement('summary');
   const records=data.results.filter(r=>r.sessionId===session.id),groups=new Map();
   for(const r of records){const k=r.repId||r.id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
   summary.textContent=`${VXT.formatDate(session.date)} · ${session.name} · ${groups.size} reps · ${new Set(records.map(r=>r.athleteId)).size} athletes`;section.append(summary);
   const notes=document.createElement('p');notes.textContent=[session.method,session.notes].filter(Boolean).join(' · ');section.append(notes);
   for(const group of groups.values()){
    group.sort((a,b)=>Number(a.event.replace(/\D/g,''))-Number(b.event.replace(/\D/g,'')));
    const first=group[0],athlete=data.athletes.find(a=>a.id===first.athleteId);const p=document.createElement('p');
    p.textContent=`${athlete?.name||'Removed athlete'} · Rep ${first.repNumber||'—'} · ${first.repEvent||first.event}: `+group.map(r=>`${r.event} ${r.time.toFixed(2)}s${r.isSplit?' (split)':''}`).join(' · ');section.append(p);
   }
   container.append(section);
  }
 }
 el('session-date').value=today();el('session-date').max=today();
 el('session-add-rep').addEventListener('click',()=>{try{addRep();}catch(e){status(e.message,true);}});
 el('session-form').addEventListener('submit',e=>{
  e.preventDefault();const save=el('session-save');if(save.disabled)return;save.disabled=true;
  try{
   const details={name:el('session-name').value,date:el('session-date').value,method:el('session-method').value,notes:el('session-notes').value};
   if(details.date>today())throw Error('Choose today or an earlier date for a completed session.');
   const reps=[...el('session-reps').children].map(row=>({athleteId:field(row,'athleteId').value,event:field(row,'event').value,time:field(row,'time').value,notes:field(row,'notes').value,splits:Object.fromEntries([10,20,30,60].filter(d=>!field(row,'split'+d).disabled).map(d=>[d,field(row,'split'+d).value]))}));
   const result=VXTSessions.build(VXTLocal.snapshot(),details,reps,()=>crypto.randomUUID());
   VXTLocal.appendReviewed(result.data);
   el('session-reps').replaceChildren();rowNumber=0;el('session-name').value='';el('session-notes').value='';history();
   status(`Saved ${result.reps} reps for ${result.athletes} athletes (${result.records} finish times and splits). Results and Predictor are updated. Upload to cloud to share this session with your other device.`);
  }catch(error){status(error.message,true);}finally{save.disabled=false;}
 });
 document.querySelector('[data-tab="sessions"]').addEventListener('click',()=>{
  try{for(const row of el('session-reps').children){const select=field(row,'athleteId');fillAthletes(select,select.value);}if(!el('session-reps').children.length)addRep();history();}catch(e){status(e.message,true);}
 });
})();
