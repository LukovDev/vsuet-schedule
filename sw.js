/*
  Офлайн-режим: сайт открывается без интернета из сохранённой копии.
  Когда интернет есть — берётся свежая версия с сервера (и копия обновляется),
  так что правки в schedule.js доходят сразу, кэш чистить не нужно.
  Если сеть не ответила за TIMEOUT мс (слабый интернет) — сразу показываем копию.
*/

const CACHE = 'rasp-v2';
const FILES = ['./', './index.html', './schedule.js'];
const OPTIONAL = ['./favicon.ico'];   // если файла нет — не страшно
const TIMEOUT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all([c.addAll(FILES), ...OPTIONAL.map(f => c.add(f).catch(() => {}))]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  // удаляем старые кэши (rasp-v1 и т.п.)
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(networkFirst(e, req));
});

// если сеть только что не ответила вовремя, следующие файлы сразу берём из копии
let slowUntil = 0;

async function networkFirst(e, req){
  const cache = await caches.open(CACHE);
  const cached = () => cache.match(req, { ignoreSearch: true, ignoreVary: true });

  const network = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  let settled = false;
  network.then(() => { settled = true; }, () => { settled = true; });
  e.waitUntil(network.catch(() => {}));   // даём дописать свежую копию, даже если ответили из кэша

  if (Date.now() < slowUntil){
    const hit = await cached();
    if (hit) return hit;
  }

  try {
    // кто быстрее: сеть или (через TIMEOUT) сохранённая копия
    const timeout = new Promise(r => setTimeout(r, TIMEOUT)).then(() => {
      if (settled) return;                 // сеть уже ответила — таймер не нужен
      slowUntil = Date.now() + 10000;
      return cached();
    });
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    return await network;                  // копии нет — ждём сеть дальше
  } catch (err) {
    const hit = await cached();            // сети нет совсем — отдаём копию
    if (hit) return hit;
    throw err;
  }
}
