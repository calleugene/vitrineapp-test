import assert from 'node:assert/strict';
import test from 'node:test';
import {mapStatsSummaryCards, mapStatsChartData, mapStatsBreakdownData, mapStatsRankedData, mapStatsBarsData} from './mappers.js';

test('missing and empty analytics never become demonstration numbers', () => {
  for (const payload of [null, {}]) {
    assert.deepEqual(mapStatsSummaryCards(payload), []);
    assert.deepEqual(mapStatsChartData(payload).values, []);
    assert.deepEqual(mapStatsBreakdownData(payload).items, []);
    assert.deepEqual(mapStatsRankedData(payload).items, []);
    assert.deepEqual(mapStatsBarsData(payload).items, []);
  }
  assert.deepEqual(mapStatsRankedData({items: []}).items, []);
});

test('analytics preserves zero, distinguishes unavailable, and formats percentage deltas', () => {
  const cards = mapStatsSummaryCards({summary: [
    {value: 0, delta: 0}, {value: null, delta: null}, {value: 1.5, unit: 'minutes', delta: -25},
  ]});
  assert.equal(cards[0].value, '0');
  assert.equal(cards[0].delta, '0.0%');
  assert.equal(cards[1].value, '—');
  assert.equal(cards[1].delta, '');
  assert.match(cards[2].value, /мин$/);
  assert.equal(cards[2].delta, '-25.0%');
});

test('server section names and event counts survive the panel mapping', () => {
  const breakdown = mapStatsBreakdownData({title: 'Типы событий', items: [{label: 'Просмотры экранов', count: 3, value: 60}]});
  assert.equal(breakdown.title, 'Типы событий');
  assert.equal(breakdown.items[0].count, 3);
  assert.ok(breakdown.items[0].color);
  assert.equal(mapStatsRankedData({title: 'Экспонаты', items: [{title: 'Письмо', views: 0}]}).items[0].views, '0');
});
