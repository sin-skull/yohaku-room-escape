// One active 3D area at a time; progress and inventory belong to the whole wing.
export const AREAS=Object.freeze({
 parlor:{name:'静寂の間',start:{x:1.4,z:2.25},bounds:{minX:-4.03,maxX:4.12,minZ:-2.72,maxZ:2.8},
  obstacles:[[-1.57,.88,-.25,1.34],[-4.4,-.72,-3.1,-2.1],[-3.9,-3.2,-1.2,-.5],[1.9,3.5,2.38,3.05]],
  objects:['scroll','tea','lattice','lantern','window','passage:hall'],
  passages:[{to:'hall',label:'表廊下へ',point:[3.04,1.5,-2.91],stand:[3,-2.35],side:'north'}]},
 hall:{name:'表廊下',start:{x:0,z:.3},bounds:{minX:-1.38,maxX:1.38,minZ:-2.72,maxZ:2.8},
  obstacles:[[-.6,.6,1.53,2.96]],objects:['peep-shelf','door','passage:parlor','passage:study'],
  passages:[{to:'parlor',label:'静寂の間へ',point:[-1.61,1.5,-.65],stand:[-1.08,-.65],side:'west'},
   {to:'study',label:'書院へ',point:[1.61,1.5,-.65],stand:[1.08,-.65],side:'east'}]},
 study:{name:'書院',start:{x:-2.5,z:2.2},bounds:{minX:-4.03,maxX:4.12,minZ:-2.72,maxZ:2.8},
  obstacles:[[-.54,1.46,-2.94,-1.23],[2.3,4.08,-.22,1.65],[-3.9,-1.65,-1.1,.3]],
  objects:['chest','pickup-key','high-shelf','study-desk','passage:hall'],
  passages:[{to:'hall',label:'表廊下へ',point:[-2.5,1.5,3.04],stand:[-2.5,2.4],side:'south'}]},
});
export const areaId=value=>Object.hasOwn(AREAS,value)?value:'parlor';
export const hasObject=(area,id)=>AREAS[areaId(area)].objects.includes(id);
export function passageAt(area,{x,z}){
 for(const p of AREAS[areaId(area)].passages){
  const [px,,pz]=p.point;
  if(p.side==='north'&&z<-2.52&&Math.abs(x-px)<.55)return p.to;
  if(p.side==='south'&&z>2.56&&Math.abs(x-px)<.55)return p.to;
  if(p.side==='west'&&x<-1.25&&Math.abs(z-pz)<.53)return p.to;
  if(p.side==='east'&&x>1.25&&Math.abs(z-pz)<.53)return p.to;
 }
 return null;
}
export function restoreJourney(saved){
 const area=areaId(saved?.area);
 return {area,visited:[...new Set(['parlor',...(Array.isArray(saved?.visited)?saved.visited.filter(id=>Object.hasOwn(AREAS,id)):[]),area])],
  views: saved?.schema>=4&&saved?.views&&typeof saved.views==='object'?saved.views:{}};
}
