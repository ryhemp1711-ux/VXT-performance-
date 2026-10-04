'use strict';
(()=>{
 const $=id=>document.getElementById('bio-'+id),video=document.getElementById('video-player'),B=VXTBiomechanics;
 let analysis=null,generation=0,previewSerial=0,busy=false;
 const engines=new Map();let selectedCrop=null,boxStart=null,boxPointer=null;
 const boxCanvas=$('box-canvas'),boxCtx=boxCanvas.getContext('2d');
 const canvas=$('canvas'),ctx=canvas.getContext('2d');
 const cropSettings=()=>selectedCrop||B.cropArea(Number($('zoom').value),Number($('center-x').value)/100,Number($('center-y').value)/100);
 const status=s=>$('status').textContent=s;
 const changed=()=>document.dispatchEvent(new Event('vxt-biomechanics-change'));
 function clearPreview(){ctx.clearRect(0,0,canvas.width,canvas.height);canvas.hidden=true;}
 const lockedIds=['video-file','video-back','video-forward','video-mark-start','video-mark-end','video-rate','video-fps','video-new','video-start','video-end','video-athlete','bio-side','bio-side-view','bio-frames','bio-preview','bio-zoom','bio-center-x','bio-center-y','bio-area','bio-model','bio-select-box','bio-clear-box'];
 function lock(value){for(const id of lockedIds)document.getElementById(id).disabled=value;video.controls=!value;}
 function cancel(){generation++;previewSerial++;busy=false;lock(false);$('run').disabled=false;$('cancel').disabled=true;}
 function reset(){cancel();closeBox();analysis=null;$('confirm').checked=false;$('confirm').disabled=false;$('frames').replaceChildren();$('results').textContent='';clearPreview();status('No analysis attached.');}
 function restore(value){selectedCrop=null;reset();describeCrop();analysis=value?structuredClone(value):null;if(analysis){const c=analysis.crop||{x:0,y:0,width:1,height:1};selectedCrop=c;describeCrop();$('model').value=analysis.engine===B.ENGINES.full?'full':'lite';$('zoom').value='1';$('center-x').value=String((c.x+c.width/2)*100);$('center-y').value=String((c.y+c.height/2)*100);$('side').value=analysis.side;$('side-view').checked=true;$('confirm').checked=analysis.confirmed;render();status('Saved measurements loaded. Reselect the original video to inspect overlays.');}}
 function getData(){if(busy)throw Error('Wait for biomechanics analysis or cancel it before saving.');if(!analysis)return undefined;if(!analysis.frames.some(f=>Object.values(B.measure(f,analysis.width,analysis.height,analysis.side)).some(v=>v!==null)))throw Error('No usable body measurements. Adjust the analysis area and retry, or remove analysis to save timing and notes.');if(!$('confirm').checked)throw Error('Review the skeleton samples and confirm the athlete and tracking, or remove the analysis.');return {...analysis,confirmed:true};}
 async function load(model){
  if(!Object.hasOwn(B.ENGINES,model))throw Error('Choose Lite or Full.');
  if(!engines.has(model))engines.set(model,(async()=>{const {FilesetResolver,PoseLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');return PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${model}/float16/1/pose_landmarker_${model}.task`,delegate:'CPU'},runningMode:'IMAGE',numPoses:2,minPoseDetectionConfidence:0.6,minPosePresenceConfidence:0.6});})().catch(e=>{engines.delete(model);throw e;}));
  return engines.get(model);
 }
 function seek(time,token){return new Promise((resolve,reject)=>{
  let timer;const done=e=>{clearTimeout(timer);video.removeEventListener('seeked',onSeek);video.removeEventListener('error',onError);if(e)reject(e);else if(token!==generation)reject(Error('Analysis canceled.'));else resolve();};
  const onSeek=()=>done(),onError=()=>done(Error('Video seek failed.'));
  if(!video.seeking&&Math.abs(video.currentTime-time)<0.001&&video.readyState>=2){done();return;}
  video.addEventListener('seeked',onSeek);video.addEventListener('error',onError);timer=setTimeout(()=>done(Error('Video seek timed out. Try a shorter MP4 clip.')),10000);video.currentTime=time;
 });}
 function render(){
  $('frames').replaceChildren();if(!analysis)return;
  analysis.frames.forEach((f,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${f.time.toFixed(3)} s${f.reason?' · '+(f.reason==='no-person'?'body not detected':f.reason.replaceAll('-',' ')):''}`;$('frames').append(option);});
  showMetrics(0);
 }
 function showMetrics(index){
  const f=analysis?.frames[index];if(!f)return;const m=B.measure(f,analysis.width,analysis.height,analysis.side);
  $('results').textContent=`${f.time.toFixed(3)} s · `+Object.entries(m).map(([k,v])=>`${B.labels[k]}: ${v===null?'not assessable':v.toFixed(0)+'°'}`).join(' · ')+'. '+(f.reason==='multiple-people'?'More than one person detected. Use a clip with one athlete.':f.reason==='no-person'?'Body not detected in this sample. Try a shorter segment and use Analysis zoom to keep the whole athlete larger in the analysis area.':'Check that the skeleton follows the correct athlete. Compare the same stride phase; no ideal-angle target is assumed.');
 }
 async function preview(){
  if(!analysis)return;const index=Number($('frames').value),f=analysis.frames[index],token=generation,serial=++previewSerial;showMetrics(index);clearPreview();
  if(!video.getAttribute('src')||video.readyState<2)return;
  try{video.pause();await seek(f.time,token);if(token!==generation||serial!==previewSerial)return;canvas.width=analysis.width;canvas.height=analysis.height;ctx.drawImage(video,0,0,canvas.width,canvas.height);ctx.lineWidth=Math.max(2,canvas.width/300);ctx.strokeStyle='#29ffc6';ctx.fillStyle='#29ffc6';
   for(const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]]){const p=f.points[a],q=f.points[b];if(B.visible(p)&&B.visible(q)){ctx.beginPath();ctx.moveTo(p.x*canvas.width,p.y*canvas.height);ctx.lineTo(q.x*canvas.width,q.y*canvas.height);ctx.stroke();}}
   for(const p of f.points)if(B.visible(p)){ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,Math.max(3,canvas.width/200),0,2*Math.PI);ctx.fill();}canvas.hidden=false;
  }catch(e){status(e.message);}
 }
 async function run(){
  if(busy)return;
  let token=null,stage='setup';
  const start=Number(document.getElementById('video-start').value),end=Number(document.getElementById('video-end').value);
  try{
   if(!video.getAttribute('src')||video.readyState<2||video.seeking)throw Error('Load a playable video and wait for seeking to finish.');
   if(!document.getElementById('video-athlete').value)throw Error('Choose an athlete first.');
   if(!$('side-view').checked)throw Error('Confirm a side-on clip with the full athlete visible.');
   if(document.getElementById('video-start').value===''||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>video.duration||end-start>10)throw Error('Mark a continuous segment of up to 10 seconds.');
   reset();changed();busy=true;lock(true);$('run').disabled=true;$('cancel').disabled=false;video.pause();token=generation;
   const side=$('side').value,width=video.videoWidth,height=video.videoHeight,crop=cropSettings(),model=$('model').value,started=performance.now();
   stage='model loading';
   status('Loading body-position model… First use requires internet; video remains on this device.');
   const detector=await load(model);if(token!==generation)return;
   const capture=document.createElement('canvas');capture.width=Math.max(1,Math.round(width*crop.width));capture.height=Math.max(1,Math.round(height*crop.height));const captureCtx=capture.getContext('2d');const frames=[],count=Math.min(51,Math.ceil((end-start)*5)+1);
   for(let i=0;i<count;i++){
    stage='video decoding / seeking';const time=start+(end-start)*i/(count-1);await seek(time,token);if(token!==generation)return;
    stage='body detection';captureCtx.drawImage(video,width*crop.x,height*crop.y,width*crop.width,height*crop.height,0,0,capture.width,capture.height);const result=detector.detect(capture);frames.push(B.frame(time,B.mapPoses(result.landmarks,crop)));
    status(`Analyzing sample ${i+1} of ${count}…`);await new Promise(resolve=>setTimeout(resolve,0));if(token!==generation)return;
   }
   analysis={version:1,engine:B.ENGINES[model],view:'side',side,width,height,start,end,crop,confirmed:false,frames};busy=false;lock(false);$('run').disabled=false;$('cancel').disabled=true;render();changed();const seconds=(performance.now()-started)/1000;await preview();if(token!==generation)return;
   const report=B.diagnostics(frames,width,height,side);$('confirm').disabled=report.usable===0;
   status(`${model==='full'?'Full':'Lite'} · ${seconds.toFixed(1)} seconds · ${report.message}`);
  }catch(e){if(token!==null&&token!==generation)return;cancel();status('Analysis unavailable during '+stage+': '+e.message+' Existing timing and coach notes are still available.');}
 }
 $('area').addEventListener('click',()=>{
 try{if(!video.getAttribute('src')||video.readyState<2||video.seeking)throw Error('Load a video and pause on a clear athlete frame first.');video.pause();const c=cropSettings();canvas.width=Math.max(1,Math.round(video.videoWidth*c.width));canvas.height=Math.max(1,Math.round(video.videoHeight*c.height));ctx.drawImage(video,video.videoWidth*c.x,video.videoHeight*c.y,video.videoWidth*c.width,video.videoHeight*c.height,0,0,canvas.width,canvas.height);canvas.hidden=false;status('Analysis area preview. Keep the whole athlete inside this area for the entire marked segment. This preview is not a detection result.');}catch(e){status(e.message);}
 });
 for(const id of ['zoom','center-x','center-y'])$(id).addEventListener('input',()=>{selectedCrop=null;reset();describeCrop();changed();});
 $('model').addEventListener('change',()=>{reset();changed();});
 $('run').addEventListener('click',run);$('cancel').addEventListener('click',()=>{cancel();status('Analysis canceled.');});
 $('remove').addEventListener('click',()=>{reset();changed();});$('frames').addEventListener('change',preview);$('preview').addEventListener('click',preview);
 $('confirm').addEventListener('change',changed);
 for(const id of ['side','side-view'])$(id).addEventListener('change',()=>{reset();changed();});
 for(const id of ['video-start','video-end','video-athlete'])document.getElementById(id).addEventListener('input',()=>{reset();changed();});
 document.getElementById('video-athlete').addEventListener('change',()=>{reset();changed();});
 document.addEventListener('vxt-tab',()=>{if(busy){cancel();status('Analysis canceled after navigation.');}});
 function describeCrop(){const c=cropSettings();$('box-status').textContent=`Fixed area: left ${(c.x*100).toFixed(0)}%, top ${(c.y*100).toFixed(0)}%, width ${(c.width*100).toFixed(0)}%, height ${(c.height*100).toFixed(0)}%. Keep the whole athlete inside throughout the segment.`;}
 function closeBox(){if(boxPointer!==null&&boxCanvas.hasPointerCapture(boxPointer))boxCanvas.releasePointerCapture(boxPointer);boxPointer=null;boxStart=null;$('box-editor').hidden=true;}
 function boxPoint(e){const r=boxCanvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
 function drawBox(end){boxCtx.drawImage(video,0,0,boxCanvas.width,boxCanvas.height);if(boxStart&&end){boxCtx.strokeStyle='#29ffc6';boxCtx.lineWidth=Math.max(2,boxCanvas.width/250);boxCtx.strokeRect(boxStart.x*boxCanvas.width,boxStart.y*boxCanvas.height,(end.x-boxStart.x)*boxCanvas.width,(end.y-boxStart.y)*boxCanvas.height);}}
 $('select-box').addEventListener('click',()=>{try{
  if(busy||!video.getAttribute('src')||video.readyState<2||video.seeking)throw Error('Load a video and pause on a clear athlete frame first.');
  video.pause();closeBox();boxCanvas.width=video.videoWidth;boxCanvas.height=video.videoHeight;drawBox();$('box-editor').hidden=false;status('Draw around the whole athlete and their path through the marked segment. The box does not follow them.');
 }catch(e){status(e.message);}});
 boxCanvas.addEventListener('pointerdown',e=>{if(busy||boxPointer!==null||e.button!==0)return;e.preventDefault();boxPointer=e.pointerId;boxStart=boxPoint(e);boxCanvas.setPointerCapture(e.pointerId);});
 boxCanvas.addEventListener('pointermove',e=>{if(e.pointerId===boxPointer&&boxStart)drawBox(boxPoint(e));});
 boxCanvas.addEventListener('pointerup',e=>{if(e.pointerId!==boxPointer||!boxStart)return;try{const crop=B.boxCrop(boxStart,boxPoint(e));selectedCrop=crop;reset();describeCrop();changed();status('Athlete box selected. Use Show analysis area to check it, then analyze.');}catch(error){closeBox();status(error.message+' Previous area kept.');}});
 boxCanvas.addEventListener('pointercancel',closeBox);
 boxCanvas.addEventListener('lostpointercapture',()=>{boxPointer=null;boxStart=null;});
 $('box-cancel').addEventListener('click',closeBox);
 $('clear-box').addEventListener('click',()=>{selectedCrop=null;$('zoom').value='1';$('center-x').value='50';$('center-y').value='50';reset();describeCrop();changed();});
 window.VXTBiomechanicsEditor={reset:()=>{selectedCrop=null;reset();describeCrop();},restore,getData};
})();
