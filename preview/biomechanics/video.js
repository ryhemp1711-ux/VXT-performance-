'use strict';
(()=>{
 const el=id=>document.getElementById('video-'+id),player=el('player');
 const fields={title:'title',date:'date',lane:'lane',wicketCount:'count',spacing:'spacing',unit:'unit',fromWicket:'from',toWicket:'to',start:'start',end:'end',notes:'notes',fps:'fps'};
 const numeric=new Set(['wicketCount','spacing','fromWicket','toWicket','start','end','fps']);
 let source=null,url=null,editing=null,dirty=false,ready=false,expected=null;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const status=text=>el('status').textContent=text;
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const guard=fn=>{try{fn();}catch(e){status(e.message);}};
 const allowDiscard=()=>!dirty||confirm('Discard unsaved video review changes?');
 function values(){const r={athleteId:el('athlete').value,realTime:el('real-time').checked,source};for(const [key,id] of Object.entries(fields))r[key]=numeric.has(key)?(el(id).value===''?NaN:Number(el(id).value)):el(id).value;return r;}
 function summary(r){const m=VXTVideo.metrics(r);return `${m.elapsed.toFixed(3)} s ${r.realTime?'elapsed':'video time'} · ${m.distance.toFixed(2)} m between wickets ${r.fromWicket}–${r.toWicket}`+(m.mps===null?' · Speed withheld (recording time basis unconfirmed).':` · Estimated zone average ${m.mps.toFixed(2)} m/s / ${m.mph.toFixed(2)} mph`);}
 function calculate(){try{el('metrics').textContent=summary(values());}catch(e){el('metrics').textContent=e.message;}}
 function controls(){for(const id of ['back','forward','mark-start','mark-end'])el(id).disabled=!ready;}
 function unload(){VXTBiomechanicsEditor.reset();ready=false;controls();player.pause();player.removeAttribute('src');player.load();if(url)URL.revokeObjectURL(url);url=null;source=null;el('file').value='';el('position').textContent='Playhead: —';}
 function roster(){const selected=el('athlete').value||document.getElementById('active-athlete').value;el('athlete').replaceChildren();const blank=node('option','Choose athlete');blank.value='';el('athlete').append(blank);for(const a of VXTLocal.snapshot().athletes){const o=node('option',a.name);o.value=a.id;el('athlete').append(o);}if([...el('athlete').options].some(o=>o.value===selected))el('athlete').value=selected;}
 function reset(keepSource=false){VXTBiomechanicsEditor.reset();editing=null;expected=null;el('form').reset();el('date').value=today();el('save').textContent='Save review';el('preset').value='custom';el('fps').value='30';if(!keepSource){unload();el('source').textContent='Select a video from this device.';}roster();dirty=false;calculate();history();status('');}
 function openReview(r){if(!allowDiscard())return;const same=ready&&VXTVideo.sameSource(source,r.source);if(!same)unload();editing=r.id;expected=r.source;source=r.source;for(const [key,id] of Object.entries(fields))el(id).value=r[key];el('athlete').value=r.athleteId;el('real-time').checked=r.realTime;el('preset').value='custom';VXTBiomechanicsEditor.restore(r.biomechanics);el('save').textContent='Save changes';el('source').textContent=same?'Original file loaded: '+source.name:'Reselect original file: '+source.name;dirty=false;calculate();status(same?'Review opened.':'Review opened. Timing and notes are available; reselect the original video for playback.');if(same)player.currentTime=r.start;}
 function history(){const d=VXTLocal.snapshot(),list=el('history');list.replaceChildren();for(const r of (d.videoReviews||[]).filter(r=>r.athleteId===el('athlete').value).slice().reverse()){
  const card=node('div');card.className='session-summary';card.append(node('h3',r.title),node('p',VXT.formatDate(r.date)+' · Lane '+(r.lane||'unspecified')+' · '+r.source.name),node('p',summary(r)));const notes=node('p',r.notes||'No coach notes.');notes.style.whiteSpace='pre-wrap';card.append(notes);if(r.biomechanics)card.append(node('p',VXTBiomechanics.describe(r.biomechanics)));
  const open=node('button','Open review');open.type='button';open.addEventListener('click',()=>openReview(r));
  const del=node('button','Delete review');del.type='button';del.addEventListener('click',()=>guard(()=>{if(!confirm('Delete this video review? The video file and race results are kept.'))return;const current=VXTLocal.snapshot();VXTLocal.appendReviewed({...current,videoReviews:(current.videoReviews||[]).filter(x=>x.id!==r.id)});if(editing===r.id)reset(true);history();status('Review deleted. Use Undo deletion to restore it.');}));card.append(open,del);list.append(card);
 }if(!list.children.length)list.append(node('p','No saved video reviews for this athlete.'));}
 el('file').addEventListener('change',()=>guard(()=>{
  const f=el('file').files[0];if(!f)return;
  const info={name:f.name,size:f.size,lastModified:f.lastModified};
  if(expected&&!VXTVideo.sameSource(expected,info)){el('file').value='';throw Error('This file does not match the saved review. Choose the original file, or choose New review first.');}
  if(!expected&&source&&!allowDiscard()){el('file').value='';return;}
  if(!expected){VXTBiomechanicsEditor.reset();editing=null;el('start').value='';el('end').value='';el('real-time').checked=false;el('save').textContent='Save review';el('notes').value='';el('title').value='';}
  ready=false;controls();player.pause();if(url)URL.revokeObjectURL(url);source=info;url=URL.createObjectURL(f);player.src=url;player.load();status('Opening video…');
 }));
 player.addEventListener('loadedmetadata',()=>guard(()=>{
  if(!source||!Number.isFinite(player.duration)||player.duration<=0||player.duration>86400)throw Error('This video duration is not supported. Choose a clip under 24 hours.');
  if(expected&&Math.abs(expected.duration-player.duration)>0.1){unload();source=expected;throw Error('Video duration does not match the saved review.');}
  source={...source,duration:player.duration};ready=true;controls();player.playbackRate=Number(el('rate').value);el('source').textContent=`${source.name} · ${source.duration.toFixed(2)} s · ${VXTBiomechanics.videoFormat(player.videoWidth,player.videoHeight).label} · Local playback only`;
  if(expected){player.currentTime=Number(el('start').value)||0;status('Original video loaded.');}else{dirty=true;status('Video ready. Mark one uninterrupted run and enter your observations.');}calculate();
 }));
 player.addEventListener('error',()=>{if(!player.getAttribute('src'))return;ready=false;controls();status('This browser cannot play the selected video. Try an MP4 with H.264 video. No review was saved.');});
 player.addEventListener('timeupdate',()=>el('position').textContent='Playhead: '+player.currentTime.toFixed(3)+' s');
 el('rate').addEventListener('change',()=>player.playbackRate=Number(el('rate').value));
 function seek(direction){guard(()=>{const fps=Number(el('fps').value);if(!ready||!Number.isFinite(fps)||fps<1||fps>240)throw Error('Load a playable video and enter a seek rate from 1–240 fps.');player.pause();player.currentTime=Math.max(0,Math.min(player.duration,player.currentTime+direction/fps));});}
 el('back').addEventListener('click',()=>seek(-1));el('forward').addEventListener('click',()=>seek(1));
 for(const point of ['start','end'])el('mark-'+point).addEventListener('click',()=>{if(!ready)return;player.pause();VXTBiomechanicsEditor.reset();el(point).value=player.currentTime.toFixed(3);dirty=true;calculate();});
 el('preset').addEventListener('change',()=>{const lane=el('preset').value;if(lane==='custom')return;el('lane').value=lane;el('spacing').value=lane==='7'?'6':String(6+8/12);el('unit').value='ft';dirty=true;calculate();});
 el('form').addEventListener('input',()=>{dirty=true;calculate();});el('fps').addEventListener('input',()=>dirty=true);
 el('athlete').addEventListener('change',()=>guard(history));
 el('new').addEventListener('click',()=>{if(allowDiscard())reset(true);});
 el('form').addEventListener('submit',e=>{e.preventDefault();guard(()=>{
  const d=VXTLocal.snapshot();if(!source?.duration)throw Error('Load a playable video before saving.');
  if(editing&&!d.videoReviews?.some(r=>r.id===editing))throw Error('This review no longer exists. Start a new review.');
  const r={...values(),id:editing||crypto.randomUUID()};const bio=VXTBiomechanicsEditor.getData();if(bio)r.biomechanics=bio;VXTVideo.validate(r,new Set(d.athletes.map(a=>a.id)));
  if(r.date>today())throw Error('Use today or an earlier date for a completed review.');
  const rows=d.videoReviews||[];VXTLocal.appendReviewed({...d,videoReviews:editing?rows.map(x=>x.id===editing?r:x):[...rows,r]});editing=r.id;expected=r.source;dirty=false;el('save').textContent='Save changes';history();status('Review saved. Notes and timing are included in backups and manual cloud transfers; the video stays on your device.');
 });});
 document.addEventListener('vxt-biomechanics-change',()=>dirty=true);
 document.addEventListener('vxt-tab',e=>{if(e.detail==='video')guard(()=>{roster();history();});else player.pause();});
 document.addEventListener('vxt-workspace-replaced',()=>guard(()=>reset()));
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 guard(()=>reset());
})();
