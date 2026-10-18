(function(root){
'use strict';
function gray(image){const out=new Float32Array(image.width*image.height);for(let i=0;i<out.length;i++)out[i]=.299*image.data[i*4]+.587*image.data[i*4+1]+.114*image.data[i*4+2];return {width:image.width,height:image.height,data:out};}
function patch(im,x,y,w,h){const a=[];for(let j=0;j<h;j++)for(let i=0;i<w;i++)a.push(im.data[(y+j)*im.width+x+i]);const mean=a.reduce((s,v)=>s+v,0)/a.length;return a.map(v=>v-mean);}
function seed(im,cx,cy,bodyHeight){const w=Math.max(6,2*Math.round(bodyHeight*.27/2)),h=Math.max(8,2*Math.round(bodyHeight*.4/2)),x=Math.round(cx-w/2),y=Math.round(cy-h/2);if(x<0||y<0||x+w>=im.width||y+h>=im.height)throw Error('Tap an athlete fully inside the image.');const template=patch(im,x,y,w,h);if(template.reduce((s,v)=>s+v*v,0)/template.length<25)throw Error('This area has too little detail. Tap the athlete’s torso on a clearer frame.');return {cx:x+w/2,cy:y+h/2,w,h,bodyHeight,template,vx:0,vy:0,steps:0};}
function step(im,s){const radius=Math.max(12,Math.round(s.bodyHeight*.55)),norm=Math.sqrt(s.template.reduce((a,v)=>a+v*v,0));let best=null;
 for(let y=Math.max(0,Math.round(s.cy-radius-s.h/2));y<=Math.min(im.height-s.h,Math.round(s.cy+radius-s.h/2));y++)for(let x=Math.max(0,Math.round(s.cx-radius-s.w/2));x<=Math.min(im.width-s.w,Math.round(s.cx+radius-s.w/2));x++){
  let sum=0,sq=0,dot=0,k=0;for(let j=0;j<s.h;j++)for(let i=0;i<s.w;i++){const v=im.data[(y+j)*im.width+x+i];sum+=v;sq+=v*v;dot+=v*s.template[k++];}const score=dot/(norm*Math.sqrt(Math.max(1e-9,sq-sum*sum/k)));if(!best||score>best.score)best={x,y,score};
 }
 if(!best||best.score<.65)return {ok:false,reason:'The athlete’s appearance changed or became unclear.'};
 const cx=best.x+s.w/2,cy=best.y+s.h/2,dx=cx-s.cx,dy=cy-s.cy;
 if(s.steps>=3&&Math.hypot(dx-s.vx,dy-s.vy)>Math.max(s.w*.8,Math.hypot(s.vx,s.vy)*.65))return {ok:false,reason:'Movement changed unexpectedly; tracking may have switched people.'};
 return {ok:true,state:{...s,cx,cy,template:patch(im,best.x,best.y,s.w,s.h),vx:s.steps?(.5*s.vx+.5*dx):dx,vy:s.steps?(.5*s.vy+.5*dy):dy,steps:s.steps+1},score:best.score};
}
function crop(s,width,height){const size=Math.min(width,height,s.bodyHeight*2.1);return {x:Math.max(0,Math.min(width-size,s.cx-size/2))/width,y:Math.max(0,Math.min(height-size,s.cy+s.bodyHeight*.2-size/2))/height,width:size/width,height:size/height};}
const api={gray,seed,step,crop};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VXTAthleteTracker=api;
})(globalThis);
