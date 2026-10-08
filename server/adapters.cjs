'use strict';
function createSupabaseAdapters({url,publishableKey,fetchImpl=fetch}){
 if(!url||!publishableKey||new URL(url).protocol!=='https:')throw Error('Configure HTTPS Supabase URL and publishable key.');
 const root=url.replace(/\/$/,'');
 const get=(path,token)=>fetchImpl(root+path,{headers:{apikey:publishableKey,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
 return {
  async authenticate(token){const r=await get('/auth/v1/user',token);if([401,403].includes(r.status))return null;if(!r.ok)throw Error('Authentication unavailable');return r.json();},
  async readWorkspace(token,userId){const query=new URLSearchParams({select:'user_id,payload,revision,updated_at',user_id:`eq.${userId}`,limit:'1'});const r=await get('/rest/v1/vxt_workspaces?'+query,token);if(!r.ok)throw Error('Cloud read failed');return (await r.json())[0]||null;}
 };
}
module.exports={createSupabaseAdapters};
