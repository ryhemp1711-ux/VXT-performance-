const {test}=require('node:test');const assert=require('node:assert/strict');const S=require('../sessions-model.js'),V=require('../model.js');
const base=()=>({version:1,athletes:[{id:'a',name:'A'},{id:'b',name:'B'}],results:[],predictions:[]});const details={name:'Group practice',date:'09/22/2026',method:'Video',notes:'Dry track'};
const rep={athleteId:'a',event:'60m',time:7.88,splits:{10:1.99,20:3.22,30:4.38}};const id=()=>{let i=0;return()=>String(++i);};
test('group session adds linked cumulative splits and finish times without mutating existing data',()=>{const data=base();const r=S.build(data,details,[rep,{...rep,athleteId:'b'},rep],id());assert.equal(r.reps,3);assert.equal(r.athletes,2);assert.equal(r.records,12);assert.equal(data.results.length,0);assert.equal(r.data.results[8].repNumber,2);assert.equal(new Set(r.data.results.slice(0,4).map(x=>x.repId)).size,1);assert.deepEqual(r.data.results.slice(0,4).map(x=>x.isSplit),[true,true,true,false]);assert.equal(r.data.sessions[0].date,'2026-09-22');assert.equal(V.savedBest(r.data.results,'a','30m').time,4.38);});
test('split and finish ordering must be strictly increasing',()=>{for(const splits of [{10:2,20:1.5},{30:8},{10:-1},{10:2,20:2}])assert.throws(()=>S.build(base(),details,[{...rep,splits}],id()));});
test('flying efforts become Fly events and cannot include standing splits',()=>{const fly={athleteId:'a',event:'Fly 20m',time:2.3};const r=S.build(base(),details,[fly],id());assert.equal(V.savedBest(r.data.results,'a','Fly 20m').time,2.3);assert.equal(V.savedBest(r.data.results,'a','20m'),null);assert.throws(()=>S.build(base(),details,[{...fly,splits:{10:1.2}}],id()));});
test('partial reps allowed but missing finish, empty sessions and orphan athletes rejected',()=>{assert.equal(S.build(base(),details,[{...rep,splits:{}}],id()).records,1);for(const reps of [[],[{...rep,time:''}],[{...rep,athleteId:'missing'}],[{...rep,splits:{60:7.5}}]])assert.throws(()=>S.build(base(),details,reps,id()));});
test('one invalid row prevents any partial additions',()=>{const data=base();assert.throws(()=>S.build(data,details,[rep,{...rep,time:-1}],id()));assert.equal(data.results.length,0);assert.equal(data.sessions,undefined);});
test('session metadata and rep links survive JSON backup and validation',()=>{const r=S.build(base(),details,[rep],id());const restored=V.validateData(JSON.parse(JSON.stringify(r.data)));assert.deepEqual(restored,r.data);assert.throws(()=>V.validateData({...restored,sessions:[]}));});
test('session date must include month/day and name is required',()=>{assert.throws(()=>S.build(base(),{...details,date:'2026'},[rep],id()));assert.throws(()=>S.build(base(),{...details,name:' '},[rep],id()));});
test('added distances save as continuous results',()=>{for(const event of ['250m','300m','350m','450m','500m']){const r=S.build(base(),details,[{athleteId:'a',event,time:60}],id());assert.equal(r.data.results[0].event,event);V.validateData(JSON.parse(JSON.stringify(r.data)));}});
test('sled push and wickets retain settings and rest without creating race results',()=>{const r=S.build(base(),details,[{athleteId:'a',event:'Sled push',distance:20,load:90,loadUnit:'lb',time:5.2,restAfter:180},{athleteId:'b',event:'Wicket run',wicketCount:10,spacing:6.75,spacingUnit:'ft',restAfter:120}],id());assert.equal(r.records,0);assert.equal(r.data.sessions[0].efforts.length,2);assert.equal(r.data.sessions[0].efforts[0].load,90);assert.ok(Math.abs(r.data.sessions[0].efforts[1].wicketSpanMeters-18.5166)<1e-8);assert.equal(r.data.sessions[0].efforts[1].restAfter,120);V.validateData(JSON.parse(JSON.stringify(r.data)));});
test('four broken segments total distance and running time excluding rest',()=>{const r=S.build(base(),details,[{athleteId:'a',event:'Broken 400m',segments:[{distance:150,time:20,rest:60},{distance:100,time:14,rest:45},{distance:100,time:15,rest:30},{distance:50,time:8}],restAfter:300}],id());const e=r.data.sessions[0].efforts[0];assert.equal(e.distance,400);assert.equal(e.runningTime,57);assert.equal(e.restAfter,300);assert.equal(r.records,0);V.validateData(JSON.parse(JSON.stringify(r.data)));});
test('broken run permits untimed segments with explicit rest including zero',()=>{const r=S.build(base(),details,[{athleteId:'a',event:'Broken 200m',segments:[{distance:120,rest:0},{distance:80}]}],id());assert.equal(r.data.sessions[0].efforts[0].runningTime,null);});
test('broken wrong total, missing rest, negative rest and too many segments rejected',()=>{const bad=[[{distance:100,rest:30},{distance:50}],[{distance:100},{distance:100}],[{distance:100,rest:-1},{distance:100}],Array.from({length:5},()=>({distance:40,rest:30}))];for(const segments of bad)assert.throws(()=>S.build(base(),details,[{athleteId:'a',event:'Broken 200m',segments}],id()));});
test('invalid wicket count/spacing, sled distance and rest rejected',()=>{for(const rep of [{athleteId:'a',event:'Wicket run',wicketCount:1,spacing:6},{athleteId:'a',event:'Wicket run',wicketCount:3.5,spacing:6},{athleteId:'a',event:'Wicket run',wicketCount:10,spacing:0},{athleteId:'a',event:'Sled push',distance:''},{athleteId:'a',event:'500m',time:80,restAfter:-1}])assert.throws(()=>S.build(base(),details,[rep],id()));});
test('400 the hard way saves seven runs with six walk-backs and no race results',()=>{
 const segments=Array.from({length:7},()=>({time:15,walkBackTime:45}));
 const r=S.build(base(),details,[{athleteId:'a',event:'400 the hard way',segments,restAfter:300}],id());
 const e=r.data.sessions[0].efforts[0];
 assert.equal(e.runningDistance,700);assert.equal(e.walkingDistance,300);assert.equal(e.distance,400);assert.equal(e.runningTime,105);
 assert.equal(e.segments.reduce((n,p)=>n+p.distance-p.walkBackDistance,0),400);
 assert.equal(e.segments[6].walkBackDistance,0);assert.equal(e.segments[6].walkBackTime,null);
 assert.equal(r.records,0);assert.equal(V.savedBest(r.data.results,'a','400m'),null);
 assert.deepEqual(V.validateData(JSON.parse(JSON.stringify(r.data))),r.data);
});
test('hard-way untimed runs survive backups and partial times do not create a total',()=>{
 for(const segments of [Array.from({length:7},()=>({})),Array.from({length:7},(_,i)=>({time:i?15:'',walkBackTime:0}))]){
  const r=S.build(base(),details,[{athleteId:'a',event:'400 the hard way',segments}],id());
  assert.equal(r.data.sessions[0].efforts[0].runningTime,null);V.validateData(JSON.parse(JSON.stringify(r.data)));
 }
});
test('hard-way invalid times, incomplete structure and corrupt backup totals are rejected',()=>{
 const rep={athleteId:'a',event:'400 the hard way',segments:Array.from({length:7},()=>({time:15,walkBackTime:45}))};
 for(const segments of [rep.segments.slice(1),rep.segments.map((p,i)=>i?p:{time:-1}),rep.segments.map((p,i)=>i?p:{walkBackTime:-1})])assert.throws(()=>S.build(base(),details,[{...rep,segments}],id()));
 const r=S.build(base(),details,[rep],id());
 for(const key of ['distance','runningDistance','walkingDistance','runningTime']){const bad=JSON.parse(JSON.stringify(r.data));bad.sessions[0].efforts[0][key]++;assert.throws(()=>V.validateData(bad));}
 const bad=JSON.parse(JSON.stringify(r.data));bad.sessions[0].efforts[0].segments[6].walkBackDistance=50;assert.throws(()=>V.validateData(bad));
});
