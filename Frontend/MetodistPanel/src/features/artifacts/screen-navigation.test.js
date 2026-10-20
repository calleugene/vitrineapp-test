import test from 'node:test';
import assert from 'node:assert/strict';
import {createScreenNavigationGuard, hasUnsavedScreenChanges} from './screen-navigation.js';

function setup({dirty = false, pending = false, confirm = false} = {}) {
  const events = [];
  const requestNavigation = createScreenNavigationGuard({
    isDirty: () => dirty,
    isPending: () => pending,
    confirmDiscard: () => { events.push('confirm'); return confirm; },
    navigate: (target) => events.push(['navigate', target]),
  });
  return {events, requestNavigation};
}

test('declining to discard keeps the current editor and does not navigate', () => {
  const {events, requestNavigation} = setup({dirty: true, confirm: false});
  assert.equal(requestNavigation('artifact-publish'), false);
  assert.deepEqual(events, ['confirm']);
});

test('confirming discard navigates once to the requested destination', () => {
  const {events, requestNavigation} = setup({dirty: true, confirm: true});
  assert.equal(requestNavigation('artifact-publish'), true);
  assert.deepEqual(events, ['confirm', ['navigate', 'artifact-publish']]);
});

test('unchanged content navigates without prompting and pending work blocks navigation', () => {
  const unchanged = setup();
  assert.equal(unchanged.requestNavigation('artifact-basic'), true);
  assert.deepEqual(unchanged.events, [['navigate', 'artifact-basic']]);

  const pending = setup({dirty: true, pending: true, confirm: true});
  assert.equal(pending.requestNavigation('artifact-basic'), false);
  assert.deepEqual(pending.events, []);
});

test('restoring every screen field to its last saved value clears the unsaved state', () => {
  const original = {title: 'Saved title', body: 'Saved body', imageURL: 'saved.png'};
  assert.equal(hasUnsavedScreenChanges({...original, body: 'Edited body'}, original), true);
  assert.equal(hasUnsavedScreenChanges(original, original), false);
});
