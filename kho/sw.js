// Cho trang kho mở được cả khi mất mạng.
// Có mạng: lấy bản mới nhất rồi cất. Mất mạng: dùng bản đã cất.
const CACHE = 'kho-v1';
const FILES = ['./', './index.html', './kho.js', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kho-') && k !== CACHE).map((k) => caches.delete(k))))
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
