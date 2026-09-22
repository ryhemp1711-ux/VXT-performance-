const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const payload={version:1,athletes:[],results:[],predictions:[]};
function harness({confirm=true,row=null,rpcError=null,readError=null,users=['a','a']}={}){
 const elements=new Map(),events=new Map(),calls=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',addEventListener(type,fn){events.set(id+':'+type,fn);}});return elements.get(id);};
 const client={auth:{onAuthStateChange(){},async getSession(){return {data:{session:{user:{id:'a',email:'a@example.com'}}}};},async getUser(){return {data:{user:{id:users.shift()||'a',email:'a@example.com'}}};}},from(){return {select(){return {eq(){return {async maybeSingle(){return {data:row,error:readError};}};}};}};},async rpc(name,args){calls.push(['rpc',args]);return {data:2,error:rpcError};}};
 const context={document:{getElementById:element,querySelectorAll(){return [];},querySelector(){return element('tab');}},supabase:{createClient(){return client;}},VXT:require('../model.js'),VXTLocal:{snapshot(){return payload;},saveSafetyCopy(p){calls.push(['backup',p]);},replace(p){calls.push(['replace',p]);}},confirm(){return confirm;},location:{origin:'https://example.com',pathname:'/'}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../sync.js'),'utf8'),context);
 return {calls,async click(id){events.get(id+':click')();for(let i=0;i<30;i++)await Promise.resolve();return element('cloud-status').textContent;}};
}
test('first upload uses revision zero and preserves payload',async()=>{const h=harness();await h.click('cloud-upload');assert.equal(h.calls[0][0],'rpc');assert.equal(h.calls[0][1].p_expected_revision,0);assert.equal(h.calls[0][1].p_payload,payload);});
test('cancelled upload does not write or back up',async()=>{const h=harness({confirm:false});await h.click('cloud-upload');assert.equal(h.calls.length,0);});
test('replacing cloud backs up old copy and passes expected revision',async()=>{const h=harness({row:{payload,revision:7,updated_at:'2026-09-22'}});await h.click('cloud-upload');assert.equal(h.calls[0][0],'backup');assert.equal(h.calls[1][1].p_expected_revision,7);});
test('concurrent cloud change is reported, not retried or claimed successful',async()=>{const h=harness({rpcError:{message:'Cloud changed on another device'}});assert.match(await h.click('cloud-upload'),/Cloud changed/);assert.equal(h.calls.length,1);});
test('account switching during upload prevents write',async()=>{const h=harness({users:['a','b']});assert.match(await h.click('cloud-upload'),/Account changed/);assert.equal(h.calls.length,0);});
test('missing schema produces actionable setup message',async()=>{const h=harness({readError:{code:'PGRST205'}});assert.match(await h.click('cloud-upload'),/Database setup/);assert.equal(h.calls.length,0);});
test('download requires existing cloud copy and confirmation',async()=>{const h=harness();assert.match(await h.click('cloud-download'),/No cloud copy/);assert.equal(h.calls.length,0);const c=harness({row:{payload,revision:1},confirm:false});await c.click('cloud-download');assert.equal(c.calls.length,0);});
test('download validates cloud data before replacing local records',async()=>{const h=harness({row:{payload:{version:9},revision:1}});assert.match(await h.click('cloud-download'),/Not a VXT/);assert.equal(h.calls.length,0);});
test('confirmed download passes validated payload to local storage bridge',async()=>{const h=harness({row:{payload,revision:1}});await h.click('cloud-download');assert.equal(h.calls[0][0],'replace');assert.equal(h.calls[0][1],payload);});
