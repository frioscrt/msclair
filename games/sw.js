// Cho trang kho mở được cả khi mất mạng.
// Có mạng: lấy bản mới nhất rồi cất. Mất mạng: dùng bản đã cất.
const CACHE = 'games-v15';
const FILES = ['./', './index.html', './kho.js', './icon.svg', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './mystery-box/', './mystery-box/index.html', './mystery-box/icon.svg', './boat-race/', './boat-race/index.html', './boat-race/icon.svg', './bowling/', './bowling/index.html', './bowling/icon.svg', './land-explorers/', './land-explorers/index.html', './land-explorers/icon.svg', './whack-a-mole/', './whack-a-mole/index.html', './whack-a-mole/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('kho-') || k.startsWith('games-')) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // bộ câu hỏi có ?t=... để luôn lấy bản mới; cất theo đường dẫn không có ?t
  const key = url.origin + url.pathname;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then((r) => r || caches.match(req)))
  );
});
