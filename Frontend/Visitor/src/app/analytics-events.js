const QUEUE_KEY = 'viralabs.analytics.queue.v1';

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}

function writeQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100))); } catch { /* storage is optional */ }
}

export function createAnalyticsEvents({endpoint = '', getContext = () => ({})} = {}) {
  let queue = readQueue();
  let flushing = false;

  async function send(payload) {
    if (!endpoint || !navigator.onLine) return false;
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && payload.type === 'scene_complete') {
        return navigator.sendBeacon(endpoint, new Blob([body], {type: 'application/json'}));
      }
      const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body, keepalive: true});
      return response.ok;
    } catch { return false; }
  }

  async function flush() {
    if (flushing || !queue.length || !endpoint || !navigator.onLine) return;
    flushing = true;
    try {
      const pending = [...queue];
      for (const item of pending) {
        if (!await send(item)) break;
        queue = queue.filter((entry) => entry.id !== item.id);
        writeQueue(queue);
      }
    } finally { flushing = false; }
  }

  function track(type, data = {}) {
    const payload = {id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, type, occurred_at: new Date().toISOString(), ...getContext(), ...data};
    queue.push(payload);
    writeQueue(queue);
    void flush();
    return payload;
  }

  window.addEventListener('online', flush);
  void flush();
  return {track, flush, pending: () => queue.length};
}
