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
const {createSupabaseAdapters}=require('../server/adapters.cjs');
const {createReviewer,validateReview}=require('../server/review.cjs');
test('review rejects stale snapshots and missing pilot access before model call',async()=>{
 let calls=0;
 const base={authenticate:async()=>({id:'owner'}),readWorkspace:async()=>row,review:async()=>{calls++;return {};}};
 const handler=createCoachHandler(base);
 assert.equal((await handler(req({athleteId:'a',action:'review',expectedRevision:1}))).status,409);
 assert.equal((await handler(req({athleteId:'a',action:'review',expectedRevision:2}))).status,429);
 assert.equal(calls,0);
 const enabled=createCoachHandler({...base,allowReview:()=>true});
 assert.equal((await enabled(req({athleteId:'a',action:'review',expectedRevision:2}))).status,200);
 assert.equal(calls,1);
});
test('review stays unavailable without provider and rejects unknown actions',async()=>{
 const handler=createCoachHandler({authenticate:async()=>({id:'owner'}),readWorkspace:async()=>row});
 assert.equal((await handler(req({athleteId:'a',action:'review',expectedRevision:2}))).status,503);
 assert.equal((await handler(req({athleteId:'a',action:'save'}))).status,400);
});
test('Supabase adapters verify against auth and carry caller token into owner-scoped reads',async()=>{
 const calls=[];const adapters=createSupabaseAdapters({url:'https://project.supabase.co',publishableKey:'public-key',fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.includes('/user')?{id:'owner'}:[row]),{status:200});}});
 assert.equal((await adapters.authenticate('caller-token')).id,'owner');
 assert.equal((await adapters.readWorkspace('caller-token','owner')).user_id,'owner');
 assert.ok(calls[0].url.endsWith('/auth/v1/user'));
 assert.equal(new URL(calls[1].url).searchParams.get('user_id'),'eq.owner');
 assert.equal(calls[1].options.headers.Authorization,'Bearer caller-token');
 assert.equal(calls[1].options.headers.apikey,'public-key');
});
test('review validator rejects fabricated references and empty evidence',()=>{
 const context={results:[{id:'real'}]};
 assert.throws(()=>validateReview({summary:'Review',observations:[{text:'Claim',resultIds:['fake']}],questions:[]},context));
 assert.throws(()=>validateReview({summary:'Review',observations:[{text:'Claim',resultIds:[]}],questions:[]},context));
});
test('provider uses structured output, disables response storage and validates evidence',async()=>{
 let body;
 const value={summary:'One recorded result.',observations:[{text:'Recorded result.',resultIds:['r1']}],questions:['How do you feel today?']};
 const reviewer=createReviewer({apiKey:'test-key',model:'test-model',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');body=JSON.parse(options.body);return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));}});
 assert.deepEqual(await reviewer({results:[{id:'r1'}]}),value);
 assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
 assert.equal(createReviewer({}),null);
});
test('provider refusal and incomplete output fail closed',async()=>{
 for(const response of [{status:'incomplete'},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}]){
 const review=createReviewer({apiKey:'test',model:'test',fetchImpl:async()=>new Response(JSON.stringify(response))});
 await assert.rejects(review({results:[]}));
 }
});
