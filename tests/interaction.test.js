import test from 'node:test';
import assert from 'node:assert/strict';
import {createGesture,wrapDigit,clampZoom} from '../interaction.js?v=1.3.0';
test('digits wrap at both ends of the mechanical wheel',()=>{assert.equal(wrapDigit(10),0);assert.equal(wrapDigit(-1),9);assert.equal(wrapDigit(315),5);});
test('zoom stops before passing through the room or losing it',()=>{assert.equal(clampZoom(.01),.28);assert.equal(clampZoom(9),1.45);assert.equal(clampZoom(.7),.7);});
test('a marker tap inspects the marker once',()=>{const g=createGesture();g.down(1,10,10,'scroll');assert.deepEqual(g.up(1),{hit:'scroll',x:10,y:10});assert.equal(g.up(1),null);});
test('drag starting on a marker rotates without inspecting it',()=>{const g=createGesture();g.down(1,10,10,'chest');assert.deepEqual(g.move(1,35,14),{dx:25,dy:4});assert.equal(g.up(1),null);});
test('pinch zoom never triggers either finger as a tap',()=>{const g=createGesture();g.down(1,0,0,'scroll');g.down(2,100,0);assert.equal(g.move(2,200,0).zoom,.5);assert.equal(g.up(2),null);g.move(1,1,0);assert.equal(g.up(1),null);g.down(3,5,5,'door');assert.equal(g.up(3).hit,'door');});
test('cancel clears pending pointer IDs',()=>{const g=createGesture();g.down(1,0,0);g.cancel();assert.equal(g.up(1),null);assert.equal(g.move(1,20,0),null);});
