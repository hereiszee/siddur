/* Offline after the first visit.
 *
 * The app shell changes on every deploy, so it is fetched network-first and
 * only falls back to cache when offline -- cache-first there would pin people
 * to whatever version they first loaded.  The text, fonts and calendar data
 * are large and effectively immutable, so those are cache-first.
 */
const V = 'siddur-v9';
const SHELL = ['./', 'index.html', 'bundle.js', 'manifest.webmanifest'];
const DURABLE = /\/(data|fonts)\/|icon-[\w-]+\.png$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V)
    .then((c) => c.addAll(SHELL).catch(() => {}))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  if (DURABLE.test(req.url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(V).then((k) => k.put(req, c)); }
      return res;
    })));
    return;
  }

  // Revalidate against the origin rather than the browser's HTTP cache:
  // GitHub Pages serves HTML with max-age=600, so without this a deploy would
  // not reach anyone for ten minutes even though this is network-first.
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const c = res.clone(); caches.open(V).then((k) => k.put(req, c)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
});
