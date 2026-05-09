// Simple service worker to satisfy PWA requirements
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // Static pass-through
  e.respondWith(fetch(e.request));
});
