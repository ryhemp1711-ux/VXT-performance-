(function(root){
'use strict';
const profiles={speed:[2.08,2.20,1.28,1.15],balanced:[2.04,2.16,1.24,.85],endurance:[2.02,2.12,1.20,.60],developing:[2.10,2.24,1.35,1.45]};
const levels={youth:[.08,.12,.08],developing:[.05,.08,.05],competitive:[.03,.04,.03],advanced:[0,0,0],elite:[-.01,-.03,-.02]};
function positive(x,label,optional=false){if(optional&&(x===''||x==null))return null;const n=Number(x);if(!Number.isFinite(n)||n<=0)throw Error(label+' must be a positive time in seconds.');return n;}
function predict(event,input){
 const p=profiles[input.profile||'balanced'];if(!p)throw Error('Unknown profile.');let center,detail;
 if(event==='100m'){const a=positive(input.accel30,'30m acceleration'),fly=positive(input.fly,'Flying time'),d=Number(input.flyDistance);if(![10,20,30].includes(d))throw Error('Choose a flying distance.');const ten=fly*10/d;if(a<=3*ten)throw Error('30m acceleration must be slower than 30m at flying speed. Check distances and timing.');center=a+7*ten+.18+Math.max(0,ten-1)*.9;detail='Flying segment average: '+(d/fly).toFixed(2)+' m/s ('+(d/fly*2.23694).toFixed(2)+' mph).';}
 else {const t=positive(input.pb100,'100m PB');if(t<8||t>40)throw Error('100m PB must be between 8 and 40 seconds.');
 if(event==='200m'){const t150=positive(input.test150,'150m test',true);if(t150&&t150<=t)throw Error('150m time must exceed 100m time.');center=2*t+p[3];if(t150)center=.65*center+.35*t150*1.36;detail='100m-based estimate'+(t150?' blended with a 150m test.':'.');}
 else if(event==='400m'){const l=levels[input.level||'competitive'];if(!l)throw Error('Unknown development level.');const actual=positive(input.pb200,'200m PB',true),tt=positive(input.test300,'300m test',true);if(actual&&actual<=t)throw Error('200m time must exceed 100m time.');if(tt&&tt<=(actual||t))throw Error('Check the 300m test time.');const two=actual||t*(p[0]+l[0]);center=two*(p[1]+l[1]);if(tt)center=.6*center+.4*(tt+t*(p[2]+l[2]));detail='Effective 200m: '+two.toFixed(2)+'s ('+(actual?'measured':'estimated')+').';}
 else throw Error('Unsupported event.');}
 if(!Number.isFinite(center))throw Error('These values exceed the model limits.');
 return {event,center,detail,model:'hemphill-heuristic-v1',notice:'Experimental estimate, not a validated forecast. Timing method, wind, age, endurance and race conditions can change the outcome.'};
}
function normalizeDate(value){
 const text=String(value??'').trim();let y,m,d;
 if(/^(19|20)\d{2}$/.test(text))return text;
 let match=text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
 if(match){[,y,m,d]=match;}else{
  match=text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if(match){[,m,d,y]=match;}else{
   match=text.match(/^--\/--\/((?:19|20)\d{2})$/);if(match)return match[1];
   throw Error('Use MM/DD/YYYY, YYYY-MM-DD, or a four-digit season year.');
  }
 }
 y=Number(y);m=Number(m);d=Number(d);const date=new Date(Date.UTC(y,m-1,d));
 if(y<1900||y>2099||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw Error('Invalid calendar date.');
 return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function formatDate(value){const date=normalizeDate(value);return date.length===4?'--/--/'+date:date.slice(5,7)+'/'+date.slice(8,10)+'/'+date.slice(0,4);}
function savedBest(results,athleteId,event,method='All'){
 return results.filter(r=>r.athleteId===athleteId&&r.event===event&&(method==='All'||(r.method||'Unknown')===method)).sort((a,b)=>a.time-b.time||b.date.localeCompare(a.date))[0]||null;
}
function startTime(value){
 if(value==null||value==='')return '';
 if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Enter a valid start time (HH:MM).');
 return value;
}
function formatStartTime(value){if(!value)return 'Time not set';const [h,m]=value.split(':');return ((Number(h)%12)||12)+':'+m+' '+(Number(h)<12?'AM':'PM');}
function schedulingConflicts(data,input){
 const date=normalizeDate(input.date);if(date.length!==10)throw Error('Choose an exact session date.');
 return [...new Set(input.athleteIds||[])].map(athleteId=>({athleteId,
  blocks:(data.trainingBlocks||[]).filter(b=>b.athleteIds.includes(athleteId)&&b.startDate<=date&&date<=b.endDate),
  workouts:(data.teamWorkouts||[]).filter(w=>w.id!==input.excludeTeamId&&w.date===date&&w.assignments.some(a=>a.athleteId===athleteId)),
  sessions:(data.sessions||[]).filter(s=>s.id!==input.excludeSessionId&&s.date===date&&((s.efforts||[]).some(e=>e.athleteId===athleteId)||data.results.some(r=>r.sessionId===s.id&&r.athleteId===athleteId)))
 })).filter(c=>c.blocks.length||c.workouts.length||c.sessions.length);
}
function validateData(data){
 if(!data||data.version!==1||!Array.isArray(data.athletes)||!Array.isArray(data.results)||!Array.isArray(data.predictions))throw Error('Not a VXT version 1 backup.');
 if(data.athletes.length>5000||data.results.length>100000||data.predictions.length>100000)throw Error('Backup is too large.');
 const ids=new Set();for(const a of data.athletes){if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>100)throw Error('Invalid athlete record.');ids.add(a.id);}
 if(data.teamWorkouts!=null){
  if(!Array.isArray(data.teamWorkouts)||data.teamWorkouts.length>5000)throw Error('Invalid team workouts.');
  const workoutIds=new Set();for(const w of data.teamWorkouts){
   if(!w||typeof w.id!=='string'||!w.id||workoutIds.has(w.id)||typeof w.name!=='string'||!w.name.trim()||w.name.length>100||typeof w.date!=='string'||w.date.length!==10||normalizeDate(w.date)!==w.date||typeof w.workout!=='string'||!w.workout.trim()||w.workout.length>10000||typeof w.notes!=='string'||w.notes.length>2000||!Array.isArray(w.assignments)||w.assignments.length>5000)throw Error('Invalid team workout.');
   startTime(w.startTime);
   const assigned=new Set();for(const a of w.assignments){if(!a||!ids.has(a.athleteId)||assigned.has(a.athleteId)||typeof a.completed!=='boolean')throw Error('Invalid team workout assignment.');assigned.add(a.athleteId);}workoutIds.add(w.id);
  }
 }
 if(data.trainingBlocks!=null){
  if(!Array.isArray(data.trainingBlocks)||data.trainingBlocks.length>1000)throw Error('Invalid training blocks.');
  const blockIds=new Set();
  for(const b of data.trainingBlocks){
   if(!b||typeof b.id!=='string'||!b.id||blockIds.has(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!Number.isInteger(b.weeks)||b.weeks<3||b.weeks>51||b.weeks%3||typeof b.notes!=='string'||b.notes.length>2000||typeof b.startDate!=='string'||normalizeDate(b.startDate)!==b.startDate||b.startDate.length!==10||typeof b.endDate!=='string'||normalizeDate(b.endDate)!==b.endDate||b.endDate.length!==10)throw Error('Invalid training block.');
   const end=new Date(b.startDate+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+b.weeks*7-1);if(end.toISOString().slice(0,10)!==b.endDate)throw Error('Invalid training block date range.');
   if(!Array.isArray(b.athleteIds)||new Set(b.athleteIds).size!==b.athleteIds.length||b.athleteIds.some(id=>!ids.has(id)))throw Error('Invalid block athletes.');
   if(!Array.isArray(b.plan)||b.plan.length!==b.weeks||b.plan.some((w,i)=>!w||w.week!==i+1||typeof w.focus!=='string'||w.focus.length>200||typeof w.workouts!=='string'||w.workouts.length>4000))throw Error('Invalid weekly block plan.');
   blockIds.add(b.id);
  }
 }
 let changed=false;const normalize=r=>{if(!r)throw Error('Invalid performance record.');const date=normalizeDate(r.date);if(date===r.date)return r;changed=true;return {...r,date};};
 const normalized={...data,results:data.results.map(normalize),predictions:data.predictions.map(normalize)};
 const sessionIds=new Set();
 if(data.sessions!=null){
  if(!Array.isArray(data.sessions)||data.sessions.length>10000)throw Error('Invalid sessions.');
  for(const session of data.sessions){
   if(!session||typeof session.id!=='string'||!session.id||sessionIds.has(session.id)||typeof session.name!=='string'||!session.name.trim()||session.name.length>100||typeof session.notes!=='string'||session.notes.length>1000||!['Video','Gates','FAT','Hand','Unknown'].includes(session.method)||normalizeDate(session.date)!==session.date||session.date.length!==10)throw Error('Invalid training session.');
   startTime(session.startTime);
   if(session.efforts!=null){
    if(!Array.isArray(session.efforts)||session.efforts.length>500)throw Error('Invalid session efforts.');
    const effortsSeen=new Set(),validNumber=(n,min=0,max=86400)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
    for(const e of session.efforts){
     if(!e||typeof e.id!=='string'||!e.id||effortsSeen.has(e.id)||!ids.has(e.athleteId)||!Number.isInteger(e.repNumber)||e.repNumber<1||typeof e.notes!=='string'||e.notes.length>500||(e.restAfter!=null&&!validNumber(e.restAfter)))throw Error('Invalid session effort.');
     effortsSeen.add(e.id);
     if(e.event==='Tempo'){
      if((e.category!==undefined&&!['Extensive','Intensive'].includes(e.category))||!Number.isInteger(e.sets)||!validNumber(e.sets,1,20)||!Number.isInteger(e.repsPerSet)||!validNumber(e.repsPerSet,1,50)||e.sets*e.repsPerSet>200||!validNumber(e.distance,.01,5000)||!Array.isArray(e.times)||e.times.length!==e.sets*e.repsPerSet||e.times.some(t=>t!==null&&!validNumber(t,.01,3600))||(e.repRest!=null&&!validNumber(e.repRest))||(e.setRest!=null&&!validNumber(e.setRest))||(e.repsPerSet===1&&e.repRest!==null)||(e.sets===1&&e.setRest!==null)||e.runningDistance!==e.sets*e.repsPerSet*e.distance)throw Error('Invalid tempo effort.');
      const total=e.times.every(t=>t!==null)?e.times.reduce((n,t)=>n+t,0):null;
      if(total===null?e.runningTime!==null:!validNumber(e.runningTime,0,720000)||Math.abs(total-e.runningTime)>.001)throw Error('Invalid tempo running time.');
     }else if(e.event==='400 the hard way'){
      if(e.distance!==400||e.runningDistance!==700||e.walkingDistance!==300||!Array.isArray(e.segments)||e.segments.length!==7||e.segments.some((p,i)=>!p||p.distance!==100||p.walkBackDistance!==(i<6?50:0)||(p.time!=null&&!validNumber(p.time,.01,3600))||(i<6?p.walkBackTime!=null&&!validNumber(p.walkBackTime):p.walkBackTime!==null)))throw Error('Invalid 400 the hard way.');
      const total=e.segments.every(p=>p.time!=null)?e.segments.reduce((n,p)=>n+p.time,0):null;
      if(total===null?e.runningTime!==null:!validNumber(e.runningTime,0,25200)||Math.abs(total-e.runningTime)>.001)throw Error('Invalid hard-way running time.');
     }else if(e.event==='Sled push'){
      if(!validNumber(e.distance,.01,1000)||(e.time!=null&&!validNumber(e.time,.01,3600))||(e.load!=null&&!validNumber(e.load,0,5000))||!['lb','kg'].includes(e.loadUnit))throw Error('Invalid sled push.');
     }else if(e.event==='Wicket run'){
      if(!Number.isInteger(e.wicketCount)||!validNumber(e.wicketCount,2,100)||!validNumber(e.spacing,.01,20)||!['ft','m'].includes(e.spacingUnit)||!validNumber(e.wicketSpanMeters,0,2000)||(e.time!=null&&!validNumber(e.time,.01,3600)))throw Error('Invalid wicket run.');
      if(Math.abs(e.wicketSpanMeters-(e.wicketCount-1)*e.spacing*(e.spacingUnit==='ft'?.3048:1))>.001)throw Error('Invalid wicket spacing total.');
     }else if(['Broken 200m','Broken 300m','Broken 400m'].includes(e.event)){
      const target=Number(e.event.replace(/\D/g,''));
      if(!Array.isArray(e.segments)||e.segments.length<2||e.segments.length>4||e.distance!==target||e.segments.some((p,i)=>!p||!validNumber(p.distance,.01,target)||(p.time!=null&&!validNumber(p.time,.01,3600))||(i<e.segments.length-1&&!validNumber(p.rest)))||Math.abs(e.segments.reduce((n,p)=>n+p.distance,0)-target)>.001)throw Error('Invalid broken run.');
      const total=e.segments.every(p=>p.time!=null)?e.segments.reduce((n,p)=>n+p.time,0):null;
      if(total===null?e.runningTime!==null:!validNumber(e.runningTime,0,14400)||Math.abs(total-e.runningTime)>.001)throw Error('Invalid broken-run time total.');
     }else if(!['10m','20m','30m','55m','60m','100m','150m','200m','250m','300m','350m','400m','450m','500m','Fly 10m','Fly 20m','Fly 30m'].includes(e.event)||!validNumber(e.time,.01,3600))throw Error('Invalid continuous run.');
    }
   }
   sessionIds.add(session.id);
  }
 }
 for(const r of normalized.results){if(r.sessionId!=null&&(!sessionIds.has(r.sessionId)||typeof r.repId!=='string'||!r.repId||!Number.isInteger(r.repNumber)||r.repNumber<1||typeof r.isSplit!=='boolean'))throw Error('Invalid session-linked result.');}
 const seen=new Set();for(const r of [...normalized.results,...normalized.predictions]){if(!r||typeof r.id!=='string'||!r.id||seen.has(r.id)||!ids.has(r.athleteId)||!['10m','20m','30m','55m','60m','100m','150m','200m','250m','300m','350m','400m','450m','500m','Fly 10m','Fly 20m','Fly 30m'].includes(r.event)||typeof r.time!=='number'||!Number.isFinite(r.time)||r.time<=0||!/^(?:19|20)\d{2}(?:-\d{2}-\d{2})?$/.test(r.date)||!Number.isFinite(Date.parse(r.date)))throw Error('Invalid performance record.');seen.add(r.id);if(r.notes!=null&&(typeof r.notes!=='string'||r.notes.length>1000))throw Error('Invalid notes.');if(r.method!=null&&!['FAT','Gates','Hand','Video','Unknown'].includes(r.method))throw Error('Invalid timing method.');}
 return changed?normalized:data;
}
const api={startTime,formatStartTime,schedulingConflicts,predict,validateData,normalizeDate,formatDate,savedBest};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXT=api;
})(globalThis);
