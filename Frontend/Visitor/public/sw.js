const CACHE_NAME = 'viralabs-shell-v6';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/pwa-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('viralabs-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The methodist application and uploaded media share this origin.
  // Never put their responses in the Visitor offline cache.
  if (url.pathname === '/methodist' || url.pathname.startsWith('/methodist/') || url.pathname.startsWith('/media-files/')) return;
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  // Always refresh HTML: a cached page can reference chunks removed by a new build.
  if (request.mode === 'navigate' || url.pathname === '/index.html') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match('/index.html');
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }
  // Only cache built assets and the PWA shell, never dev modules or HTML fallbacks.
  if (!url.pathname.startsWith('/assets/') && !SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    const contentType = response.headers.get('content-type') || '';
    const isScript = request.destination === 'script' || /\.(?:m?js|wasm)$/.test(url.pathname);
    const validScript = /(?:javascript|ecmascript|application\/wasm)/i.test(contentType);
    if (response.ok && !contentType.includes('text/html') && (!isScript || validScript)) {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
