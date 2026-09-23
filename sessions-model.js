(function(root){
'use strict';
const V=typeof module!=='undefined'&&module.exports?require('./model.js'):root.VXT;
const events=['10m','20m','30m','55m','60m','100m','150m','200m','300m','400m','Fly 10m','Fly 20m','Fly 30m'];
function build(data,details,reps,newId){
 data=V.validateData(data);
 const name=String(details.name||'').trim(),date=V.normalizeDate(details.date),notes=String(details.notes||'').trim();
 if(!name||name.length>100)throw Error('Enter a session name (up to 100 characters).');
 if(date.length!==10)throw Error('A training session needs an exact date.');
 if(notes.length>1000)throw Error('Session notes must be under 1,001 characters.');
 if(!['Video','Gates','FAT','Hand','Unknown'].includes(details.method))throw Error('Choose a timing method.');
 if(!Array.isArray(reps)||!reps.length||reps.length>500)throw Error('Add between 1 and 500 reps.');
 const sessionId=newId(),results=[],counts=new Map();
 for(const [index,rep] of reps.entries()){
  const prefix='Row '+(index+1)+': ';
  if(!data.athletes.some(a=>a.id===rep.athleteId))throw Error(prefix+'choose an athlete from the roster.');
  if(!events.includes(rep.event))throw Error(prefix+'choose a supported event.');
  const final=Number(rep.time);if(!Number.isFinite(final)||final<=0||final>3600)throw Error(prefix+'enter a finish time between 0 and 3,600 seconds.');
  const fly=rep.event.startsWith('Fly '),distance=Number(rep.event.replace(/\D/g,'')),points=[];
  for(const split of [10,20,30,60]){
   const value=rep.splits?.[split];if(value==null||String(value).trim()==='')continue;
   if(fly||split>=distance)throw Error(prefix+'only enter splits before the finish of a standing-start run.');
   const time=Number(value);if(!Number.isFinite(time)||time<=0)throw Error(prefix+split+'m split must be positive.');points.push({event:split+'m',time});
  }
  points.push({event:rep.event,time:final});
  if(points.some((p,i)=>i>0&&p.time<=points[i-1].time))throw Error(prefix+'cumulative splits must increase and finish before the total time.');
  const repId=newId(),repNumber=(counts.get(rep.athleteId)||0)+1;counts.set(rep.athleteId,repNumber);
  const resultNotes=`Session: ${name}. Rep ${repNumber}. ${fly?'Flying effort after a run-in.':'Standing start; cumulative times from the same run.'} ${String(rep.notes||'').trim()}`.trim();
  if(resultNotes.length>1000)throw Error(prefix+'shorten the rep notes.');
  for(const [i,p] of points.entries())results.push({id:newId(),athleteId:rep.athleteId,event:p.event,time:p.time,date,method:details.method,notes:resultNotes,sessionId,repId,repNumber,repEvent:rep.event,isSplit:i<points.length-1});
 }
 const next={...data,sessions:[...(data.sessions||[]),{id:sessionId,name,date,notes,method:details.method}],results:[...data.results,...results]};
 return {data:V.validateData(next),sessionId,reps:reps.length,records:results.length,athletes:counts.size};
}
const api={build,events};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTSessions=api;
})(globalThis);
