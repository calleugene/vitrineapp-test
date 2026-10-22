import assert from 'node:assert/strict';
import test from 'node:test';
import {ensureMuseumSession} from './museum-session.js';

test('legacy methodist replaces only access token and user after provisioning', async () => {
  const session = {accessToken: 'old', refreshToken: 'refresh', user: {id: 'u1', role: 'methodist'}};
  const result = await ensureMuseumSession(session, {provisionMuseumContext: async () => ({
    accessToken: 'new', user: {id: 'u1', role: 'methodist', museum_id: 'mus_one'},
  })});
  assert.equal(result.accessToken, 'new');
  assert.equal(result.refreshToken, 'refresh');
  assert.equal(result.user.museum_id, 'mus_one');
  assert.equal(session.accessToken, 'old');
});

test('provision failure or incomplete response never creates a successful session', async () => {
  const session = {accessToken: 'old', user: {id: 'u1', role: 'methodist'}};
  await assert.rejects(ensureMuseumSession(session, {provisionMuseumContext: async () => { throw new Error('offline'); }}));
  await assert.rejects(ensureMuseumSession(session, {provisionMuseumContext: async () => ({accessToken: 'new', user: {id: 'u1'}})}));
  await assert.rejects(ensureMuseumSession(session, {provisionMuseumContext: async () => ({accessToken: 'new', user: {id: 'u2', museum_id: 'mus_other'}})}));
});
