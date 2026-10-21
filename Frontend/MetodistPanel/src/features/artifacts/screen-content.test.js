import test from 'node:test';
import assert from 'node:assert/strict';
import {screenValues, contentError, screenExtra} from './screen-content.js';

test('preserves legacy text and round trips model and quiz content', () => {
  assert.equal(screenValues({title:'Old',payload:'{"body":"Legacy","imageUrl":"/old.jpg"}'}).imageURL,'/old.jpg');
  const quiz = screenValues({title:'Question',payload:JSON.stringify({content:{options:['Да','Нет'],correct_answer:'Нет',explanation:'Because'}})});
  assert.equal(quiz.correct,1);
  assert.equal(contentError('quiz',quiz),'');
  assert.deepEqual(screenExtra('quiz',quiz),{options:['Да','Нет'],correct_answer:'Нет',explanation:'Because'});
  assert.match(contentError('quiz',{...quiz,correct:-1}),/правильный/);
  assert.match(contentError('quiz',{...quiz,options:['Да',' да ']}),/отличаться/);
  assert.match(contentError('quiz',{...quiz,options:['','Нет']}),/Заполните/);
  assert.match(contentError('model',{...quiz,modelURL:''}),/3D/);
  assert.deepEqual(screenExtra('model',{modelURL:'/asset.glb'}),{model_url:'/asset.glb'});
});
