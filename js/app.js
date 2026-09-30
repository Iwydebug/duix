/* DuiX — arranque, PWA y captura del instalador */
(function () {
  'use strict';
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });
  window.addEventListener('appinstalled', () => { window.__installPrompt = null; });

  function start() { window.DuiXUI.boot(); }
  const fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('20px Bangers'), document.fonts.load('12px "Press Start 2P"')]).catch(() => {}) : Promise.resolve();
  // No esperamos las fuentes más de 1,2 s para no retrasar el juego
  Promise.race([fonts, new Promise((r) => setTimeout(r, 1200))]).then(start);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    const had = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } }); // nueva versión lista → recarga sola
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => { try { r.update(); } catch (e) { /* ok */ } }).catch(() => {}); });
  }
})();
