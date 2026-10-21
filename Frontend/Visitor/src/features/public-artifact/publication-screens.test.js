import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePublication} from './publication-screens.js';

test('public snapshot preserves quiz, 3D and legacy text in their order', () => {
  const result=normalizePublication({snapshot:{artifact:{id:'a',title:'Museum'},screens:[
    {id:'one',type:'text',payload:'{"body":"Legacy text"}'},
    {id:'two',type:'quiz',title:'Question',payload:JSON.stringify({content:{options:['A','B'],correct_answer:'B',explanation:'Why'}})},
    {id:'three',type:'model',payload:JSON.stringify({content:{model_url:'/model.glb',body:'Rotate'}})},
  ]}});
  assert.deepEqual(result.screens.map((screen)=>screen.type),['cover','fact','quiz','ar','final']);
  assert.equal(result.screens[1].text,'Legacy text');
  assert.deepEqual(result.screens[2].options,['A','B']);
  assert.equal(result.screens[2].correctAnswer,'B');
  assert.equal(result.screens[3].modelUrl,'/model.glb');
});
