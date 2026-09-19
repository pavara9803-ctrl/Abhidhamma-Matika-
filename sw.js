self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('matika-store').then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './manifest.json',
        './launchericon-192x192.png',
        './launchericon-512x512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
