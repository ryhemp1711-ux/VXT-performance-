const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildContext,createCoachHandler} = require('../server/coach.cjs');
const row = {user_id:'owner',revision:2,updated_at:'2026-10-05',payload:{athletes:[{id:'a',name:'Private Name',profile:{birthYear:'2016',events:'100m',notes:'Private note'}},{id:'b'}],results:[
 {id:'r1',athleteId:'a',date:'2026-10-01',event:'60m',time:9,method:'Hand'},
 {id:'r2',athleteId:'b',date:'2026-10-01',time:8},
 {id:'r3',athleteId:'a',date:'2027-10-01',time:8},
 {id:'r4',athleteId:'a',date:'2026',time:8}],sessions:[{id:'s',date:'2026-10-01',efforts:[{athleteId:'a',event:'60m',time:9},{athleteId:'b',time:8}]}]}};
test('context isolates athletes, removes identity/free text, preserves timing provenance and excludes ambiguous/future dates',()=>{
 const c = buildContext(row,'a','2026-10-05');
 assert.deepEqual(c.results.map(r=>r.id),['r1']);
 assert.equal(c.results[0].method,'Hand');
 assert.equal(c.sessions[0].efforts.length,1);
 assert.ok(!JSON.stringify(c).includes('Private'));
 assert.ok(c.missing.includes('goals'));
});
const req = (body={athleteId:'a'},auth=true) => new Request('https://example.test/coach',{method:'POST',headers:auth?{Authorization:'Bearer token'}:{},body:JSON.stringify(body)});
test('unauthenticated requests never read a workspace',async()=>{
 const handler=createCoachHandler({authenticate:async()=>null,readWorkspace:()=>assert.fail('read')});
 assert.equal((await handler(req({},false))).status,401);
 assert.equal((await handler(req())).status,401);
});
test('owner boundary, untrusted payloads, missing athletes, and safe incomplete response',async()=>{
 let source=row;
 const handler=createCoachHandler({authenticate:async()=>({id:'owner'}),readWorkspace:async(token,id)=>{assert.equal(token,'token');assert.equal(id,'owner');return source;}});
 assert.equal((await handler(req({athleteId:'a',workspace:row}))).status,400);
 assert.equal((await handler(req({athleteId:'unknown'}))).status,404);
 source={...row,user_id:'someone-else'};
 assert.equal((await handler(req())).status,404);
 source=row;
 const body=await (await handler(req())).json();
 assert.equal(body.recommendation,null);
 assert.equal(body.requiresCoachApproval,true);
 assert.equal(body.status,'needs_information');
});
test('oversized requests and internal errors do not leak records or secrets',async()=>{
 const handler=createCoachHandler({authenticate:async()=>({id:'owner'}),readWorkspace:async()=>{throw Error('secret');}});
 assert.equal((await handler(req({athleteId:'a'.repeat(3000)}))).status,413);
 const response=await handler(req());
 assert.equal(response.status,503);
 assert.ok(!(await response.text()).includes('secret'));
});
