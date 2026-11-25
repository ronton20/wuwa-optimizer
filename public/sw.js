// WuWa Build Optimizer service worker: makes the app installable and usable offline.
// - pages: network first, cached copy when offline (so new deploys show up right away)
// - built files (/assets/, hashed names), mirrored images (/img/) and the OCR engine (/ocr/): cache first
// - fonts and everything else: cached copy at once, refreshed in the background
const VERSION = 'v2';
const CACHE = `wuwa-optimizer-${VERSION}`;
const SCOPE = new URL(self.registration.scope);
const INDEX = new URL('./', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache the page and the JS/CSS it loads, so the very first visit already works offline afterwards
    const res = await fetch(INDEX, { cache: 'reload' });
    if (res.ok) {
      const html = await res.clone().text();
      await cache.put(INDEX, res);
      const assets = [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], SCOPE).href);
      await cache.addAll([...new Set([...assets, new URL('manifest.webmanifest', SCOPE).href, new URL('favicon.svg', SCOPE).href])]).catch(() => {});
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('wuwa-optimizer-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

const cacheFirst = async (req) => {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
};

const staleWhileRevalidate = async (req) => {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit ?? fresh;
};

const networkFirstPage = async (req) => {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(INDEX, res.clone());
    return res;
  } catch {
    return (await cache.match(INDEX)) ?? Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.href.startsWith(SCOPE.href)) return event.respondWith(networkFirstPage(req));
  if (url.origin === SCOPE.origin) {
    if (url.pathname.includes('/assets/') || url.pathname.includes('/img/') || url.pathname.includes('/ocr/')) return event.respondWith(cacheFirst(req));
    return event.respondWith(staleWhileRevalidate(req));
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return event.respondWith(staleWhileRevalidate(req));
});
