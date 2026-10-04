(function(root){
'use strict';
const ENGINE='mediapipe-pose-lite-0.10.21-v1';
const ENGINES={lite:ENGINE,full:'mediapipe-pose-full-0.10.21-v1'};
const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
function visible(p){return !!p&&finite(p.x,0,1)&&finite(p.y,0,1)&&finite(p.visibility,0.7,1)&&finite(p.presence,0.7,1);}
function angle(a,b,c){const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y],d=Math.hypot(...u)*Math.hypot(...v);return d<1e-8?null:Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/d)))*180/Math.PI;}
function measure(frame,width,height,side){
 const empty={knee:null,hip:null,elbow:null,trunk:null};
 if(frame.reason||!frame.points||!finite(width,1,16384)||!finite(height,1,16384)||!['left','right'].includes(side))return empty;
 const p=frame.points.map(p=>visible(p)?{x:p.x*width,y:p.y*height}:null),i=side==='left'?0:1;
 const joint=(a,b,c)=>p[a]&&p[b]&&p[c]?angle(p[a],p[b],p[c]):null;
 const s=p[11+i],h=p[23+i];
 return {knee:joint(23+i,25+i,27+i),hip:joint(11+i,23+i,25+i),elbow:joint(11+i,13+i,15+i),trunk:s&&h&&Math.hypot(s.x-h.x,s.y-h.y)>1e-8?Math.atan2(Math.abs(s.x-h.x),h.y-s.y)*180/Math.PI:null};
}
function cropArea(zoom,cx,cy){
 if(![1,2,3,4].includes(zoom)||!finite(cx,0,1)||!finite(cy,0,1))throw Error('Choose a valid analysis zoom and center.');
 const size=1/zoom;return {x:Math.max(0,Math.min(1-size,cx-size/2)),y:Math.max(0,Math.min(1-size,cy-size/2)),width:size,height:size};
}
function validCrop(c){return !!c&&finite(c.x,0,1)&&finite(c.y,0,1)&&finite(c.width,.05,1)&&finite(c.height,.05,1)&&c.x+c.width<=1.000001&&c.y+c.height<=1.000001;}
function boxCrop(a,b){
 const c={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};
 if(!validCrop(c))throw Error('Draw a larger box (at least 5% of the frame in each direction).');return c;
}
function diagnostics(frames,width,height,side,model='lite'){
 const total=frames.length,missing=frames.filter(f=>f.reason==='no-person').length,multiple=frames.filter(f=>f.reason==='multiple-people').length;
 const usable=frames.filter(f=>Object.values(measure(f,width,height,side)).some(v=>v!==null)).length;
 const uncertain=total-missing-multiple-usable;
 return {total,missing,multiple,usable,uncertain,message:`${usable}/${total} samples have usable angles; ${missing} no athlete detected; ${multiple} multiple people; ${uncertain} joints below confidence threshold. `+(usable?'Inspect skeleton alignment before confirming. ': '')+(multiple?'Crop to one athlete and retry. ': '')+(missing?(model==='full'?'Check the captured detector inputs below; verify the athlete is visible throughout the crop. ':'Check the captured detector inputs below; try Full if the athlete is clearly visible. '): '')+(uncertain?'Hidden joints, camera angle, small body size or blur can reduce confidence; this is not a sharpness measurement.':'')};
}
function mapPoses(poses,crop){return poses.map(points=>points.map(p=>finite(p.x,0,1)&&finite(p.y,0,1)?{...p,x:crop.x+p.x*crop.width,y:crop.y+p.y*crop.height}:{...p,x:0,y:0,visibility:0,presence:0}));}
function frame(time,poses){
 if(poses.length!==1)return {time,reason:poses.length?'multiple-people':'no-person',points:[]};
 const points=poses[0].map(p=>({x:p.x,y:p.y,visibility:p.visibility??0,presence:p.presence??0}));
 // Outside-frame predictions are kept as missing points rather than trusted geometry.
 return {time,reason:'',points:points.map(p=>finite(p.x,0,1)&&finite(p.y,0,1)?p:{x:0,y:0,visibility:0,presence:0})};
}
function validate(b,r){
 if(!b||b.version!==1||!Object.values(ENGINES).includes(b.engine)||b.confirmed!==true||b.view!=='side'||!['left','right'].includes(b.side)||!finite(b.width,1,16384)||!finite(b.height,1,16384)||!Number.isInteger(b.width)||!Number.isInteger(b.height)||b.start!==r.start||b.end!==r.end||!Array.isArray(b.frames)||b.frames.length<1||b.frames.length>51)throw Error('Invalid biomechanics analysis. Reanalyze the marked segment and confirm the tracking.');
 if(b.crop!==undefined){const c=b.crop;if(!validCrop(c))throw Error('Invalid analysis crop.');}
 let prev=-1;
 for(const f of b.frames){if(!f||!finite(f.time,r.start,r.end)||f.time<=prev||!['','no-person','multiple-people'].includes(f.reason)||!Array.isArray(f.points)||f.points.length!==(f.reason?0:33))throw Error('Invalid biomechanics frame.');prev=f.time;for(const p of f.points)if(!p||!finite(p.x,0,1)||!finite(p.y,0,1)||!finite(p.visibility,0,1)||!finite(p.presence,0,1))throw Error('Invalid body landmark.');}
 return b;
}
const labels={knee:'Knee included angle',hip:'Hip included angle',elbow:'Elbow included angle',trunk:'Trunk tilt from image vertical'};
function describe(b){const valid=b.frames.filter(f=>Object.values(measure(f,b.width,b.height,b.side)).some(x=>x!==null)).length;return `Experimental 2D biomechanics · ${b.engine===ENGINES.full?'Full':'Lite'} model · ${b.side} side · ${valid}/${b.frames.length} sampled frames assessable · coach reviewed. Angles are image-plane estimates, not 3D measurements or a technique score.`;}
const api={ENGINE,ENGINES,validCrop,boxCrop,diagnostics,cropArea,mapPoses,visible,angle,measure,frame,validate,labels,describe};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTBiomechanics=api;
})(globalThis);
