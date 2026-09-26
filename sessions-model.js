(function(root){
'use strict';
const V=typeof module!=='undefined'&&module.exports?require('./model.js'):root.VXT;
const raceEvents=['10m','20m','30m','55m','60m','100m','150m','200m','250m','300m','350m','400m','450m','500m','Fly 10m','Fly 20m','Fly 30m'];
const events=[...raceEvents,'Sled push','Wicket run','Tempo','400 the hard way','Broken 200m','Broken 300m','Broken 400m'];
const optional=(v)=>v==null||String(v).trim()==='';
function number(v,label,{min=0,max=3600,required=false,integer=false}={}){
 if(optional(v)){if(required)throw Error(label+' is required.');return null;}
 const n=Number(v);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error(label+` must be ${integer?'a whole number ':''}between ${min} and ${max}.`);return n;
}
function build(data,details,reps,newId){
 data=V.validateData(data);
 const name=String(details.name||'').trim(),date=V.normalizeDate(details.date),notes=String(details.notes||'').trim();
 if(!name||name.length>100)throw Error('Enter a session name (up to 100 characters).');
 if(date.length!==10)throw Error('A training session needs an exact date.');
 if(notes.length>1000)throw Error('Session notes must be under 1,001 characters.');
 if(!['Video','Gates','FAT','Hand','Unknown'].includes(details.method))throw Error('Choose a timing method.');
 if(!Array.isArray(reps)||!reps.length||reps.length>500)throw Error('Add between 1 and 500 reps.');
 const overlaps=V.schedulingConflicts(data,{date,athleteIds:reps.map(r=>r.athleteId)});
 let skipped=0;
 if(overlaps.length){
  if(!['skip','include'].includes(details.conflictPolicy))throw Error('Scheduling conflicts found. Choose Skip conflicting athletes or Include anyway before saving.');
  if(details.conflictPolicy==='skip'){skipped=overlaps.length;reps=reps.filter(r=>!overlaps.some(c=>c.athleteId===r.athleteId));}
  if(!reps.length)throw Error('All selected athletes have scheduling conflicts. Nothing was saved. Select other athletes or choose Include anyway.');
 }
 const startTime=V.startTime(details.startTime);
 const sessionId=newId(),results=[],efforts=[],counts=new Map();
 for(const [index,rep] of reps.entries()){
  const prefix='Row '+(index+1)+': ';
  if(!data.athletes.some(a=>a.id===rep.athleteId))throw Error(prefix+'choose an athlete from the roster.');
  if(!events.includes(rep.event))throw Error(prefix+'choose a supported event.');
  const repId=newId(),repNumber=(counts.get(rep.athleteId)||0)+1;counts.set(rep.athleteId,repNumber);
  const effort={id:repId,athleteId:rep.athleteId,repNumber,event:rep.event,notes:String(rep.notes||'').trim(),restAfter:number(rep.restAfter,prefix+'rest after rep (seconds)',{max:86400})};
  if(effort.notes.length>500)throw Error(prefix+'rep notes must be 500 characters or fewer.');
  if(rep.event==='Tempo'){
   effort.category=rep.category||'Extensive';if(!['Extensive','Intensive'].includes(effort.category))throw Error(prefix+'choose Extensive or Intensive tempo.');
   effort.sets=number(rep.sets,prefix+'tempo sets',{min:1,max:20,required:true,integer:true});
   effort.repsPerSet=number(rep.repsPerSet,prefix+'tempo reps per set',{min:1,max:50,required:true,integer:true});
   const count=effort.sets*effort.repsPerSet;if(count>200)throw Error(prefix+'tempo is limited to 200 runs per entry.');
   effort.distance=number(rep.tempoDistance,prefix+'tempo distance (meters)',{min:.01,max:5000,required:true});
   effort.repRest=effort.repsPerSet>1?number(rep.repRest,prefix+'rest between tempo reps',{max:86400}):null;
   effort.setRest=effort.sets>1?number(rep.setRest,prefix+'rest between tempo sets',{max:86400}):null;
   if(!Array.isArray(rep.times)||rep.times.length!==count)throw Error(prefix+'tempo times must match sets and reps.');
   effort.times=rep.times.map((t,i)=>number(t,prefix+`tempo run ${i+1} time`,{min:.01}));
   effort.runningDistance=count*effort.distance;
   effort.runningTime=effort.times.every(t=>t!==null)?effort.times.reduce((n,t)=>n+t,0):null;
   efforts.push(effort);continue;
  }
  if(rep.event==='400 the hard way'){
   if(!Array.isArray(rep.segments)||rep.segments.length!==7)throw Error(prefix+'enter seven 100m runs.');
   effort.distance=400;effort.runningDistance=700;effort.walkingDistance=300;
   effort.segments=rep.segments.map((part,i)=>({distance:100,time:number(part.time,prefix+`run ${i+1} time`,{min:.01}),walkBackDistance:i<6?50:0,walkBackTime:i<6?number(part.walkBackTime,prefix+`walk-back ${i+1} time`,{max:86400}):null}));
   effort.runningTime=effort.segments.every(p=>p.time!==null)?effort.segments.reduce((n,p)=>n+p.time,0):null;
   efforts.push(effort);continue;
  }
  if(rep.event.startsWith('Broken ')){
   const total=Number(rep.event.replace(/\D/g,''));
   if(!Array.isArray(rep.segments)||rep.segments.length<2||rep.segments.length>4)throw Error(prefix+'enter 2 to 4 broken-run segments.');
   effort.segments=rep.segments.map((part,i)=>({distance:number(part.distance,prefix+`segment ${i+1} distance`,{min:.01,max:total,required:true}),time:number(part.time,prefix+`segment ${i+1} time`,{min:.01}),rest:i===rep.segments.length-1?null:number(part.rest,prefix+`rest after segment ${i+1} (seconds)`,{max:86400,required:true})}));
   const sum=effort.segments.reduce((n,p)=>n+p.distance,0);if(Math.abs(sum-total)>.001)throw Error(prefix+`segments total ${sum}m; they must equal ${total}m.`);
   effort.distance=total;effort.runningTime=effort.segments.every(p=>p.time!==null)?effort.segments.reduce((n,p)=>n+p.time,0):null;
   efforts.push(effort);continue;
  }
  if(rep.event==='Sled push'){
   effort.distance=number(rep.distance,prefix+'push distance (meters)',{min:.01,max:1000,required:true});effort.time=number(rep.time,prefix+'push time (seconds)',{min:.01});
   effort.load=number(rep.load,prefix+'sled load',{max:5000});effort.loadUnit=rep.loadUnit||'lb';if(!['lb','kg'].includes(effort.loadUnit))throw Error(prefix+'choose lb or kg.');
   efforts.push(effort);continue;
  }
  if(rep.event==='Wicket run'){
   effort.wicketCount=number(rep.wicketCount,prefix+'number of wickets',{min:2,max:100,required:true,integer:true});
   effort.spacing=number(rep.spacing,prefix+'distance between wickets',{min:.01,max:20,required:true});effort.spacingUnit=rep.spacingUnit||'ft';if(!['ft','m'].includes(effort.spacingUnit))throw Error(prefix+'choose feet or meters.');
   effort.wicketSpanMeters=(effort.wicketCount-1)*effort.spacing*(effort.spacingUnit==='ft'?.3048:1);
   effort.time=number(rep.time,prefix+'wicket run time (seconds)',{min:.01});efforts.push(effort);continue;
  }
  const final=number(rep.time,prefix+'finish time (seconds)',{min:.01,required:true});
  const fly=rep.event.startsWith('Fly '),distance=Number(rep.event.replace(/\D/g,'')),points=[];
  for(const split of [10,20,30,60]){
   const value=rep.splits?.[split];if(optional(value))continue;
   if(fly||split>=distance)throw Error(prefix+'only enter splits before the finish of a standing-start run.');
   points.push({event:split+'m',time:number(value,prefix+split+'m split',{min:.01,required:true})});
  }
  points.push({event:rep.event,time:final});if(points.some((p,i)=>i>0&&p.time<=points[i-1].time))throw Error(prefix+'cumulative splits must increase and finish before the total time.');
  effort.time=final;effort.distance=distance;efforts.push(effort);
  const resultNotes=`Session: ${name}. Rep ${repNumber}. ${fly?'Flying effort after a run-in.':'Standing start; cumulative times from the same run.'} ${effort.notes}`.trim();
  for(const [i,p] of points.entries())results.push({id:newId(),athleteId:rep.athleteId,event:p.event,time:p.time,date,method:details.method,notes:resultNotes,sessionId,repId,repNumber,repEvent:rep.event,isSplit:i<points.length-1});
 }
 const next={...data,sessions:[...(data.sessions||[]),{id:sessionId,name,date,startTime,notes,method:details.method,efforts}],results:[...data.results,...results]};
 return {data:V.validateData(next),sessionId,reps:reps.length,records:results.length,athletes:counts.size,skipped};
}
function remove(data,id,removeResults=false){
 data=V.validateData(data);if(!data.sessions?.some(s=>s.id===id))throw Error('This session is no longer available.');
 if(typeof removeResults!=='boolean')throw Error('Choose whether to remove results.');
 const results=data.results.flatMap(r=>{if(r.sessionId!==id)return [r];if(removeResults)return [];const {sessionId,repId,repNumber,repEvent,isSplit,...record}=r;return [record];});
 return V.validateData({...data,sessions:data.sessions.filter(s=>s.id!==id),results});
}
const api={remove,build,events,raceEvents};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTSessions=api;
})(globalThis);
