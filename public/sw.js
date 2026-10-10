/* TripDeck service worker — hand-written, no Workbox, to keep the bundle small.
   Three caches:
   1. app shell  — precached; bump VERSION to roll it
   2. app data   — public/data/*.json, stale-while-revalidate
   3. map tiles  — runtime cache, LRU capped at 2000 tiles (~60 MB)
*/
const VERSION = 'v1';
const SHELL = `tripdeck-shell-${VERSION}`;
const DATA  = `tripdeck-data-${VERSION}`;
const TILES = 'tripdeck-tiles';
const FONTS = 'tripdeck-fonts';
const MAX_TILES = 2000;

const BASE = new URL(self.registration.scope).pathname;
const SHELL_URLS = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('tripdeck-') && ![SHELL, DATA, TILES, FONTS].includes(k))
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  if (keys.length <= MAX_TILES) return;
  // Oldest go first — the Cache API preserves insertion order
  await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((k) => c.delete(k)));
}

async function cacheFirst(req, cacheName, after) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); if (after) after(); }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || new Response('{}', { headers: { 'Content-Type': 'application/json' } });
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Google APIs and sign-in — never cached
  if (/googleapis\.com|accounts\.google\.com|project-osrm\.org/.test(url.hostname)) return;

  // Map tiles
  if (/tile\.openstreetmap\.org|tile\..*\.org/.test(url.hostname)) {
    e.respondWith(cacheFirst(request, TILES, trimTiles).catch(() => new Response('', { status: 504 })));
    return;
  }

  // Fonts
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(cacheFirst(request, FONTS));
    return;
  }

  if (url.origin !== location.origin) return;

  // The app's own data files
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    e.respondWith(staleWhileRevalidate(request, DATA));
    return;
  }

  // Navigation — fall back to index.html when offline
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await fetch(request); }
      catch { return (await caches.match(BASE + 'index.html')) || (await caches.match(BASE)) || Response.error(); }
    })());
    return;
  }

  // Everything else static (JS/CSS/images) has a hashed name, so cache-first is safe
  e.respondWith(cacheFirst(request, SHELL).catch(() => fetch(request)));
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
