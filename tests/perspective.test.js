import test from 'node:test';
import assert from 'node:assert/strict';
import {inkFragments,projectedPoint,alignedObservation,GOD_EYE,GOD_TARGET,PEEP_EYE} from '../perspective.js?v=1.3.0';
import {flowerCell,restoreObservations,nextHint} from '../puzzles.js?v=1.3.0';
test('fragments at distinct heights/depths join into the intended projected strokes',()=>{
 for(const kind of ['pine','bamboo']){
  const pieces=inkFragments(kind);assert.ok(new Set(pieces.map(p=>p.plane)).size===3);
  for(const piece of pieces){const expected=[[piece.u0,piece.v0],[piece.u1,piece.v0],[piece.u1,piece.v1],[piece.u0,piece.v1]];piece.points.forEach((point,i)=>{const actual=projectedPoint(kind,point);assert.ok(Math.hypot(actual[0]-expected[i][0],actual[1]-expected[i][1])<1e-9);});}
 }
});
test('observation depends on real camera position and direction, with a generous tolerance',()=>{
 const direction=GOD_TARGET.map((v,i)=>v-GOD_EYE[i]);assert.equal(alignedObservation(GOD_EYE,direction),'pine');
 assert.equal(alignedObservation(PEEP_EYE,[0,0,1]),'bamboo');assert.equal(alignedObservation(PEEP_EYE,[0,0,-1]),null);
 assert.equal(alignedObservation([PEEP_EYE[0]+.2,1.58,PEEP_EYE[2]],[0,0,1]),'bamboo');
 assert.equal(alignedObservation([3.1,1.58,.6],direction),null);
});
test('pine is the vertical clue and bamboo the horizontal clue of the flower lattice',()=>{
 assert.equal(flowerCell({row:2,column:0}),true);assert.equal(flowerCell({row:0,column:2}),false);
});
test('old completed games retain progress but an old scroll alone does not reveal new clues',()=>{
 assert.deepEqual(restoreObservations({clue:true}),{pine:false,bamboo:false,plum:false});assert.deepEqual(restoreObservations({solved:true}),{pine:true,bamboo:true,plum:true});
 assert.deepEqual(restoreObservations({observations:{pine:true}}),{pine:true,bamboo:false,plum:false});
});
test('hints follow individual observations rather than treating any scroll as all answers',()=>{
 assert.match(nextHint({observations:{pine:false}})[0],/高い棚/);assert.match(nextHint({observations:{pine:true,bamboo:false}})[0],/覗き穴/);
});
