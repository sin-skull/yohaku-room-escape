import test from 'node:test';
import assert from 'node:assert/strict';
import {AREAS,hasObject,passageAt,restoreJourney} from '../mansion.js?v=1.4.0';
import {createNavigation} from '../navigation.js?v=1.4.0';

test('clues, combination, chest and exit are spread across three different areas',()=>{
 assert.ok(hasObject('study','high-shelf'));assert.ok(hasObject('hall','peep-shelf'));assert.ok(hasObject('parlor','lattice'));
 assert.ok(hasObject('study','chest'));assert.ok(hasObject('hall','door'));
 for(const [area,ids] of Object.entries({parlor:['high-shelf','peep-shelf','chest','door'],hall:['high-shelf','chest','lattice'],study:['peep-shelf','lattice','door']}))for(const id of ids)assert.equal(hasObject(area,id),false);
});
test('every doorway is reciprocal and reachable without crossing furniture',()=>{
 for(const [id,area] of Object.entries(AREAS)){
  const nav=createNavigation(id);assert.ok(nav.canStand(area.start));
  for(const p of area.passages){
   assert.ok(AREAS[p.to].passages.some(back=>back.to===id));
   const goal={x:p.stand[0],z:p.stand[1]},path=nav.findPath(area.start,goal);assert.ok(path?.length,`${id} to ${p.to}`);
   let current=area.start;for(const target of path){current=nav.moveBy(current,target.x-current.x,target.z-current.z);assert.ok(Math.hypot(current.x-target.x,current.z-target.z)<.001);}
  }
 }
});
test('walking through doorway thresholds travels, ordinary exploration does not',()=>{
 assert.equal(passageAt('parlor',{x:3,z:-2.6}),'hall');assert.equal(passageAt('hall',{x:-1.32,z:-.65}),'parlor');
 assert.equal(passageAt('hall',{x:1.32,z:-.65}),'study');assert.equal(passageAt('study',{x:-2.5,z:2.7}),'hall');
 for(const [id,a] of Object.entries(AREAS))assert.equal(passageAt(id,a.start),null);
 assert.equal(passageAt('hall',{x:0,z:-2.6}),null); // final exit still needs the selected key
});
test('study and hallway furniture block movement, all clue approach poses are reachable',()=>{
 const hall=createNavigation('hall'),study=createNavigation('study');
 assert.equal(hall.canStand({x:0,z:2.1}),false);assert.equal(hall.canStand({x:2,z:0}),false);
 assert.equal(study.canStand({x:.46,z:-2}),false);assert.equal(study.canStand({x:3,z:.7}),false);
 assert.ok(hall.findPath(AREAS.hall.start,{x:0,z:.9}));
 for(const goal of [{x:.46,z:-.85},{x:1.8,z:.65}])assert.ok(study.findPath(AREAS.study.start,goal));
});
test('journey migration preserves valid locations and never adopts stale single-room camera data',()=>{
 assert.deepEqual(restoreJourney({schema:3,solved:true}),{area:'parlor',visited:['parlor'],views:{}});
 const restored=restoreJourney({schema:4,area:'study',visited:['hall','bad','hall'],views:{study:{zoom:1}}});
 assert.equal(restored.area,'study');assert.deepEqual(restored.visited,['parlor','hall','study']);assert.deepEqual(restored.views.study,{zoom:1});
 assert.equal(restoreJourney({area:'bad'}).area,'parlor');
});
