/* DuiX — pantallas e interfaz */
(function (root) {
  'use strict';
  const D = root.DuiXData, S = root.DuiXSprites, A = root.DuiXAudio, St = root.DuiXStore, B = root.DuiXBattle;

  /* ---------- utilidades DOM ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function h(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c === undefined || c === null || c === false) return; if (Array.isArray(c)) c.forEach((x) => add(e, x)); else e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (name, scale, tint, cls) => h('img', { class: 'px ' + (cls || ''), alt: '', src: S.icon(name, scale || 3, tint) });
  const sfx = (n, a) => A.sfx(n, a);
  const V = D.VILLAINS, Vby = (id) => V.find((x) => x.id === id);
  const plural = (n, a, b) => (n === 1 ? a : b);

  const app = () => $('#app'), screenEl = () => $('#screen');
  let cur = { name: null, params: null }, cleanups = [], liveList = [], liveTimer = 0, battle = null, amb = null;

  /* ---------- héroe animado ---------- */
  function liveHero(cv, getLook, o) {
    o = o || {}; const sc = o.scale || 4, w = S.HERO_W, hh = S.HERO_H;
    cv.width = w * sc; cv.height = hh * sc; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const entry = { draw(t) { const look = getLook(); const fr = Math.floor(t / 150) % 4; ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(S.heroCanvas(look, o.pose ? o.pose() : 'idle', fr), 0, Math.round(Math.sin(t / 220) * sc * 0.6), cv.width, cv.height); } };
    entry.draw(0); liveList.push(entry);
    if (!liveTimer && !St.settings().reduceMotion) liveTimer = setInterval(() => { const t = Date.now(); liveList.forEach((e) => e.draw(t)); }, 140);
    return cv;
  }
  function stopLive() { liveList = []; if (liveTimer) { clearInterval(liveTimer); liveTimer = 0; } }
  function avatarEl(look, size) {
    const src = S.avatarCanvas(look), cv = h('canvas', { class: 'avatar px', width: src.width, height: src.height }); cv.style.width = cv.style.height = (size || 44) + 'px';
    cv.getContext('2d').drawImage(src, 0, 0); return cv;
  }
  // recorte de la cabeza (para ver bien peinados y cascos)
  function headThumb(L, cls) {
    const c = h('canvas', { class: 'px hthumb ' + (cls || ''), width: 30, height: 30 }), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(S.heroCanvas(Object.assign({}, L, { mask: 'mask-none' }), 'idle', 0, { nopet: true }), 21, 3, 30, 30, 0, 0, 30, 30); return c;
  }
  function villainEl(v, size, dark) {
    const src = S.villainCanvas(v), cv = h('canvas', { class: 'vsprite px', width: src.width, height: src.height });
    cv.getContext('2d').drawImage(src, 0, 0); cv.style.width = cv.style.height = (size || 80) + 'px'; if (dark) cv.classList.add('silhouette'); return cv;
  }

  /* ---------- toasts y modales ---------- */
  function toast(text, kind, ms) {
    const t = h('div', { class: 'toast ' + (kind || '') }, typeof text === 'string' ? h('span', { html: text }) : text);
    $('#toasts').appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms || 3200);
  }
  function modal(o) {
    const m = $('#modal'); m.innerHTML = ''; m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    const box = h('div', { class: 'mbox' + (o.cls ? ' ' + o.cls : '') }, o.title ? h('h2', { text: o.title }) : null, o.body, h('div', { class: 'mbtns' }, (o.buttons || [{ label: 'Cerrar' }]).map((b) => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => { close(); if (b.onClick) b.onClick(); sfx('click'); } }, b.label))));
    m.appendChild(box); m.onclick = (e) => { if (e.target === m && !o.locked) close(); }; return close;
  }
  function announceAch(list) { (list || []).forEach((a, i) => setTimeout(() => { toast(`<b>🏆 Logro: ${esc(a.name)}</b><br>+${a.coins} monedas${a.item && D.ITEM_BY_ID[a.item] ? ' · ' + esc(D.ITEM_BY_ID[a.item].name) : ''}`, 'ach', 4200); sfx('levelup'); }, i * 900)); }

  /* ---------- barra superior y menú ---------- */
  const NAV = [
    { id: 'hub', label: 'Mapa', icon: 'city' },
    { id: 'wardrobe', label: 'Vestidor', icon: 'shirt' },
    { id: 'rooms', label: 'Salas', icon: 'people' },
    { id: 'goals', label: 'Metas', icon: 'trophy' },
    { id: 'notebook', label: 'Cuaderno', icon: 'book' },
    { id: 'settings', label: 'Ajustes', icon: 'gear' },
  ];
  function buildNav(active) {
    const n = $('#nav'); n.innerHTML = '';
    NAV.forEach((t) => n.appendChild(h('button', { class: 'navbtn' + (t.id === active ? ' on' : ''), 'aria-label': t.label, 'aria-current': t.id === active ? 'page' : null, onclick: () => { if (cur.name !== t.id) { sfx('click'); go(t.id); } } }, h('img', { class: 'px', alt: '', src: S.icon(t.icon, 3, t.id === active ? '#ffd23f' : '#9fb3c8') }), h('span', { text: t.label }))));
    n.hidden = false;
  }
  function topbar() {
    const p = St.profile(), need = St.xpNeed(p.level);
    return h('div', { class: 'top' },
      h('button', { class: 'top-hero', 'aria-label': 'Cambiar de héroe', onclick: () => { sfx('click'); go('profiles'); } }, avatarEl(p.look, 46)),
      h('div', { class: 'top-info' },
        h('div', { class: 'top-name', text: p.name }),
        h('div', { class: 'xp' }, h('i', { style: 'width:' + Math.round(p.xp / need * 100) + '%' }), h('span', { text: 'Nivel ' + p.level }))),
      h('div', { class: 'top-coins', 'aria-label': 'Monedas' }, img('coin', 3), h('b', { class: 'coinval', text: String(p.coins) })),
      h('button', { class: 'top-sig', 'aria-label': 'Sigmas y ruleta', onclick: () => { sfx('click'); go('wheel'); } }, h('span', { class: 'sigico', text: 'Σ' }), h('b', { class: 'sigval', text: String(p.sigma || 0) }), St.spinsLeft() ? h('i', { class: 'spinbadge', text: '🎡' }) : null));
  }
  function refreshCoins() { const p = St.profile(); if (!p) return; $$('.coinval').forEach((e) => { e.textContent = String(p.coins); }); $$('.sigval').forEach((e) => { e.textContent = String(p.sigma || 0); }); }
  St.on((ev) => { if (ev === 'coins') refreshCoins(); if (ev === 'settings') applySettings(); });
  function applySettings() {
    const s = St.settings(); document.body.classList.toggle('crt-on', !!s.crt); document.body.classList.toggle('reduce', !!s.reduceMotion); document.body.classList.toggle('big', !!s.big);
    A.configure({ sfx: s.sfx, music: s.music, volume: s.volume, musicStyle: s.musicStyle });
  }

  /* ---------- navegación ---------- */
  const SCREENS = {}, NAVSCREENS = ['hub', 'wardrobe', 'rooms', 'goals', 'notebook', 'settings', 'credits'];
  const MUSIC = { title: 'menu', profiles: 'menu', creator: 'menu', hub: 'map', district: 'map', wardrobe: 'menu', rooms: 'menu', goals: 'menu', notebook: 'menu', settings: 'menu', results: 'menu', wheel: 'menu' };
  function teardown() { stopLive(); cleanups.forEach((f) => { try { f(); } catch (e) { /* ok */ } }); cleanups = []; if (battle) { battle.destroy(); battle = null; } setAmbient(false); $('#modal').hidden = true; $('#modal').innerHTML = ''; $('#toasts').innerHTML = ''; }
  const AMB_SCREENS = ['hub', 'district', 'rooms', 'roomCreate', 'room', 'wardrobe', 'goals', 'notebook', 'settings', 'results', 'profiles', 'creator', 'wheel'];
  const AMB_HUE = { hub: 0, district: 0, rooms: 40, roomCreate: 40, room: 40, wardrobe: 300, goals: 150, notebook: 190, settings: 260, results: 20, profiles: 330, creator: 300, wheel: 45 };
  function setAmbient(on, seed, opts) {
    if (amb) { amb.destroy(); amb = null; }
    const sc = screenEl(); if (sc) sc.classList.toggle('amb', !!on);
    if (on && root.DuiXAmbient) amb = root.DuiXAmbient.mount(app(), Object.assign({ seed: seed || 'hub', still: !!St.settings().reduceMotion }, opts || {}));
  }
  function go(name, params) {
    if (name === 'hub' && root.__pendingRoom && St.profile()) { params = { code: root.__pendingRoom }; root.__pendingRoom = null; name = 'rooms'; }
    teardown(); cur = { name, params };
    const p = St.profile();
    if (!p && !['title', 'creator', 'profiles'].includes(name)) name = cur.name = 'title';
    if (name === 'hub' || NAVSCREENS.includes(name)) { if (!p) return go('title'); }
    const sc = screenEl(); sc.innerHTML = ''; sc.scrollTop = 0; sc.className = 'screen s-' + name;
    app().dataset.screen = name;
    if (NAVSCREENS.includes(name)) buildNav(name); else $('#nav').hidden = true;
    if (MUSIC[name]) A.play(MUSIC[name]);
    if (AMB_SCREENS.includes(name)) setAmbient(true, name === 'district' && params && params.id ? params.id : name, { world: name === 'hub', hue: AMB_HUE[name] || 0 });
    SCREENS[name](params || {}, sc);
    sc.classList.remove('enter'); void sc.offsetWidth; sc.classList.add('enter');
  }
  const later = (fn, ms) => { const t = setTimeout(fn, ms); cleanups.push(() => clearTimeout(t)); return t; };

  /* ============================================================
   * TÍTULO
   * ============================================================ */
  SCREENS.title = (_, sc) => {
    const p = St.profile() || St.list()[0];
    const look = p ? p.look : Object.assign({}, St.DEFAULT_LOOK, { wings: 'wing-angel', pet: 'pet-dragon', suit: 'suit-caballero', weapon: 'wp-espada' });
    const bg = h('canvas', { class: 'title-bg px' }); const bw = Math.max(90, Math.min(320, Math.round(160 * innerWidth / Math.max(1, innerHeight)))); const bgc = S.cityBg(Vby('polinomios'), bw, 160); bg.width = bw; bg.height = 160; bg.getContext('2d').drawImage(bgc, 0, 0);
    const marquee = h('div', { class: 'marquee', 'aria-hidden': 'true' }, h('div', { class: 'mtrack' }, [0, 1].map(() => V.map((v) => villainEl(v, 72)))));
    const hero = h('canvas', { class: 'title-hero px' }); liveHero(hero, () => look, { scale: 6 });
    const go1 = () => { A.unlock(); sfx('select'); go(St.list().length ? 'profiles' : 'creator'); };
    const el = h('div', { class: 'title', tabindex: '0', role: 'button', 'aria-label': 'Toca para jugar', onclick: go1, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') go1(); } },
      bg,
      h('div', { class: 'logo', 'aria-label': 'DuiX' }, h('span', { text: 'D' }), h('span', { text: 'U' }), h('span', { text: 'I' }), h('span', { class: 'x', text: 'X' })),
      h('p', { class: 'tagline', text: 'Cálculo diferencial en modo arcade' }),
      hero,
      h('div', { class: 'insert' }, h('span', { class: 'blink', text: 'INSERT COIN' }), h('small', { text: 'Toca la pantalla para jugar' })),
      marquee,
      h('div', { class: 'credit', text: 'Hecho por ' + D.AUTHOR.full + ' · Proyecto de Cálculo Diferencial' }));
    sc.appendChild(el);
    // interacción: tocar al héroe salta y suelta símbolos; el fondo sigue al puntero
    const SYM = ['Σ', '∫', 'π', '√', '∞', 'Δ', 'f(x)', 'lím', '≤', 'dx'];
    hero.style.cursor = 'pointer';
    hero.addEventListener('click', (e) => {
      e.stopPropagation(); sfx('coin'); hero.classList.remove('jump'); void hero.offsetWidth; hero.classList.add('jump');
      const r = hero.getBoundingClientRect(), er = el.getBoundingClientRect();
      for (let i = 0; i < 6; i++) {
        const sp = h('span', { class: 'tsym', text: SYM[Math.floor(Math.random() * SYM.length)], style: `left:${r.left - er.left + r.width / 2}px;top:${r.top - er.top + 20}px;--dx:${Math.round((Math.random() - 0.5) * 220)}px;--dy:${-Math.round(80 + Math.random() * 140)}px;color:${['#ffd23f', '#5ce1e6', '#ff3f9a', '#c58bff'][i % 4]}` });
        el.appendChild(sp); setTimeout(() => sp.remove(), 1300);
      }
    });
    const onMove = (e) => { const x = (e.clientX / innerWidth - 0.5), y = (e.clientY / innerHeight - 0.5); bg.style.transform = `translate(${-x * 26}px,${-y * 18}px) scale(1.12)`; marquee.style.transform = `translateX(${x * 30}px)`; };
    window.addEventListener('pointermove', onMove); cleanups.push(() => window.removeEventListener('pointermove', onMove));
    if (!St.persistent) toast('Tu navegador no permite guardar. El progreso se perderá al cerrar.', 'warn', 6000);
  };

  /* ============================================================
   * PERFILES
   * ============================================================ */
  SCREENS.profiles = (_, sc) => {
    const list = St.list();
    if (!list.length) return go('creator');
    const grid = h('div', { class: 'pgrid' });
    list.forEach((p) => {
      const cv = h('canvas', { class: 'px pcv' }); liveHero(cv, () => p.look, { scale: 3 });
      grid.appendChild(h('div', { class: 'pcard' + (St.profile() && St.profile().id === p.id ? ' cur' : '') },
        h('button', { class: 'pmain', onclick: () => { A.unlock(); sfx('select'); St.switchTo(p.id); go('hub'); } }, cv, h('b', { text: p.name }), h('small', { text: `Nivel ${p.level} · ${p.coins} monedas` })),
        h('button', { class: 'pdel', 'aria-label': 'Borrar héroe ' + p.name, onclick: () => modal({ title: '¿Borrar a ' + p.name + '?', body: h('p', { text: 'Se perderá todo su progreso. Esto no se puede deshacer.' }), buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Borrar', cls: 'danger', onClick: () => { St.removeProfile(p.id); go('profiles'); } }] }) }, '🗑')));
    });
    if (list.length < St.MAX_PROFILES) grid.appendChild(h('button', { class: 'pcard pnew', onclick: () => { sfx('click'); go('creator'); } }, h('span', { class: 'plus', text: '+' }), h('b', { text: 'Nuevo héroe' })));
    sc.appendChild(h('div', { class: 'pwrap' }, h('h1', { class: 'h1', text: '¿Quién juega hoy?' }), grid,
      h('button', { class: 'btn ghost', onclick: () => go('title') }, 'Volver')));
  };

  /* ============================================================
   * CREADOR DE HÉROE
   * ============================================================ */
  /* ---------- emotes (animaciones estilo Free Fire / Fortnite) ---------- */
  const emoItems = () => D.ITEMS.filter((i) => i.cat === 'emote' && i.id !== 'em-none');
  const ownedEmotes = () => { const p = St.profile(); return p ? emoItems().filter((i) => p.owned.includes(i.id)) : []; };
  function playEmoteOn(cv, box, it, ms) {
    if (!it || !it.anim || it.anim === 'none') return;
    [...cv.classList].filter((c) => c.startsWith('emo-')).forEach((c) => cv.classList.remove(c)); void cv.offsetWidth; cv.classList.add('emo-' + it.anim);
    const t0 = Date.now(), dur = ms || 3600; sfx('levelup');
    const spawn = () => { if (!box.isConnected) return; const r = cv.getBoundingClientRect(), br = box.getBoundingClientRect();
      for (let i = 0; i < 3; i++) box.appendChild(h('span', { class: 'tsym efx', text: it.fx, style: `left:${r.left - br.left + r.width * (0.2 + Math.random() * 0.6)}px;top:${r.top - br.top + r.height * (0.2 + Math.random() * 0.4)}px;--dx:${Math.round((Math.random() - 0.5) * 160)}px;--dy:${-Math.round(60 + Math.random() * 110)}px;color:#ffd23f` })); box.querySelectorAll('.tsym.efx').forEach((e, i, a) => { if (a.length > 24 && i < a.length - 24) e.remove(); }); };
    spawn(); const iv = setInterval(() => { if (Date.now() - t0 > dur || !cv.isConnected) { clearInterval(iv); cv.classList.remove('emo-' + it.anim); return; } spawn(); }, 600);
    cleanups.push(() => clearInterval(iv));
  }
  // rueda de emotes: elige uno de los que tienes
  function emoteWheel(onPick) {
    const list = ownedEmotes(); const wrap = h('div', { class: 'ewheel' }); let close;
    const N2 = Math.max(1, list.length), R2 = Math.min(130, 92 + N2 * 4);
    list.forEach((it, i) => { const a = -Math.PI / 2 + i / N2 * Math.PI * 2, tx = Math.cos(a) * R2, ty = Math.sin(a) * R2;
      wrap.appendChild(h('button', { type: 'button', class: 'ec r-' + it.rarity, style: `transform:translate(${tx}px,${ty}px);--t:translate(${tx}px,${ty}px)`, 'aria-label': it.name, onclick: () => { close(); onPick(it); } }, h('span', { text: it.fx || '💃' }), h('small', { text: it.name }))); });
    wrap.appendChild(h('div', { class: 'ecenter', text: 'Emotes' }));
    close = modal({ title: '', body: wrap, buttons: [{ label: 'Cerrar', cls: 'ghost' }] });
  }
  const stageDeco = () => [h('div', { class: 'wspot' }), [0, 1, 2, 3, 4, 5, 6, 7].map((i) => h('i', { class: 'wspark', style: `left:${8 + i * 11}%;animation-delay:${(i * 0.37).toFixed(2)}s;--sz:${6 + (i % 3) * 3}px` }))];
  SCREENS.creator = (_, sc) => {
    const first = !St.list().length;
    const look = Object.assign({}, St.DEFAULT_LOOK, { gender: 'm', hair: 'hair-corto', suit: 'suit-rojo' });
    const cv = h('canvas', { class: 'px cprev' }); liveHero(cv, () => look, { scale: 6 });
    const nameIn = h('input', { class: 'input', maxlength: '12', placeholder: 'Nombre del héroe', autocomplete: 'off', 'aria-label': 'Nombre del héroe' });
    const genderRow = h('div', { class: 'gender' });
    const groups = h('div', { class: 'cgroups' });
    const DEF_HAIR = { m: 'hair-corto', f: 'hair-largo' };
    function renderGender() {
      genderRow.innerHTML = '';
      [['m', 'Hombre'], ['f', 'Mujer']].forEach(([g, label]) => {
        genderRow.appendChild(h('button', { class: 'gbtn' + (look.gender === g ? ' on' : ''), 'aria-pressed': look.gender === g ? 'true' : 'false', onclick: () => {
          if (look.gender === g) return; sfx('select');
          const oldG = look.gender; look.gender = g;
          if (look.hair === DEF_HAIR[oldG]) look.hair = DEF_HAIR[g];
          if (!D.BASE_SUITS[g].includes(look.suit)) look.suit = D.BASE_SUITS[g][0];
          renderGender(); buildGroups();
        } }, headThumb(Object.assign({}, look, { gender: g, hair: DEF_HAIR[g] })), h('b', { text: label })));
      });
    }
    function group(title, opts, key, render, rebuild) {
      const row = h('div', { class: 'copts' });
      const upd = () => $$('button', row).forEach((b, i) => b.classList.toggle('on', opts[i].v === look[key]));
      opts.forEach((o) => row.appendChild(h('button', { class: 'copt', 'aria-label': o.label, title: o.label, onclick: () => { look[key] = o.v; sfx('click'); if (rebuild) buildGroups(); else upd(); } }, render(o), o.label && o.show ? h('small', { text: o.label }) : null)));
      groups.appendChild(h('div', { class: 'cgroup' }, h('h3', { text: title }), row)); upd();
    }
    const swatch = (o) => h('i', { class: 'sw', style: 'background:' + o.c });
    function buildGroups() {
      groups.innerHTML = '';
      group('Piel', D.SKINS.map((c, i) => ({ v: i, label: 'Tono ' + (i + 1), c })), 'skin', swatch, true);
      group('Peinado', D.FREE_HAIR.map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name })), 'hair', (o) => headThumb(Object.assign({}, look, { hair: o.v })), false);
      group('Color de pelo', D.HAIR_COLORS.map((c, i) => ({ v: i, label: 'Color ' + (i + 1), c })), 'hairColor', swatch, true);
      group('Color del traje', D.BASE_SUITS[look.gender].map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name, c: D.ITEM_BY_ID[id].main })), 'suit', swatch, false);
      group('Cabeza', ['mask-antifaz', 'mask-none'].map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name })), 'mask', (o) => h('span', { text: o.label }), false);
      group('Capa', ['cape-corta', 'cape-none'].map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name })), 'cape', (o) => h('span', { text: o.label }), false);
      group('Emblema', ['emb-star', 'emb-bolt'].map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name })), 'emblem', (o) => h('span', { text: o.label }), false);
    }
    const rand = () => {
      const r = (a) => a[Math.floor(Math.random() * a.length)];
      look.gender = r(['m', 'f']); look.skin = Math.floor(Math.random() * 6); look.hair = r(D.FREE_HAIR); look.hairColor = Math.floor(Math.random() * 8);
      look.suit = r(D.BASE_SUITS[look.gender]); look.mask = r(['mask-antifaz', 'mask-none']); look.cape = r(['cape-corta', 'cape-none']); look.emblem = r(['emb-star', 'emb-bolt']);
      renderGender(); buildGroups(); sfx('select');
    };
    const ready = () => {
      A.unlock(); const p = St.newProfile(nameIn.value || 'Héroe', look); if (!p) return toast('Ya tienes 4 héroes. Borra uno para crear otro.', 'warn');
      sfx('levelup'); go('hub', { welcome: true });
    };
    const fantasy = Object.assign({}, look, { gender: 'f', hair: 'hair-dobles', hairColor: 6, suit: 'suit-mago', wings: 'wing-hada', pet: 'pet-dragon', weapon: 'wp-mago', mask: 'mask-halo', cape: 'cape-none' });
    const fantasy2 = Object.assign({}, look, { gender: 'm', hair: 'hair-cresta', hairColor: 4, suit: 'suit-dragon', wings: 'wing-dragon', pet: 'pet-fenix', weapon: 'wp-espada', mask: 'mask-cuernos', cape: 'cape-none' });
    const t1 = h('canvas', { class: 'px tease' }), t2 = h('canvas', { class: 'px tease' }); liveHero(t1, () => fantasy, { scale: 2 }); liveHero(t2, () => fantasy2, { scale: 2 });
    renderGender(); buildGroups();
    sc.appendChild(h('div', { class: 'creator' },
      h('div', { class: 'cstage wstage' }, stageDeco(), h('div', { class: 'wpod' }, cv), h('button', { class: 'btn small ghost dice', onclick: rand }, '🎲 Sorpréndeme')),
      h('div', { class: 'cscroll' },
        h('h1', { class: 'h1', text: first ? 'Crea tu héroe' : 'Nuevo héroe' }),
        nameIn, genderRow, groups,
        h('div', { class: 'teaser' }, t1, h('p', {}, h('b', { text: '¡Y hay mucho más!' }), h('br'), 'Alas, mascotas dragón, armaduras, túnicas, cascos y armas mágicas. Se compran con las monedas que ganas en el Vestidor.'), t2),
        h('div', { class: 'row' }, !first || St.list().length ? h('button', { class: 'btn ghost', onclick: () => go(St.list().length ? 'profiles' : 'title') }, 'Atrás') : null, h('button', { class: 'btn big', onclick: ready }, '¡Listo para luchar!')))));
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') ready(); });
  };

  /* ============================================================
   * CIUDAD (mapa)
   * ============================================================ */
  let lastHeroIdx = null;
  SCREENS.hub = (params, sc) => {
    const p = St.profile(), stats = St.stats();
    const daily = St.ensureDaily(); const dn = daily.ids.filter((id) => daily.done[id]).length;
    const GI = ['🎯', '🏃', '👾'];
    // lista de nodos: por cada tablero (villano) → banner + niveles 1, 2 y 3 (el jefe final también); Duinity es solo banner
    const nodes = []; let lv = 0;
    V.forEach((v) => {
      const unl = St.unlocked(v), pr = St.prog(v.id);
      nodes.push({ kind: 'board', v, unl, done: !v.endless && pr.tier >= 3 });
      if (!v.endless) for (let t = 1; t <= 3; t++) nodes.push({ kind: 'lvl', v, t, n: ++lv, unl: unl && (t === 1 || pr.tier >= t - 1), done: pr.tier >= t });
    });
    let nextIdx = nodes.findIndex((n) => n.kind === 'lvl' && n.unl && !n.done);
    if (nextIdx < 0) nextIdx = nodes.findIndex((n) => n.kind === 'board' && n.v.endless && n.unl);
    if (nextIdx < 0) nextIdx = 0;
    const nx = nodes[nextIdx], nextV = nx.v, nextT = nx.t || 1;
    // camino sinuoso: el primer nivel abajo, se sube en serpiente
    const ROW = 86, PADT = 130, PADB = 120, n = nodes.length, HT = PADT + PADB + (n - 1) * ROW;
    const px = (i) => 50 + 26 * Math.sin(i * 0.62 + 0.4), py = (i) => HT - PADB - i * ROW;
    const map = h('div', { class: 'wmap', style: `height:${HT}px` });
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'wpath'); svg.setAttribute('viewBox', `0 0 100 ${HT}`); svg.setAttribute('preserveAspectRatio', 'none');
    const seg = (i) => { const x0 = px(i), y0 = py(i), x1 = px(i + 1), y1 = py(i + 1), my = (y0 + y1) / 2; return `M${x0} ${y0} C${x0} ${my} ${x1} ${my} ${x1} ${y1}`; };
    const mk = (d, cls) => { const q = document.createElementNS(NS, 'path'); q.setAttribute('d', d); q.setAttribute('class', cls); svg.appendChild(q); return q; };
    let all = ''; for (let i = 0; i < n - 1; i++) all += seg(i) + ' ';
    mk(all, 'wp-b'); mk(all, 'wp-r'); mk(all, 'wp-d');
    let lit = ''; for (let i = 0; i < n - 1; i++) if (nodes[i + 1].unl) lit += seg(i) + ' ';
    if (lit) mk(lit, 'wp-lit');
    map.appendChild(svg);
    ['∫', 'Σ', 'π', '∞', 'f(x)', 'lím', 'dx', '√', 'log', 'sen', 'Δ', '0/0', 'x²', 'e', 'θ', '≤'].forEach((s, k) => { const sy = PADT + k * (HT - PADT - PADB) / 16 + 30; map.appendChild(h('span', { class: 'wdeco ' + (k % 2 ? 'r' : 'l'), style: `top:${sy}px`, text: s })); });
    const els = [];
    nodes.forEach((nd, i) => {
      const v = nd.v, isNext = i === nextIdx;
      let el;
      if (nd.kind === 'board') {
        const size = v.boss ? 104 : 88, secret = v.boss && !nd.unl;
        el = h('button', { class: `lnode board${nd.unl ? '' : ' locked'}${nd.done ? ' cleared' : ''}${v.boss ? ' boss' : ''}${isNext ? ' next' : ''}`, style: `left:${px(i)}%;top:${py(i)}px;--sz:${size}px;--glow:${v.glow || '#7b4dff'}`, 'aria-label': `Tablero ${v.n}: ${secret ? 'secreto' : v.district}${nd.unl ? '' : ', bloqueado'}`,
          onclick: () => { if (!nd.unl) { sfx('deny'); toast(secret ? 'Supera todos los tableros anteriores para descubrir este.' : 'Supera los 3 niveles del tablero anterior.', 'warn'); return; } sfx('select'); go('district', { id: v.id, tier: v.endless ? 2 : undefined }); } },
          h('span', { class: 'lcircle' }, villainEl(v, size - 18, !nd.unl), !nd.unl ? img('lock', 3, null, 'nlock') : null),
          v.endless ? null : h('span', { class: 'lnum', text: 'T' + v.n }),
          h('span', { class: 'lrib' }, h('b', { text: secret ? '???' : v.district }), v.endless && nd.unl ? h('small', { text: 'Récord ' + p.stats.duinityBest }) : null));
      } else {
        el = h('button', { class: `lnode lvl g${nd.t}${nd.unl ? '' : ' locked'}${nd.done ? ' cleared' : ''}${isNext ? ' next' : ''}`, style: `left:${px(i)}%;top:${py(i)}px;--sz:54px`, 'aria-label': `Nivel ${nd.n}: ${v.district}, juego ${nd.t}${nd.unl ? '' : ', bloqueado'}`,
          onclick: () => { if (!nd.unl) { sfx('deny'); toast(nd.t === 1 ? 'Supera los 3 niveles del tablero anterior.' : 'Supera primero el nivel anterior.', 'warn'); return; } sfx('select'); go('district', { id: v.id, tier: nd.t }); } },
          h('span', { class: 'lcircle' }, nd.unl ? h('b', { class: 'lgi', text: nd.done ? '✔' : String(nd.n) }) : img('lock', 3, null, 'nlock2')),
          h('span', { class: 'lico', text: GI[nd.t - 1] }));
      }
      el.dataset.y = py(i); map.appendChild(el); els.push(el);
    });
    // héroe (avatar) parado en el nivel actual; si avanzaste, camina hasta él
    const hcv = h('canvas', { class: 'px lhero-cv' }); liveHero(hcv, () => p.look, { scale: 3 });
    const hero = h('div', { class: 'lhero' }, hcv, h('span', { class: 'lhero-sh' }));
    const setHero = (x, y) => { hero.style.left = x + '%'; hero.style.top = y + 'px'; hero.dataset.y = y; };
    let fromIdx = -1;
    if (lastHeroIdx !== null && lastHeroIdx !== nextIdx && lastHeroIdx < nextIdx) fromIdx = lastHeroIdx;
    const targetY = () => py(nextIdx) - (nodes[nextIdx].kind === 'board' ? 44 : 24);
    setHero(px(fromIdx >= 0 ? fromIdx : nextIdx), fromIdx >= 0 ? py(fromIdx) - (nodes[fromIdx].kind === 'board' ? 44 : 24) : targetY()); map.appendChild(hero);
    if (fromIdx >= 0 && fromIdx < nextIdx) {
      let t0 = 0; const dur = 300 + (nextIdx - fromIdx) * 380;
      later(() => { A.sfx('coin'); const step = (ts) => { if (!t0) t0 = ts; const k = Math.min(1, (ts - t0) / dur), f = fromIdx + (nextIdx - fromIdx) * k, i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1), fr = f - i0; setHero(px(i0) + (px(i1) - px(i0)) * fr, (py(i0) + (py(i1) - py(i0)) * fr) - 24 - Math.abs(Math.sin(f * Math.PI * 2)) * 14); if (k < 1 && cur && cur.name === 'hub') requestAnimationFrame(step); else { setHero(px(nextIdx), targetY()); A.sfx('levelup'); els[nextIdx].classList.add('popin'); } }; requestAnimationFrame(step); }, 700);
    }
    lastHeroIdx = nextIdx;
    // zoom suave según qué tan cerca del centro de la pantalla está cada nodo
    let raf = 0, mapTop = 0;
    const zoom = () => { raf = 0; const mid = sc.scrollTop + sc.clientHeight / 2 - mapTop; for (let i = 0; i < els.length; i++) { const d = Math.abs(+els[i].dataset.y - mid), k = Math.max(0, 1 - d / (sc.clientHeight * 0.55)); els[i].style.setProperty('--zs', (0.62 + 0.9 * k * k).toFixed(3)); } if (hero && hero.dataset) { const hd = Math.abs(+hero.dataset.y - mid), hk = Math.max(0, 1 - hd / (sc.clientHeight * 0.55)); hero.style.setProperty('--zs', (0.75 + 0.75 * hk * hk).toFixed(3)); } };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(zoom); };
    sc.addEventListener('scroll', onScroll, { passive: true }); cleanups.push(() => { sc.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); });
    const playNext = () => { sfx('select'); go('district', { id: nextV.id, tier: nx.v.endless ? 2 : nextT }); };
    sc.appendChild(h('div', { class: 'hubwrap' }, topbar(),
      h('div', { class: 'cta' }, h('div', { class: 'cta-l' }, h('b', { text: 'Mundo DuiX' }), h('small', { text: `${stats.districts}/15 tableros · ${stats.stars}/45 ★` })),
        h('div', { class: 'ctabtns' }, h('button', { class: 'chip', 'aria-label': 'Puntaje y créditos', onclick: () => { sfx('click'); go('credits'); } }, '🏆 ', h('b', { text: fmtPts(St.score().total) + '/100' })), h('button', { class: 'chip', onclick: () => { sfx('click'); go('goals'); } }, '📋 ', h('b', { text: dn + '/3' })))),
      h('button', { class: 'btn big playnext', onclick: playNext }, img('play', 3), h('span', { text: 'Continuar: ' + nextV.name + (nx.v.endless ? '' : ' · Nivel ' + nextT) })),
      map));
    // iconos flotantes fijos a los costados del mapa (como en Candy Crush)
    { const mk = (ico, label, fn, badge, cls) => h('button', { class: 'dockbtn ' + (cls || ''), 'aria-label': label, onclick: () => { sfx('select'); fn(); } }, h('span', { class: 'dico', text: ico }), h('small', { text: label }), badge ? h('i', { class: 'dbadge', text: badge }) : null);
      const spins = St.spinsLeft();
      const L = h('div', { class: 'hubdock left' }, mk('🎡', 'Ruleta', () => go('wheel'), spins ? String(spins) : '', 'wheelbtn'), mk('🎁', 'Vestidor', () => go('wardrobe')));
      const Rr = h('div', { class: 'hubdock right' }, mk('🏆', 'Metas', () => go('goals'), dn ? dn + '/3' : ''), mk('💃', 'Emotes', () => emoteWheel((it) => { if (it.anim && it.anim !== 'none') playEmoteOn(hcv, hero, it, 3200); }), '', 'emobtn'), mk('👥', 'Salas', () => go('rooms')));
      app().appendChild(L); app().appendChild(Rr); cleanups.push(() => { L.remove(); Rr.remove(); }); }
    if (params.welcome) later(() => toast(`¡Bienvenido, <b>${esc(p.name)}</b>! El Mundo DuiX te necesita.`, '', 3800), 400);
    later(() => { mapTop = map.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop; const y = py(fromIdx >= 0 ? fromIdx : nextIdx) + mapTop; sc.scrollTop = y - sc.clientHeight * 0.6; zoom(); if (fromIdx >= 0 && fromIdx < nextIdx) { const y2 = py(nextIdx) + mapTop; const s0 = sc.scrollTop, s1 = y2 - sc.clientHeight * 0.6, T0 = performance.now(); const sm = (ts) => { const k = Math.min(1, (ts - T0 - 700) / (300 + (nextIdx - fromIdx) * 380)); if (k > 0) sc.scrollTop = s0 + (s1 - s0) * k; if (k < 1 && cur && cur.name === 'hub') requestAnimationFrame(sm); }; requestAnimationFrame(sm); } }, 40);
  };

  /* ============================================================
   * DISTRITO / ANTES DE LA BATALLA
   * ============================================================ */
  SCREENS.district = (params, sc) => {
    const v = Vby(params.id), pr = St.prog(v.id), p = St.profile();
    if (!v || !St.unlocked(v)) return go('hub');
    let tier = params.tier || Math.min(3, Math.max(1, pr.tier + (pr.tier >= 1 && pr.tier < 3 ? 1 : pr.tier === 3 ? 0 : 0) || 1));
    if (pr.tier === 0) tier = 1;
    const tierUnlocked = (t) => t === 1 || pr.tier >= t - 1;
    const repaso = h('div', { class: 'repaso', hidden: true }, h('h3', { text: 'Repaso rápido: ' + v.tema }), repasoList(v.topic));
    const tiers = h('div', { class: 'tiers' });
    const MUL = ['×1', '×1,5', '×2'];
    const GM = [['🎯', 'Disparo', 'Dispara a la cápsula con la respuesta correcta antes de que caiga.'], ['🏃', 'Carrera', 'Corre sin parar, esquiva minas, recoge monedas y poderes, y cruza la puerta con la respuesta.'], ['👾', 'Laberinto', 'Guía a tu héroe por el laberinto, come la respuesta correcta y huye de los secuaces.']];
    function renderTiers() {
      tiers.innerHTML = '';
      [1, 2, 3].forEach((t) => {
        const un = tierUnlocked(t), done = pr.tier >= t, g = GM[t - 1];
        tiers.appendChild(h('button', { class: `tier t${t}` + (t === tier ? ' on' : '') + (un ? '' : ' off') + (done ? ' done' : ''), disabled: !un, 'aria-pressed': t === tier ? 'true' : 'false', onclick: () => { tier = t; sfx('click'); renderTiers(); } },
          h('span', { class: 'tico', text: g[0] }),
          h('span', { class: 'tbody' }, h('b', { text: `Nivel ${t} · ${g[1]}` }), h('small', { text: un ? g[2] : `Se desbloquea al vencer el Nivel ${t - 1}` })),
          h('span', { class: 'tside' }, un ? h('em', { text: 'Premios ' + MUL[t - 1] }) : img('lock', 3), done ? h('span', { class: 'tchk', text: '✔ Superado' }) : null)));
      });
    }
    renderTiers();
    const info = v.endless ? `Supervivencia sin fin con todos los temas. La dificultad sube sola. Tu récord: ${p.stats.duinityBest} aciertos.` : v.boss ? 'Jefe final: preguntas de TODOS los temas mezclados.' : `Tema: ${v.tema}.`;
    const vs = villainEl(v, v.boss ? 150 : 128);
    sc.appendChild(h('div', { class: 'dist' },
      h('button', { class: 'back', onclick: () => { sfx('back'); go('hub', { scrollTo: true }); } }, '‹ Ciudad'),
      h('div', { class: 'dhead' }, h('div', { class: 'dvil', style: `--glow:${v.glow}` }, vs),
        h('div', { class: 'dbubble' }, h('b', { text: v.name + ' · ' + v.title }), h('p', { text: '“' + v.intro + '”' }))),
      h('h1', { class: 'h1 dtitle', text: v.district }),
      h('p', { class: 'dinfo', text: info }),
      h('button', { class: 'btn ghost', onclick: () => { sfx('click'); repaso.hidden = !repaso.hidden; } }, img('book', 3, '#ffd23f'), h('span', { text: ' Repaso rápido' })), repaso,
      v.endless ? null : h('div', { class: 'dstat' }, h('span', { text: 'Mejor: ' }), h('div', { class: 'stars' }, [0, 1, 2].map((k) => img(k < pr.stars ? 'star' : 'starEmpty', 2))), h('span', { text: ` · Victorias: ${pr.wins}` })),
      v.endless ? null : h('h3', { class: 'h3', text: 'Elige tu juego' }), v.endless ? null : tiers,
      h('button', { class: 'btn big fight', onclick: () => { A.unlock(); sfx('select'); startBattle(v, v.endless ? 2 : tier); } }, img('bolt', 3), h('span', { text: ' ¡A luchar!' }))));
    if (pr.plays === 0 && !v.endless) later(() => toast('Consejo: abre el <b>Repaso rápido</b> antes de luchar.', '', 3200), 500);
  };

  /* ============================================================
   * BATALLA
   * ============================================================ */
  function startBattle(v, tier) {
    go('battle', { id: v.id, tier });
  }
  SCREENS.battle = (params, sc) => {
    const v = Vby(params.id), p = St.profile();
    $('#nav').hidden = true; A.play(v.boss ? 'boss' : 'battle');
    const holder = h('div', { class: 'btholder' }); sc.appendChild(holder);
    battle = (root.DuiXGames || B).start({
      container: holder, villain: v, tier: params.tier, look: p.look, perks: St.perks(),
      onEnd: (res) => finishBattle(v, params.tier, res),
      onQuit: () => { battle = null; go('district', { id: v.id, tier: params.tier }); },
      onRestart: () => { battle = null; go('battle', { id: v.id, tier: params.tier }); },
    });
    root.__battle = battle;
  };
  function finishBattle(v, tier, res) {
    const mul = [1, 1.5, 2][tier - 1];
    let coins = Math.round(res.coins * mul), xp = res.correct * 10 + Math.round(res.answered * 2);
    if (res.win) { coins += Math.round((40 + v.n * 4) * mul) + (res.stars === 3 ? 30 : 0); xp += Math.round(70 * mul); }
    if (res.endless) { coins += Math.min(200, res.correct * 3); }
    const before = St.profile().level;
    const sigma = (res.win ? 1 + (res.stars === 3 ? 2 : 0) : 0) + (res.sigma || 0);
    St.addCoins(coins); if (sigma) St.addSigma(sigma); if (res.win) St.grantSpin(1);
    const ups = St.addXp(xp);
    const scBefore = St.score().total;
    const rec = St.recordBattle(v, res);
    const scAfter = St.score().total;
    const ach = St.checkAch();
    let chest = null; if (res.win && res.stars === 3 && Math.random() < 0.6) chest = St.openChest(true);
    St.save();
    battle = null;
    go('results', { id: v.id, tier, res, coins, sigma, xp, ups, ach, chest, scBefore, scAfter, first: rec && rec.firstClear, before });
  }

  /* ============================================================
   * RESULTADOS
   * ============================================================ */
  SCREENS.results = (P, sc) => {
    const v = Vby(P.id), res = P.res, p = St.profile();
    const win = res.win || (res.endless && res.correct >= 1);
    const stars = h('div', { class: 'rstars' }, [0, 1, 2].map((k) => h('span', { class: 'rstar' + (k < res.stars ? ' on' : ''), style: `animation-delay:${0.5 + k * 0.45}s` }, img(k < res.stars ? 'star' : 'starEmpty', 7))));
    const acc = res.answered ? Math.round(res.correct / res.answered * 100) : 0;
    const title = res.endless ? `¡Resististe ${res.correct} ${plural(res.correct, 'pregunta', 'preguntas')}!` : res.win ? '¡Victoria!' : 'Derrota';
    const rewards = h('div', { class: 'rewards' },
      h('div', { class: 'rw' }, img('coin', 3), h('b', { text: '+' + P.coins }), h('small', { text: 'monedas' })),
      h('div', { class: 'rw sig' }, h('span', { class: 'sigico', text: 'Σ' }), h('b', { text: '+' + (P.sigma || 0) }), h('small', { text: 'sigmas' })),
      h('div', { class: 'rw' }, img('bolt', 3), h('b', { text: '+' + P.xp }), h('small', { text: 'experiencia' })),
      h('div', { class: 'rw' }, img('star', 3), h('b', { text: acc + '%' }), h('small', { text: 'precisión' })),
      h('div', { class: 'rw' }, img('heart', 3), h('b', { text: String(res.bestStreak) }), h('small', { text: 'mejor racha' })));
    const mist = res.mistakes.length ? h('div', { class: 'mist' }, h('h3', { class: 'h3', text: `Para repasar (${res.mistakes.length})` }), res.mistakes.map(mistakeCard)) : h('p', { class: 'hint', text: res.answered ? '¡Ni un error para repasar!' : '' });
    const resHero = (() => { const cv = h('canvas', { class: 'px' }); liveHero(cv, () => p.look, { scale: 3, pose: () => 'idle' }); const box = h('div', { class: 'rhero' }, cv); const em = D.ITEM_BY_ID[p.look.emote]; if (res.win && em && em.anim !== 'none') later(() => playEmoteOn(cv, box, em, 4200), 700); return box; })();
    const nextV = V[V.indexOf(v) + 1];
    const canNext = res.win && nextV && St.unlocked(nextV);
    sc.appendChild(h('div', { class: 'results ' + (win ? 'win' : 'lose') },
      h('div', { class: 'rhead' }, h('div', { class: 'rvil', style: `--glow:${v.glow}` }, villainEl(v, 96)), h('div', { class: 'rbubble' }, h('p', { text: '“' + (res.win ? v.defeat : v.intro.split('.')[0] + '…') + '”' }))),
      h('h1', { class: 'h1 rtitle', text: title }),
      res.win ? resHero : null,
      res.endless ? null : stars,
      rewards,
      res.endless ? null : h('button', { class: 'scorebar', onclick: () => { sfx('select'); go('credits'); }, 'aria-label': 'Ver puntaje total' }, h('span', { class: 'sb-l', text: 'PUNTAJE' }), h('b', { text: fmtPts(P.scAfter) + ' / 100' }), P.scAfter > P.scBefore ? h('span', { class: 'sb-d', text: '+' + fmtPts(P.scAfter - P.scBefore) }) : h('small', { text: res.win ? 'Ya tenías estos puntos: sube de dificultad o de estrellas para ganar más' : 'Gana el tablero para sumar puntos' })),
      P.ups && P.ups.length ? h('div', { class: 'levelup' }, h('b', { text: '¡Subiste al nivel ' + P.ups[P.ups.length - 1].level + '!' }), h('small', { text: P.ups.map((u) => `Nivel ${u.level}: +${u.coins} monedas${u.item ? ' · ' + D.ITEM_BY_ID[u.item].name : ''}`).join(' · ') })) : null,
      P.chest && P.chest.ok ? h('div', { class: 'levelup chest' }, img('chest', 3), h('b', { text: '¡Cofre de botín!' }), h('small', { text: P.chest.item ? `Conseguiste: ${P.chest.item.name} (${D.RARITY[P.chest.item.rarity].name})` : `+${P.chest.coins} monedas extra` })) : null,
      mist,
      h('div', { class: 'rbtns' },
        canNext ? h('button', { class: 'btn big', onclick: () => { sfx('select'); go('district', { id: nextV.id }); } }, 'Siguiente distrito') : null,
        h('button', { class: 'btn' + (canNext ? '' : ' big'), onclick: () => { sfx('select'); go('district', { id: v.id, tier: P.tier }); } }, res.win ? 'Volver a luchar' : 'Reintentar'),
        v.boss && res.win ? h('button', { class: 'btn gold big', onclick: () => { sfx('select'); go('credits', { final: true }); } }, '🏆 Créditos y puntaje final') : null,
        res.win ? h('button', { class: 'btn gold', onclick: () => { sfx('select'); go('wheel'); } }, '🎡 ¡Girar ruleta!') : null,
        h('button', { class: 'btn ghost', onclick: () => { sfx('back'); go('hub', { scrollTo: true }); } }, 'Volver al mapa'))));
    // sonidos y avisos
    if (res.win) { A.play('menu'); later(() => sfx('win'), 100); [0, 1, 2].forEach((k) => { if (k < res.stars) later(() => sfx('star', k), 500 + k * 450); }); } else later(() => sfx('lose'), 100);
    if (P.ups && P.ups.length) later(() => sfx('levelup'), 1900);
    announceAch(P.ach);
    if (P.first) later(() => toast(`¡Nuevo distrito desbloqueado!`, 'ach'), 2200);
  };
  function repasoList(topic) {
    return h('ul', { class: 'rlist' }, (D.REPASO[topic] || []).map((t) => h('li', { class: t.startsWith('Ejemplo') ? 'rex' : t.startsWith('📖') ? 'rref' : '', text: t })));
  }
  function mistakeCard(m) {
    const q = h('div', { class: 'mcard' }, h('div', { class: 'mq', text: m.text }));
    if (m.table) q.appendChild(h('div', { class: 'mtable', html: '<table><tr>' + m.table.head.map((c, i) => (i ? '<td>' : '<th>') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>' + m.table.rows.map((r) => '<tr>' + r.map((c, i) => (i ? '<td>' : '<th>') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>' }));
    const mans = h('div', { class: 'mans' });
    if (typeof m.chosen === 'number' && m.chosen >= 0 && m.options[m.chosen] !== undefined) mans.appendChild(h('span', { class: 'bad', text: '✖ Elegiste: ' + m.options[m.chosen] }));
    else if (m.chosen === -1) mans.appendChild(h('span', { class: 'bad', text: '⏱ No alcanzaste a responder' }));
    mans.appendChild(h('span', { class: 'ok', text: '✔ Correcta: ' + m.options[m.correct] }));
    q.appendChild(mans);
    q.appendChild(h('p', { class: 'mexp', text: m.explain }));
    return q;
  }

  /* ============================================================
   * VESTIDOR + TIENDA
   * ============================================================ */
  const AMULET_ICON = { 'am-none': '⚪', 'am-escudo': '🛡️', 'am-lupa': '🔍', 'am-log': '🪙', 'am-reloj': '⏳', 'am-titan': '💗' };
  function itemPreview(it, look) {
    const cv = h('canvas', { class: 'px iprev' });
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const L = Object.assign({}, look, { [it.cat]: it.id });
    if (it.cat === 'hair' || it.cat === 'mask') { cv.width = 30; cv.height = 30; ctx.drawImage(S.heroCanvas(it.cat === 'hair' ? Object.assign({}, L, { mask: 'mask-none' }) : L, 'idle', 0, { nopet: true }), 21, 3, 30, 30, 0, 0, 30, 30); }
    else if (it.cat === 'emblem') { cv.width = 84; cv.height = 84; const suit = D.ITEM_BY_ID[look.suit] || D.ITEM_BY_ID['suit-rojo']; ctx.fillStyle = suit.main; ctx.fillRect(0, 0, 84, 84); const rows = S.EMB[it.shape]; const sc = Math.floor(60 / Math.max(rows[0].length, rows.length)), ox = Math.round((84 - rows[0].length * sc) / 2), oy = Math.round((84 - rows.length * sc) / 2); ctx.fillStyle = suit.accent === '#ffffff' ? '#fff' : S.lighten(suit.accent, 0.25); rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') ctx.fillRect(ox + i * sc, oy + j * sc, sc, sc); }); }
    else if (it.cat === 'emote') { cv.width = 84; cv.height = 84; ctx.fillStyle = '#1a1033'; ctx.fillRect(0, 0, 84, 84); ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.id === 'em-none' ? '🚫' : (it.fx || '💃'), 42, 46); ctx.font = '12px serif'; ctx.fillText('💃', 68, 14); }
    else if (it.cat === 'amulet') { cv.width = 84; cv.height = 84; ctx.fillStyle = '#1a1033'; ctx.fillRect(0, 0, 84, 84); ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(AMULET_ICON[it.id] || '✨', 42, 46); }
    else { cv.width = S.HERO_W; cv.height = S.HERO_H; ctx.drawImage(S.heroCanvas(L, it.cat === 'weapon' ? 'shoot' : 'idle', 0), 0, 0); }
    return cv;
  }
  SCREENS.wardrobe = (params, sc) => {
    const p = St.profile(); let cat = params.cat || 'suit', sel = null;
    const pv = {}; // vista previa (no guardada)
    const stage = h('canvas', { class: 'px wprev' });
    const lookNow = () => Object.assign({}, p.look, pv);
    let forcePose = null, forceUntil = 0;
    liveHero(stage, lookNow, { scale: 6, pose: () => (forcePose && Date.now() < forceUntil ? forcePose : (cat === 'weapon' || Math.floor(Date.now() / 1600) % 4 === 0 ? 'shoot' : 'idle')) });
    const stageBox = h('div', { class: 'wstage' }, stageDeco(), h('div', { class: 'wpod' }, stage), h('div', { class: 'wname', text: p.name }));
    stageBox.style.cursor = 'pointer';
    stageBox.addEventListener('click', () => { const em = D.ITEM_BY_ID[p.look.emote]; if (em && em.anim && em.anim !== 'none') { playEmoteOn(stage, stageBox, em, 3000); return; } forcePose = 'shoot'; forceUntil = Date.now() + 700; stage.classList.remove('jump'); void stage.offsetWidth; stage.classList.add('jump'); sfx('select'); });
    const tabs = h('div', { class: 'ctabs', role: 'tablist' });
    const grid = h('div', { class: 'igrid' });
    const bar = h('div', { class: 'ibar' });
    const summary = h('div', { class: 'wsum' });
    function owned(id) { return p.owned.includes(id); }
    function renderTabs() {
      tabs.innerHTML = '';
      const all = [{ id: 'body', name: 'Aspecto', icon: '🙂' }].concat(D.CATS);
      all.forEach((c) => { const n = D.ITEMS.filter((i) => i.cat === c.id).length, o = D.ITEMS.filter((i) => i.cat === c.id && owned(i.id)).length; tabs.appendChild(h('button', { class: 'ctab' + (c.id === cat ? ' on' : ''), role: 'tab', 'aria-selected': c.id === cat ? 'true' : 'false', onclick: () => { cat = c.id; sel = null; sfx('click'); renderAll(); } }, h('span', { text: c.icon }), h('b', { text: c.name }), h('small', { text: c.id === 'body' ? 'libre' : `${o}/${n}` }))); });
    }
    function itemCard(it) {
      const eq = p.look[it.cat] === it.id, own = owned(it.id), rar = D.RARITY[it.rarity];
      const lockAch = it.unlock && !own, trying = pv[it.cat] === it.id;
      return h('button', { class: `icard r-${it.rarity}${eq ? ' eq' : ''}${own ? '' : ' lock'}${sel === it.id ? ' sel' : ''}`, 'aria-label': `${it.name}, ${rar.name}${eq ? ', puesto' : own ? '' : lockAch ? ', se consigue con un logro' : ', ' + it.price + ' monedas'}`, style: `--rc:${rar.color}`, onclick: () => choose(it) },
        itemPreview(it, lookNow()),
        h('b', { class: 'iname', text: it.name }),
        h('span', { class: 'irar', text: rar.name }),
        eq ? h('span', { class: 'ibadge on', text: 'Puesto' }) : own ? h('span', { class: 'ibadge', text: 'Tuyo' }) : trying ? h('span', { class: 'ibadge on', text: 'Probando' }) : lockAch ? h('span', { class: 'ibadge ach', text: '🏆 Logro' }) : h('span', { class: 'ibadge price' }, img('coin', 2), h('b', { text: String(it.price) })));
    }
    function choose(it) {
      sel = it.id; if (it.cat === 'emote') playEmoteOn(stage, stageBox, it, 3600); else { stage.classList.remove('jump'); void stage.offsetWidth; stage.classList.add('jump'); }
      if (owned(it.id)) { St.equip(it.id); delete pv[it.cat]; sfx('select'); }
      else { pv[it.cat] = it.id; sfx('click'); }
      renderAll();
    }
    function renderBar() {
      bar.innerHTML = ''; const it = sel && D.ITEM_BY_ID[sel];
      if (cat === 'body') { bar.appendChild(h('p', { class: 'hint', text: 'Cambia tu cuerpo, piel y color de pelo cuando quieras. Es gratis.' })); return; }
      if (!it) { bar.appendChild(h('p', { class: 'hint', text: 'Toca cualquier objeto para probártelo, aunque aún no lo tengas. Los tuyos se equipan al instante.' })); return; }
      const own = owned(it.id), rar = D.RARITY[it.rarity];
      bar.appendChild(h('div', { class: 'binfo' }, h('b', { text: it.name }), h('small', { class: 'brar', style: 'color:' + rar.color, text: rar.name }), it.perk || it.desc ? h('p', { class: 'perk', text: it.perk || it.desc }) : null, !own && !it.unlock ? h('p', { class: 'perk', text: 'Te lo estás probando. Cómpralo para quedártelo.' }) : null));
      if (own) bar.appendChild(h('span', { class: 'ibadge on big', text: p.look[it.cat] === it.id ? 'Puesto ✓' : 'Tuyo' }));
      else if (it.unlock) bar.appendChild(h('span', { class: 'ibadge ach big', text: '🏆 Se gana con el logro “' + (D.ACH.find((a) => a.id === it.unlock.ach) || {}).name + '”' }));
      else bar.appendChild(h('button', { class: 'btn buy' + (p.coins >= it.price ? '' : ' cant'), onclick: () => {
        const r = St.buy(it.id); if (!r.ok) { sfx('deny'); toast(r.err, 'warn'); return; }
        sfx('buy'); St.equip(it.id); delete pv[it.cat]; toast(`¡Compraste <b>${esc(it.name)}</b> y te lo pusiste!`, ''); announceAch(r.ach); renderAll();
      } }, img('coin', 3), h('span', { text: ` Comprar · ${it.price}` })));
    }
    function renderBody() {
      const sw = (c, i, key) => h('button', { class: 'copt' + (p.look[key] === i ? ' on' : ''), 'aria-label': (key === 'skin' ? 'Piel ' : 'Pelo ') + (i + 1), onclick: () => { St.setLook({ [key]: i }); sfx('click'); renderAll(); } }, h('i', { class: 'sw', style: 'background:' + c }));
      const gbtn = (g, label) => h('button', { class: 'gbtn' + (p.look.gender === g ? ' on' : ''), onclick: () => { if (p.look.gender === g) return; St.setLook({ gender: g }); sfx('select'); renderAll(); } }, headThumb(Object.assign({}, p.look, { gender: g }), ''), h('b', { text: label }));
      grid.className = 'bodypanel';
      grid.appendChild(h('div', { class: 'cgroup' }, h('h3', { text: 'Cuerpo' }), h('div', { class: 'gender' }, gbtn('m', 'Hombre'), gbtn('f', 'Mujer'))));
      grid.appendChild(h('div', { class: 'cgroup' }, h('h3', { text: 'Piel' }), h('div', { class: 'copts' }, D.SKINS.map((c, i) => sw(c, i, 'skin')))));
      grid.appendChild(h('div', { class: 'cgroup' }, h('h3', { text: 'Color de pelo' }), h('div', { class: 'copts' }, D.HAIR_COLORS.map((c, i) => sw(c, i, 'hairColor')))));
    }
    function renderAll() {
      renderTabs(); grid.innerHTML = ''; grid.className = 'igrid';
      if (cat === 'body') renderBody();
      else { const items = D.ITEMS.filter((i) => i.cat === cat).sort((a, b) => (owned(b.id) - owned(a.id)) || a.price - b.price); items.forEach((it) => grid.appendChild(itemCard(it))); }
      renderBar(); refreshCoins();
      summary.textContent = `Colección: ${p.owned.length}/${D.ITEMS.length} objetos`;
    }
    const chest = h('button', { class: 'chestbtn', onclick: () => {
      const r = St.openChest(false); if (!r.ok) { sfx('deny'); toast(r.err, 'warn'); return; }
      sfx('buy');
      const body = r.dup ? h('p', { text: `¡Ya tienes todo! Te devolvemos ${r.coins} monedas.` }) : h('div', { class: 'reveal r-' + r.item.rarity, style: `--rc:${D.RARITY[r.item.rarity].color}` }, itemPreview(r.item, p.look), h('b', { text: r.item.name }), h('small', { text: D.RARITY[r.item.rarity].name + ' · ' + D.CATS.find((c) => c.id === r.item.cat).name }));
      modal({ title: '¡Cofre abierto!', body, cls: 'chestm', buttons: r.item ? [{ label: 'Equipar', onClick: () => { St.equip(r.item.id); cat = r.item.cat; sel = r.item.id; renderAll(); } }, { label: 'Guardar', cls: 'ghost', onClick: () => { cat = r.item.cat; renderAll(); } }] : [{ label: 'Genial' }] });
      if (r.item) sfx('levelup'); announceAch(r.ach); renderAll();
    } }, img('chest', 4), h('div', null, h('b', { text: 'Cofre misterioso' }), h('small', { text: 'Un objeto al azar que aún no tengas' })), h('span', { class: 'ibadge price' }, img('coin', 2), h('b', { text: String(St.CHEST_COST) })));
    sc.appendChild(h('div', { class: 'wardrobe' }, topbar(), stageBox, tabs, h('div', { class: 'wscroll' }, chest, grid, summary), bar));
    renderAll();
  };

  /* ============================================================
   * METAS (misiones + logros)
   * ============================================================ */

  /* ============================================================
   * RULETA ARCADE + CANJE DE SIGMAS
   * ============================================================ */
  SCREENS.wheel = (P, sc) => {
    const N = St.WHEEL.length, SEG = 360 / N; let rot = 0, spinning = false;
    const status = h('div', { class: 'wh-status' });
    const cv = h('canvas', { class: 'wh-cv', width: 320, height: 320 });
    const ctx = cv.getContext('2d');
    function draw() {
      ctx.clearRect(0, 0, 320, 320); ctx.save(); ctx.translate(160, 160);
      ctx.save(); ctx.rotate(rot * Math.PI / 180);
      St.WHEEL.forEach((w, i) => {
        const a0 = (i * SEG - 90 - SEG / 2) * Math.PI / 180, a1 = a0 + SEG * Math.PI / 180;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 148, a0, a1); ctx.closePath();
        ctx.fillStyle = w.col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#140a2e'; ctx.stroke();
        ctx.save(); ctx.rotate((a0 + a1) / 2); ctx.textAlign = 'right'; ctx.fillStyle = '#140a2e';
        ctx.font = '22px sans-serif'; ctx.fillText(w.icon, 132, -2);
        ctx.font = 'bold 13px monospace'; ctx.fillText(w.label, 132, 16); ctx.restore();
      });
      ctx.restore();
      const t = Date.now() / 200;
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 154, Math.sin(a) * 154, 4, 0, 7); ctx.fillStyle = (i + Math.floor(t)) % 2 ? '#ffd23f' : '#fff6c8'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fillStyle = '#140a2e'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 24px serif'; ctx.textAlign = 'center'; ctx.fillText('Σ', 0, 8);
      ctx.restore();
    }
    let raf = 0; const loop = () => { draw(); raf = requestAnimationFrame(loop); }; loop(); cleanups.push(() => cancelAnimationFrame(raf));
    const spinBtn = h('button', { class: 'btn big gold', onclick: spin }, '🎡 ¡GIRAR!');
    const qBox = h('div', { class: 'wh-q' });
    const shop = h('div', { class: 'wh-shop' });
    function refresh() {
      const w = St.wheelState(), n = St.spinsLeft();
      status.innerHTML = ''; status.appendChild(h('span', { html: n ? `Giros disponibles: <b>${n}</b>${w.free ? ' (incluye el gratis de hoy)' : ''}` : 'Sin giros ahora. ¡Responde una pregunta o gana batallas!' }));
      spinBtn.disabled = spinning || !n;
      qBox.innerHTML = '';
      if (w.qLeft > 0) qBox.appendChild(h('button', { class: 'btn', onclick: askQ }, `🧠 Responde y gana 1 giro (${w.qLeft} hoy)`));
      else qBox.appendChild(h('small', { class: 'hint', text: 'Hoy ya usaste tus 3 preguntas de giro. ¡Vuelve mañana!' }));
      const p = St.profile(); shop.innerHTML = '';
      shop.appendChild(h('h3', { class: 'h3', text: 'Canjear sigmas  Σ ' + (p.sigma || 0) }));
      St.EXCHANGE.forEach((e) => shop.appendChild(h('button', { class: 'wh-item', disabled: (p.sigma || 0) < e.cost, onclick: () => {
        const r = St.exchange(e.id); if (!r.ok) { toast(r.err); return; } sfx('buy');
        toast(`¡Canjeaste ${esc(e.name)}!` + (r.chest ? (r.chest.item ? ' Te tocó: ' + esc(r.chest.item.name) : ' +' + r.chest.coins + ' monedas') : ''), 'ach'); refresh(); refreshCoins();
      } }, h('span', { class: 'wi-ico', text: e.icon }), h('span', { class: 'wi-n', text: e.name }), h('b', { text: e.cost + ' Σ' }))));
    }
    function askQ() {
      let q; try { q = root.DuiXQ.generateAny(2); } catch (e) { return; }
      const body = h('div', { class: 'wh-qb' }, h('p', { class: 'wh-qt', text: q.text }));
      let closeM;
      const fb = h('p', { class: 'hint' });
      let done = false;
      q.options.forEach((o, i) => body.appendChild(h('button', { class: 'btn opt', onclick: (ev) => {
        if (done) return; done = true; const ok = i === q.correct; St.wheelQuestionDone();
        ev.target.classList.add(ok ? 'good' : 'bad'); if (ok) { St.grantSpin(1); sfx('win'); fb.textContent = '¡Correcto! +1 giro 🎡'; } else { sfx('lose'); fb.textContent = 'Casi. Era: ' + q.options[q.correct] + '. ' + (q.explain || ''); }
      } }, o)));
      body.appendChild(fb);
      closeM = modal({ title: 'Pregunta relámpago', body, cls: 'wh-modal', buttons: [{ label: 'Listo', onClick: refresh }] });
    }
    function spin() {
      if (spinning || !St.useSpin()) return; spinning = true; spinBtn.disabled = true; A.unlock(); sfx('select');
      const idx = St.rollWheel(); const target = 360 * 6 + (360 - idx * SEG); const start = rot % 360, t0 = performance.now(), dur = 4200; const from = rot;
      const end = from + (target - start) + 0; let lastTick = -1;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); rot = from + (end - from) * e;
        const seg = Math.floor(rot / SEG); if (seg !== lastTick) { lastTick = seg; sfx('click'); }
        if (k < 1) requestAnimationFrame(step); else finish(idx);
      };
      requestAnimationFrame(step);
    }
    function finish(idx) {
      const r = St.applyPrize(idx); spinning = false; sfx('win'); refreshCoins();
      const pz = r.prize; let extra = '';
      if (r.chest) extra = r.chest.item ? ` Conseguiste: ${esc(r.chest.item.name)}` : ` +${r.chest.coins} monedas`;
      modal({ title: '¡Premio!', body: h('div', { class: 'wh-prize' }, h('div', { class: 'wp-ico', text: pz.icon }), h('b', { text: pz.label }), h('small', { html: extra })), buttons: [{ label: '¡Genial!', cls: 'gold', onClick: refresh }] });
      refresh();
    }
    sc.appendChild(h('div', { class: 'wheelscr' },
      h('h1', { class: 'h1', text: '🎡 Ruleta de la Fortuna' }), status,
      h('div', { class: 'wh-stage' }, h('div', { class: 'wh-pointer', text: '▼' }), cv), spinBtn, qBox, shop,
      h('button', { class: 'btn ghost', onclick: () => { sfx('back'); go('hub'); } }, 'Volver al mapa')));
    refresh();
  };

  SCREENS.goals = (_, sc) => {
    const p = St.profile(), daily = St.ensureDaily(), stats = St.stats();
    const bar = (v, g) => h('div', { class: 'pbar' }, h('i', { style: 'width:' + Math.min(100, Math.round(v / g * 100)) + '%' }));
    const miss = h('div', { class: 'list' }, daily.ids.map((id) => { const m = D.MISSIONS.find((x) => x.id === id), v = Math.min(m.goal, daily.prog[m.stat] || 0), done = !!daily.done[id]; return h('div', { class: 'row-card' + (done ? ' done' : '') }, h('div', { class: 'rc-main' }, h('b', { text: m.name }), bar(v, m.goal), h('small', { text: done ? '¡Completada!' : `${v}/${m.goal}` })), h('div', { class: 'rc-rw' }, img('coin', 2), h('b', { text: '+' + m.reward }))); }));
    const done = D.ACH.filter((a) => p.achDone[a.id]).length;
    const ach = h('div', { class: 'list' }, D.ACH.slice().sort((a, b) => (!!p.achDone[b.id] - !!p.achDone[a.id]) || 0).map((a) => { const v = Math.min(a.goal, a.prog(stats)), ok = !!p.achDone[a.id]; const it = a.item && D.ITEM_BY_ID[a.item]; return h('div', { class: 'row-card' + (ok ? ' done' : '') }, h('div', { class: 'rc-ic', text: ok ? '🏆' : '🔒' }), h('div', { class: 'rc-main' }, h('b', { text: a.name }), h('small', { text: a.desc }), bar(v, a.goal), h('small', { text: `${v}/${a.goal}` })), h('div', { class: 'rc-rw' }, img('coin', 2), h('b', { text: '+' + a.coins }), it ? h('small', { text: it.name }) : null)); }));
    sc.appendChild(h('div', { class: 'goals' }, topbar(), h('h1', { class: 'h1', text: 'Misiones de hoy' }), h('p', { class: 'hint', text: 'Se renuevan cada día.' }), miss, h('h1', { class: 'h1', text: `Logros (${done}/${D.ACH.length})` }), ach));
  };

  /* ============================================================
   * CUADERNO (errores y repaso por tema)
   * ============================================================ */
  SCREENS.notebook = (_, sc) => {
    const p = St.profile();
    const wrap = h('div', { class: 'notebook' }, topbar(), h('h1', { class: 'h1', text: 'Cuaderno de errores' }));
    if (!p.mistakes.length) wrap.appendChild(h('p', { class: 'hint', text: 'Aquí aparecerán las preguntas que falles, con su explicación, para que las repases. ¡Todavía no tienes ninguna!' }));
    else { wrap.appendChild(h('p', { class: 'hint', text: 'Tus últimos errores, con la respuesta correcta y por qué.' })); p.mistakes.slice(0, 20).forEach((m) => { const t = (V.find((x) => x.topic === m.topic) || {}).tema; wrap.appendChild(h('div', null, t ? h('small', { class: 'mt', text: t }) : null, mistakeCard(m))); }); }
    wrap.appendChild(h('h1', { class: 'h1', text: 'Repaso por tema' }));
    V.filter((v) => !v.boss).forEach((v) => { const det = h('details', { class: 'acc' }, h('summary', null, villainEl(v, 34), h('b', { text: v.tema })), repasoList(v.topic)); wrap.appendChild(det); });
    sc.appendChild(wrap);
  };

  /* ============================================================
   * AJUSTES
   * ============================================================ */
  SCREENS.settings = (_, sc) => {
    const s = St.settings(), p = St.profile();
    const tog = (key, label, desc) => h('label', { class: 'set' }, h('div', null, h('b', { text: label }), desc ? h('small', { text: desc }) : null), h('input', { type: 'checkbox', checked: s[key] ? true : null, onchange: (e) => { St.setSetting(key, e.target.checked); if (key === 'music') { if (e.target.checked) { A.unlock(); A.play(MUSIC.settings); } } sfx('click'); } }), h('span', { class: 'sw2' }));
    const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s.volume), 'aria-label': 'Volumen', oninput: (e) => { St.setSetting('volume', +e.target.value); }, onchange: () => sfx('coin') });
    const styleNow = () => (!s.music ? 'off' : s.musicStyle === 'calma' ? 'calma' : 'arcade');
    const musicPick = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Estilo de música' });
    const renderMusicPick = () => { musicPick.innerHTML = ''; [['arcade', 'Arcade'], ['calma', 'Calmada'], ['off', 'Sin música']].forEach(([id, label]) => musicPick.appendChild(h('button', { class: 'segb' + (styleNow() === id ? ' on' : ''), role: 'radio', 'aria-checked': styleNow() === id ? 'true' : 'false', onclick: () => { A.unlock(); if (id === 'off') St.setSetting('music', false); else { St.setSetting('musicStyle', id); St.setSetting('music', true); A.play(MUSIC.settings); } sfx('click'); renderMusicPick(); } }, label))); };
    renderMusicPick();
    const code = h('textarea', { class: 'input code', rows: '3', placeholder: 'Pega aquí un código de guardado…', 'aria-label': 'Código de guardado' });
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = root.matchMedia && root.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const inst = h('div', { class: 'set-block' }, h('h3', { text: 'Instalar como app' }),
      standalone ? h('p', { class: 'hint', text: '¡Ya estás jugando como app!' }) : root.__installPrompt ? h('button', { class: 'btn', onclick: async () => { const ev = root.__installPrompt; ev.prompt(); await ev.userChoice; root.__installPrompt = null; go('settings'); } }, 'Instalar DuiX') :
        h('p', { class: 'hint', text: isIOS ? 'En iPhone/iPad: toca el botón Compartir y elige “Añadir a pantalla de inicio”.' : 'En el menú del navegador (⋮ o el ícono de instalar) elige “Instalar app” o “Añadir a pantalla de inicio”. En Mac/Windows aparece un ícono de instalar en la barra de direcciones.' }));
    sc.appendChild(h('div', { class: 'settings' }, topbar(), h('h1', { class: 'h1', text: 'Ajustes' }),
      h('div', { class: 'set-block' }, tog('sfx', 'Efectos de sonido'), h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Música' }), h('small', { text: 'Elige el estilo que no te distraiga' })), musicPick), h('div', { class: 'set' }, h('div', null, h('b', { text: 'Volumen' })), vol)),
      h('div', { class: 'set-block' }, tog('crt', 'Pantalla retro (CRT)', 'Líneas de barrido y bordes suaves'), tog('reduceMotion', 'Reducir movimiento', 'Menos animaciones'), tog('big', 'Texto grande')),
      h('div', { class: 'set-block' }, h('h3', { text: 'Créditos y puntaje' }), h('button', { class: 'btn', onclick: () => { sfx('select'); go('credits'); } }, '🏆 Ver créditos y puntaje final (' + fmtPts(St.score().total) + '/100)')),
      inst,
      h('div', { class: 'set-block' }, h('h3', { text: 'Progreso de ' + p.name }),
        h('p', { class: 'hint', text: 'Tu progreso se guarda en este dispositivo. Para llevarlo a otro, copia el código y pégalo allá.' }),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { const c = St.exportCode(); code.value = c; if (navigator.clipboard) navigator.clipboard.writeText(c).then(() => toast('Código copiado.', ''), () => toast('Copia el código del cuadro.', '')); else toast('Copia el código del cuadro.', ''); code.select(); } }, 'Copiar mi código'),
          h('button', { class: 'btn small ghost', onclick: () => { const r = St.importCode(code.value); if (r.ok) { toast('¡Héroe cargado!', ''); go('hub'); } else toast(r.err, 'warn'); } }, 'Cargar código')), code,
        h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: () => { St.logout(); go('profiles'); } }, 'Cambiar de héroe'),
          h('button', { class: 'btn small danger', onclick: () => modal({ title: '¿Borrar todo?', body: h('p', { text: 'Se borrarán TODOS los héroes y su progreso en este dispositivo.' }), buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Borrar todo', cls: 'danger', onClick: () => { St.resetAll(); go('title'); } }] }) }, 'Borrar todo'))),
      h('div', { class: 'about' }, h('b', { text: 'DuiX' }), h('p', { text: 'Juego de Cálculo Diferencial hecho por ' + D.AUTHOR.full + ', estudiante de Estadística.' }), h('small', { text: 'Temas: intervalos, fracciones, factorización, polinomios, plano cartesiano, desigualdades, funciones, desplazamientos, tabulaciones, potenciación, composición, radicales, logaritmos y trigonometría.' }))));
  };


  /* ============================================================
   * CRÉDITOS Y PUNTAJE FINAL (rúbrica: nombre del autor + puntaje total)
   * ============================================================ */
  const fmtPts = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  SCREENS.credits = (P, sc) => {
    const p = St.profile(), A0 = D.AUTHOR, sco = St.score();
    const pct = sco.total / sco.max;
    const grade = pct >= 0.9 ? '¡Héroe legendario!' : pct >= 0.6 ? '¡Gran defensor de la ciudad!' : pct >= 0.3 ? 'Vas por buen camino' : 'Tu aventura apenas comienza';
    const rows = sco.rows.map((r) => h('tr', { class: r.pts >= r.max - 0.01 ? 'full' : r.pts > 0 ? 'part' : '' },
      h('td', { class: 'cr-n', text: r.boss ? '👑 ' + r.name : r.name }), h('td', { class: 'cr-t', text: r.tema }),
      h('td', { class: 'cr-p' }, h('b', { text: fmtPts(r.pts) }), h('small', { text: ' / ' + r.max }))));
    sc.appendChild(h('div', { class: 'credits' }, topbar(),
      h('h1', { class: 'h1', text: P && P.final ? '¡Misión cumplida!' : 'Créditos y puntaje' }),
      h('div', { class: 'cr-score' }, h('small', { text: 'PUNTAJE FINAL DE ' + p.name.toUpperCase() }), h('div', { class: 'cr-big' }, h('b', { text: fmtPts(sco.total) }), h('span', { text: ' / ' + sco.max })), h('p', { text: grade }),
        h('div', { class: 'cr-bar' }, h('i', { style: `width:${Math.round(pct * 100)}%` }))),
      h('div', { class: 'cr-card' }, h('h3', { text: 'Créditos' }),
        h('p', { class: 'cr-au' }, h('span', { text: 'Juego creado por' }), h('b', { text: A0.full }), h('span', { text: `Estudiante de ${A0.career}` })),
        h('p', { class: 'cr-sm', text: `Proyecto de ${A0.course} · Basado en ${A0.book} · ${A0.year}` })),
      h('div', { class: 'cr-card' }, h('h3', { text: 'Cómo se calcula el puntaje (máx. 100)' }),
        h('ul', { class: 'cr-rules' },
          h('li', { text: '15 tableros de tema × 6 puntos = 90 puntos.' }),
          h('li', { text: 'El jefe final El Indeterminado vale 10 puntos → total exacto: 100.' }),
          h('li', { text: 'Cada tablero tiene 3 dificultades: Fácil (1 pt), Medio (2 pts) y Difícil (3 pts). En el jefe: 2, 3 y 5 pts.' }),
          h('li', { text: 'Puntos de una dificultad = su valor × (estrellas ÷ 3). Con 3 estrellas se gana completo.' }),
          h('li', { text: 'Duinity (modo sin fin) es un extra: no suma al puntaje.' }))),
      h('div', { class: 'cr-card' }, h('h3', { text: 'Puntos por tablero' }), h('table', { class: 'cr-tab' }, h('tbody', null, rows)),
        h('div', { class: 'cr-tot' }, h('span', { text: 'TOTAL' }), h('b', { text: fmtPts(sco.total) + ' / ' + sco.max }))),
      h('div', { class: 'rbtns' }, h('button', { class: 'btn big', onclick: () => { sfx('back'); go('hub', { scrollTo: true }); } }, 'Volver al mapa'))));
  };

  /* ---------- arranque ---------- */
  function boot() {
    applySettings();
    const unlockOnce = () => { A.unlock(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));
    document.addEventListener('visibilitychange', () => A.suspend(document.hidden));
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
    try { const m = /[?&]sala=([A-Za-z0-9]{3,8})/.exec(location.search); if (m) root.__pendingRoom = m[1].toUpperCase(); } catch (e) { /* ok */ }
    go('title');
  }

  const kit = { emoteWheel, ownedEmotes, playEmoteOn, h, add, esc, img, sfx, modal, toast, topbar, avatarEl, headThumb, liveHero, villainEl, go, later, refreshCoins, announceAch, plural, $, $$, onLeave: (f) => cleanups.push(f), setAmbient, SCREENS, MUSIC };
  root.DuiXUI = { boot, go, toast, kit, _cur: () => cur, _battle: () => battle, SCREENS };
})(typeof window !== 'undefined' ? window : globalThis);
