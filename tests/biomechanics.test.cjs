const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../preview/biomechanics/biomechanics-model.js');
const points=()=>Array.from({length:33},(_,i)=>({x:.2+(i%5)*.1,y:.1+Math.floor(i/5)*.1,visibility:.95,presence:.95}));
const sample=()=>({version:1,engine:B.ENGINE,confirmed:true,view:'side',side:'left',width:1920,height:1080,start:1,end:2,frames:[B.frame(1,[points()])]});
test('moving crops interpolate actual timestamps, including gaps, and clamp at frame edges',()=>{
 const path=[{time:2,cx:.2,cy:.5},{time:8,cx:.8,cy:.5}];
 assert.ok(Math.abs(B.trackedCrop(path,5).x-.32)<1e-8);
 assert.ok(Math.abs(B.trackedCrop(path,3).x-.12)<1e-8);
 assert.deepEqual(B.trackedCrop(path,0),B.trackedCrop(path,2));
 assert.deepEqual(B.trackedCrop(path,9),B.trackedCrop(path,8));
 const edges=[{time:1,cx:0,cy:0},{time:2,cx:1,cy:1}];
 assert.equal(B.trackedCrop(edges,1).x,0);
 assert.equal(B.trackedCrop(edges,2).x,.64);
 assert.ok(B.validCrop(B.trackedCrop(edges,2)));
 assert.throws(()=>B.trackedCrop([path[1],path[0]],4));
});
test('saved per-sample crops round-trip, reject invalid areas, and remain optional for old reviews',()=>{
 const saved=sample();saved.frames[0].crop={x:.2,y:.3,width:.36,height:.46};
 assert.deepEqual(B.validate(JSON.parse(JSON.stringify(saved)),saved),saved);
 saved.frames[0].crop.x=.9;assert.throws(()=>B.validate(saved,saved),/sample crop/);
 assert.doesNotThrow(()=>B.validate(sample(),{start:1,end:2}));
});
test('drawn boxes support both directions and reject tiny/out-of-frame selections',()=>{
 const a={x:.2,y:.1},b={x:.6,y:.9};assert.deepEqual(B.boxCrop(a,b),B.boxCrop(b,a));
 assert.throws(()=>B.boxCrop(a,{x:.21,y:.8}));assert.throws(()=>B.boxCrop(a,{x:2,y:.8}));
});
test('rectangular crop maps landmarks back to source pixels without altering joint geometry',()=>{
 const crop={x:.1,y:.2,width:.3,height:.6};const p=points();
 const mapped=B.mapPoses([p],crop)[0];assert.equal(mapped[0].x,.16);assert.equal(mapped[0].y,.26);
 const local=B.measure(B.frame(1,[p]),1920*crop.width,1080*crop.height,'left');
 const original=B.measure(B.frame(1,[mapped]),1920,1080,'left');
 for(const key of Object.keys(local))assert.ok(Math.abs(local[key]-original[key])<1e-5);
 assert.equal(B.mapPoses([[{...p[0],x:-.1}]],crop)[0][0].visibility,0);
});
test('saved Lite analyses remain valid; Full provenance and custom crops round-trip',()=>{
 assert.equal(B.validate(sample(),{start:1,end:2}).engine,B.ENGINE);
 const full={...sample(),engine:B.ENGINES.full,crop:{x:.1,y:.1,width:.2,height:.7}};
 assert.deepEqual(B.validate(JSON.parse(JSON.stringify(full)),{start:1,end:2}),full);
 assert.throws(()=>B.validate({...full,engine:'unknown'},{start:1,end:2}));
 assert.throws(()=>B.validate({...full,crop:{x:.9,y:0,width:.2,height:1}},{start:1,end:2}));
});
test('diagnostics distinguish no person, multiple people, uncertain joints and usable angles',()=>{
 const p=points(),low=p.map(x=>({...x,visibility:.1}));
 const report=B.diagnostics([B.frame(1,[]),B.frame(2,[p,p]),B.frame(3,[low]),B.frame(4,[p])],1920,1080,'left');
 assert.equal(report.missing,1);assert.equal(report.multiple,1);assert.equal(report.uncertain,1);assert.equal(report.usable,1);
 assert.match(report.message,/not a sharpness measurement/);
});

test('Full failures direct users to captured inputs without suggesting Full again',()=>{
 const report=B.diagnostics([B.frame(1,[])],1920,1080,'left','full');
 assert.match(report.message,/captured detector inputs/);assert.doesNotMatch(report.message,/try Full/);
});
test('auto-find scan tiles cover the frame with overlap and union adds bounded padding',()=>{
 const tiles=B.autoScanCrops();assert.equal(tiles.length,9);
 assert.ok(tiles.every(c=>B.validCrop(c)));
 assert.ok(Math.max(...tiles.map(c=>c.x+c.width))===1);
 assert.ok(Math.max(...tiles.map(c=>c.y+c.height))===1);
 assert.ok(tiles.some(a=>a.x===0&&tiles.some(b=>b.x>a.x&&b.x< a.width)));
 const crop=B.unionCrop([{x:.35,y:.45,width:.08,height:.15},{x:.45,y:.44,width:.08,height:.16}]);
 assert.ok(crop.x<.35&&crop.y<.44);assert.ok(crop.x+crop.width>.53&&crop.y+crop.height>.60);assert.ok(B.validCrop(crop));
});

test('small detected runners produce valid crops, including at the edge of the source',()=>{
 for(const box of [{x:.4,y:.5,width:.02,height:.04},{x:.98,y:.97,width:.02,height:.03}]){
  const crop=B.unionCrop([box],.25,.5);assert.ok(B.validCrop(crop));
  assert.ok(crop.x<=box.x&&crop.x+crop.width>=box.x+box.width);
 }
 assert.throws(()=>B.unionCrop([{x:.99,y:0,width:.1,height:.1}]));
});

test('phone formats use their actual dimensions and scan every part of the frame',()=>{
 for(const [w,h,ratio] of [[1080,1920,'9:16'],[1920,1080,'16:9'],[1440,1920,'3:4'],[1920,1440,'4:3'],[1080,1080,'1:1'],[3840,2160,'16:9']]){
  assert.ok(B.videoFormat(w,h).label.includes(ratio));
  const tiles=B.autoScanCrops(w,h);assert.equal(tiles.length,9);assert.ok(tiles.every(B.validCrop));
  for(let y=0;y<=20;y++)for(let x=0;x<=20;x++)assert.ok(tiles.some(c=>x/20>=c.x&&x/20<=c.x+c.width&&y/20>=c.y&&y/20<=c.y+c.height));
 }
 assert.notDeepEqual(B.autoScanCrops(1080,1920),B.autoScanCrops(1920,1080));
 assert.throws(()=>B.autoScanCrops(0,1920));
});

test('close phone footage gets a larger following crop that contains the detected body',()=>{
 const path=[{time:0,cx:.5,cy:.5,width:.4,height:.7},{time:1,cx:.55,cy:.5,width:.4,height:.7}];
 const crop=B.trackedCrop(path,.5);assert.ok(crop.width>=.6);assert.equal(crop.height,1);assert.ok(B.validCrop(crop));
});
