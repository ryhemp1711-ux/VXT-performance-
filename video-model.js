(function(root){
'use strict';
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
function metrics(r){
 if(!finite(r.start,0,86400)||!finite(r.end,0,86400)||r.end<=r.start)throw Error('Mark an end after the start.');
 if(!Number.isInteger(r.wicketCount)||r.wicketCount<2||r.wicketCount>100||!Number.isInteger(r.fromWicket)||!Number.isInteger(r.toWicket)||r.fromWicket<1||r.toWicket>r.wicketCount||r.toWicket<=r.fromWicket)throw Error('Choose increasing wicket numbers within the run.');
 if(!finite(r.spacing,0.1,10)||!['ft','m'].includes(r.unit))throw Error('Enter valid wicket spacing.');
 if(typeof r.realTime!=='boolean')throw Error('Confirm the recording time basis.');
 const elapsed=r.end-r.start,distance=(r.toWicket-r.fromWicket)*r.spacing*(r.unit==='ft'?0.3048:1);
 return {elapsed,distance,mps:r.realTime?distance/elapsed:null,mph:r.realTime?distance/elapsed*2.2369362921:null};
}
function validate(r,athletes){
 if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||!athletes.has(r.athleteId))throw Error('Choose an existing athlete for the video review.');
 for(const [key,max,required] of [['title',100,true],['notes',4000,false],['lane',20,false]])if(typeof r[key]!=='string'||r[key].length>max||(required&&!r[key].trim()))throw Error('Invalid video review '+key+'.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date)throw Error('Choose a valid review date.');
 const s=r.source;
 if(!s||typeof s.name!=='string'||!s.name||s.name.length>255||!finite(s.size,1,Number.MAX_SAFE_INTEGER)||!Number.isInteger(s.size)||!finite(s.lastModified,0,Number.MAX_SAFE_INTEGER)||!finite(s.duration,0.001,86400))throw Error('Invalid video source.');
 if(!finite(r.fps,1,240)||r.end>s.duration+0.001)throw Error('Invalid seek rate or markers outside the video.');
 metrics(r);return r;
}
function sameSource(a,b){return !!a&&!!b&&a.name===b.name&&a.size===b.size&&a.lastModified===b.lastModified;}
const api={metrics,validate,sameSource};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTVideo=api;
})(globalThis);
