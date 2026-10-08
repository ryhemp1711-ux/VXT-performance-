'use strict';
(() => {
 const el=id=>document.getElementById(id);
 let generation=0,evidence=null,busy=false;
 const status=text=>{el('ai-coach-status').textContent=text;};
 function clear(){generation++;evidence=null;busy=false;el('ai-coach-output').replaceChildren();el('ai-coach-consent').checked=false;el('ai-coach-review').disabled=true;el('ai-coach-load').disabled=!globalThis.VXTCoachConfig?.endpoint;status(globalThis.VXTCoachConfig?.endpoint?'Load the selected athlete’s cloud evidence to begin.':'AI coach preview — the server connection has not been activated yet.');}
 function paragraph(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);}
 function show(data){
  const out=el('ai-coach-output');out.replaceChildren();
  const c=data.context;
  paragraph(out,`Cloud revision ${c.cloudRevision} · saved ${c.cloudUpdatedAt || 'date unknown'} · ${c.results.length} dated results. Review date: ${c.asOf} (UTC).`);
  if(data.review){
   paragraph(out,'AI-generated draft — verify against the evidence. No workout has been saved.');
   paragraph(out,data.review.summary);
   for(const observation of data.review.observations){paragraph(out,observation.text);for(const id of observation.resultIds){const r=c.results.find(x=>x.id===id);if(r)paragraph(out,`Evidence: ${r.date} · ${r.event} · ${r.time}s · ${r.method || 'Unknown'}${r.isSplit?' · split':''}`);}}
   for(const q of data.review.questions)paragraph(out,'Question: '+q);
  }else for(const r of c.results)paragraph(out,`${r.date} · ${r.event} · ${r.time}s · ${r.method || 'Unknown'}${r.isSplit?' · split':''}`);
  paragraph(out,'Before planning a session: '+c.missing.join('; ')+'.');
  for(const limitation of c.limitations)paragraph(out,limitation);
 }
 async function run(action){
  if(busy)return;
  const athleteId=el('active-athlete').value;if(!athleteId){status('Select an athlete first.');return;}
  if(action==='review'&&(!evidence||!el('ai-coach-consent').checked)){status('Load evidence and confirm permission before requesting AI review.');return;}
  const endpoint=globalThis.VXTCoachConfig?.endpoint;
  if(!endpoint){status('AI coach has not been configured yet.');return;}
  const operation=++generation;busy=true;el('ai-coach-load').disabled=true;el('ai-coach-review').disabled=true;
  status(action==='review'?'Reviewing cloud evidence…':'Loading cloud evidence…');
  try{
   const url=new URL(endpoint,location.href);
   if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Coach server must use HTTPS.');
   const {token,userId}=await VXTCloud.coachSession();
   if(operation!==generation)return;
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({athleteId,action,...(action==='review'?{expectedRevision:evidence.cloudRevision}:{})})});
   const data=await response.json();
   if(operation!==generation||el('active-athlete').value!==athleteId)return;
   const current=await VXTCloud.coachSession();if(current.userId!==userId)throw Error('Account changed. Load evidence again.');
   if(operation!==generation)return;
   if(!response.ok)throw Error(data.error||'Coach request failed.');
   evidence=data.context;show(data);status(action==='review'?'Draft review ready for coach verification.':'Cloud evidence loaded. Unsynced changes are not included.');
  }catch(error){if(operation===generation){evidence=null;el('ai-coach-output').replaceChildren();status(error.name==='TimeoutError'?'Request timed out. Please try again.':error.message||'Coach unavailable.');}}
  finally{if(operation===generation){busy=false;el('ai-coach-load').disabled=false;el('ai-coach-review').disabled=!evidence||!el('ai-coach-consent').checked;}}
 }
 el('ai-coach-load').addEventListener('click',()=>run('context'));
 el('ai-coach-review').addEventListener('click',()=>run('review'));
 el('ai-coach-consent').addEventListener('change',()=>{el('ai-coach-review').disabled=busy||!evidence||!el('ai-coach-consent').checked;});
 for(const event of ['vxt-coach-reset','vxt-workspace-replaced','vxt-auth-changed'])document.addEventListener(event,clear);
 clear();
})();
