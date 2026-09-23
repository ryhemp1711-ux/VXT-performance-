'use strict';
(() => {
 const url='https://ygyfxhcyzzvmpksimhmt.supabase.co';
 const publishableKey='sb_publishable_oxG4wtVYHIe9JI5bdq66Ug_HshNkTup';
 const el=id=>document.getElementById(id);
 let client, user=null, busy=false;
 const status=(text,error=false)=>{el('cloud-status').textContent=text;el('cloud-status').className=error?'error':'';};
 const count=p=>`${p.athletes.length} athletes, ${p.results.length} results, ${p.predictions.length} predictions, ${(p.sessions||[]).length} sessions`;
 function draw(){
  el('cloud-account').textContent=user?'Signed in as '+user.email:'Sign in to share your records between devices.';
  el('cloud-auth').hidden=!!user;el('cloud-actions').hidden=!user;
  document.querySelectorAll('#cloud button').forEach(b=>b.disabled=busy);
 }
 async function run(action){
  if(busy)return;busy=true;draw();
  try{await action();}catch(e){status(e.message||'Cloud request failed. Check your connection and try again.',true);}
  finally{busy=false;draw();}
 }
 async function connect(){
  if(client)return client;
  if(!globalThis.supabase){
   await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
    script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('Cloud tools could not load. Check your internet connection and retry.'));};
    document.head.append(script);
   });
  }
  client=globalThis.supabase.createClient(url,publishableKey);
  client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;draw();});
  const result=await client.auth.getSession();if(result.error)throw result.error;
  user=result.data.session?.user||null;draw();return client;
 }
 async function account(){
  const c=await connect();const result=await c.auth.getUser();if(result.error)throw result.error;
  if(!result.data.user)throw Error('Sign in first.');return result.data.user;
 }
 async function readCloud(id){
  const r=await client.from('vxt_workspaces').select('payload,revision,updated_at').eq('user_id',id).maybeSingle();
  if(r.error){if(['42P01','PGRST205'].includes(r.error.code))throw Error('Database setup is needed. Open the setup SQL link below and run it in Supabase SQL Editor.');throw r.error;}
  if(r.data)VXT.validateData(r.data.payload);return r.data;
 }
 el('cloud-auth').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
  const c=await connect(),signup=e.submitter?.id==='cloud-signup';
  const credentials={email:el('cloud-email').value.trim(),password:el('cloud-password').value};
  const r=signup?await c.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+location.pathname}}):await c.auth.signInWithPassword(credentials);
  if(r.error)throw r.error;
  el('cloud-password').value='';user=r.data.user&&r.data.session?r.data.user:null;
  status(signup&&!r.data.session?'Check your email to confirm your account, then return here and sign in.':'Signed in. Choose upload on the device with your records, or download on your other device.');
 });});
 el('cloud-signout').addEventListener('click',()=>run(async()=>{
  const c=await connect();const r=await c.auth.signOut({scope:'local'});if(r.error)throw r.error;user=null;
  status('Signed out. Downloaded records remain in this browser.');
 }));
 el('cloud-upload').addEventListener('click',()=>run(async()=>{
  const owner=await account();const local=VXTLocal.snapshot();const row=await readCloud(owner.id);
  const prompt=row?`Replace the cloud copy for ${owner.email}?\nCloud: ${count(row.payload)} (saved ${new Date(row.updated_at).toLocaleString()})\nThis device: ${count(local)}\nThis replaces all cloud records, including deletions. Download first if the cloud has records you need.`:`Upload ${count(local)} to ${owner.email}?`;
  if(!confirm(prompt))return;
  if(row)VXTLocal.saveSafetyCopy(row.payload);
  if((await account()).id!==owner.id)throw Error('Account changed. Please try again.');
  const r=await client.rpc('vxt_save_workspace',{p_payload:local,p_expected_revision:row?.revision||0});
  if(r.error)throw r.error;
  status('Uploaded '+count(local)+'. On your other device, sign in and choose Download from cloud.');
 }));
 el('cloud-download').addEventListener('click',()=>run(async()=>{
  const owner=await account(),row=await readCloud(owner.id);
  if(!row)throw Error('No cloud copy yet. Upload from the device that has your records first.');
  if(!confirm(`Replace this browser’s records with ${count(row.payload)} from ${owner.email}?\nSaved ${new Date(row.updated_at).toLocaleString()}. A recovery copy of this browser’s current records will be kept.`))return;
  if((await account()).id!==owner.id)throw Error('Account changed. Please try again.');
  VXTLocal.replace(row.payload);
  status('Downloaded '+count(row.payload)+'. Your roster, results and predictions are ready on this device.');
 }));
 el('cloud-recovery').addEventListener('click',()=>run(async()=>{VXTLocal.exportSafetyCopy();status('Recovery backup download started.');}));
 // Load auth only when the user opens Cloud sync; local app works without the CDN.
 document.querySelector('[data-tab="cloud"]').addEventListener('click',()=>run(async()=>{await connect();}));
 draw();
})();
