import assert from 'node:assert/strict';
import test from 'node:test';
import {createProfileWithRecovery} from './create-profile.js';

test('lost creation response is recovered only from a matching saved profile', async () => {
  const body = {name: 'Museum A', description: 'Story'};
  const result = await createProfileWithRecovery(body, {
    createProfile: async () => { throw new Error('connection lost'); },
    getProfile: async () => ({museum: {name: 'Museum A', description: 'Story'}}),
  });
  assert.equal(result.museum.name, 'Museum A');
});

test('unconfirmed save and unauthorized requests remain failures', async () => {
  const original = Object.assign(new Error('failed'), {status: 409});
  await assert.rejects(createProfileWithRecovery({name: 'Museum A'}, {
    createProfile: async () => { throw original; },
    getProfile: async () => ({museum: {name: 'Museum B'}}),
  }), (error) => error === original);

  let queried = false;
  await assert.rejects(createProfileWithRecovery({name: 'Museum A'}, {
    createProfile: async () => { throw Object.assign(new Error('unauthorized'), {status: 401}); },
    getProfile: async () => { queried = true; },
  }));
  assert.equal(queried, false);
});
