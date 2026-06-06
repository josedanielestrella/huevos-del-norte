const CACHE = 'huevos-norte-v2';

const SHELL = ['/', '/index.html'];

function getApiUrl() {
  const url = new URL(self.location.href);
  return `${url.protocol}//${url.hostname}:5000/api`;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = event.request.url;
  const apiUrl = getApiUrl();

  if (requestUrl.startsWith(apiUrl)) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ ok: false, message: 'Sin conexion' }), {
          headers: { 'Content-Type': 'application/json' },
        })),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'));
    }),
  );
});
