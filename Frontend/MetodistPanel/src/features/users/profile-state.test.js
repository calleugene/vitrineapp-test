import test from 'node:test';
import assert from 'node:assert/strict';
import {accountDate, profileChanged, profileFields, validateProfile, profileErrorMessage} from './profile-state.js';

test('missing backend data never becomes demo personal information', () => {
  assert.deepEqual(profileFields(null), {firstName:'',lastName:'',email:'',phone:'',about:''});
  assert.equal(accountDate(null),'Нет данных');
  assert.equal(accountDate('invalid'),'Нет данных');
});
test('all five fields participate in explicit save change detection', () => {
  const saved = profileFields({full_name:'Анна Петрова',email:'a@example.test',phone:'',about:''});
  assert.equal(profileChanged(saved,{...saved}),false);
  for (const key of Object.keys(saved)) assert.equal(profileChanged(saved,{...saved,[key]:`${saved[key]}new`}),true);
  assert.equal(validateProfile({...saved,email:'invalid'}).email,'Введите корректный email');
  assert.equal(Object.keys(validateProfile(saved)).length,0);
});
test('dates include year and use the browser local timezone', () => {
  const value='2026-10-17T12:30:00Z';
  assert.equal(accountDate(value),new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)));
});
test('museum code errors remain distinct', () => {
  const messages=['code_not_found','code_invalid','already_joined','join_rate_limited'].map((code) => profileErrorMessage({code}));
  assert.equal(new Set(messages).size,4);
});
