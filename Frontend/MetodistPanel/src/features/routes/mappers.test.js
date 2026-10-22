import assert from 'node:assert/strict';
import test from 'node:test';
import {mapRouteRows, mapRouteSummaryData, mapRouteActivities} from './mappers.js';

test('empty route source stays empty and preserves server artifact order', () => {
  assert.deepEqual(mapRouteRows([]), []);
  assert.equal(mapRouteSummaryData(null).total,0);
  assert.deepEqual(mapRouteActivities([]),[]);
  const [route] = mapRouteRows([{id:'r1',title:'Letters',artifact_ids:['a2','a1'],status:'published',visibility:'private'}]);
  assert.deepEqual(route.artifactIds,['a2','a1']);
  assert.equal(route.source.visibility,'team');
});
