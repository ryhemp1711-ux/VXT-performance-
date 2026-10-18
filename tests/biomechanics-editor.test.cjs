// Interface regression checks with simulated media, canvas and model responses.
// These do not verify video decoding, pointer layout, or real pose inference.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const B=require('../preview/biomechanics/biomechanics-model.js');
function editor(tracker){
 const captures=[];
 class Element {
  constructor(){this.style={};this.value='';this.handlers={};this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.options=[];}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(x=>x!==fn);}
  async fire(type,data={}){for(const fn of this.handlers[type]||[])await fn({pointerId:1,button:0,preventDefault(){},...data});}
  append(x){this.options.push(x);if(this.options.length===1)this.value='0';}
  replaceChildren(){this.options=[];}
  toDataURL(type){captures.push({kind:'snapshot',canvas:this,type});return 'data:image/png;base64,fixture';}
  async decode(){}
  closest(){return this;}
  getContext(){const canvas=this;return new Proxy({},{get:(target,key)=>key==='getImageData'?()=>({width:canvas.width,height:canvas.height,data:new Uint8ClampedArray(canvas.width*canvas.height*4)}):['lineTo','arc'].includes(key)?(...args)=>captures.push({kind:key,canvas,args}):key==='drawImage'?(...args)=>captures.push({kind:'draw',canvas,args,width:canvas.width,height:canvas.height}):()=>{}});}
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
  setPointerCapture(id){this.capture=id;} hasPointerCapture(id){return this.capture===id;} releasePointerCapture(){this.capture=null;}
 }
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const doc={getElementById:el,createElement:()=>new Element(),addEventListener(){},dispatchEvent(){}};
 for(const [id,value] of Object.entries({'bio-athlete-size':'12','bio-zoom':'1','bio-center-x':'50','bio-center-y':'50','bio-model':'lite','bio-side':'left','video-start':'1','video-end':'1.2','video-athlete':'a'}))el(id).value=value;
 el('bio-side-view').checked=true;
 const video=el('video-player');Object.assign(video,{readyState:2,seeking:false,duration:5,videoWidth:1920,videoHeight:1080,pause(){},getAttribute:()=> 'blob:fixture'});
 let time=1;Object.defineProperty(video,'currentTime',{get:()=>time,set:v=>{time=v;queueMicrotask(()=>video.fire('seeked'));}});
 const points=Array.from({length:33},(_,i)=>({x:.2+(i%5)*.1,y:.1+Math.floor(i/5)*.1,z:0,visibility:.95}));
 const requests=[],state={fail:false,poses:[points]};
 const module={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:async (files,options)=>{requests.push(options);if(state.fail)throw Error('fixture download failure');return {detect:canvas=>{captures.push({kind:'detect',canvas});return {landmarks:state.poses};}};}}};
 const context={document:doc,VXTBiomechanics:B,VXTAthleteTracker:tracker,window:{},Event:class{},structuredClone,performance,setTimeout,clearTimeout,__model:module};
 let source=fs.readFileSync('preview/biomechanics/biomechanics.js','utf8');source=source.replace(/await import\('[^']+'\)/,'await Promise.resolve(__model)');vm.runInNewContext(source,context);
 return {el,api:context.window.VXTBiomechanicsEditor,state,requests,captures};
}
test('box drawing, model choice, saving and restore preserve the selected source area',async()=>{
 const {el,api,requests}=editor();await el('bio-select-box').fire('click');assert.equal(el('bio-box-editor').hidden,false);
 await el('bio-box-canvas').fire('pointerdown',{clientX:10,clientY:10});await el('bio-box-canvas').fire('pointerup',{clientX:40,clientY:90});
 assert.match(el('bio-box-status').textContent,/width 30%/);
 el('bio-model').value='full';await el('bio-model').fire('change');await el('bio-run').fire('click');
 assert.match(requests[0].baseOptions.modelAssetPath,/pose_landmarker_full/);el('bio-confirm').checked=true;
 const data=api.getData();assert.equal(data.engine,B.ENGINES.full);assert.ok(Math.abs(data.crop.width-.3)<1e-8);
 api.reset();api.restore(data);assert.equal(el('bio-model').value,'full');assert.equal(JSON.stringify(api.getData()),JSON.stringify(data));
 el('bio-model').value='lite';await el('bio-model').fire('change');assert.equal(api.getData(),undefined);
 await el('bio-run').fire('click');assert.match(requests[1].baseOptions.modelAssetPath,/pose_landmarker_lite/);
 assert.equal(el('bio-run').disabled,false);
});
test('ambiguous detections cannot be confirmed and model loading failures are labeled and retryable',async()=>{
 const {el,api,state}=editor();state.fail=true;await el('bio-run').fire('click');assert.match(el('bio-status').textContent,/during model loading/);
 assert.equal(el('bio-model').disabled,false);state.fail=false;state.poses=[];await el('bio-run').fire('click');
 assert.match(el('bio-status').textContent,/no athlete detected/);assert.equal(el('bio-confirm').disabled,true);assert.throws(()=>api.getData(),/No usable/);
});
test('cancelled or tiny box selections leave the previous area intact; sliders replace it',async()=>{
 const {el}=editor();await el('bio-select-box').fire('click');await el('bio-box-canvas').fire('pointerdown',{clientX:10,clientY:10});await el('bio-box-canvas').fire('pointercancel');assert.equal(el('bio-box-editor').hidden,true);
 await el('bio-select-box').fire('click');await el('bio-box-canvas').fire('pointerdown',{clientX:10,clientY:10});await el('bio-box-canvas').fire('pointerup',{clientX:11,clientY:90});assert.match(el('bio-status').textContent,/Previous area kept/);
 el('bio-zoom').value='2';await el('bio-zoom').fire('input');assert.match(el('bio-box-status').textContent,/width 50%/);
 await el('bio-clear-box').fire('click');assert.match(el('bio-box-status').textContent,/width 100%/);
});

test('diagnostics snapshot the same canvas immediately before inference and retain zero-pose evidence',async()=>{
 const {el,api,state,captures}=editor();state.poses=[];el('video-end').value='2';
 await el('bio-run').fire('click');assert.equal(el('bio-input-panel').hidden,false);
 const cards=el('bio-inputs').options;assert.equal(cards.length,3);
 for(const index of [1,3,6])assert.match(cards[[1,3,6].indexOf(index)].options[0].textContent,new RegExp('Sample '+index+'/6'));
 assert.equal(captures.filter((c,i)=>c.kind==='snapshot'&&captures[i+1]?.kind==='detect').length,3);
 for(let i=0;i<captures.length;i++)if(captures[i].kind==='snapshot'&&captures[i+1]?.kind==='detect'){
  assert.equal(captures[i+1].kind,'detect');assert.equal(captures[i].canvas,captures[i+1].canvas);assert.equal(captures[i].type,'image/png');
 }
 for(const card of cards)assert.match(card.options[2].textContent,/returned 0 pose/);
 assert.match(cards[1].options[0].textContent,/identical pixels/);
 api.reset();assert.equal(el('bio-input-panel').hidden,true);assert.equal(el('bio-inputs').options.length,0);
});

test('pose auto-find retains a moving path and preserves the crop aspect ratio on repeated analysis',async()=>{
 const {el,api,captures}=editor();el('video-end').value='2';
 await el('bio-auto').fire('click');assert.match(el('bio-box-status').textContent,/moving crop/);
 for(let attempt=0;attempt<2;attempt++){
  captures.length=0;await el('bio-run').fire('click');el('bio-confirm').checked=true;
  const data=api.getData();assert.equal(data.frames.length,6);
  for(const frame of data.frames){assert.equal(frame.crop.width,.36);assert.ok(frame.crop.height>=.46);}
  const draws=captures.filter(c=>c.kind==='draw'&&c.args.length===9&&c.canvas!==el('bio-canvas'));assert.equal(draws.length,6);
  for(const d of draws)assert.ok(Math.abs(d.width/d.height-d.args[3]/d.args[4])<.002,'detector input must keep source crop proportions');
 }
 api.reset();await el('bio-run').fire('click');el('bio-confirm').checked=true;
 assert.equal(api.getData().frames[0].crop.width,1,'new video/editor reset clears previous path');
});

test('moving crops do not silently resolve multiple people into a confirmed athlete',async()=>{
 const {el,api,state}=editor();await el('bio-auto').fire('click');state.poses=[state.poses[0],state.poses[0]];
 await el('bio-run').fire('click');assert.equal(el('bio-confirm').disabled,true);
 assert.match(el('bio-status').textContent,/multiple people/);assert.throws(()=>api.getData(),/No usable/);
});

test('portrait auto-find scans upper and lower frame and sends unstretched portrait crops',async()=>{
 const {el,captures}=editor(),video=el('video-player');video.videoWidth=1080;video.videoHeight=1920;
 await el('bio-auto').fire('click');
 const scans=captures.filter(c=>c.kind==='draw'&&c.args.length===9&&c.canvas!==el('bio-canvas'));assert.equal(scans.length,45);
 assert.ok(scans.some(d=>d.args[2]===0));
 assert.ok(scans.some(d=>Math.abs(d.args[2]+d.args[4]-1920)<1e-6));
 for(const d of scans)assert.ok(Math.abs(d.width/d.height-d.args[3]/d.args[4])<.002);
 await el('bio-area').fire('click');assert.match(el('bio-status').textContent,/Moving analysis area/);
});

test('failed portrait search keeps the whole frame instead of suggesting a lower-track region',async()=>{
 const {el,state}=editor();Object.assign(el('video-player'),{videoWidth:1080,videoHeight:1920});state.poses=[];
 await el('bio-auto').fire('click');assert.match(el('bio-status').textContent,/could not confirm/);
 await el('bio-area').fire('click');assert.equal(el('bio-canvas').width,1080);assert.equal(el('bio-canvas').height,1920);
});

test('auto-find preview and detector use identical source rectangles after model and side changes',async()=>{
 const {el,api,captures}=editor(),video=el('video-player');el('video-end').value='2';
 await el('bio-auto').fire('click');
 const sourceArea=async(time)=>{video.currentTime=time;captures.length=0;await el('bio-area').fire('click');return captures.find(c=>c.kind==='draw'&&c.args.length===9).args.slice(1,5);};
 const before=await sourceArea(1);
 el('bio-model').value='full';await el('bio-model').fire('change');
 el('bio-side').value='right';await el('bio-side').fire('change');
 assert.deepEqual(await sourceArea(1),before,'changing measurement settings must preserve the selected moving area');
 assert.match(el('bio-box-status').textContent,/moving crop/);
 captures.length=0;await el('bio-run').fire('click');el('bio-confirm').checked=true;
 const data=api.getData(),draws=captures.filter(c=>c.kind==='draw'&&c.args.length===9&&c.canvas!==el('bio-canvas'));
 assert.equal(draws.length,data.frames.length);
 for(let i=0;i<data.frames.length;i++)assert.deepEqual(await sourceArea(data.frames[i].time),draws[i].args.slice(1,5),'preview must use the same source rectangle as inference');
 el('video-end').value='1.8';await el('video-end').fire('input');
 assert.match(el('bio-box-status').textContent,/Fixed area/,'changing markers must visibly invalidate the old path');
});

test('analysis-area preview refreshes with playback and stops when analysis replaces it',async()=>{
 const {el,captures}=editor(),video=el('video-player');await el('bio-auto').fire('click');
 await el('bio-area').fire('click');captures.length=0;
 video.currentTime=1.1;await video.fire('timeupdate');
 assert.ok(captures.some(c=>c.kind==='draw'&&c.args.length===9),'playback must repaint the crop');
 captures.length=0;await video.fire('seeked');
 assert.ok(captures.some(c=>c.kind==='draw'&&c.args.length===9),'scrubbing must repaint the crop');
 await el('bio-run').fire('click');captures.length=0;await video.fire('timeupdate');
 assert.equal(captures.length,0,'playback must not overwrite a sample skeleton overlay');
});

test('guided positions replace wrong auto target and move the actual inference crop left to right',async()=>{
 const {el,api,captures}=editor();el('video-end').value='2';
 await el('bio-auto').fire('click');
 const box=async(which,x)=>{await el('bio-guide-'+which).fire('click');await el('bio-box-canvas').fire('pointerdown',{clientX:x,clientY:50});await el('bio-box-canvas').fire('pointerup',{clientX:x+15,clientY:80});};
 await box('start',5);await el('bio-run').fire('click');assert.match(el('bio-status').textContent,/both the marked start and end/);
 await box('end',65);await el('bio-auto').fire('click');assert.match(el('bio-status').textContent,/guided athlete path is selected/);
 el('bio-model').value='full';await el('bio-model').fire('change');
 captures.length=0;await el('bio-run').fire('click');el('bio-confirm').checked=true;
 const saved=api.getData();assert.equal(saved.guidedPath.length,2);
 const draws=captures.filter(c=>c.kind==='draw'&&c.args.length===9&&c.canvas!==el('bio-canvas'));assert.equal(draws.length,6);
 for(let i=0;i<draws.length;i++){
  assert.ok(Math.abs(saved.frames[i].crop.x-(.05+.6*i/5))<1e-9);
  assert.ok(Math.abs(draws[i].args[1]-saved.frames[i].crop.x*1920)<1e-9);
  assert.ok(Math.abs(draws[i].args[3]-1920*.15)<1e-9,'must use selected tight boxes, not auto envelope');
 }
 api.reset();api.restore(saved);await el('bio-run').fire('click');el('bio-confirm').checked=true;
 assert.equal(JSON.stringify(api.getData().guidedPath),JSON.stringify(saved.guidedPath));
 el('video-player').currentTime=1.5;await box('add',45);
 await el('bio-run').fire('click');el('bio-confirm').checked=true;assert.equal(api.getData().guidedPath.length,3);
 await el('bio-clear-box').fire('click');await el('bio-run').fire('click');el('bio-confirm').checked=true;
 assert.equal(api.getData().guidedPath,undefined);assert.equal(api.getData().frames[0].crop.width,1);
});

test('guided area does not turn failed pose detection into usable measurements',async()=>{
 const {el,api,state}=editor();
 for(const which of ['start','end']){await el('bio-guide-'+which).fire('click');await el('bio-box-canvas').fire('pointerdown',{clientX:10,clientY:30});await el('bio-box-canvas').fire('pointerup',{clientX:30,clientY:80});}
 state.poses=[];await el('bio-run').fire('click');assert.equal(el('bio-confirm').disabled,true);assert.throws(()=>api.getData(),/No usable/);
 await el('bio-guide-add').fire('click');await el('bio-box-cancel').fire('click');assert.equal(el('video-player').controls,true);
 assert.match(el('bio-box-status').textContent,/2 position/);
});

test('browser-shaped detections render skeleton lines and angles without a presence field',async()=>{
 const {el,api,captures}=editor();await el('bio-run').fire('click');
 assert.equal(el('bio-confirm').disabled,false);el('bio-confirm').checked=true;
 const saved=api.getData();assert.equal(Object.hasOwn(saved.frames[0].points[0],'presence'),false);
 assert.ok(captures.some(c=>c.kind==='lineTo'),'overlay must draw skeleton segments');
 assert.ok(captures.some(c=>c.kind==='arc'),'overlay must draw landmark dots');
 assert.match(el('bio-results').textContent,/\d+°/,'angles must be shown');
 assert.match(el('bio-inputs').options[0].options[2].textContent,/returned 1 pose/);
});

test('review selects strongest sample and maps landmarks into enlarged crop with full-frame toggle',async()=>{
 const {el,api,captures,state}=editor();const crop={x:.2,y:.3,width:.4,height:.5};
 const pose=state.poses[0],frame=B.frame(1.2,B.mapPoses([pose],crop));frame.crop=crop;
 api.restore({version:1,engine:B.ENGINE,confirmed:true,view:'side',side:'left',width:1920,height:1080,start:1,end:1.2,crop,frames:[B.frame(1,[]),frame]});
 assert.equal(el('bio-frames').value,'1');assert.match(el('bio-frames').options[0].textContent,/No athlete/);
 captures.length=0;await el('bio-preview').fire('click');
 const draw=captures.find(c=>c.kind==='draw'&&c.canvas===el('bio-canvas'));
 assert.deepEqual(draw.args.slice(1,5),[384,324,768,540]);
 const dot=captures.find(c=>c.kind==='arc');
 assert.ok(Math.abs(dot.args[0]-pose[0].x*draw.width)<1e-8);assert.ok(Math.abs(dot.args[1]-pose[0].y*draw.height)<1e-8);assert.equal(dot.args[2],2.5);
 el('bio-full-context').checked=true;captures.length=0;await el('bio-full-context').fire('change');
 const full=captures.find(c=>c.kind==='draw'&&c.canvas===el('bio-canvas'));
 assert.deepEqual(full.args.slice(1,5),[0,0,1920,1080]);assert.equal(el('bio-frames').value,'1');
});

test('overlays reuse frozen source images without another video seek',async()=>{
 const {el,captures}=editor();await el('bio-run').fire('click');
 const player=el('video-player');player.currentTime=4;
 await el('bio-preview').fire('click');assert.equal(player.currentTime,4);
 const draw=captures.filter(c=>c.kind==='draw'&&c.canvas===el('bio-canvas')).at(-1);
 assert.match(draw.args[0].src,/^data:image\/png/);assert.match(el('bio-frame-source').textContent,/Exact captured frame/);
 assert.equal(el('bio-edit-joints').disabled,false);
});
test('manual placement recovers missed detections, invalidates confirmation, saves provenance and undoes',async()=>{
 const {el,api,state}=editor();state.poses=[];await el('bio-run').fire('click');
 const canvas=el('bio-canvas');
 for(const [joint,x,y] of [[23,40,40],[25,40,60],[27,60,60]]){
  el('bio-edit-joints').checked=true;el('bio-joint').value=String(joint);
  await canvas.fire('pointerdown',{clientX:x,clientY:y});await canvas.fire('pointerup',{clientX:x,clientY:y});
 }
 assert.match(el('bio-results').textContent,/Manually corrected/);assert.match(el('bio-results').textContent,/90°/);
 assert.equal(el('bio-confirm').disabled,false);assert.equal(el('bio-confirm').checked,false);
 el('bio-confirm').checked=true;const saved=api.getData();assert.equal(saved.frames[0].points[25].manual,true);
 assert.equal(saved.frames[0].points[25].visibility,0);B.validate(saved,saved);
 await el('bio-undo-joints').fire('click');assert.match(el('bio-results').textContent,/No athlete detected/);assert.equal(el('bio-confirm').disabled,true);
 api.restore(saved);await el('bio-preview').fire('click');assert.equal(el('bio-edit-joints').disabled,true);
 assert.match(el('bio-results').textContent,/Manually corrected/);
});

function trackingFixture(stopAfter=Infinity,onStep=()=>{}){
 const T=require('../preview/biomechanics/athlete-tracker.js');
 return {gray:x=>x,seed:()=>({cx:200,cy:200,bodyHeight:60,steps:0}),crop:T.crop,
 step(im,s){onStep();return s.steps>=stopAfter?{ok:false,reason:'Crossing subject.'}:{ok:true,state:{...s,cx:s.cx+2,steps:s.steps+1}};}};
}
test('selected athlete path reaches detector, persists through model changes and round-trips',async()=>{
 const {el,api,captures}=editor(trackingFixture());
 await el('bio-pick-athlete').fire('click');assert.equal(el('bio-box-editor').hidden,false);
 await el('bio-box-canvas').fire('pointerdown',{clientX:20,clientY:40});
 assert.equal(el('video-start').value,'1');assert.equal(el('video-end').value,'4');
 assert.match(el('bio-status').textContent,/Suggested moving crop ready/);
 el('bio-model').value='full';await el('bio-model').fire('change');
 captures.length=0;await el('bio-run').fire('click');el('bio-confirm').checked=true;
 const data=api.getData();assert.equal(data.guidedPath.length,46);B.validate(data,data);
 assert.ok(data.frames.at(-1).crop.x>data.frames[0].crop.x);
 const draws=captures.filter(c=>c.kind==='draw'&&c.args.length===9);
 for(const f of data.frames)assert.ok(draws.some(d=>Math.abs(d.args[1]-f.crop.x*data.width)<1e-6));
 api.restore(data);assert.equal(JSON.stringify(api.getData()),JSON.stringify(data));
});
test('unreliable tracking shortens the segment and an immediate failure leaves markers intact',async()=>{
 const {el}=editor(trackingFixture(4));await el('bio-pick-athlete').fire('click');
 await el('bio-box-canvas').fire('pointerdown',{clientX:20,clientY:40});
 assert.match(el('bio-status').textContent,/Tracking stopped.*Crossing subject/);
 assert.ok(Number(el('video-end').value)<1.3);assert.equal(el('bio-run').disabled,false);
 const failed=editor(trackingFixture(0));await failed.el('bio-pick-athlete').fire('click');
 await failed.el('bio-box-canvas').fire('pointerdown',{clientX:20,clientY:40});
 assert.match(failed.el('bio-status').textContent,/Could not follow/);assert.equal(failed.el('video-end').value,'1.2');
});
test('cancellation during tracking never installs a partial path or changes markers',async()=>{
 let e;e=editor(trackingFixture(Infinity,()=>e.el('bio-cancel').fire('click')));
 await e.el('bio-pick-athlete').fire('click');await e.el('bio-box-canvas').fire('pointerdown',{clientX:20,clientY:40});
 assert.equal(e.el('video-end').value,'1.2');assert.match(e.el('bio-status').textContent,/canceled/);
 assert.equal(e.el('bio-run').disabled,false);assert.equal(e.api.getData(),undefined);
});
