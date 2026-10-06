// Interface regression checks with simulated media, canvas and model responses.
// These do not verify video decoding, pointer layout, or real pose inference.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const B=require('../preview/biomechanics/biomechanics-model.js');
function editor(){
 const captures=[];
 class Element {
  constructor(){this.value='';this.handlers={};this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.options=[];}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(x=>x!==fn);}
  async fire(type,data={}){for(const fn of this.handlers[type]||[])await fn({pointerId:1,button:0,preventDefault(){},...data});}
  append(x){this.options.push(x);if(this.options.length===1)this.value='0';}
  replaceChildren(){this.options=[];}
  toDataURL(type){captures.push({kind:'snapshot',canvas:this,type});return 'data:image/png;base64,fixture';}
  getContext(){const canvas=this;return new Proxy({},{get:(target,key)=>key==='getImageData'?()=>({width:canvas.width,height:canvas.height,data:new Uint8ClampedArray(canvas.width*canvas.height*4)}):key==='drawImage'?(...args)=>captures.push({kind:'draw',canvas,args,width:canvas.width,height:canvas.height}):()=>{}});}
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
  setPointerCapture(id){this.capture=id;} hasPointerCapture(id){return this.capture===id;} releasePointerCapture(){this.capture=null;}
 }
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const doc={getElementById:el,createElement:()=>new Element(),addEventListener(){},dispatchEvent(){}};
 for(const [id,value] of Object.entries({'bio-zoom':'1','bio-center-x':'50','bio-center-y':'50','bio-model':'lite','bio-side':'left','video-start':'1','video-end':'1.2','video-athlete':'a'}))el(id).value=value;
 el('bio-side-view').checked=true;
 const video=el('video-player');Object.assign(video,{readyState:2,seeking:false,duration:5,videoWidth:1920,videoHeight:1080,pause(){},getAttribute:()=> 'blob:fixture'});
 let time=1;Object.defineProperty(video,'currentTime',{get:()=>time,set:v=>{time=v;queueMicrotask(()=>video.fire('seeked'));}});
 const points=Array.from({length:33},(_,i)=>({x:.2+(i%5)*.1,y:.1+Math.floor(i/5)*.1,visibility:.95,presence:.95}));
 const requests=[],state={fail:false,poses:[points]};
 const module={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:async (files,options)=>{requests.push(options);if(state.fail)throw Error('fixture download failure');return {detect:canvas=>{captures.push({kind:'detect',canvas});return {landmarks:state.poses};}};}}};
 const context={document:doc,VXTBiomechanics:B,window:{},Event:class{},structuredClone,performance,setTimeout,clearTimeout,__model:module};
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
 for(let i=0;i<captures.length;i++)if(captures[i].kind==='snapshot'){
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
  const draws=captures.filter(c=>c.kind==='draw'&&c.args.length===9);assert.equal(draws.length,6);
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
 const scans=captures.filter(c=>c.kind==='draw'&&c.args.length===9);assert.equal(scans.length,45);
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
