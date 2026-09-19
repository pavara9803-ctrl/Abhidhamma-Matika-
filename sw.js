/* ============================================================
   අභිධර්ම මාතිකා අධ්‍යයනය - Service Worker
   ============================================================ */

const CACHE_NAME = 'matika-cache-v1';
const RUNTIME_CACHE = 'matika-runtime-v1';

// මුලින්ම cache කළ යුතු core assets
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  // External CDN resources
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+Sinhala:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2'
];

// ============ INSTALL ============
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching core assets');
        // එක් එක් asset එක වෙන වෙනම cache කරන්න (එකක් fail වුනත් අනිත් ඒවා cache වෙන්න)
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Failed to cache:', url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============ FETCH ============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // chrome-extension වැනි අනවශ්‍ය schemes අත්හැර දමන්න
  if (!url.protocol.startsWith('http')) return;

  // ============ Navigation requests (HTML pages) ============
  // Network-first strategy for HTML so users always get latest content
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // ============ CDN & Static assets ============
  // Cache-first strategy (CDN resources rarely change)
  const isCDN =
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com');

  if (isCDN) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // ============ Same-origin assets (images, icons, etc.) ============
  // Stale-while-revalidate strategy
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ============ MESSAGE (skipWaiting control) ============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
