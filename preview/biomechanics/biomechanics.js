'use strict';
(()=>{
 const $=id=>document.getElementById('bio-'+id),video=document.getElementById('video-player'),B=VXTBiomechanics;
 let pickingAthlete=false;
 let snapshots=[],originalFrames=new Map(),displayed=null;
 let analysis=null,generation=0,previewSerial=0,busy=false,areaPreview=false;
 const engines=new Map();let inputImages=[];let selectedCrop=null,autoPath=[],guidedPath=[],guideTime=null,boxStart=null,boxPointer=null;
 const boxCanvas=$('box-canvas'),boxCtx=boxCanvas.getContext('2d');
 const canvas=$('canvas'),ctx=canvas.getContext('2d');
 const cropSettings=()=>selectedCrop||B.cropArea([1,2,3,4].includes(Number($('zoom').value))?Number($('zoom').value):1,Number.isFinite(Number($('center-x').value))?Number($('center-x').value)/100:.5,Number.isFinite(Number($('center-y').value))?Number($('center-y').value)/100:.5);
 const activeCrop=time=>guidedPath.length>=2?B.guidedCrop(guidedPath,time):autoPath.length>=2?B.trackedCrop(autoPath,time):cropSettings();
 const inferenceSize=(sourceWidth,sourceHeight)=>{const minSide=640,maxSide=1280,scale=Math.max(1,minSide/Math.min(sourceWidth,sourceHeight));const capped=Math.min(scale,maxSide/Math.max(sourceWidth,sourceHeight));return {width:Math.max(1,Math.round(sourceWidth*capped)),height:Math.max(1,Math.round(sourceHeight*capped)),scale:capped};};
 const status=s=>$('status').textContent=s;
 const changed=()=>document.dispatchEvent(new Event('vxt-biomechanics-change'));
 function clearPreview(){displayed=null;$('edit-joints').checked=false;$('edit-joints').disabled=true;$('undo-joints').disabled=true;canvas.style.touchAction='auto';areaPreview=false;ctx.clearRect(0,0,canvas.width,canvas.height);canvas.hidden=true;}
 const lockedIds=['video-file','video-back','video-forward','video-mark-start','video-mark-end','video-rate','video-fps','video-new','video-start','video-end','video-athlete','bio-side','bio-side-view','bio-frames','bio-preview','bio-zoom','bio-center-x','bio-center-y','bio-area','bio-auto','bio-model','bio-select-box','bio-clear-box','bio-guide-start','bio-guide-end','bio-guide-add','bio-full-context','bio-edit-joints','bio-joint','bio-undo-joints','bio-pick-athlete','bio-athlete-size'];
 function lock(value){for(const id of lockedIds)document.getElementById(id).disabled=value;video.controls=!value;}
 function cancel(){generation++;previewSerial++;busy=false;lock(false);$('run').disabled=false;$('cancel').disabled=true;}
 function reset({keepPath=false}={}){const path=keepPath?autoPath:[],guided=keepPath?guidedPath:[];cancel();closeBox();snapshots=[];originalFrames.clear();inputImages=[];autoPath=path;guidedPath=guided;$('inputs').replaceChildren();$('input-panel').hidden=true;analysis=null;$('confirm').checked=false;$('confirm').disabled=false;$('frames').replaceChildren();$('results').textContent='';clearPreview();describeCrop();status('No analysis attached.');}
 function restore(value){selectedCrop=null;reset();describeCrop();analysis=value?structuredClone(value):null;if(analysis){const c=analysis.crop||{x:0,y:0,width:1,height:1};selectedCrop=c;guidedPath=analysis.guidedPath||[];describeCrop();$('model').value=analysis.engine===B.ENGINES.full?'full':'lite';$('zoom').value='1';$('center-x').value=String((c.x+c.width/2)*100);$('center-y').value=String((c.y+c.height/2)*100);$('side').value=analysis.side;$('side-view').checked=true;$('confirm').checked=analysis.confirmed;render();status('Saved measurements loaded. Reselect the original video to inspect overlays. Reanalyze to enable exact-frame correction.');}}
 function getData(){if(busy)throw Error('Wait for biomechanics analysis or cancel it before saving.');if(!analysis)return undefined;if(!analysis.frames.some(f=>Object.values(B.measure(f,analysis.width,analysis.height,analysis.side)).some(v=>v!==null)))throw Error('No usable body measurements. Adjust the analysis area and retry, or remove analysis to save timing and notes.');if(!$('confirm').checked)throw Error('Review the skeleton samples and confirm the athlete and tracking, or remove the analysis.');return structuredClone({...analysis,confirmed:true});}
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
  analysis.frames.forEach((f,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${f.time.toFixed(3)} s · ${f.points.some(p=>p.manual)?'Manually corrected · ':''}${B.sampleQuality(f,analysis.width,analysis.height,analysis.side).label}`;$('frames').append(option);});
  const best=B.bestSampleIndex(analysis.frames,analysis.width,analysis.height,analysis.side);$('frames').value=String(best);showMetrics(best);
 }
 function showMetrics(index){
  const f=analysis?.frames[index];if(!f)return;const m=B.measure(f,analysis.width,analysis.height,analysis.side);
  $('results').textContent=`${f.time.toFixed(3)} s · ${f.points.some(p=>p.manual)?'Manually corrected · ':''}${B.sampleQuality(f,analysis.width,analysis.height,analysis.side).label} · `+Object.entries(m).map(([k,v])=>`${B.labels[k]}: ${v===null?'not assessable':v.toFixed(0)+'°'}`).join(' · ')+'. '+(f.reason==='multiple-people'?'More than one person detected. Use a clip with one athlete.':f.reason==='no-person'?'Body not detected in this sample. Check the amber box: if your athlete is outside it, use Correct the athlete path. If inside, inspect Actual detector inputs.':'Check that the skeleton follows the correct athlete. Compare the same stride phase; no ideal-angle target is assumed.');
 }
 async function preview(){
  if(!analysis)return;const index=Number($('frames').value),f=analysis.frames[index],token=generation,serial=++previewSerial;showMetrics(index);clearPreview();
  if(!snapshots[index]&&(!video.getAttribute('src')||video.readyState<2))return;
  try{let source;if(snapshots[index]){source=document.createElement('img');source.src=snapshots[index];await source.decode();}else{video.pause();await seek(f.time,token);source=video;}if(token!==generation||serial!==previewSerial)return;const full=$('full-context').checked,c=full?{x:0,y:0,width:1,height:1}:f.crop||analysis.crop||{x:0,y:0,width:1,height:1};
   const sourceWidth=analysis.width*c.width,sourceHeight=analysis.height*c.height,scale=960/Math.max(sourceWidth,sourceHeight);
   canvas.width=Math.max(1,Math.round(sourceWidth*scale));canvas.height=Math.max(1,Math.round(sourceHeight*scale));
   ctx.drawImage(source,c.x*analysis.width,c.y*analysis.height,sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);ctx.lineWidth=1.5;ctx.strokeStyle='#29ffc6';ctx.fillStyle='#29ffc6';
   if(full&&f.crop){ctx.strokeStyle='#ffcb69';ctx.strokeRect(f.crop.x*canvas.width,f.crop.y*canvas.height,f.crop.width*canvas.width,f.crop.height*canvas.height);ctx.strokeStyle='#29ffc6';}
   const inView=p=>B.visible(p)&&p.x>=c.x&&p.x<=c.x+c.width&&p.y>=c.y&&p.y<=c.y+c.height;
   const xy=p=>[(p.x-c.x)/c.width*canvas.width,(p.y-c.y)/c.height*canvas.height];
   for(const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]]){const p=f.points[a],q=f.points[b];if(inView(p)&&inView(q)){ctx.strokeStyle=p.manual||q.manual?'#ffcb69':'#29ffc6';ctx.beginPath();ctx.moveTo(...xy(p));ctx.lineTo(...xy(q));ctx.stroke();}}
   for(const p of f.points)if(inView(p)){ctx.fillStyle=p.manual?'#ffcb69':'#29ffc6';ctx.beginPath();ctx.arc(...xy(p),2.5,0,2*Math.PI);ctx.fill();}canvas.hidden=false;displayed={index,c};$('edit-joints').disabled=!snapshots[index];$('undo-joints').disabled=!originalFrames.has(index);$('frame-source').textContent=snapshots[index]?'Exact captured frame · retained for this analysis session.':'Reopened video frame · exact captured image unavailable. Reanalyze before correcting joints.';
  }catch(e){status(e.message);}
 }
 function inspectInput(capture,index,count,time,model){
  if(![0,Math.floor((count-1)/2),count-1].includes(index))return null;
  $('input-panel').hidden=false;
  const card=document.createElement('figure'),caption=document.createElement('figcaption');
  card.append(caption);$('inputs').append(card);
  const prefix=`Sample ${index+1}/${count} · ${model==='full'?'Full':'Lite'} · requested ${time.toFixed(3)} s · playhead ${video.currentTime.toFixed(3)} s · ${capture.width} × ${capture.height} pixels`;
  try{
   // Snapshot this very canvas immediately before detect(capture), with no seek or await in between.
   const png=capture.toDataURL('image/png');if(!png.startsWith('data:image/png'))throw Error('Canvas snapshot unavailable.');
   const image=document.createElement('img');image.src=png;image.alt=`Detector input for sample ${index+1}`;card.append(image);
   const identical=inputImages.find(item=>item.png===png);inputImages.push({png,index});
   caption.textContent=prefix+(identical?` · identical pixels to sample ${identical.index+1} (a still scene or repeated capture; inspect the images).`:'')+' · captured before detector call.';
  }catch(e){caption.textContent=prefix+' · input preview unavailable: '+e.message;}
  const result=document.createElement('p');card.append(result);result.textContent='Detector call pending.';return result;
 }
 function poseCandidate(landmarks,tile){
  const points=landmarks.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(Number(p.visibility??0)>=.35||Number(p.presence??0)>=.35));
  if(points.length<6)return null;
  const xs=points.map(p=>tile.x+p.x*tile.width),ys=points.map(p=>tile.y+p.y*tile.height),x=Math.max(0,Math.min(...xs)),y=Math.max(0,Math.min(...ys)),right=Math.min(1,Math.max(...xs)),bottom=Math.min(1,Math.max(...ys));
  const width=right-x,height=bottom-y,quality=points.reduce((sum,p)=>sum+Math.max(Number(p.visibility??0),Number(p.presence??0)),0)/points.length;
  if(width<.015||height<.025)return null;
  return {x,y,width,height,cx:x+width/2,cy:y+height/2,area:width*height,quality};
 }
 function chooseCandidate(candidates,previous){
  if(!candidates.length)return null;
  return candidates.reduce((best,c)=>{
   const score=previous?Math.exp(-Math.hypot(c.cx-previous.cx,c.cy-previous.cy)/.22)*(.5+Math.sqrt(c.area)*4+c.quality):(.5+Math.sqrt(c.area)*4+c.quality);
   return !best||score>best.score?{...c,score}:best;
  },null);
 }
 function motionBoxes(image,previous){
  if(!previous||image.width!==previous.width||image.height!==previous.height)return [];
  const width=image.width,height=image.height,current=image.data,last=previous.data,active=new Uint8Array(width*height),minY=0,maxY=height,threshold=60;
  for(let y=minY;y<maxY;y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4,d=Math.abs(current[i]-last[i])+Math.abs(current[i+1]-last[i+1])+Math.abs(current[i+2]-last[i+2]);
   if(d>=threshold)active[y*width+x]=1;
  }
  const grown=new Uint8Array(active.length);
  for(let y=minY;y<maxY;y++)for(let x=0;x<width;x++){
   let on=false;for(let dy=-1;dy<=1&&!on;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<width&&yy>=minY&&yy<maxY&&active[yy*width+xx]){on=true;break;}}
   if(on)grown[y*width+x]=1;
  }
  const seen=new Uint8Array(grown.length),boxes=[];
  for(let y=minY;y<maxY;y++)for(let x=0;x<width;x++){
   const start=y*width+x;if(!grown[start]||seen[start])continue;
   const queue=[start];seen[start]=1;let head=0,count=0,left=x,right=x,top=y,bottom=y;
   while(head<queue.length){const cell=queue[head++],cx=cell%width,cy=Math.floor(cell/width);count++;left=Math.min(left,cx);right=Math.max(right,cx);top=Math.min(top,cy);bottom=Math.max(bottom,cy);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=cx+dx,yy=cy+dy;if(xx>=0&&xx<width&&yy>=minY&&yy<maxY){const next=yy*width+xx;if(grown[next]&&!seen[next]){seen[next]=1;queue.push(next);}}}}
   const boxWidth=(right-left+1)/width,boxHeight=(bottom-top+1)/height;
   if(count>=8&&boxWidth>=.015&&boxHeight>=.025&&boxWidth<=.65&&boxHeight<=.9)boxes.push({x:left/width,y:top/height,width:boxWidth,height:boxHeight,cx:(left+right+1)/(2*width),cy:(top+bottom+1)/(2*height),area:count/(width*height)});
  }
  return boxes;
 }
 function motionTrack(groups){
  const paths=[];
  const rank=path=>{const xs=path.items.map(b=>b.cx),ys=path.items.map(b=>b.cy),span=Math.max(...xs)-Math.min(...xs),movement=path.items.slice(1).reduce((sum,b,i)=>sum+Math.abs(b.cx-path.items[i].cx),0),spread=Math.max(...ys)-Math.min(...ys);return path.items.length*2+span*8+movement*2-spread*2+path.score;};
  groups.forEach((boxes,time)=>{
   const current=[];
   for(const box of boxes){
    let best={items:[{...box,time}],score:0};
    for(const path of paths){
     const last=path.items[path.items.length-1],gap=time-last.time;if(gap<1||gap>2)continue;
     const dx=box.cx-last.cx,dy=box.cy-last.cy;if(Math.abs(dx)>.2*gap||Math.abs(dy)>.15*gap)continue;
     const extended={items:[...path.items,{...box,time}],score:path.score+2+Math.abs(dx)*8-Math.abs(dy)*2};if(rank(extended)>rank(best))best=extended;
    }
    current.push(best);
   }
   paths.push(...current);
  });
  const best=paths.filter(path=>path.items.length>=2).sort((a,b)=>rank(b)-rank(a))[0];return best?best.items:[];
 }
 async function autoFind(){
  if(busy)return;
  let token=null,stage='setup';
  const start=Number(document.getElementById('video-start').value),end=Number(document.getElementById('video-end').value);
  try{
   if(guidedPath.length)throw Error('A guided athlete path is selected. Use full frame to clear it before Auto-find.');
   if(!video.getAttribute('src')||video.readyState<2||video.seeking)throw Error('Load a playable video and wait for seeking to finish.');
   if(!document.getElementById('video-athlete').value)throw Error('Choose an athlete first.');
   if(!$('side-view').checked)throw Error('Confirm a side-on clip with the full athlete visible.');
   if(document.getElementById('video-start').value===''||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>video.duration||end-start>10)throw Error('Mark a continuous segment of up to 10 seconds.');
   reset();changed();busy=true;lock(true);$('run').disabled=true;$('cancel').disabled=false;video.pause();token=generation;
   stage='model loading';
   const width=video.videoWidth,height=video.videoHeight,model=$('model').value,detector=await load(model);if(token!==generation)return;const times=Array.from({length:5},(_,i)=>start+(end-start)*i/4),selected=[],motionCanvas=document.createElement('canvas');const motionScale=228/Math.max(width,height);motionCanvas.width=Math.max(1,Math.round(width*motionScale));motionCanvas.height=Math.max(1,Math.round(height*motionScale));const motionCtx=motionCanvas.getContext('2d',{willReadFrequently:true});let previousMotion=null;const motionGroups=[];stage='tile scanning';
   for(let n=0;n<times.length;n++){
    const time=times[n];stage='video decoding / seeking';await seek(time,token);if(token!==generation)return;
    motionCtx.drawImage(video,0,0,motionCanvas.width,motionCanvas.height);const currentMotion=motionCtx.getImageData(0,0,motionCanvas.width,motionCanvas.height);motionGroups.push(motionBoxes(currentMotion,previousMotion));previousMotion=currentMotion;
    const candidates=[];const tiles=B.autoScanCrops(width,height);for(let tileIndex=0;tileIndex<tiles.length;tileIndex++){const tile=tiles[tileIndex];
     const sourceW=Math.max(1,Math.round(width*tile.width)),sourceH=Math.max(1,Math.round(height*tile.height)),size=inferenceSize(sourceW,sourceH),capture=document.createElement('canvas');capture.width=size.width;capture.height=size.height;capture.getContext('2d').drawImage(video,width*tile.x,height*tile.y,width*tile.width,height*tile.height,0,0,size.width,size.height);stage='tile pose detection';const result=detector.detect(capture);for(const pose of result.landmarks||[]){const c=poseCandidate(pose,tile);if(c)candidates.push(c);}
     status(`Auto-finding · ${B.videoFormat(width,height).label} · sample ${n+1}/${times.length} · area ${tileIndex+1}/${tiles.length} · ${candidates.length} candidates…`);await new Promise(resolve=>setTimeout(resolve,0));if(token!==generation)return;
    }
    const picked=chooseCandidate(candidates,n?selected[selected.length-1]:null);if(picked)selected.push({...picked,time});
    await new Promise(resolve=>setTimeout(resolve,0));if(token!==generation)return;
   }
   if(selected.length<2){const moving=motionTrack(motionGroups);if(moving.length>=2){autoPath=moving.map(p=>({...p,time:times[p.time]}));selectedCrop=B.unionCrop(moving.map(c=>({x:c.x,y:c.y,width:c.width,height:c.height})),.25,.5);$('box-status').textContent=`Auto crop selected from moving athlete area: left ${(selectedCrop.x*100).toFixed(0)}%, top ${(selectedCrop.y*100).toFixed(0)}%, width ${(selectedCrop.width*100).toFixed(0)}%, height ${(selectedCrop.height*100).toFixed(0)}%. A moving crop will follow the suggested path. Seek and use Show analysis area to check it, then analyze.`;busy=false;lock(false);$('run').disabled=false;$('cancel').disabled=true;changed();status(`Pose model did not label the athlete consistently, so Auto-find selected a moving athlete area from ${moving.length} samples. Review the area, then analyze.`);return;}
    selectedCrop={x:0,y:0,width:1,height:1};$('box-status').textContent='No athlete path confirmed. Full frame kept. Pause on the runner and use Draw athlete box.';busy=false;lock(false);$('run').disabled=false;$('cancel').disabled=true;changed();status('Auto-find could not confirm an athlete path. Full frame kept; draw an athlete box around the runner and their path, then analyze.');return;}
   autoPath=selected;selectedCrop=B.unionCrop(selected.map(c=>({x:c.x,y:c.y,width:c.width,height:c.height})),.8,.9);$('box-status').textContent=`Auto crop selected: left ${(selectedCrop.x*100).toFixed(0)}%, top ${(selectedCrop.y*100).toFixed(0)}%, width ${(selectedCrop.width*100).toFixed(0)}%, height ${(selectedCrop.height*100).toFixed(0)}%. A moving crop will follow the suggested path. Seek and use Show analysis area to check it, then analyze.`;busy=false;lock(false);$('run').disabled=false;$('cancel').disabled=true;changed();status(`Auto crop found a consistent athlete in ${selected.length}/${times.length} scan samples. Review the area, then analyze the marked segment.`);
  }catch(e){if(token!==null&&token!==generation)return;cancel();status('Auto-find unavailable during '+stage+': '+e.message+' You can still draw an athlete box manually.');}
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
   if(guidedPath.length&&(!B.validGuidedPath(guidedPath)||guidedPath[0].time!==start||guidedPath.at(-1).time!==end))throw Error('Set the athlete at both the marked start and end before analysis.');
   reset({keepPath:true});changed();busy=true;lock(true);$('run').disabled=true;$('cancel').disabled=false;video.pause();token=generation;
   const side=$('side').value,width=video.videoWidth,height=video.videoHeight,crop=cropSettings(),model=$('model').value,started=performance.now();
   stage='model loading';
   status('Loading body-position model… First use requires internet; video remains on this device.');
   const detector=await load(model);if(token!==generation)return;
   const sourceFrame=document.createElement('canvas');sourceFrame.width=width;sourceFrame.height=height;const sourceCtx=sourceFrame.getContext('2d');let snapshotBytes=0;
   const capture=document.createElement('canvas'),captureCtx=capture.getContext('2d');const frames=[],count=Math.min(51,Math.ceil((end-start)*5)+1);
   for(let i=0;i<count;i++){
    stage='video decoding / seeking';const time=start+(end-start)*i/(count-1);await seek(time,token);if(token!==generation)return;
    stage='body detection';
    const inferenceCrop=activeCrop(time);
    const inputSize=inferenceSize(width*inferenceCrop.width,height*inferenceCrop.height);
    // Size from this frame's crop, not the wider path envelope, to avoid stretching the athlete.
    capture.width=inputSize.width;capture.height=inputSize.height;
    // Freeze once: inference and every overlay share these source pixels.
    sourceCtx.drawImage(video,0,0,width,height);
    const snapshot=sourceFrame.toDataURL('image/png');if(!snapshot.startsWith('data:image/png'))throw Error('Cannot retain the captured frame. Try a shorter or smaller video.');snapshotBytes+=snapshot.length*2;
    if(snapshotBytes>96*1024*1024)throw Error('Frame review memory limit reached. Select a shorter segment and retry.');
    snapshots.push(snapshot);
    captureCtx.drawImage(sourceFrame,width*inferenceCrop.x,height*inferenceCrop.y,width*inferenceCrop.width,height*inferenceCrop.height,0,0,capture.width,capture.height);
    const inputResult=inspectInput(capture,i,count,time,model);let result;
    try{result=detector.detect(capture);if(inputResult)inputResult.textContent=`Detector returned ${result.landmarks.length} pose(s) for this input.`;}catch(e){if(inputResult)inputResult.textContent='Detector call failed: '+e.message;throw e;}
    // A moving crop is not proof of identity: keep multiple-person samples ambiguous.
    frames.push({...B.frame(time,B.mapPoses(result.landmarks,inferenceCrop)),crop:inferenceCrop});
    status(`Analyzing sample ${i+1} of ${count}…`);await new Promise(resolve=>setTimeout(resolve,0));if(token!==generation)return;
   }
   analysis={version:1,engine:B.ENGINES[model],view:'side',side,width,height,start,end,crop,...(guidedPath.length>=2?{guidedPath:structuredClone(guidedPath)}:{}),confirmed:false,frames};busy=false;lock(false);$('run').disabled=false;$('cancel').disabled=true;render();changed();const seconds=(performance.now()-started)/1000;await preview();if(token!==generation)return;
   const report=B.diagnostics(frames,width,height,side,model);$('confirm').disabled=report.usable===0;
   status(`${model==='full'?'Full':'Lite'} · ${seconds.toFixed(1)} seconds · ${report.message}`);
  }catch(e){if(token!==null&&token!==generation)return;cancel();snapshots=[];status('Analysis unavailable during '+stage+': '+e.message+' Existing timing and coach notes are still available.');}
 }
 function drawAreaPreview(){
  if(!areaPreview||busy||video.readyState<2||video.seeking)return;
  const c=activeCrop(video.currentTime);
  canvas.width=Math.max(1,Math.round(video.videoWidth*c.width));canvas.height=Math.max(1,Math.round(video.videoHeight*c.height));
  ctx.drawImage(video,video.videoWidth*c.x,video.videoHeight*c.y,video.videoWidth*c.width,video.videoHeight*c.height,0,0,canvas.width,canvas.height);canvas.hidden=false;
 }
 $('area').addEventListener('click',()=>{
  try{if(!video.getAttribute('src')||video.readyState<2||video.seeking)throw Error('Load a video and wait for seeking to finish.');areaPreview=true;drawAreaPreview();status(guidedPath.length>=2?'Guided moving analysis area. Play or seek to check your athlete stays inside. Add another position if the path needs correction.':autoPath.length>=2?'Moving analysis area preview. Play or seek the video to check whether the suggested crop follows your athlete. A moving crop is not a confirmed pose detection.':'Fixed analysis area preview. No moving path is active. Play or seek to check the athlete stays inside, or run Auto-find again.');}catch(e){areaPreview=false;status(e.message);}
 });
 for(const event of ['timeupdate','seeked','loadeddata'])video.addEventListener(event,drawAreaPreview);
 for(const id of ['zoom','center-x','center-y'])$(id).addEventListener('input',()=>{selectedCrop=null;reset();describeCrop();changed();});
 $('model').addEventListener('change',()=>{reset({keepPath:true});changed();});
 $('auto').addEventListener('click',autoFind);
 $('run').addEventListener('click',run);$('cancel').addEventListener('click',()=>{cancel();status('Analysis canceled.');});
 $('remove').addEventListener('click',()=>{reset();changed();});$('frames').addEventListener('change',preview);$('preview').addEventListener('click',preview);
 $('edit-joints').addEventListener('change',()=>{canvas.style.touchAction=$('edit-joints').checked?'none':'auto';});
 function refreshCorrection(index){
  analysis.confirmed=false;$('confirm').checked=false;$('confirm').disabled=!analysis.frames.some(f=>Object.values(B.measure(f,analysis.width,analysis.height,analysis.side)).some(v=>v!==null));
  const f=analysis.frames[index];$('frames').options[index].textContent=`${f.time.toFixed(3)} s · ${f.points.some(p=>p.manual)?'Manually corrected · ':''}${B.sampleQuality(f,analysis.width,analysis.height,analysis.side).label}`;changed();
 }
 let jointPointer=null;
 canvas.addEventListener('pointerdown',e=>{if(busy||!displayed||!$('edit-joints').checked||e.button!==0)return;e.preventDefault();jointPointer={id:e.pointerId,index:displayed.index,c:displayed.c};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointerup',async e=>{
  const drag=jointPointer;jointPointer=null;if(!drag||drag.id!==e.pointerId)return;
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(busy||!displayed||displayed.index!==drag.index||!$('edit-joints').checked)return;
  const joint=Number($('joint').value),rect=canvas.getBoundingClientRect(),u=(e.clientX-rect.left)/rect.width,v=(e.clientY-rect.top)/rect.height;
  if(![11,12,13,14,15,16,23,24,25,26,27,28].includes(joint)||u<0||u>1||v<0||v>1)return;
  if(!originalFrames.has(drag.index))originalFrames.set(drag.index,structuredClone(analysis.frames[drag.index]));
  analysis.frames[drag.index]=B.correctJoint(analysis.frames[drag.index],joint,drag.c.x+u*drag.c.width,drag.c.y+v*drag.c.height);
  refreshCorrection(drag.index);await preview();if(displayed?.index===drag.index){$('edit-joints').checked=true;canvas.style.touchAction='none';}
  status('Joint manually placed. Check the remaining joints, then confirm your review.');
 });
 canvas.addEventListener('pointercancel',()=>{jointPointer=null;});
 canvas.addEventListener('lostpointercapture',()=>{jointPointer=null;});
 $('undo-joints').addEventListener('click',async()=>{const index=Number($('frames').value);if(busy||!originalFrames.has(index))return;analysis.frames[index]=originalFrames.get(index);originalFrames.delete(index);refreshCorrection(index);await preview();status('Original detection restored for this sample.');});
 $('confirm').addEventListener('change',changed);$('full-context').addEventListener('change',preview);
 for(const id of ['side','side-view'])$(id).addEventListener('change',()=>{reset({keepPath:true});changed();});
 for(const id of ['video-start','video-end','video-athlete'])document.getElementById(id).addEventListener('input',()=>{reset();changed();});
 document.getElementById('video-athlete').addEventListener('change',()=>{reset();changed();});
 document.addEventListener('vxt-tab',()=>{if(busy){cancel();status('Analysis canceled after navigation.');}});
 function describeCrop(){if(guidedPath.length){$('box-status').textContent=`Guided athlete path: ${guidedPath.length} position(s). `+(guidedPath.length<2?'Set the athlete at the other endpoint before analysis.':'The crop moves between your boxes. Preview the path; add positions wherever the athlete leaves it.');return;}if(autoPath.length>=2){$('box-status').textContent='Auto-find moving crop selected. Show analysis area previews the exact source area used by the detector at this playhead. The crop follows the suggested path; verify the athlete stays inside.';return;}const c=cropSettings();$('box-status').textContent=`Fixed area: left ${(c.x*100).toFixed(0)}%, top ${(c.y*100).toFixed(0)}%, width ${(c.width*100).toFixed(0)}%, height ${(c.height*100).toFixed(0)}%. Keep the whole athlete inside throughout the segment.`;}
 function closeBox(){pickingAthlete=false;if(boxPointer!==null&&boxCanvas.hasPointerCapture(boxPointer))boxCanvas.releasePointerCapture(boxPointer);boxPointer=null;boxStart=null;guideTime=null;$('box-editor').hidden=true;video.controls=!busy;}
 function boxPoint(e){const r=boxCanvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
 function drawBox(end){boxCtx.drawImage(video,0,0,boxCanvas.width,boxCanvas.height);if(boxStart&&end){boxCtx.strokeStyle='#29ffc6';boxCtx.lineWidth=Math.max(2,boxCanvas.width/250);boxCtx.strokeRect(boxStart.x*boxCanvas.width,boxStart.y*boxCanvas.height,(end.x-boxStart.x)*boxCanvas.width,(end.y-boxStart.y)*boxCanvas.height);}}
 $('pick-athlete').addEventListener('click',()=>{try{
  if(busy||!video.getAttribute('src')||video.readyState<2||video.seeking)throw Error('Load a video and pause where the athlete is fully visible.');
  video.pause();closeBox();boxCanvas.width=video.videoWidth;boxCanvas.height=video.videoHeight;drawBox();$('box-editor').hidden=false;pickingAthlete=true;$('box-editor').closest('details').open=true;status('Tap the athlete’s chest. The crop will follow from this frame for up to 3 seconds.');
 }catch(e){status(e.message);}});
 async function trackPickedAthlete(point){
  if(busy)return;const start=video.currentTime,end=Math.min(start+3,video.duration-.04);if(end-start<.2){closeBox();status('Choose a frame earlier in the video.');return;}
  const heightFraction=Number($('athlete-size').value)/100;if(!Number.isFinite(heightFraction)||heightFraction<.06||heightFraction>.5){closeBox();status('Choose an athlete height between 6% and 50%.');return;}reset();changed();busy=true;lock(true);$('run').disabled=true;$('cancel').disabled=false;const token=generation;
  try{
   const scale=Math.min(1,960/Math.max(video.videoWidth,video.videoHeight)),w=Math.round(video.videoWidth*scale),h=Math.round(video.videoHeight*scale),capture=document.createElement('canvas');capture.width=w;capture.height=h;const cx=capture.getContext('2d',{willReadFrequently:true}),T=VXTAthleteTracker;
   const get=()=>{cx.drawImage(video,0,0,w,h);return T.gray(cx.getImageData(0,0,w,h));};await seek(start,token);if(token!==generation)return;
   let tracker=T.seed(get(),point.x*w,point.y*h,heightFraction*h),path=[{...T.crop(tracker,w,h),time:start}],stopped='';const count=Math.ceil((end-start)*15);
   for(let i=1;i<=count;i++){const time=start+(end-start)*i/count;await seek(time,token);if(token!==generation)return;const result=T.step(get(),tracker);if(token!==generation)return;if(!result.ok){stopped=result.reason;break;}tracker=result.state;path.push({...T.crop(tracker,w,h),time});status(`Following selected athlete · ${i}/${count} frames…`);await new Promise(resolve=>setTimeout(resolve,0));if(token!==generation)return;}
   if(path.length<4)throw Error('Could not follow the selected athlete. Try a clearer starting frame or advanced crop controls.');
   guidedPath=path;selectedCrop=B.unionCrop(path,0,0);document.getElementById('video-start').value=String(start);document.getElementById('video-end').value=String(path.at(-1).time);busy=false;lock(false);$('run').disabled=false;$('cancel').disabled=true;describeCrop();changed();await seek(start,token);if(token!==generation)return;areaPreview=true;drawAreaPreview();
   status((stopped?'Tracking stopped: '+stopped+' The segment ends at '+path.at(-1).time.toFixed(2)+' s. ':'Suggested moving crop ready. ')+'Play the segment to check it follows your athlete, then Analyze marked segment. Appearance matching does not verify identity or joint accuracy.');
  }catch(e){if(token!==generation)return;cancel();status(e.message);}
 }
 $('select-box').addEventListener('click',()=>{try{
  if(busy||!video.getAttribute('src')||video.readyState<2||video.seeking)throw Error('Load a video and pause on a clear athlete frame first.');
  video.pause();closeBox();boxCanvas.width=video.videoWidth;boxCanvas.height=video.videoHeight;drawBox();$('box-editor').hidden=false;status('Draw around the whole athlete and their path through the marked segment. The box does not follow them.');
 }catch(e){status(e.message);}});
 async function openGuidedBox(which){
  try{
   if(busy||!video.getAttribute('src')||video.readyState<2||video.seeking)throw Error('Load a video and wait for seeking to finish.');
   const start=Number(document.getElementById('video-start').value),end=Number(document.getElementById('video-end').value);
   if(document.getElementById('video-start').value===''||document.getElementById('video-end').value===''||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>video.duration||end-start>10)throw Error('Mark a segment of up to 10 seconds first.');
   const time=which==='start'?start:which==='end'?end:video.currentTime;
   if(time<start||time>end)throw Error('Seek inside the marked segment to add a position.');
   closeBox();video.pause();const token=generation;await seek(time,token);if(token!==generation)return;
   guideTime=time;video.controls=false;boxCanvas.width=video.videoWidth;boxCanvas.height=video.videoHeight;drawBox();$('box-editor').hidden=false;
   status(`Draw around your athlete at ${time.toFixed(3)} s, with a little space around head, hands and feet. This position will guide the moving crop.`);
  }catch(e){status(e.message);}
 }
 for(const which of ['start','end','add'])$('guide-'+which).addEventListener('click',()=>openGuidedBox(which));
 boxCanvas.addEventListener('pointerdown',e=>{if(pickingAthlete){if(e.button!==0)return;e.preventDefault();return trackPickedAthlete(boxPoint(e));}if(busy||boxPointer!==null||e.button!==0)return;e.preventDefault();boxPointer=e.pointerId;boxStart=boxPoint(e);boxCanvas.setPointerCapture(e.pointerId);});
 boxCanvas.addEventListener('pointermove',e=>{if(e.pointerId===boxPointer&&boxStart)drawBox(boxPoint(e));});
 boxCanvas.addEventListener('pointerup',e=>{if(e.pointerId!==boxPointer||!boxStart)return;try{const crop=B.boxCrop(boxStart,boxPoint(e));
 if(guideTime!==null){const point={...crop,time:guideTime},points=guidedPath.filter(p=>Math.abs(p.time-point.time)>.001);if(points.length>=51)throw Error('Use at most 51 guided positions.');points.push(point);points.sort((a,b)=>a.time-b.time);reset();guidedPath=points;selectedCrop=B.unionCrop(points,0,0);describeCrop();changed();status(points.length<2?'First athlete position set. Set the athlete at the other endpoint next.':'Guided path updated. Show analysis area to check it, then analyze. Auto-find will not replace your selected path.');}
 else{selectedCrop=crop;reset();describeCrop();changed();status('Fixed athlete box selected. Use guided positions to follow a moving athlete.');}}catch(error){closeBox();status(error.message+' Previous area kept.');}});
 boxCanvas.addEventListener('pointercancel',closeBox);
 boxCanvas.addEventListener('lostpointercapture',()=>{boxPointer=null;boxStart=null;});
 $('box-cancel').addEventListener('click',closeBox);
 $('clear-box').addEventListener('click',()=>{selectedCrop=null;$('zoom').value='1';$('center-x').value='50';$('center-y').value='50';reset();describeCrop();changed();});
 window.VXTBiomechanicsEditor={reset:()=>{selectedCrop=null;reset();describeCrop();},restore,getData};
})();
