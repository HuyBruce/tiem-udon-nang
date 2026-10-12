import test from 'node:test';
import assert from 'node:assert/strict';
import {lab,deltaE} from '../tools/seam-color.mjs';
test('seam audit CIE Lab D65 has calibrated neutral and identity distances',()=>{
 assert.ok(Math.abs(lab([255,255,255])[0]-100)<.001);
 assert.deepEqual(lab([0,0,0]),[0,0,0]);
 assert.equal(deltaE([30,40,50],[30,40,50]),0);
 assert.ok(Math.abs(deltaE([255,255,255],[0,0,0])-100)<.001);
 assert.ok(deltaE([200,190,180],[20,30,40])>deltaE([200,190,180],[195,185,175]));
});
