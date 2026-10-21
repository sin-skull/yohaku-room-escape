// Metres in the area's floor plane. Collision is kinematic, not physics.
import {AREAS,areaId} from './mansion.js?v=1.5.0';
export const START = Object.freeze(AREAS.parlor.start);
export const BOUNDS = Object.freeze(AREAS.parlor.bounds);
const RADIUS=.19;
export const angleDelta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export function createNavigation(location='parlor'){
const config=AREAS[areaId(location)],BOUNDS=config.bounds;
const obstacles=config.obstacles.map(([minX,maxX,minZ,maxZ])=>({minX,maxX,minZ,maxZ}));
function canStand({x,z}){
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<BOUNDS.minX||x>BOUNDS.maxX||z<BOUNDS.minZ||z>BOUNDS.maxZ)return false;
  return !obstacles.some(b=>Math.hypot(x-Math.max(b.minX,Math.min(b.maxX,x)),z-Math.max(b.minZ,Math.min(b.maxZ,z)))<RADIUS);
}
function moveBy(position,dx,dz){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
  let next={...position};
  for(let i=0;i<steps;i++){
    const whole={x:next.x+dx/steps,z:next.z+dz/steps};
    if(canStand(whole)){next=whole;continue;}
    const alongX={x:whole.x,z:next.z};if(canStand(alongX))next=alongX;
    const alongZ={x:next.x,z:whole.z};if(canStand(alongZ))next=alongZ;
  }
  return next;
}
function walkStep(position,side,forward,yaw,seconds){
  const length=Math.max(1,Math.hypot(side,forward)),distance=1.35*Math.min(.05,Math.max(0,seconds))/length;
  return moveBy(position,(Math.cos(yaw)*side+Math.sin(yaw)*forward)*distance,(Math.sin(yaw)*side-Math.cos(yaw)*forward)*distance);
}
function clearLine(a,b){
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06));
  for(let i=1;i<=n;i++)if(!canStand({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n}))return false;
  return true;
}
// Small bounded grid, computed only when an object is tapped. No per-frame search.
function findPath(start,goal){
  if(!canStand(start)||!canStand(goal))return null;
  if(clearLine(start,goal))return [{...goal}];
  const step=.24,cols=Math.floor((BOUNDS.maxX-BOUNDS.minX)/step),rows=Math.floor((BOUNDS.maxZ-BOUNDS.minZ)/step);
  const point=id=>({x:BOUNDS.minX+.12+(id%cols)*step,z:BOUNDS.minZ+.12+Math.floor(id/cols)*step});
  const nodes=Array.from({length:cols*rows},(_,id)=>canStand(point(id)));
  const nearest=p=>{let best=-1,distance=Infinity;for(let id=0;id<nodes.length;id++){if(!nodes[id])continue;const q=point(id),d=Math.hypot(q.x-p.x,q.z-p.z);if(d<distance&&clearLine(p,q)){best=id;distance=d;}}return best;};
  const first=nearest(start),last=nearest(goal);if(first<0||last<0)return null;
  const parents=new Int32Array(nodes.length).fill(-1),queue=[first];parents[first]=first;
  for(let head=0;head<queue.length&&parents[last]<0;head++){
    const id=queue[head],col=id%cols,row=Math.floor(id/cols);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const x=col+dx,z=row+dz;if(x<0||x>=cols||z<0||z>=rows)continue;
      const next=z*cols+x;if(parents[next]>=0||!nodes[next]||!clearLine(point(id),point(next)))continue;
      parents[next]=id;queue.push(next);
    }
  }
  if(parents[last]<0)return null;
  const raw=[{...goal}];let id=last;while(id!==first){raw.push(point(id));id=parents[id];}raw.push(point(first));raw.reverse();
  const path=[];let anchor=start;
  for(let i=0;i<raw.length;){let far=raw.length-1;while(far>i&&!clearLine(anchor,raw[far]))far--;path.push(raw[far]);anchor=raw[far];i=far+1;}
  return path;
}
return {canStand,moveBy,walkStep,findPath};
}
export const {canStand,moveBy,walkStep,findPath}=createNavigation();
