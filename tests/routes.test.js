import test from 'node:test';
import assert from 'node:assert/strict';
import {AREAS} from '../mansion.js?v=1.5.0';
import {createNavigation} from '../navigation.js?v=1.5.0';
import {createRoutePlanner,routeTargets} from '../routes.js?v=1.5.0';

test('every movement destination is reachable in its own area and not inside furniture',()=>{
 for(const [id,area] of Object.entries(AREAS)){
  const nav=createNavigation(id);
  for(const target of routeTargets(id)){
   const goal={x:target.stand[0],z:target.stand[1]};assert.ok(nav.canStand(goal),`${id}: ${target.id}`);
   const path=nav.findPath(area.start,goal);assert.ok(path?.length,`${id}: ${target.id}`);
   let position=area.start;for(const p of path){position=nav.moveBy(position,p.x-position.x,p.z-position.z);assert.ok(Math.hypot(position.x-p.x,position.z-p.z)<.001);}
  }
 }
});
test('arrows follow the direction being viewed and disappear when facing an inaccessible wall',()=>{
 const planner=createRoutePlanner('hall'),start=AREAS.hall.start;
 assert.ok(planner.options(start,0).some(p=>p.id==='stop:exit'));
 assert.ok(!planner.options(start,0).some(p=>p.id==='stop:peep'));
 assert.deepEqual(planner.options({x:0,z:-2.6},0),[]);
 assert.ok(planner.options({x:0,z:-2.6},Math.PI).length);
});
test('arrival hides the current stop, while a reachable doorway remains usable',()=>{
 const planner=createRoutePlanner('hall');
 assert.ok(!planner.options(AREAS.hall.start,0).some(p=>p.id==='stop:center'));
 const atDoor=planner.options({x:1.08,z:-.65},Math.PI/2);
 assert.ok(atDoor.some(p=>p.id==='passage:study'));
});
test('locked routes and unreachable destinations never produce an arrow',()=>{
 const planner=createRoutePlanner('hall');
 assert.ok(!planner.options(AREAS.hall.start,0,{blocked:['stop:exit']}).some(p=>p.id==='stop:exit'));
 assert.deepEqual(planner.options({x:0,z:2.2},0),[]);
});
test('god view only offers area travel and bearings wrap correctly across north/south',()=>{
 const planner=createRoutePlanner('parlor');
 assert.ok(planner.options(AREAS.parlor.start,0,{mode:'god'}).every(p=>p.kind==='passage'));
 const a=planner.options(AREAS.parlor.start,Math.PI-.01).map(p=>p.id);
 const b=planner.options(AREAS.parlor.start,-Math.PI-.01).map(p=>p.id);assert.deepEqual(a,b);
});
