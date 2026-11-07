/**
 * prepskm.in — Service Worker for Lecture Player & Pre-Downloaded Study Materials
 * Provides resilient offline & intermittent connectivity access to:
 * 1. App shell pages (/index.html, /study.html, /test.html, /mentorship.html, /player.html)
 * 2. Lecture Player media cover assets, SVG illustrations, and chapter metadata
 * 3. Pre-downloaded Study Materials (PDF notes, formula sheets, PYQ booklets) stored in Cache Storage
 */

const SHELL_CACHE_NAME = 'prepskm-shell-v2';
const LECTURE_MATERIALS_CACHE_NAME = 'prepskm-lecture-materials-v1';

const CORE_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/study.html',
  '/test.html',
  '/mentorship.html',
  '/player.html',
  '/manifest.json',
  '/assets/lecture-cover.svg',
  '/assets/mentor-sumit.svg',
  '/assets/mentor-ananya.svg',
  '/assets/mentor-rohan.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          CORE_SHELL_ASSETS.map((url) =>
            fetch(url, { cache: 'no-cache' }).then((response) => {
              if (response && response.ok) {
                return cache.put(url, response);
              }
              return undefined;
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== SHELL_CACHE_NAME && key !== LECTURE_MATERIALS_CACHE_NAME) {
              return caches.delete(key);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Message handler allowing the Lecture Player & Study Vault to pre-download and cache
 * study materials, formula sheets, and lecture chapter packets on demand.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'PRECACHE_LECTURE_MATERIALS') {
    const materials = Array.isArray(data.materials) ? data.materials : [];
    const assetUrls = Array.isArray(data.assetUrls) ? data.assetUrls : [];

    event.waitUntil(
      caches.open(LECTURE_MATERIALS_CACHE_NAME).then(async (cache) => {
        const cachedIds = [];

        // 1. Cache synthetic offline study material responses (/offline-material/<id>.json and /materials/<fileUrl>)
        for (const item of materials) {
          if (!item || !item.id) continue;
          const payload = JSON.stringify({
            ...item,
            cachedAt: new Date().toISOString(),
            offlineReady: true,
          });
          const syntheticUrl = new URL(`/offline-materials/${encodeURIComponent(item.id)}.json`, self.location.origin).href;
          await cache.put(
            syntheticUrl,
            new Response(payload, {
              status: 200,
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-PrepSKM-Offline-Cache': 'true',
              },
            })
          );

          if (item.fileUrl && typeof item.fileUrl === 'string' && item.fileUrl.startsWith('/')) {
            const fileFullUrl = new URL(item.fileUrl, self.location.origin).href;
            const htmlDoc = item.offlineHtmlDocument || payload;
            const contentType = item.offlineHtmlDocument
              ? 'text/html; charset=utf-8'
              : 'application/json; charset=utf-8';
            await cache.put(
              fileFullUrl,
              new Response(htmlDoc, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'X-PrepSKM-Offline-Cache': 'true',
                },
              })
            );
          }

          cachedIds.push(item.id);
        }

        // 2. Cache any associated lecture cover/media URLs
        for (const rawUrl of assetUrls) {
          try {
            const targetUrl = new URL(rawUrl, self.location.origin).href;
            const res = await fetch(targetUrl);
            if (res && res.ok) {
              await cache.put(targetUrl, res.clone());
            }
          } catch (_err) {
            // Ignore individual asset fetch failures during intermittent connectivity
          }
        }

        // Notify open clients that pre-caching completed
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({
            type: 'LECTURE_MATERIALS_PRECACHED',
            cachedIds,
            timestamp: new Date().toISOString(),
          });
        }
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept Firebase Firestore / Auth / Google APIs long-polling or RPC requests
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // 1. Cache-First strategy for pre-downloaded study materials & lecture assets
  if (
    url.pathname.startsWith('/offline-materials/') ||
    url.pathname.startsWith('/materials/') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.open(LECTURE_MATERIALS_CACHE_NAME).then(async (materialCache) => {
        const cachedMaterial = await materialCache.match(request);
        if (cachedMaterial) return cachedMaterial;

        const shellCache = await caches.open(SHELL_CACHE_NAME);
        const cachedShellAsset = await shellCache.match(request);
        if (cachedShellAsset) return cachedShellAsset;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            materialCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (_err) {
          return new Response(
            JSON.stringify({
              error: 'offline',
              message: 'Resource unavailable while offline.',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      })
    );
    return;
  }

  // 2. Network-First with Cache Fallback for navigation / HTML pages & JS bundles
  if (request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const shellCache = await caches.open(SHELL_CACHE_NAME);
            shellCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          const shellCache = await caches.open(SHELL_CACHE_NAME);
          const cachedResponse = await shellCache.match(request);
          if (cachedResponse) return cachedResponse;

          if (request.mode === 'navigate') {
            const fallbackIndex = await shellCache.match('/index.html');
            if (fallbackIndex) return fallbackIndex;
          }
          return new Response('Offline — pre-downloaded lecture materials remain available in cache.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
  }
});
