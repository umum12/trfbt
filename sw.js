/* Service worker: cache-first untuk aset statis. Naikkan VERSION setiap rilis. */
const VERSION = 'v1.2.0';
const CACHE = 'trfbt-' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css',
  './js/engine.js', './js/store.js', './js/receipts.js', './js/printer.js', './js/ocr-parse.js', './js/ocr.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('trfbt-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const u = new URL(req.url);
  // Web Share Target: gambar yang dibagikan dari aplikasi lain
  if (req.method === 'POST' && u.origin === self.location.origin && u.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const f = fd.get('image');
        if (f && f.size) {
          const c = await caches.open('share-inbox');
          await c.put(new URL('shared-image', self.registration.scope).href, new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } }));
        }
      } catch (_) { /* abaikan */ }
      return Response.redirect(new URL('./#/share', self.registration.scope).href, 303);
    })());
    return;
  }
  // Mesin OCR (Tesseract.js) dari CDN: cache sekali agar bisa dipakai offline
  if (req.method === 'GET' && (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'tessdata.projectnaptha.com')) {
    e.respondWith(caches.open('ocr-engine').then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (req.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    })
  );
});
