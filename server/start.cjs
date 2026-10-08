'use strict';
const http=require('node:http');
const {Readable}=require('node:stream');
const {createCoachHandler}=require('./coach.cjs');
const {createSupabaseAdapters}=require('./adapters.cjs');
const {createReviewer}=require('./review.cjs');
const env=process.env;
const allowedOrigin=env.VXT_ALLOWED_ORIGIN;
const allowedUsers=new Set((env.VXT_COACH_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));
if(!allowedOrigin||!allowedUsers.size)throw Error('Configure VXT_ALLOWED_ORIGIN and VXT_COACH_USER_IDS for the private pilot.');
const adapters=createSupabaseAdapters({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY});
const usage=new Map();
const handler=createCoachHandler({...adapters,review:createReviewer({apiKey:env.OPENAI_API_KEY,model:env.OPENAI_MODEL}),
 allowReview(userId){if(!allowedUsers.has(userId))return false;const day=new Date().toISOString().slice(0,10),key=day+userId;for(const k of usage.keys())if(!k.startsWith(day))usage.delete(k);const count=usage.get(key)||0;if(count>=20)return false;usage.set(key,count+1);return true;}});
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.headers.origin!==allowedOrigin){res.writeHead(403);res.end();return;}
 res.setHeader('Access-Control-Allow-Origin',allowedOrigin);res.setHeader('Vary','Origin');
 if(req.url!=='/api/coach'){res.writeHead(404);res.end();return;}
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);res.end();return;}
 try{const request=new Request('http://localhost/api/coach',{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});const reply=await handler(request);res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(await reply.text());}
 catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Coach unavailable.'}));}
});
server.requestTimeout=45000;server.headersTimeout=10000;
server.listen(Number(env.PORT||8787),env.HOST||'127.0.0.1',()=>console.log('VXT Coach pilot server listening.'));
