import {appConfig} from './config.js';

const QUEUE_KEY = 'viralabs.analytics.queue.v1';
const VISITOR_KEY = 'viralabs.analytics.visitor.v1';
const PUBLIC_VISITOR_KEY = 'viralabs.public.visitor.id';
const SESSION_KEY = 'viralabs.analytics.session.v1';
const MAX_QUEUE = 100;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_MS = 5000;
const SESSION_IDLE_MS = 30 * 60 * 1000;

function stored(key, storage = globalThis.localStorage) {
  try { return storage.getItem(key); } catch { return null; }
}

function save(key, value, storage = globalThis.localStorage) {
  try { storage.setItem(key, value); } catch { /* Optional browser storage. */ }
}

function id() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readQueue() {
  try {
    const queue = JSON.parse(stored(QUEUE_KEY) || '[]');
    return Array.isArray(queue) ? queue.filter((entry) => entry?.id && Date.now() - Date.parse(entry.occurred_at) < MAX_AGE_MS).slice(-MAX_QUEUE) : [];
  } catch { return []; }
}

function writeQueue(queue) {
  save(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
}

function visitorKey() {
  let value = stored(PUBLIC_VISITOR_KEY) || stored(VISITOR_KEY);
  if (!value) value = id();
  save(VISITOR_KEY, value);
  save(PUBLIC_VISITOR_KEY, value);
  return value;
}

export function analyticsVisitorKey() { return visitorKey(); }

function sessionId() {
  const storage = globalThis.sessionStorage || globalThis.localStorage;
  let session;
  try { session = JSON.parse(stored(SESSION_KEY, storage) || 'null'); } catch { session = null; }
  if (!session?.id || Date.now() - session.last_at > SESSION_IDLE_MS) session = {id: id()};
  session.last_at = Date.now();
  save(SESSION_KEY, JSON.stringify(session), storage);
  return session.id;
}

export function createAnalyticsEvents({endpoint = '', fetcher = fetch, clock = () => Date.now()} = {}) {
  let queue = readQueue();
  let flushing = false;
  let retryTimer;
  const attempts = new Map();
  const seen = new Set();

  async function flush() {
    if (flushing || !queue.length || !endpoint || !navigator.onLine) return;
    flushing = true;
    try {
      while (queue.length && navigator.onLine) {
        const item = queue[0];
        if (Date.now() - Date.parse(item.occurred_at) >= MAX_AGE_MS) {
          queue.shift();
          attempts.delete(item.id);
          writeQueue(queue);
          continue;
        }
        let response;
        try {
          response = await fetcher(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(item), keepalive: true, signal: AbortSignal.timeout(10000)});
        } catch {
          attempts.set(item.id, (attempts.get(item.id) || 0) + 1);
          break;
        }
        if (response.ok) {
          let accepted;
          try { accepted = await response.json(); } catch { break; }
          if (accepted.accepted_event_id !== item.id) break;
        } else if (response.status !== 400 && response.status !== 404 && response.status !== 409 && response.status !== 413 && response.status !== 415 && response.status !== 422) {
          attempts.set(item.id, (attempts.get(item.id) || 0) + 1);
          break;
        }
        attempts.delete(item.id);
        queue.shift();
        writeQueue(queue);
      }
    } finally {
      flushing = false;
      clearTimeout(retryTimer);
      if (queue.length && endpoint && navigator.onLine) {
        retryTimer = setTimeout(() => void flush(), Math.min(60000, RETRY_MS * 2 ** Math.min(4, attempts.get(queue[0].id) || 0)));
      }
    }
  }

  function track(type, data = {}) {
    if (!endpoint || !data.public_code) return null;
    const payload = {
      ...data,
      schema_version: 1,
      id: id(),
      type,
      occurred_at: new Date(clock()).toISOString(),
      session_id: sessionId(),
      visitor_key: visitorKey(),
    };
    queue.push(payload);
    queue = queue.slice(-MAX_QUEUE);
    writeQueue(queue);
    void flush();
    return payload;
  }

  function trackOnce(key, type, data = {}) {
    const scoped = `${sessionId()}:${key}`;
    if (seen.has(scoped)) return null;
    const payload = track(type, data);
    if (payload) seen.add(scoped);
    return payload;
  }

  function beacon() {
    if (!endpoint || !navigator.sendBeacon) return;
    for (const item of queue.slice(0, 3)) {
      navigator.sendBeacon(endpoint, new Blob([JSON.stringify(item)], {type: 'application/json'}));
    }
  }

  window.addEventListener('online', flush);
  window.addEventListener('pagehide', beacon);
  void flush();
  return {track, trackOnce, flush, pending: () => queue.length, sessionId};
}

export const analyticsEvents = createAnalyticsEvents({endpoint: appConfig.analyticsEventsUrl});
