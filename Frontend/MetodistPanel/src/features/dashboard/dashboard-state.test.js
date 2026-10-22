import test from 'node:test';
import assert from 'node:assert/strict';
import {createDashboardRetryHandler, createInitialDashboardData, createInitialDashboardStates, dashboardResultStatus, resolveDashboardResults} from './dashboard-state.js';
import {mapDashboardActivities, mapDashboardAttendance, mapDashboardFeedbackItems, mapDashboardPopularRoutes, mapDashboardSummary} from './mappers.js';

test('dashboard starts empty and pending, with no demo values', () => {
  assert.deepEqual(createInitialDashboardData(), {
    summary: [], attendance: {labels: [], values: [], note: ''}, popularRoutes: [], recentActivity: [], feedbackItems: [],
  });
  assert.deepEqual(createInitialDashboardStates(), {
    summary: {status: 'loading'}, attendance: {status: 'loading'}, popularRoutes: {status: 'loading'}, recentActivity: {status: 'loading'}, feedbackItems: {status: 'loading'},
  });
});

test('summary preserves real zero and marks missing numeric fields', () => {
  const [visitors, averageTime, progress, rating] = mapDashboardSummary({visitors_per_month: 0, avg_route_duration_minutes: null});
  assert.equal(visitors.value, '0');
  assert.equal(averageTime.value, '—');
  assert.equal(progress.value, '—');
  assert.equal(rating.value, '—');
});

test('successful empty lists remain empty instead of becoming demo content', () => {
  assert.deepEqual(mapDashboardPopularRoutes([]), []);
  assert.deepEqual(mapDashboardActivities([]), []);
  assert.deepEqual(mapDashboardFeedbackItems([]), []);
});

test('attendance distinguishes missing arrays, empty arrays, and malformed values', () => {
  assert.deepEqual(mapDashboardAttendance({}), {labels: [], values: [], note: 'Нет данных за выбранный период.'});
  assert.deepEqual(mapDashboardAttendance({labels: [], values: []}).values, []);
  assert.throws(() => mapDashboardAttendance({labels: ['Пн'], values: [undefined]}), /Некорректный ответ/);
});

test('failed block retry exposes error and later success updates only that block', async () => {
  let data = {...createInitialDashboardData(), summary: [{value: '10'}]};
  let states = {...createInitialDashboardStates(), summary: {status: 'success'}};
  const events = [];
  const setData = (update) => { data = update(data); };
  const setStates = (update) => { states = update(states); events.push(states.popularRoutes.status); };
  const retry = createDashboardRetryHandler({setData, setStates});

  assert.equal(await retry('popularRoutes', async () => { throw new Error('offline'); }, (value) => value.routes), false);
  assert.equal(states.popularRoutes.status, 'error');
  assert.deepEqual(data.summary, [{value: '10'}]);

  assert.equal(await retry('popularRoutes', async () => ({routes: [{title: 'Маршрут'}]}), (value) => mapDashboardPopularRoutes(value.routes)), true);
  assert.deepEqual(events, ['loading', 'error', 'loading', 'success']);
  assert.equal(data.popularRoutes[0].title, 'Маршрут');
  assert.deepEqual(data.summary, [{value: '10'}]);
});

test('initial failed requests become errors while neighboring fulfilled blocks stay successful', () => {
  const resolved = resolveDashboardResults({
    summary: {status: 'fulfilled', value: {visitors_per_month: 0}},
    attendance: {status: 'rejected'},
  }, {summary: mapDashboardSummary, attendance: mapDashboardAttendance});
  assert.deepEqual(resolved.states, {summary: {status: 'success'}, attendance: {status: 'error'}});
  assert.equal(resolved.data.summary[0].value, '0');
  assert.equal('attendance' in resolved.data, false);
  assert.deepEqual(dashboardResultStatus({status: 'rejected'}, mapDashboardSummary), {status: 'error'});
});

test('missing summary is empty while zero is a real measurement', () => {
  assert.deepEqual(mapDashboardSummary({}), []);
  assert.equal(mapDashboardSummary({visitors_per_month: 0})[0].value, '0');
});

test('concurrent retries request a widget only once and release the lock afterward', async () => {
  let resolve;
  let calls = 0;
  const retry = createDashboardRetryHandler({setData: () => {}, setStates: () => {}});
  const request = () => { calls++; return new Promise((done) => { resolve = done; }); };
  const pending = retry('attendance', request, (value) => value);
  assert.equal(await retry('attendance', request, (value) => value), false);
  assert.equal(calls, 1);
  resolve({labels: [], values: []});
  assert.equal(await pending, true);
  assert.equal(await retry('attendance', async () => ({}), (value) => value), true);
});
