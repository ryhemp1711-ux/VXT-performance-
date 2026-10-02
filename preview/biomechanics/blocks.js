'use strict';
(()=>{
 const el=id=>document.getElementById(id);let editing=null;const draft=new Map();
 const status=(text,error=false)=>{el('block-status').textContent=text;el('block-status').className=error?'error':'';};
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 function capture(){for(const row of el('block-plan').children){draft.set(Number(row.dataset.week),{focus:row.querySelector('input').value,workouts:row.querySelector('textarea').value});}}
 function plan(){
  capture();const count=Number(el('block-weeks').value),start=el('block-start').value;
  if(!Number.isInteger(count)||count<3||count>51||count%3){el('block-range').textContent='Choose 3 to 51 weeks in increments of 3.';return;}
  try{el('block-range').textContent=start?`${VXT.formatDate(start)} – ${VXT.formatDate(VXTBlocks.addDays(start,count*7-1))} · ${count/3} three-week cycles`:'Choose a start date.';}catch{el('block-range').textContent='Choose a valid start date.';}
  el('block-plan').replaceChildren();
  for(let week=1;week<=count;week++){
   const row=document.createElement('fieldset');row.className='session-segment';row.dataset.week=week;
   const legend=document.createElement('legend');let dates='';try{if(start)dates=' · '+VXT.formatDate(VXTBlocks.addDays(start,(week-1)*7))+' – '+VXT.formatDate(VXTBlocks.addDays(start,week*7-1));}catch{}
   legend.textContent=`Week ${week} · Cycle ${Math.ceil(week/3)}${dates}`;row.append(legend);
   for(const [key,label,type,max] of [['focus','Weekly focus','input',200],['workouts','Planned workouts / recovery','textarea',4000]]){
    const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type);input.maxLength=max;input.value=draft.get(week)?.[key]||'';if(type==='textarea')input.rows=3;wrap.append(input);row.append(wrap);
   }el('block-plan').append(row);
  }
 }
 function athletes(selected){
  const ids=selected||[...el('block-athletes').querySelectorAll('input:checked')].map(i=>i.value);el('block-athletes').replaceChildren();
  for(const a of VXTLocal.snapshot().athletes){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.value=a.id;input.checked=ids.includes(a.id);label.append(input,document.createTextNode(a.name));el('block-athletes').append(label);}
 }
 function reset(){document.dispatchEvent(new CustomEvent('vxt-clear-draft',{detail:'blocks'}));editing=null;draft.clear();el('block-plan').replaceChildren();el('block-form').reset();el('block-start').value=today();el('block-weeks').value='3';el('block-save').textContent='Save training block';el('block-cancel').hidden=true;athletes([]);plan();}
 function history(openId){
  const data=VXTLocal.snapshot();el('block-history').replaceChildren();
  if(!data.trainingBlocks?.length){el('block-history').textContent='No saved training blocks yet.';return;}
  for(const b of [...data.trainingBlocks].sort((a,b)=>b.startDate.localeCompare(a.startDate))){
   const section=document.createElement('details');section.className='session-summary';section.open=b.id===openId;section.dataset.blockId=b.id;
   const title=document.createElement('summary');title.textContent=`${b.name} · ${b.weeks} weeks · ${VXT.formatDate(b.startDate)} – ${VXT.formatDate(b.endDate)}`;section.append(title);
   const roster=document.createElement('p');roster.textContent=b.athleteIds.length?'Athletes: '+b.athleteIds.map(id=>data.athletes.find(a=>a.id===id)?.name||'Removed athlete').join(', '):'General block · no athletes assigned';section.append(roster);
   if(b.notes){const p=document.createElement('p');p.textContent=b.notes;p.style.whiteSpace='pre-wrap';section.append(p);}
   for(const week of b.plan){const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=`Week ${week.week} · Cycle ${Math.ceil(week.week/3)} · ${VXT.formatDate(VXTBlocks.addDays(b.startDate,(week.week-1)*7))} – ${VXT.formatDate(VXTBlocks.addDays(b.startDate,week.week*7-1))}\nFocus: ${week.focus||'Not set'}\n${week.workouts||'No workouts planned yet.'}`;section.append(p);}
   const edit=document.createElement('button');edit.type='button';edit.textContent='Edit '+b.name;edit.addEventListener('click',()=>{
    editing=b.id;draft.clear();el('block-plan').replaceChildren();for(const w of b.plan)draft.set(w.week,{focus:w.focus,workouts:w.workouts});el('block-name').value=b.name;el('block-start').value=b.startDate;el('block-weeks').value=b.weeks;el('block-notes').value=b.notes;athletes(b.athleteIds);plan();el('block-save').textContent='Save block changes';el('block-cancel').hidden=false;status('Editing '+b.name);el('block-name').focus();document.dispatchEvent(new CustomEvent('vxt-draft-change',{detail:'blocks'}));
   });section.append(edit);el('block-history').append(section);
  }
 }
 el('block-weeks').addEventListener('input',plan);el('block-start').addEventListener('input',plan);el('block-cancel').addEventListener('click',()=>{reset();status('Changes cancelled.');});
 el('block-form').addEventListener('submit',e=>{
  e.preventDefault();el('block-save').disabled=true;
  try{capture();const weeks=Number(el('block-weeks').value);const input={id:editing,name:el('block-name').value,startDate:el('block-start').value,weeks,notes:el('block-notes').value,athleteIds:[...el('block-athletes').querySelectorAll('input:checked')].map(i=>i.value),plan:Number.isInteger(weeks)&&weeks>=3&&weeks<=51?Array.from({length:weeks},(_,i)=>draft.get(i+1)||{}):[]};const result=VXTBlocks.build(VXTLocal.snapshot(),input,()=>crypto.randomUUID());VXTLocal.appendReviewed(result.data);reset();history(result.blockId);status('Training block saved. See the expanded block below.');}catch(e){status(e.message,true);}finally{el('block-save').disabled=false;}
 });
 document.querySelector('[data-tab="blocks"]').addEventListener('click',()=>{try{athletes();history();}catch(e){status(e.message,true);}});
 try{reset();}catch(e){status(e.message,true);}

 (globalThis.VXTEditors ||= {}).blocks={form:'block-form',capture(){capture();return {editing,name:el('block-name').value,start:el('block-start').value,weeks:el('block-weeks').value,notes:el('block-notes').value,athleteIds:[...el('block-athletes').querySelectorAll('input:checked')].map(i=>i.value),plan:[...draft]};},restore(d){
  if(!Array.isArray(d.plan)||d.plan.length>51||!Array.isArray(d.athleteIds))throw Error('Block draft is invalid.');if(d.editing&&!VXTLocal.snapshot().trainingBlocks?.some(b=>b.id===d.editing))throw Error('Edited block no longer exists.');editing=d.editing||null;draft.clear();el('block-plan').replaceChildren();for(const [week,values] of d.plan)draft.set(week,values);el('block-name').value=d.name||'';el('block-start').value=d.start||today();el('block-weeks').value=d.weeks||3;el('block-notes').value=d.notes||'';athletes(d.athleteIds);plan();el('block-save').textContent=editing?'Save block changes':'Save training block';el('block-cancel').hidden=!editing;
 },discard:reset};

})();
