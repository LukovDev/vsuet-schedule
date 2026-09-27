/*
  Офлайн-режим: сайт открывается без интернета из сохранённой копии.
  Когда интернет есть — всегда берётся свежая версия с сервера (и копия обновляется),
  так что правки в schedule.js доходят сразу, кэш чистить не нужно.
*/

const CACHE = 'rasp-v1';
const FILES = ['./', './index.html', './schedule.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  // удаляем старые кэши, если когда-нибудь поменяется имя CACHE
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// сначала сеть, без сети — из кэша
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
