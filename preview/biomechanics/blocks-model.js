(function(root){
'use strict';
const V=typeof module!=='undefined'&&module.exports?require('./model.js'):root.VXT;
function addDays(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return V.normalizeDate(d.toISOString().slice(0,10));}
function build(data,input,newId){
 data=V.validateData(data);
 const name=String(input.name||'').trim(),startDate=V.normalizeDate(input.startDate),weeks=Number(input.weeks),notes=String(input.notes||'').trim();
 if(!name||name.length>100)throw Error('Enter a block name (up to 100 characters).');
 if(startDate.length!==10)throw Error('Choose an exact start date.');
 if(!Number.isInteger(weeks)||weeks<3||weeks>51||weeks%3)throw Error('Choose 3 to 51 weeks in increments of 3.');
 const endDate=addDays(startDate,weeks*7-1);
 const athleteIds=input.athleteIds||[];
 if(!Array.isArray(athleteIds)||new Set(athleteIds).size!==athleteIds.length||athleteIds.some(id=>!data.athletes.some(a=>a.id===id)))throw Error('Choose athletes from the current roster.');
 if(notes.length>2000)throw Error('Block notes must be 2,000 characters or fewer.');
 if(!Array.isArray(input.plan)||input.plan.length!==weeks)throw Error('Each week needs a planning row.');
 const plan=input.plan.map((p,i)=>({week:i+1,focus:String(p.focus||'').trim(),workouts:String(p.workouts||'').trim()}));
 const existing=input.id?(data.trainingBlocks||[]).find(b=>b.id===input.id):null;
 if(input.id&&!existing)throw Error('This block is no longer available. Reopen it from saved blocks.');
 const block={id:existing?.id||newId(),name,startDate,endDate,weeks,athleteIds:[...athleteIds],notes,plan};
 const blocks=existing?data.trainingBlocks.map(b=>b.id===existing.id?block:b):[...(data.trainingBlocks||[]),block];
 return {data:V.validateData({...data,trainingBlocks:blocks}),blockId:block.id};
}
const api={build,addDays};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTBlocks=api;
})(globalThis);
