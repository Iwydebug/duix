/* DuiX — service worker: guarda el juego para usarlo sin internet */
const VERSION = 'duix-v1.8.5';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/data.js', './js/questions.js', './js/store.js', './js/audio.js', './js/sprites.js', './js/hero.js', './js/ambient.js', './js/battle.js', './js/games.js', './js/ui.js', './js/firebase-config.js', './js/net.js', './js/vendor/qrcode.js', './js/plaza.js', './js/world.js', './js/rooms.js', './js/vendor/firebase-app-compat.js', './js/vendor/firebase-database-compat.js', './js/app.js',
  './fonts/bangers-latin-400-normal.woff2', './fonts/press-start-2p-latin-400-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  // páginas: red primero (para recibir actualizaciones) y, si no hay internet, caché
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // recursos: red primero (siempre la versión más nueva) y, sin internet, la copia guardada
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r; }).catch(() => caches.match(req)));
});
