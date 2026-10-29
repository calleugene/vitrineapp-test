import assert from 'node:assert/strict';
import test from 'node:test';
import {loadAllArtifacts} from './artifact-list-data.js';

test('loads all pages, including active exhibits beyond a page of archived rows', async () => {
  const calls = [];
  const result = await loadAllArtifacts(async ({page}) => {
    calls.push(page);
    return {artifacts: [{id: page, status: page === 1 ? 'archived' : 'draft'}], pagination: {total: 2}};
  });
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(result.artifacts.map((item) => item.status), ['archived', 'draft']);
});

test('does not return a misleading partial list if a later page fails', async () => {
  await assert.rejects(loadAllArtifacts(async ({page}) => {
    if (page > 1) throw new Error('unavailable');
    return {artifacts: [{id: 'first'}], pagination: {total: 2}};
  }), /unavailable/);
});
