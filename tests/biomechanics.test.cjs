const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../preview/biomechanics/biomechanics-model.js');
const points=()=>Array.from({length:33},(_,i)=>({x:.2+(i%5)*.1,y:.1+Math.floor(i/5)*.1,visibility:.95,presence:.95}));
const sample=()=>({version:1,engine:B.ENGINE,confirmed:true,view:'side',side:'left',width:1920,height:1080,start:1,end:2,frames:[B.frame(1,[points()])]});
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
