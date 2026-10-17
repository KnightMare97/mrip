/**
 * Music Rip - App Shell Service Worker
 * Only caches static assets (HTML shell, CSS, JS, SVG icons).
 * Explicitly DOES NOT cache media files, export files, or API responses.
 */

const CACHE_NAME = 'musicrip-app-shell-v1';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Strictly only intercept GET requests within same origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // DO NOT CACHE: media files (.mp3, .flac, .wav), exports (.zip), or api requests (/api/*)
  if (
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.zip') ||
    url.pathname.endsWith('.wav') ||
    url.pathname.endsWith('.flac') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network first with cache fallback for static app shell
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful static app shell assets (js, css, html, svg)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/src/') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.svg') ||
            url.pathname === '/')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
