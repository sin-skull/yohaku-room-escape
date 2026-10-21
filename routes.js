import {AREAS,areaId} from './mansion.js?v=1.5.0';
import {createNavigation,angleDelta} from './navigation.js?v=1.5.0';

export function routeTargets(location){
 const area=AREAS[areaId(location)];
 return [...area.stops.map(p=>({...p,id:`stop:${p.id}`,kind:'stop'})),
  ...area.passages.map(p=>({...p,id:`passage:${p.to}`,kind:'passage'}))];
}

// Bearings come from the standing point, not the screen position of a hotspot.
// Reachability is recomputed only when the player has actually changed position.
export function createRoutePlanner(location){
 const navigation=createNavigation(location),targets=routeTargets(location);
 let origin=null,reachable=[];
 function options(position,heading,{mode='walk',blocked=[]}={}){
  if(!origin||Math.hypot(position.x-origin.x,position.z-origin.z)>.12){
   origin={x:position.x,z:position.z};
   reachable=targets.filter(p=>navigation.findPath(origin,{x:p.stand[0],z:p.stand[1]}));
  }
  return reachable.flatMap(p=>{
   if(blocked.includes(p.id)||(mode==='god'&&p.kind!=='passage'))return [];
   const dx=p.stand[0]-position.x,dz=p.stand[1]-position.z,distance=Math.hypot(dx,dz);
   // Doorway arrows stay available at the door; other stops disappear on arrival.
   const target=distance<.48&&p.kind==='passage'?p.point:[p.stand[0],0,p.stand[1]];
   if(distance<.48&&p.kind==='stop')return [];
   const bearing=Math.atan2(target[0]-position.x,-(target[2]-position.z)),relative=angleDelta(bearing,heading);
   if(Math.abs(relative)>Math.PI*.36)return [];
   return [{...p,distance,relative,direction:relative<-.24?'left':relative>.24?'right':'forward'}];
  }).sort((a,b)=>Math.abs(a.relative)-Math.abs(b.relative)||a.distance-b.distance)
   .slice(0,3).sort((a,b)=>a.relative-b.relative);
 }
 return {options,targets};
}
