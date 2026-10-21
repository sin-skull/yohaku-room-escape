// Real painted fragments are projected onto different physical planes.
// Nothing swaps the visible glyph when a view mode changes.
export const GOD_TARGET=[3.1,2.1,.6];
export const GOD_DISTANCE=5.7;
export const GOD_PITCH=1.2;
export const GOD_EYE=[GOD_TARGET[0],GOD_TARGET[1]+Math.sin(GOD_PITCH)*GOD_DISTANCE,GOD_TARGET[2]+Math.cos(GOD_PITCH)*GOD_DISTANCE];
export const PEEP_EYE=[-2.75,1.58,.9];
export const PEEP_TARGET=[-2.75,1.58,2.6];
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const mul=(a,s)=>a.map(n=>n*s);
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
const unit=a=>mul(a,1/Math.hypot(...a));
function basis(kind){
 if(kind==='pine'){const forward=unit(sub(GOD_TARGET,GOD_EYE));return {eye:GOD_EYE,forward,right:[1,0,0],up:[0,-forward[2],forward[1]],distance:GOD_DISTANCE};}
 return {eye:PEEP_EYE,forward:[0,0,1],right:[-1,0,0],up:[0,1,0],distance:1.7};
}
export function paintPoint(kind,u,v,plane){
 const b=basis(kind),ray=add(add(mul(b.forward,b.distance),mul(b.right,u)),mul(b.up,v));
 const axis=kind==='pine'?1:2,t=(plane-b.eye[axis])/ray[axis];
 return add(b.eye,mul(ray,t));
}
export function projectedPoint(kind,world){
 const b=basis(kind),ray=sub(world,b.eye),depth=dot(ray,b.forward);
 return [dot(ray,b.right)*b.distance/depth,dot(ray,b.up)*b.distance/depth];
}
export function inkFragments(kind){
 const fragments=[];
 if(kind==='pine'){
  for(let row=0;row<3;row++){
   const width=[1.13,.88,1.38][row],v=[.48,0,-.48][row];
   for(let col=0;col<3;col++){
    const u0=-width/2+width*col/3-.012,u1=-width/2+width*(col+1)/3+.012,plane=[2.05,2.38,2.7][(row+col)%3];
    fragments.push({u0,u1,v0:v-.045,v1:v+.045,plane,points:[[u0,v-.045],[u1,v-.045],[u1,v+.045],[u0,v+.045]].map(([u,y])=>paintPoint(kind,u,y,plane))});
   }
  }
 }else{
  for(let col=0;col<3;col++){
   const u0=-.34+.68*col/3-.006,u1=-.34+.68*(col+1)/3+.006,plane=[1.68,2.12,2.72][col];
   fragments.push({u0,u1,v0:-.028,v1:.028,plane,points:[[u0,-.028],[u1,-.028],[u1,.028],[u0,.028]].map(([u,v])=>paintPoint(kind,u,v,plane))});
  }
 }
 return fragments;
}
export function alignedObservation(position,direction){
 const dir=unit(direction);
 if(Math.hypot(...sub(position,GOD_EYE))<1.05&&dot(dir,basis('pine').forward)>Math.cos(.2))return 'pine';
 if(Math.hypot(position[0]-PEEP_EYE[0],position[2]-PEEP_EYE[2])<.36&&Math.abs(position[1]-PEEP_EYE[1])<.12&&dot(dir,[0,0,1])>Math.cos(.22))return 'bamboo';
 return null;
}
