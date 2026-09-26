'use strict';
(()=>{
 const el=id=>document.getElementById(id);let rowNumber=0;
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const status=(text,error=false)=>{const node=el('session-status');node.textContent=text;node.className=error?'error':'';node.scrollIntoView?.({block:'center',behavior:'smooth'});};
 const field=(row,name)=>row.querySelector(`[data-field="${name}"]`);
 function fillAthletes(select,chosen){select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose athlete';select.append(placeholder);
  for(const a of VXTLocal.snapshot().athletes){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;select.append(o);}select.value=chosen||'';
 }
 function addRep(copy){
  const row=document.createElement('fieldset');row.className='session-rep';const legend=document.createElement('legend');legend.textContent='Rep entry '+(++rowNumber);row.append(legend);
  function control(label,name,type='text',parent=row,options=[]){
   const wrapper=document.createElement('label');wrapper.textContent=label;const input=document.createElement(type==='select'?'select':'input');if(type!=='select')input.type=type;input.dataset.field=name;
   if(type==='number'){input.step='0.01';input.min='0';input.inputMode='decimal';}
   for(const v of options){const o=document.createElement('option');o.value=o.textContent=v;input.append(o);}wrapper.append(input);parent.append(wrapper);return input;
  }
  const athlete=control('Athlete','athleteId','select');fillAthletes(athlete,copy?.athleteId||el('active-athlete').value);
  const event=control('Effort / finish distance','event','select',row,VXTSessions.events);event.value=copy?.event||'60m';
  const total=control('Finish time (seconds; optional for drills)','time','number');
  const intro=document.createElement('p');intro.className='muted';intro.textContent='Optional cumulative splits from the same start, not individual segment times.';row.append(intro);
  const grid=document.createElement('div');grid.className='session-splits';row.append(grid);
  for(const distance of [10,20,30,60])control(distance+'m split (seconds)','split'+distance,'number',grid);
  const sled=document.createElement('div');row.append(sled);control('Sled push distance (meters)','distance','number',sled);control('Sled load (optional)','load','number',sled);control('Load unit','loadUnit','select',sled,['lb','kg']);
  const wickets=document.createElement('div');row.append(wickets);control('Number of wickets','wicketCount','number',wickets).step='1';control('Distance between wickets','spacing','number',wickets);control('Spacing unit','spacingUnit','select',wickets,['ft','m']);
  const span=document.createElement('p');span.className='muted';wickets.append(span);
  wickets.addEventListener('input',()=>{const count=Number(field(row,'wicketCount').value),spacing=Number(field(row,'spacing').value),factor=field(row,'spacingUnit').value==='ft'?.3048:1;span.textContent=count>=2&&spacing>0?`First-to-last wicket span: ${((count-1)*spacing*factor).toFixed(2)}m. Run-in and run-out are separate; this is not automatically a flying split.`:'Enter uniform spacing. For 6 ft 9 in, enter 6.75 ft.';});
  span.textContent='Enter uniform spacing. For 6 ft 9 in, enter 6.75 ft. Run-in is not included in the wicket span.';
  const tempo=document.createElement('div');row.append(tempo);
  const tempoIntro=document.createElement('p');tempoIntro.textContent='Tempo uses repeated runs at a controlled training pace. Edit sets, reps and distance; times and recovery durations are optional. Between-set recovery replaces between-rep recovery at the end of each set. Tempo stays in the session and does not feed race bests or the predictor.';tempo.append(tempoIntro);
  const tempoSets=control('Tempo sets','tempoSets','number',tempo);tempoSets.step='1';tempoSets.value='2';
  const tempoReps=control('Reps per set','tempoReps','number',tempo);tempoReps.step='1';tempoReps.value='5';
  const tempoDistance=control('Distance per rep (meters)','tempoDistance','number',tempo);tempoDistance.value='100';
  const repRest=control('Rest between reps (seconds, optional)','tempoRepRest','number',tempo);
  const setRest=control('Rest between sets (seconds, optional)','tempoSetRest','number',tempo);
  const tempoVolume=document.createElement('p');tempoVolume.setAttribute('aria-live','polite');tempo.append(tempoVolume);
  const tempoTimes=document.createElement('div');tempo.append(tempoTimes);
  function updateTempo(){
   const sets=Number(tempoSets.value),reps=Number(tempoReps.value),distance=Number(tempoDistance.value);
   if(!Number.isInteger(sets)||sets<1||sets>20||!Number.isInteger(reps)||reps<1||reps>50||sets*reps>200){tempoVolume.textContent='Choose 1–20 sets and 1–50 reps per set, up to 200 runs total.';return;}
   const previous=Object.fromEntries([...tempoTimes.querySelectorAll('input')].map(i=>[i.dataset.field,i.value]));tempoTimes.replaceChildren();
   tempoVolume.textContent=distance>0?`${sets} × ${reps} × ${distance}m = ${sets*reps*distance}m running`:'Enter the distance per rep.';
   repRest.parentElement.hidden=reps===1;repRest.disabled=reps===1||event.value!=='Tempo';setRest.parentElement.hidden=sets===1;setRest.disabled=sets===1||event.value!=='Tempo';
   for(let set=1;set<=sets;set++){
    const group=document.createElement('fieldset');group.className='session-segment';const title=document.createElement('legend');title.textContent='Tempo set '+set;group.append(title);tempoTimes.append(group);
    for(let rep=1;rep<=reps;rep++){const name='tempoTime'+set+'_'+rep;const input=control('Rep '+rep+' time (seconds, optional)',name,'number',group);input.value=previous[name]||'';input.disabled=event.value!=='Tempo';}
   }
  }
  tempoSets.addEventListener('change',updateTempo);tempoReps.addEventListener('change',updateTempo);tempoDistance.addEventListener('change',updateTempo);
  const hard=document.createElement('div');row.append(hard);
  const hardInstructions=document.createElement('p');hardInstructions.textContent='Run 100m, walk back 50m, repeat until you reach the end of the 400m lap. Seven 100m runs and six 50m walk-backs: 700m running, 300m walking. No walk-back after run 7. Times are optional; running time excludes walking. This is not a continuous 400m result.';hard.append(hardInstructions);
  for(let i=0;i<7;i++){
   const part=document.createElement('fieldset');part.className='session-segment';const title=document.createElement('legend');title.textContent='Run '+(i+1)+' — 100m (finish at '+(100+i*50)+'m)';part.append(title);hard.append(part);
   control('Run time (seconds, optional)','hardTime'+i,'number',part);
   if(i<6)control('50m walk-back time (seconds, optional)','hardWalk'+i,'number',part);
  }
  const broken=document.createElement('div');row.append(broken);
  const instructions=document.createElement('p');instructions.textContent='Enter 2–4 segments in order. Rest is in seconds (90 = 1:30). Segment times are optional; their sum excludes rest and is not a continuous race result.';broken.append(instructions);
  for(let i=0;i<4;i++){
   const part=document.createElement('fieldset');part.className='session-segment';const title=document.createElement('legend');title.textContent='Segment '+(i+1);part.append(title);broken.append(part);
   control('Distance (meters)','partDistance'+i,'number',part);control('Segment time (seconds, optional)','partTime'+i,'number',part);
   if(i<3)control('Rest before next segment (seconds)','partRest'+i,'number',part);
  }
  const sum=document.createElement('p');sum.setAttribute('aria-live','polite');broken.append(sum);
  function updateSum(){const last=[0,1,2,3].filter(i=>field(row,'partDistance'+i).value!=='').at(-1)??0;for(let i=0;i<3;i++){const rest=field(row,'partRest'+i);rest.disabled=i>=last;rest.parentElement.hidden=i>=last;}const target=Number(event.value.replace(/\D/g,'')),actual=[0,1,2,3].reduce((n,i)=>n+Number(field(row,'partDistance'+i).value||0),0);sum.textContent=`Segments: ${actual}m / ${target}m${Math.abs(target-actual)<.001?' — total matches':''}`;}
  broken.addEventListener('input',updateSum);
  control('Rest after this rep (seconds, optional)','restAfter','number');
  control('Rep notes','notes').maxLength=500;
  function showGroup(group,show){group.hidden=!show;group.querySelectorAll('input,select').forEach(i=>i.disabled=!show);}
  function adjust(){
   const race=VXTSessions.raceEvents.includes(event.value),fly=event.value.startsWith('Fly '),distance=Number(event.value.replace(/\D/g,'')),isBroken=event.value.startsWith('Broken ');
   const isHard=event.value==='400 the hard way';
   const isTempo=event.value==='Tempo';
   total.disabled=isBroken||isHard||isTempo;total.parentElement.hidden=total.disabled;showGroup(hard,isHard);showGroup(tempo,isTempo);if(isTempo)updateTempo();
   showGroup(sled,event.value==='Sled push');showGroup(wickets,event.value==='Wicket run');showGroup(broken,isBroken);
   for(const d of [10,20,30,60]){const input=field(row,'split'+d);input.disabled=!race||fly||d>=distance;input.parentElement.hidden=input.disabled;}intro.hidden=!race||fly;
   if(isBroken)updateSum();
  }
  event.addEventListener('change',adjust);adjust();
  const actions=document.createElement('div');actions.className='session-rep-actions';
  const another=document.createElement('button');another.type='button';another.textContent='Next rep for this athlete';another.addEventListener('click',()=>addRep({athleteId:athlete.value,event:event.value}));actions.append(another);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove entry';remove.addEventListener('click',()=>row.remove());actions.append(remove);row.append(actions);el('session-reps').append(row);
 }
 function history(openId){
  const data=VXTLocal.snapshot(),container=el('session-history');container.replaceChildren();
  const sessions=[...(data.sessions||[])].sort((a,b)=>b.date.localeCompare(a.date));
  if(!sessions.length){container.textContent='No saved sessions on this device yet. Use Save session results above; individual results logged in Results are not grouped into a session.';return;}
  const seconds=n=>n==null?'not recorded':Number(n).toFixed(2)+'s';
  for(const session of sessions){
   const section=document.createElement('details');section.className='session-summary';section.open=session.id===openId;const summary=document.createElement('summary');
   const records=data.results.filter(r=>r.sessionId===session.id),groups=new Map();for(const r of records){const k=r.repId||r.id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
   const entries=session.efforts||[...groups.values()].map(g=>({id:g[0].repId||g[0].id,athleteId:g[0].athleteId,repNumber:g[0].repNumber,event:g[0].repEvent||g[0].event}));
   summary.textContent=`${VXT.formatDate(session.date)} · ${session.name} · ${entries.length} reps · ${new Set(entries.map(r=>r.athleteId)).size} athletes`;section.append(summary);
   const notes=document.createElement('p');notes.textContent=[session.method,session.notes].filter(Boolean).join(' · ');section.append(notes);
   for(const effort of entries){
    const athlete=data.athletes.find(a=>a.id===effort.athleteId);let detail='';
    if(effort.event==='Tempo')detail=`${effort.sets} × ${effort.repsPerSet} × ${effort.distance}m · ${effort.runningDistance}m running`+(effort.repsPerSet>1?` · rest between reps ${seconds(effort.repRest)}`:'')+(effort.sets>1?` · rest between sets ${seconds(effort.setRest)} (replaces rep rest)`:'')+' · '+Array.from({length:effort.sets},(_,set)=>'set '+(set+1)+': '+effort.times.slice(set*effort.repsPerSet,(set+1)*effort.repsPerSet).map((t,i)=>'rep '+(i+1)+' '+seconds(t)).join(', ')).join(' · ')+(effort.runningTime==null?'':` · running time ${seconds(effort.runningTime)} (rest excluded)`);
    else if(effort.event==='400 the hard way')detail='400m net progress · 700m running · 300m walking · '+effort.segments.map((p,i)=>`run ${i+1}: 100m ${seconds(p.time)}${i<6?' → walk back 50m'+(p.walkBackTime==null?'':' in '+seconds(p.walkBackTime)):''}`).join(' · ')+(effort.runningTime==null?'':` · running time ${seconds(effort.runningTime)} (walking excluded)`);
    else if(effort.event==='Sled push')detail=`${effort.distance}m · time ${seconds(effort.time)}`+(effort.load==null?'':` · load ${effort.load} ${effort.loadUnit}`);
    else if(effort.event==='Wicket run')detail=`${effort.wicketCount} wickets · ${effort.spacing} ${effort.spacingUnit} apart · span ${effort.wicketSpanMeters.toFixed(2)}m · time ${seconds(effort.time)}`;
    else if(effort.event.startsWith('Broken '))detail=effort.segments.map((p,i)=>`${p.distance}m${p.time==null?'':' in '+seconds(p.time)}${i<effort.segments.length-1?' → rest '+p.rest+'s →':''}`).join(' ')+` · total ${effort.distance}m`+(effort.runningTime==null?'':` · running time ${seconds(effort.runningTime)} (rest excluded)`);
    else{const group=groups.get(effort.id)||[];group.sort((a,b)=>Number(a.event.replace(/\D/g,''))-Number(b.event.replace(/\D/g,'')));detail=group.length?group.map(r=>`${r.event} ${r.time.toFixed(2)}s${r.isSplit?' (split)':''}`).join(' · '):'Result records removed';}
    const p=document.createElement('p');p.textContent=`${athlete?.name||'Removed athlete'} · Rep ${effort.repNumber||'—'} · ${effort.event}: ${detail}`+(effort.restAfter==null?'':` · rest after rep ${effort.restAfter}s`)+(effort.notes?' · '+effort.notes:'');section.append(p);
   }
   container.append(section);
  }
 }
 el('session-date').value=today();el('session-date').max=today();
 el('session-add-rep').addEventListener('click',()=>{try{addRep();}catch(e){status(e.message,true);}});
 el('session-form').addEventListener('submit',e=>{
  e.preventDefault();const save=el('session-save');if(save.disabled)return;save.disabled=true;
  try{
   const details={name:el('session-name').value,date:el('session-date').value,method:el('session-method').value,notes:el('session-notes').value};if(details.date>today())throw Error('Choose today or an earlier date for a completed session.');
   const reps=[...el('session-reps').children].map((row,index)=>{
    const v=name=>field(row,name)?.value||'';
    const rep={athleteId:v('athleteId'),event:v('event'),time:v('time'),notes:v('notes'),restAfter:v('restAfter'),distance:v('distance'),load:v('load'),loadUnit:v('loadUnit'),wicketCount:v('wicketCount'),spacing:v('spacing'),spacingUnit:v('spacingUnit'),splits:Object.fromEntries([10,20,30,60].filter(d=>!field(row,'split'+d).disabled).map(d=>[d,v('split'+d)]))};
    if(rep.event==='Tempo'){
     rep.sets=v('tempoSets');rep.repsPerSet=v('tempoReps');rep.tempoDistance=v('tempoDistance');rep.repRest=v('tempoRepRest');rep.setRest=v('tempoSetRest');
     const sets=Number(rep.sets),reps=Number(rep.repsPerSet);
     rep.times=Number.isInteger(sets)&&Number.isInteger(reps)&&sets>0&&sets<=20&&reps>0&&reps<=50&&sets*reps<=200?Array.from({length:sets*reps},(_,i)=>v('tempoTime'+(Math.floor(i/reps)+1)+'_'+(i%reps+1))):[];
    }
    if(rep.event==='400 the hard way')rep.segments=Array.from({length:7},(_,i)=>({time:v('hardTime'+i),walkBackTime:i<6?v('hardWalk'+i):''}));
    if(rep.event.startsWith('Broken ')){
     rep.segments=[];let gap=false;for(let i=0;i<4;i++){
      if(!v('partDistance'+i)){gap=true;if(v('partTime'+i)||(!field(row,'partRest'+i)?.disabled&&v('partRest'+i)))throw Error(`Row ${index+1}: segment ${i+1} needs a distance.`);continue;}
      if(gap)throw Error(`Row ${index+1}: enter segments consecutively without empty gaps.`);
      rep.segments.push({distance:v('partDistance'+i),time:v('partTime'+i),rest:field(row,'partRest'+i)?.disabled?'':v('partRest'+i)});
     }
    }
    return rep;
   });
   const result=VXTSessions.build(VXTLocal.snapshot(),details,reps,()=>crypto.randomUUID());VXTLocal.appendReviewed(result.data);
   // Confirm durable local storage before clearing the entry form.
   if(!VXTLocal.snapshot().sessions?.some(s=>s.id===result.sessionId))throw Error('Session was not saved. Keep this page open and try again.');
   el('session-reps').replaceChildren();rowNumber=0;el('session-name').value='';el('session-notes').value='';history(result.sessionId);
   status(`Saved ${result.reps} reps for ${result.athletes} athletes. See the expanded session below. ${result.records} continuous finish times and splits added to Results. Upload to cloud for your other device.`);
  }catch(error){status(error.message,true);}finally{save.disabled=false;}
 });
 document.querySelector('[data-tab="sessions"]').addEventListener('click',()=>{
  try{for(const row of el('session-reps').children){const s=field(row,'athleteId');fillAthletes(s,s.value);}if(!el('session-reps').children.length)addRep();history();}catch(e){status(e.message,true);}
 });
})();
