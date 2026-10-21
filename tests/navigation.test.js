import test from 'node:test';
import assert from 'node:assert/strict';
import {START,BOUNDS,canStand,moveBy,walkStep,findPath,angleDelta} from '../navigation.js?v=1.5.0';
test('player starts inside the room and cannot stand in walls or furniture',()=>{
 assert.ok(canStand(START));assert.equal(canStand({x:20,z:0}),false);assert.equal(canStand({x:0,z:.5}),false);assert.equal(canStand({x:-2.5,z:-2.5}),false);
});
test('continuous movement cannot tunnel through the table or leave the room',()=>{
 const table=moveBy({x:0,z:2},0,-5);assert.ok(canStand(table));assert.ok(table.z>1.34);
 const wall=moveBy({x:4,z:-1.6},5,0);assert.ok(canStand(wall));assert.ok(wall.x<=BOUNDS.maxX);
});
test('movement slides along a wall rather than trapping the player',()=>{const p=moveBy({x:-3.98,z:-.2},-1,1);assert.ok(p.z>.79);assert.ok(p.x>=BOUNDS.minX);});
test('walking uses viewing direction, caps elapsed time, and normalizes diagonals',()=>{
 const start={x:2,z:0};assert.ok(walkStep(start,0,1,0,.05).z<0);assert.ok(walkStep(start,0,1,Math.PI,.05).z>0);
 assert.deepEqual(walkStep(start,0,1,0,10),walkStep(start,0,1,0,.05));
 const straight=walkStep(start,0,1,0,.05),diagonal=walkStep(start,1,1,0,.05);
 assert.ok(Math.abs(Math.hypot(diagonal.x-start.x,diagonal.z-start.z)-Math.hypot(straight.x-start.x,straight.z-start.z))<1e-8);
});
test('tap approach finds safe routes around the table to every existing clue',()=>{
 for(const goal of [{x:-2.55,z:-1.35},{x:.46,z:-.85},{x:3,z:-1.55},{x:-.35,z:1.85},{x:-2.7,z:-.85},{x:-3.4,z:.4},{x:-2.75,z:.9},{x:1.8,z:.65}]){
  const path=findPath(START,goal);assert.ok(path?.length,JSON.stringify(goal));let position={...START};
  for(const target of path){const reached=moveBy(position,target.x-position.x,target.z-position.z);assert.ok(Math.hypot(reached.x-target.x,reached.z-target.z)<.001);position=reached;}
  assert.ok(Math.hypot(position.x-goal.x,position.z-goal.z)<.001);
 }
 assert.equal(findPath(START,{x:0,z:.5}),null);
});
test('turning across a full revolution takes the short direction',()=>{assert.ok(Math.abs(angleDelta(-Math.PI+.01,Math.PI-.01)-.02)<1e-8);assert.ok(Math.abs(angleDelta(Math.PI*4+.4,0)-.4)<1e-8);});
