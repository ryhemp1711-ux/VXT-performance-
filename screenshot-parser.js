(function(root){
'use strict';
const events=['10m','20m','30m','55m','60m','100m','150m','200m','250m','300m','350m','400m','450m','500m','Fly 10m','Fly 20m','Fly 30m'];
function parse(text){
 const rows=[];let event='';
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();const heading=line.match(/^(\d{2,3})\s*(?:meters?|metres?|m)\s*$/i);
  if(heading){event=events.includes(heading[1]+'m')?heading[1]+'m':'';continue;}
  const season=line.match(/\b((?:19|20)\d{2})\s+(Indoor|Outdoor)\b/i);
  if(!season||!event)continue;
  const remainder=line.slice(season.index+season[0].length);
  // Grade is an integer or Sr; result is the first decimal/clock time after it.
  const timeMatch=remainder.match(/^\s*(?:\d{1,2}|Sr|Jr|Fr|So)\s+(?:(\d{1,2}):)?(\d{1,3}[.,]\d{1,3})\b/i);
  if(!timeMatch)continue;
  const time=Number(timeMatch[1]||0)*60+Number(timeMatch[2].replace(',','.'));
  const wind=remainder.slice(timeMatch.index+timeMatch[0].length).match(/\(([+-]?\d+(?:[.,]\d+)?)\)/);
  rows.push({event,time,date:season[1],method:'Unknown',notes:`Screenshot season record: ${season[1]} ${season[2]}. Exact race date and timing method not supplied.`+(wind?` Wind: ${wind[1].replace(',','.')} m/s.`:''),source:line});
 }
 return rows;
}
function merge(data,athleteId,rows,id){
 if(!data.athletes.some(a=>a.id===athleteId))throw Error('Choose an existing athlete.');
 const results=[...data.results];let added=0,duplicates=0;
 for(const row of rows){
  if(results.some(r=>r.athleteId===athleteId&&r.event===row.event&&r.date===row.date&&r.time===row.time&&(r.method||'Unknown')===row.method&&r.notes===row.notes)){duplicates++;continue;}
  results.push({...row,id:id(),athleteId});added++;
 }
 return {data:{...data,results},added,duplicates};
}
const api={parse,merge,events};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTScreenshot=api;
})(globalThis);
