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
function validateData(data){
 if(!data||data.version!==1||!Array.isArray(data.athletes)||!Array.isArray(data.results)||!Array.isArray(data.predictions))throw Error('Not a VXT version 1 backup.');
 if(data.athletes.length>5000||data.results.length>100000||data.predictions.length>100000)throw Error('Backup is too large.');
 const ids=new Set();for(const a of data.athletes){if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>100)throw Error('Invalid athlete record.');ids.add(a.id);}
 let changed=false;const normalize=r=>{if(!r)throw Error('Invalid performance record.');const date=normalizeDate(r.date);if(date===r.date)return r;changed=true;return {...r,date};};
 const normalized={...data,results:data.results.map(normalize),predictions:data.predictions.map(normalize)};
 const seen=new Set();for(const r of [...normalized.results,...normalized.predictions]){if(!r||typeof r.id!=='string'||!r.id||seen.has(r.id)||!ids.has(r.athleteId)||!['10m','20m','30m','55m','60m','100m','150m','200m','300m','400m','Fly 10m','Fly 20m','Fly 30m'].includes(r.event)||typeof r.time!=='number'||!Number.isFinite(r.time)||r.time<=0||!/^(?:19|20)\d{2}(?:-\d{2}-\d{2})?$/.test(r.date)||!Number.isFinite(Date.parse(r.date)))throw Error('Invalid performance record.');seen.add(r.id);if(r.notes!=null&&(typeof r.notes!=='string'||r.notes.length>1000))throw Error('Invalid notes.');if(r.method!=null&&!['FAT','Gates','Hand','Video','Unknown'].includes(r.method))throw Error('Invalid timing method.');}
 return changed?normalized:data;
}
const api={predict,validateData,normalizeDate,formatDate,savedBest};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXT=api;
})(globalThis);
