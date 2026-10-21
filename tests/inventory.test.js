import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleItemSelection,itemAction} from '../inventory.js?v=1.4.0';
test('one tap selects, a second tap deselects, and another item replaces selection',()=>{
 const owned=['scroll','key'];assert.equal(toggleItemSelection(null,'key',owned),'key');assert.equal(toggleItemSelection('key','key',owned),null);assert.equal(toggleItemSelection('key','scroll',owned),'scroll');assert.equal(toggleItemSelection('scroll','missing',owned),'scroll');
});
test('owning a key alone does not use it; it must be selected and tapped on the door',()=>{
 const progress={key:true,escaped:false};assert.equal(itemAction(null,'door',progress),'inspect');assert.equal(itemAction('key','door',progress),'unlock-door');assert.equal(itemAction('key','chest',progress),'no-effect');assert.equal(itemAction('scroll','door',progress),'no-effect');assert.equal(itemAction('key','door',{key:false}),'no-effect');
});
