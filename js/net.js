/* DuiX — capa de red para las salas.
 * Dos motores con la misma interfaz:
 *  - "firebase": Realtime Database de Google (el real, con internet).
 *  - "local":    base de datos simulada en localStorage (solo para pruebas en un mismo navegador;
 *                se activa con ?net=local en la dirección).
 */
(function (root) {
  'use strict';
  const cfgFB = root.DUIX_FIREBASE;
  const wantLocal = /[?&]net=local\b/.test(root.location ? root.location.search : '');
  const mode = wantLocal || !cfgFB ? 'local' : 'firebase';
  const TS = mode === 'local' ? '@@ts' : null; // en Firebase se completa al cargar
  let impl = null, readyP = null;

  const loadScript = (src) => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });

  /* ---------------- motor Firebase ---------------- */
  function makeFirebase() {
    const fb = root.firebase; fb.initializeApp(cfgFB);
    const db = fb.database(), ref = (p) => db.ref(p);
    let offset = 0;
    ref('.info/serverTimeOffset').on('value', (s) => { offset = s.val() || 0; });
    const clean = (v) => (v === undefined ? null : v);
    return {
      TS: fb.database.ServerValue.TIMESTAMP,
      connected: () => new Promise((ok, bad) => {
        let done = false; const r = ref('.info/connected');
        const t = setTimeout(() => { if (!done) { done = true; r.off('value', h); bad(new Error('Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.')); } }, 9000);
        const h = (s) => { if (s.val() === true && !done) { done = true; clearTimeout(t); r.off('value', h); ok(); } };
        r.on('value', h);
      }),
      now: () => Date.now() + offset,
      get: (p) => ref(p).once('value').then((s) => clean(s.val())),
      set: (p, v) => ref(p).set(v),
      update: (p, o) => (p ? ref(p).update(o) : db.ref().update(o)),
      remove: (p) => ref(p).remove(),
      on: (p, cb) => { const r = ref(p), h = (s) => cb(clean(s.val())); r.on('value', h); return () => r.off('value', h); },
      onDisconnect: (p, v) => { const od = ref(p).onDisconnect(); return v === null ? od.remove() : od.set(v); },
      cancelDisconnect: (p) => ref(p).onDisconnect().cancel(),
      onConnection: (cb) => { const r = ref('.info/connected'), h = (s) => cb(s.val() === true); r.on('value', h); return () => r.off('value', h); },
    };
  }

  /* ---------------- motor local (pruebas) ---------------- */
  function makeLocal() {
    const KEY = 'duixnet:db';
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const save = (d) => { localStorage.setItem(KEY, JSON.stringify(d)); };
    const seg = (p) => String(p || '').split('/').filter(Boolean);
    const getAt = (d, p) => { let c = d; for (const k of seg(p)) { if (c == null || typeof c !== 'object') return null; c = c[k]; } return c === undefined ? null : c; };
    const setAt = (d, p, v) => {
      const s = seg(p); if (!s.length) return v == null ? {} : v;
      let c = d; for (let i = 0; i < s.length - 1; i++) { if (c[s[i]] == null || typeof c[s[i]] !== 'object') c[s[i]] = {}; c = c[s[i]]; }
      if (v == null) delete c[s[s.length - 1]]; else c[s[s.length - 1]] = v; return d;
    };
    const stamp = (v) => (v === '@@ts' ? Date.now() : Array.isArray(v) ? v.map(stamp) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stamp(x)])) : v);
    const listeners = [], disc = [];
    const fire = () => { const d = load(); listeners.slice().forEach((l) => { const v = getAt(d, l.p), j = JSON.stringify(v); if (j !== l.last) { l.last = j; l.cb(v === undefined ? null : JSON.parse(j === undefined ? 'null' : j)); } }); };
    root.addEventListener('storage', (e) => { if (e.key === KEY) fire(); });
    root.addEventListener('pagehide', () => { const d = load(); disc.forEach((x) => setAt(d, x.p, x.v)); if (disc.length) save(d); });
    const wrap = (fn) => Promise.resolve().then(() => { const r = fn(); fire(); return r; });
    return {
      TS: '@@ts',
      connected: () => Promise.resolve(),
      now: () => Date.now(),
      get: (p) => Promise.resolve(getAt(load(), p)).then((v) => (v === undefined ? null : JSON.parse(JSON.stringify(v === null ? null : v)))),
      set: (p, v) => wrap(() => save(setAt(load(), p, stamp(v)))),
      update: (p, o) => wrap(() => { let d = load(); Object.keys(o).forEach((k) => { d = setAt(d, (p ? p + '/' : '') + k, stamp(o[k])); }); save(d); }),
      remove: (p) => wrap(() => save(setAt(load(), p, null))),
      on: (p, cb) => { const l = { p, cb, last: undefined }; listeners.push(l); setTimeout(() => { const v = getAt(load(), p); l.last = JSON.stringify(v); cb(v === undefined ? null : JSON.parse(JSON.stringify(v))); }, 0); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; },
      onDisconnect: (p, v) => { disc.push({ p, v: v === null ? null : v }); return Promise.resolve(); },
      cancelDisconnect: (p) => { for (let i = disc.length - 1; i >= 0; i--) if (disc[i].p === p) disc.splice(i, 1); return Promise.resolve(); },
      onConnection: (cb) => { setTimeout(() => cb(true), 0); return () => {}; },
      _wipe: () => { localStorage.removeItem(KEY); fire(); },
    };
  }

  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      if (mode === 'firebase') {
        if (!root.firebase) { await loadScript('js/vendor/firebase-app-compat.js'); await loadScript('js/vendor/firebase-database-compat.js'); }
        impl = makeFirebase(); await impl.connected();
      } else impl = makeLocal();
      api.TS = impl.TS;
    })().catch((e) => { readyP = null; throw e; });
    return readyP;
  }
  const need = () => { if (!impl) throw new Error('La red no está lista'); return impl; };
  const api = {
    mode, TS, ready,
    now: () => (impl ? impl.now() : Date.now()),
    get: (p) => need().get(p), set: (p, v) => need().set(p, v), update: (p, o) => need().update(p, o), remove: (p) => need().remove(p),
    on: (p, cb) => need().on(p, cb), onDisconnect: (p, v) => need().onDisconnect(p, v), cancelDisconnect: (p) => need().cancelDisconnect(p), onConnection: (cb) => need().onConnection(cb),
    _impl: () => impl,
  };
  root.DuiXNet = api;
})(window);
