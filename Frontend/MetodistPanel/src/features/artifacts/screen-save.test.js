import test from 'node:test';
import assert from 'node:assert/strict';
import {createScreenSaveHandler} from './screen-save.js';

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return {promise, resolve};
}

function setup(onSave) {
  const calls = [];
  const savingRef = {current: false};
  const events = [];
  const save = createScreenSaveHandler({
    savingRef,
    setSaving: (value) => events.push(['saving', value]),
    onSave: (...payload) => { calls.push(payload); return onSave(...payload); },
    onSaved: () => events.push(['closed']),
  });
  return {save, calls, events, savingRef};
}

test('pending save keeps editor open and ignores duplicate submits', async () => {
  const request = deferred();
  const state = setup(() => request.promise);
  const payload = ['Title', 'Body', 'image.png'];
  const first = state.save(...payload);

  assert.equal(state.savingRef.current, true);
  assert.deepEqual(state.events, [['saving', true]]);
  assert.equal(await state.save(...payload), false);
  assert.equal(state.calls.length, 1);

  request.resolve(true);
  assert.equal(await first, true);
  assert.deepEqual(state.events, [['saving', true], ['saving', false], ['closed']]);
});

test('failed saves keep the editor open and retry with the same fields', async () => {
  let attempts = 0;
  const state = setup(async () => ++attempts === 1 ? false : true);
  const payload = ['New title', 'Unsaved body', 'https://image.test/a.png'];

  assert.equal(await state.save(...payload), false);
  assert.equal(state.events.some(([event]) => event === 'closed'), false);
  assert.equal(await state.save(...payload), true);
  assert.deepEqual(state.calls, [payload, payload]);
  assert.deepEqual(state.events.filter(([event]) => event === 'closed'), [['closed']]);
});

test('a rejected save leaves editor open and releases the submit lock', async () => {
  const state = setup(async () => { throw new Error('network'); });
  await assert.rejects(state.save('Title', 'Body', ''), /network/);
  assert.equal(state.events.some(([event]) => event === 'closed'), false);
  assert.equal(state.savingRef.current, false);
});
