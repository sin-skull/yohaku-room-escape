// Metres in the room's floor plane. Collision is deliberately kinematic, not physics.
export const START = Object.freeze({x:1.4,z:2.25});
export const BOUNDS = Object.freeze({minX:-4.03,maxX:4.12,minZ:-2.72,maxZ:2.8});
const RADIUS=.19;
const obstacles=[
  {minX:-1.57,maxX:.88,minZ:-.25,maxZ:1.34}, // low table, including its legs
  {minX:-.54,maxX:1.46,minZ:-2.94,maxZ:-1.23}, // chest and fully extended drawer
  {minX:-4.4,maxX:-.72,minZ:-3.1,maxZ:-2.1}, // raised alcove
  {minX:-3.9,maxX:-3.2,minZ:-1.2,maxZ:-.5}, // lantern
  {minX:1.9,maxX:3.5,minZ:2.38,maxZ:3.05}, // rear cupboard
  {minX:2.3,maxX:4.08,minZ:-.22,maxZ:1.65}, // tall painted display shelf
  {minX:-3.35,maxX:-2.15,minZ:1.53,maxZ:2.96}, // enclosed peep shelf
];
export const angleDelta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export function canStand({x,z}){
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<BOUNDS.minX||x>BOUNDS.maxX||z<BOUNDS.minZ||z>BOUNDS.maxZ)return false;
  return !obstacles.some(b=>Math.hypot(x-Math.max(b.minX,Math.min(b.maxX,x)),z-Math.max(b.minZ,Math.min(b.maxZ,z)))<RADIUS);
}
export function moveBy(position,dx,dz){
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
export function walkStep(position,side,forward,yaw,seconds){
  const length=Math.max(1,Math.hypot(side,forward)),distance=1.35*Math.min(.05,Math.max(0,seconds))/length;
  return moveBy(position,(Math.cos(yaw)*side+Math.sin(yaw)*forward)*distance,(Math.sin(yaw)*side-Math.cos(yaw)*forward)*distance);
}
function clearLine(a,b){
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06));
  for(let i=1;i<=n;i++)if(!canStand({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n}))return false;
  return true;
}
// Small bounded grid, computed only when an object is tapped. No per-frame search.
export function findPath(start,goal){
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
