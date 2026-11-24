// Voice Auth Card service worker: keeps the page on the phone so it opens with no signal.
// Cache-first. The build stamps a new version whenever the page changes, which replaces the cache.
const CACHE = 'voiceauth-card-81c501617082';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('voiceauth-card-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) =>
    (await c.match(req, { ignoreSearch: true })) ||
    (req.mode === 'navigate' && await c.match('index.html')) ||
    fetch(req)));
});
