import assert from 'node:assert/strict';
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = {addEventListener: () => {}};
globalThis.sessionStorage = globalThis.localStorage;
Object.defineProperty(globalThis, 'navigator', {value: {onLine: false}, configurable: true});

const {createApiClient} = await import('../src/app/api-client.js');
const {findArtifactBySecretCode, readQrArtifactId} = await import('../src/features/scanner/code-utils.js');
const {createAnalyticsEvents} = await import('../src/app/analytics-events.js');

const api = createApiClient({apiMode: 'mock', apiBaseUrl: 'http://localhost:8080/api/v1'});
const visitor = await api.ensureVisitor();
assert.ok(visitor.id, 'mock visitor has an id');
const museums = await api.listMuseums(visitor.id);
assert.ok(museums.length > 0, 'mock API returns museums');
const museum = await api.getMuseum(museums[0].id, visitor.id);
assert.ok(museum.artifacts.length > 0, 'museum contains artifacts');
// Published museums must use profile values from Artifacts API without invented metadata.
const publishedProfile = {
  museum_id: 'mus_published', name: 'Луговой парк',
  short_description: 'Профиль из API', description: '', address: '', website: '', logo_url: ''
};
window.fetch = globalThis.fetch = async (url) => ({
  ok: true,
  json: async () => url.endsWith('/public/museums')
    ? {museums: [{museum_id: publishedProfile.museum_id}]}
    : url.endsWith('/artifacts')
      ? {artifacts: []}
      : {museum: publishedProfile}
});
const publishedApi = createApiClient({apiMode: 'mock', publicCatalog: true, artifactsApiUrl: '/api/artifacts/api/v1'});
const [publishedCard] = await publishedApi.listMuseums(visitor.id);
const publishedMuseum = await publishedApi.getMuseum(publishedCard.id, visitor.id);
assert.equal(publishedMuseum.name, publishedProfile.name);
assert.equal(publishedMuseum.description, publishedProfile.short_description);
assert.equal(publishedMuseum.about, publishedProfile.short_description);
assert.equal(publishedMuseum.city, '');
assert.equal(publishedMuseum.category, '');
assert.equal(publishedMuseum.hours, '');
assert.equal(publishedMuseum.address, '');
// Museum-level code entry must find a later exhibit, preserve leading zeroes,
// and never resolve an empty/malformed code to an unrelated exhibit.
const codedMuseum = {artifacts: [
  {id: 'first', secretCode: '00001'},
  {id: 'second', secret_code: '00002'},
]};
assert.equal(findArtifactBySecretCode(codedMuseum, '00002')?.id, 'second');
assert.equal(findArtifactBySecretCode(codedMuseum, '00001')?.id, 'first');
for (const code of ['', '2', '0000x', '99999', '000002']) {
  assert.equal(findArtifactBySecretCode(codedMuseum, code), null);
}
assert.equal(findArtifactBySecretCode(null, '00001'), null);
assert.equal(findArtifactBySecretCode({artifacts: [{id: 'missing'}]}, '00001'), null);
assert.equal(readQrArtifactId('https://museum.example/a/front-letter?source=qr'), 'front-letter');
assert.equal(readQrArtifactId(' front-letter '), 'front-letter');
assert.equal(readQrArtifactId('/a/%E0%A4%A'), '');
assert.equal(readQrArtifactId(''), '');

const story = await api.getStory(museum.route_id, museum.artifacts[0].id);
assert.ok(story.coverTitle, 'artifact story has a cover');

const events = createAnalyticsEvents({endpoint: 'https://events.invalid'});
events.track('scene_view', {public_code: 'example', artifact_id: museum.artifacts[0].id, screen_id: 'cover'});
assert.equal(events.pending(), 1, 'offline event is queued');

const delivered = [];
const retryingEvents = createAnalyticsEvents({
  endpoint: 'https://events.invalid',
  fetcher: async (_url, options) => {
    const item = JSON.parse(options.body);
    delivered.push(item.id);
    return {ok: true, json: async () => ({accepted_event_id: item.id, duplicate: delivered.length > 1})};
  },
});
navigator.onLine = true;
await retryingEvents.flush();
assert.equal(retryingEvents.pending(), 0, 'confirmed delivery clears the queue');
assert.equal(delivered.length, 1, 'queued event is delivered once');

// A temporary server outage must not silently discard queued analytics after
// eight attempts. Recovery must deliver the original event ID.
navigator.onLine = false;
let recovering = false;
const outageIds = [];
const outageEvents = createAnalyticsEvents({
  endpoint: 'https://events.invalid',
  fetcher: async (_url, options) => {
    const item = JSON.parse(options.body);
    outageIds.push(item.id);
    return recovering
      ? {ok: true, json: async () => ({accepted_event_id: item.id})}
      : {ok: false, status: 503};
  },
});
outageEvents.track('scene_view', {public_code: 'example', artifact_id: 'art', screen_id: 'cover'});
navigator.onLine = true;
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
// Manual flushes replace retry timers in this deterministic outage check.
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};
try {
  for (let attempt = 0; attempt < 10; attempt += 1) await outageEvents.flush();
  assert.equal(outageEvents.pending(), 1, 'transient outage retains the event');
  recovering = true;
  await outageEvents.flush();
  assert.equal(outageEvents.pending(), 0, 'recovery confirms delivery');
  assert.equal(new Set(outageIds).size, 1, 'every retry preserves the event ID');
} finally {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
}

navigator.onLine = false;
for (let index = 0; index < 110; index += 1) {
  retryingEvents.track('scene_view', {public_code: 'example', artifact_id: 'art', screen_id: `screen-${index}`});
}
assert.equal(retryingEvents.pending(), 100, 'offline queue is bounded');

console.log('Visitor smoke flow: PASS');

// A missing legacy Visitor catalogue must load every real museum, not demo data.
const originalFetch = globalThis.fetch;
globalThis.window.URL = URL;
globalThis.window.location = {protocol: 'http:', hostname: 'localhost'};
const catalogFetch = async (url) => {
  if (url.startsWith('/visitor/')) return new Response('', {status: 404});
  if (url === '/artifacts/public/museums') return Response.json({museums: [{museum_id: 'real-one'}, {museum_id: 'real-two'}]});
  const id = url.includes('real-two') ? 'real-two' : 'real-one';
  if (url.endsWith('/artifacts')) return Response.json({artifacts: [{id: `${id}-exhibit`, title: 'Published', public_code: `${id}-code`}]});
  return Response.json({museum: {museum_id: id, name: id}});
};
globalThis.fetch = globalThis.window.fetch = catalogFetch;
const published = createApiClient({apiMode: 'auto', apiBaseUrl: '/visitor', artifactsApiUrl: '/artifacts'});
const realMuseums = await published.listMuseums();
assert.deepEqual(realMuseums.map((item) => item.id), ['real-one', 'real-two']);
const realMuseum = await published.getMuseum('real-two');
assert.equal(realMuseum.artifacts[0].publicCode, 'real-two-code');
globalThis.fetch = globalThis.window.fetch = async () => {throw new Error('backend offline');};
const unavailable = createApiClient({apiMode: 'auto', apiBaseUrl: '/visitor', artifactsApiUrl: '/artifacts'});
await assert.rejects(unavailable.listMuseums(), /backend offline/);
globalThis.fetch = originalFetch;
delete globalThis.window.fetch;
console.log('Visitor real museum catalogue: PASS');
