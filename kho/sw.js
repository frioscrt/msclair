// Trang kho đã chuyển sang /games/. Bản này dọn bộ nhớ cũ trên máy rồi tự gỡ,
// để máy nào từng mở /kho/ không còn hiện bản cũ khi mất mạng.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kho-')).map((k) => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll())
    .then((cs) => cs.forEach((c) => c.navigate(c.url))));
});
