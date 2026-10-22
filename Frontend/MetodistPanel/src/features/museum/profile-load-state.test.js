import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {getMuseumProfileLoadState, INITIAL_MUSEUM_PROFILE_LOAD_STATE} from './profile-load-state.js';

describe('museum profile load state', () => {
  it('does not offer museum creation while the profile request is pending', () => {
    assert.equal(INITIAL_MUSEUM_PROFILE_LOAD_STATE.status, 'loading');
  });

  it('allows creation only when the API reports a missing profile', () => {
    const state = getMuseumProfileLoadState(INITIAL_MUSEUM_PROFILE_LOAD_STATE, {type: 'failure', status: 404});
    assert.deepEqual(state, {status: 'missing', error: ''});
  });

  it('keeps unauthorized and service failures on the retryable error path', () => {
    for (const status of [401, 500, undefined]) {
      const state = getMuseumProfileLoadState(INITIAL_MUSEUM_PROFILE_LOAD_STATE, {
        type: 'failure', status, message: 'Не удалось загрузить профиль музея.',
      });
      assert.equal(state.status, 'error');
      assert.match(state.error, /загрузить профиль/);
    }
  });

  it('returns to loading on retry and clears the previous error', () => {
    const error = {status: 'error', error: 'network'};
    assert.deepEqual(getMuseumProfileLoadState(error, {type: 'start'}), {status: 'loading', error: ''});
    assert.deepEqual(getMuseumProfileLoadState(error, {type: 'success'}), {status: 'loaded', error: ''});
  });
});
