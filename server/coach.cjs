'use strict';

// Server-only, provider-independent boundary. No browser-supplied workspace is trusted.
const pick = (value, keys) => Object.fromEntries(keys.filter(k => value[k] !== undefined).map(k => [k, value[k]]));
function buildContext(row, athleteId, asOf) {
 const data = row.payload;
 const athlete = data.athletes.find(a => a.id === athleteId);
 if (!athlete) throw Object.assign(Error('Athlete not found.'), { status: 404 });
 const profile = pick(athlete.profile || {}, ['birthYear', 'events', 'goals']);
 const results = data.results.filter(r => r.athleteId === athleteId && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= asOf)
  .sort((a,b) => b.date.localeCompare(a.date)).slice(0,30)
  .map(r => pick(r, ['id','date','event','time','method','isSplit','sessionId','repId']));
 const workouts = (data.teamWorkouts || []).filter(w => w.date <= asOf && w.assignments.some(a => a.athleteId === athleteId))
  .sort((a,b) => b.date.localeCompare(a.date)).slice(0,10)
  .map(w => ({ id:w.id, date:w.date, assignment:pick(w.assignments.find(a => a.athleteId === athleteId), ['completed','attendance','energy','soreness']) }));
 // Session free text and other athletes' effort records are deliberately excluded.
 const sessions = (data.sessions || []).filter(s => s.date <= asOf && (s.efforts || []).some(e => e.athleteId === athleteId))
  .sort((a,b) => b.date.localeCompare(a.date)).slice(0,10)
  .map(s => ({ id:s.id,date:s.date,efforts:s.efforts.filter(e => e.athleteId === athleteId)
   .map(e => pick(e,['event','repNumber','distance','time','restAfter','sets','reps','category','wicketCount','spacing','spacingUnit'])) }));
 return { specialty:'vxt-sprint', version:1, asOf, cloudRevision:row.revision, cloudUpdatedAt:row.updated_at,
  profile, results, workouts, sessions,
  missing:['current readiness and pain check','available equipment','available training time','coach-approved training rules',
   ...(!profile.birthYear ? ['age'] : []), ...(!profile.events ? ['target events'] : []), ...(!profile.goals ? ['goals'] : [])],
  limitations:['Cloud snapshot only; unsynced local records are absent.', 'Birth year does not establish exact age.',
   'Timing methods and standing/flying efforts are not interchangeable.', 'Completion flags do not establish actual training load.',
   'Session summaries are partial; absence of a session does not establish rest.'] };
}

/** Fetch-compatible endpoint factory. Adapters must run on a trusted server.
 * authenticate(token): verify identity with the auth service, never just decode JWT.
 * readWorkspace(token,userId): use that user's token/RLS, never a service-role bypass.
 * Optional review adapter produces a read-only draft; no workout write is allowed.
 */
function createCoachHandler({authenticate, readWorkspace, review = null, allowReview = () => false, clock = () => new Date()}) {
 return async request => {
  const reply = (status, body) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method !== 'POST') return reply(405,{error:'Use POST.'});
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if(!token) return reply(401,{error:'Sign in first.'});
  try {
   const user = await authenticate(token);
   if(!user?.id) return reply(401,{error:'Sign in first.'});
   // Stream with a hard limit rather than buffering an unlimited request body.
   let bytes = 0, chunks = [];
   if(request.body) for await (const chunk of request.body) {
    bytes += chunk.byteLength;
    if(bytes > 2048) return reply(413,{error:'Request too large.'});
    chunks.push(Buffer.from(chunk));
   }
   let input;
   try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400,{error:'Invalid JSON.'}); }
   if(!input || typeof input.athleteId !== 'string' || !input.athleteId || input.athleteId.length > 200 || Object.keys(input).some(k=> !['athleteId','action','expectedRevision'].includes(k)))
    return reply(400,{error:'Invalid coach request.'});
   if(input.action !== undefined && !['context','review'].includes(input.action)) return reply(400,{error:'Invalid action.'});
   const row = await readWorkspace(token,user.id);
   if(!row || row.user_id !== user.id) return reply(404,{error:'Upload your workspace to cloud first.'});
   const context = buildContext(row,input.athleteId,clock().toISOString().slice(0,10));
   if(input.action === 'review') {
    if(!Number.isInteger(input.expectedRevision) || input.expectedRevision !== row.revision) return reply(409,{error:'Cloud data changed. Refresh the evidence first.'});
    if(!review) return reply(503,{error:'AI review is not configured yet.'});
    if(!context.results.length) return reply(422,{error:'Add dated results and upload to cloud before requesting a review.'});
    if(!await allowReview(user.id)) return reply(429,{error:'AI review is unavailable for this account or the pilot daily limit has been reached.'});
    if(JSON.stringify(context).length > 30000) return reply(422,{error:'Evidence is too large for this pilot review.'});
    const draft = await review(context);
    return reply(200,{status:'draft_review',requiresCoachApproval:true,context,review:draft,recommendation:null});
   }
   return reply(200,{status:'needs_information', requiresCoachApproval:true, context, recommendation:null});
  } catch(error) {
   return reply(error.status === 404 ? 404 : 503,{error:error.status === 404 ? 'Athlete not found.' : 'Coach context unavailable. Please try again.'});
  }
 };
}
module.exports = {buildContext,createCoachHandler};
