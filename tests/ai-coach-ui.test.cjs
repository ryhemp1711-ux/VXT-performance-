const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(){
 const nodes=new Map(),events=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='active-athlete'?'a':'',checked:false,disabled:false,textContent:'',children:[],addEventListener(t,fn){events.set(id+':'+t,fn);},replaceChildren(){this.children=[];},append(x){this.children.push(x);}});return nodes.get(id);};
 let resolve;
 const context={document:{getElementById:el,createElement:()=>({}),addEventListener:(t,fn)=>events.set(t,fn)},VXTCoachConfig:{endpoint:'https://example.test/api/coach'},VXTCloud:{coachSession:async()=>({token:'token',userId:'owner'})},location:{href:'https://example.test/'},URL,AbortSignal,fetch:()=>new Promise(r=>{resolve=r;})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../ai-coach.js'),'utf8'),context);
 return {el,events,context,respond:()=>resolve({ok:true,json:async()=>({context:{cloudRevision:1,results:[],missing:[],limitations:[]}})})};
}
test('coach requires consent and suppresses stale response after switching athlete',async()=>{
 const h=harness();assert.equal(h.el('ai-coach-review').disabled,true);
 const running=h.events.get('ai-coach-load:click')();await new Promise(r=>setImmediate(r));
 h.el('active-athlete').value='b';h.events.get('vxt-coach-reset')();h.respond();await running;
 assert.equal(h.el('ai-coach-output').children.length,0);assert.equal(h.el('ai-coach-review').disabled,true);
});
test('coach evidence remains read-only and AI review requires explicit consent',async()=>{
 const h=harness();const running=h.events.get('ai-coach-load:click')();await new Promise(r=>setImmediate(r));h.respond();await running;
 assert.ok(h.el('ai-coach-output').children.length>0);assert.equal(h.el('ai-coach-review').disabled,true);
 h.el('ai-coach-consent').checked=true;h.events.get('ai-coach-consent:change')();assert.equal(h.el('ai-coach-review').disabled,false);
 h.events.get('vxt-auth-changed')();assert.equal(h.el('ai-coach-output').children.length,0);assert.equal(h.el('ai-coach-consent').checked,false);
});
