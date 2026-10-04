// Interface regression checks with simulated media, canvas and model responses.
// These do not verify video decoding, pointer layout, or real pose inference.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const B=require('../preview/biomechanics/biomechanics-model.js');
function editor(){
 class Element {
  constructor(){this.value='';this.handlers={};this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.options=[];}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(x=>x!==fn);}
  async fire(type,data={}){for(const fn of this.handlers[type]||[])await fn({pointerId:1,button:0,preventDefault(){},...data});}
  append(x){this.options.push(x);if(this.options.length===1)this.value='0';}
  replaceChildren(){this.options=[];}
  getContext(){return new Proxy({},{get:()=>()=>{}});}
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
 const module={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:async (files,options)=>{requests.push(options);if(state.fail)throw Error('fixture download failure');return {detect:()=>({landmarks:state.poses})};}}};
 const context={document:doc,VXTBiomechanics:B,window:{},Event:class{},structuredClone,performance,setTimeout,clearTimeout,__model:module};
 let source=fs.readFileSync('preview/biomechanics/biomechanics.js','utf8');source=source.replace(/await import\('[^']+'\)/,'await Promise.resolve(__model)');vm.runInNewContext(source,context);
 return {el,api:context.window.VXTBiomechanicsEditor,state,requests};
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
