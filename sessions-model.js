(function(root){
'use strict';
const V=typeof module!=='undefined'&&module.exports?require('./model.js'):root.VXT;
const raceEvents=['10m','20m','30m','55m','60m','100m','150m','200m','250m','300m','350m','400m','450m','500m','Fly 10m','Fly 20m','Fly 30m'];
const events=[...raceEvents,'Sled push','Wicket run','Broken 200m','Broken 300m','Broken 400m'];
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
 const sessionId=newId(),results=[],efforts=[],counts=new Map();
 for(const [index,rep] of reps.entries()){
  const prefix='Row '+(index+1)+': ';
  if(!data.athletes.some(a=>a.id===rep.athleteId))throw Error(prefix+'choose an athlete from the roster.');
  if(!events.includes(rep.event))throw Error(prefix+'choose a supported event.');
  const repId=newId(),repNumber=(counts.get(rep.athleteId)||0)+1;counts.set(rep.athleteId,repNumber);
  const effort={id:repId,athleteId:rep.athleteId,repNumber,event:rep.event,notes:String(rep.notes||'').trim(),restAfter:number(rep.restAfter,prefix+'rest after rep (seconds)',{max:86400})};
  if(effort.notes.length>500)throw Error(prefix+'rep notes must be 500 characters or fewer.');
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
 const next={...data,sessions:[...(data.sessions||[]),{id:sessionId,name,date,notes,method:details.method,efforts}],results:[...data.results,...results]};
 return {data:V.validateData(next),sessionId,reps:reps.length,records:results.length,athletes:counts.size};
}
const api={build,events,raceEvents};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTSessions=api;
})(globalThis);
