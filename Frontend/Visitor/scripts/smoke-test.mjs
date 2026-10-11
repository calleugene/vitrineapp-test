import assert from 'node:assert/strict';
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = {addEventListener: () => {}};
Object.defineProperty(globalThis, 'navigator', {value: {onLine: false}, configurable: true});

const {createApiClient} = await import('../src/app/api-client.js');
const {createAnalyticsEvents} = await import('../src/app/analytics-events.js');

const api = createApiClient({apiMode: 'mock', apiBaseUrl: 'http://localhost:8080/api/v1'});
const visitor = await api.ensureVisitor();
assert.ok(visitor.id, 'mock visitor has an id');
const museums = await api.listMuseums(visitor.id);
assert.ok(museums.length > 0, 'mock API returns museums');
const museum = await api.getMuseum(museums[0].id, visitor.id);
assert.ok(museum.artifacts.length > 0, 'museum contains artifacts');
const story = await api.getStory(museum.route_id, museum.artifacts[0].id);
assert.ok(story.coverTitle, 'artifact story has a cover');

const events = createAnalyticsEvents({endpoint: 'https://events.invalid'});
events.track('scene_view', {artifact_id: museum.artifacts[0].id});
assert.equal(events.pending(), 1, 'offline event is queued');

console.log('Visitor smoke flow: PASS');
