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
  let cur = { name: null, params: null }, cleanups = [], liveList = [], liveTimer = 0, battle = null;

  /* ---------- héroe animado ---------- */
  function liveHero(cv, getLook, o) {
    o = o || {}; const sc = o.scale || 4, w = 40, hh = 46;
    cv.width = w * sc; cv.height = hh * sc; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const entry = { draw(t) { const look = getLook(); const fr = Math.floor(t / 150) % 4; ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(S.heroCanvas(look, o.pose ? o.pose() : 'idle', fr), 0, Math.round(Math.sin(t / 220) * sc * 0.6), cv.width, cv.height); } };
    entry.draw(0); liveList.push(entry);
    if (!liveTimer && !St.settings().reduceMotion) liveTimer = setInterval(() => { const t = Date.now(); liveList.forEach((e) => e.draw(t)); }, 140);
    return cv;
  }
  function stopLive() { liveList = []; if (liveTimer) { clearInterval(liveTimer); liveTimer = 0; } }
  function avatarEl(look, size) {
    const cv = h('canvas', { class: 'avatar px', width: 36, height: 34 }); cv.style.width = cv.style.height = (size || 44) + 'px';
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(S.heroCanvas(look, 'idle', 0), 2, 0, 36, 34, 0, 0, 36, 34); return cv;
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
    { id: 'hub', label: 'Ciudad', icon: 'city' },
    { id: 'wardrobe', label: 'Vestidor', icon: 'shirt' },
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
      h('div', { class: 'top-coins', 'aria-label': 'Monedas' }, img('coin', 3), h('b', { class: 'coinval', text: String(p.coins) })));
  }
  function refreshCoins() { const p = St.profile(); if (!p) return; $$('.coinval').forEach((e) => { e.textContent = String(p.coins); }); }
  St.on((ev) => { if (ev === 'coins') refreshCoins(); if (ev === 'settings') applySettings(); });
  function applySettings() {
    const s = St.settings(); document.body.classList.toggle('crt-on', !!s.crt); document.body.classList.toggle('reduce', !!s.reduceMotion); document.body.classList.toggle('big', !!s.big);
    A.configure({ sfx: s.sfx, music: s.music, volume: s.volume });
  }

  /* ---------- navegación ---------- */
  const SCREENS = {}, NAVSCREENS = ['hub', 'wardrobe', 'goals', 'notebook', 'settings'];
  const MUSIC = { title: 'menu', profiles: 'menu', creator: 'menu', hub: 'map', district: 'map', wardrobe: 'menu', goals: 'menu', notebook: 'menu', settings: 'menu', results: 'menu' };
  function teardown() { stopLive(); cleanups.forEach((f) => { try { f(); } catch (e) { /* ok */ } }); cleanups = []; if (battle) { battle.destroy(); battle = null; } $('#modal').hidden = true; $('#modal').innerHTML = ''; $('#toasts').innerHTML = ''; }
  function go(name, params) {
    teardown(); cur = { name, params };
    const p = St.profile();
    if (!p && !['title', 'creator', 'profiles'].includes(name)) name = cur.name = 'title';
    if (name === 'hub' || NAVSCREENS.includes(name)) { if (!p) return go('title'); }
    const sc = screenEl(); sc.innerHTML = ''; sc.scrollTop = 0; sc.className = 'screen s-' + name;
    app().dataset.screen = name;
    if (NAVSCREENS.includes(name)) buildNav(name); else $('#nav').hidden = true;
    if (MUSIC[name]) A.play(MUSIC[name]);
    SCREENS[name](params || {}, sc);
    sc.classList.remove('enter'); void sc.offsetWidth; sc.classList.add('enter');
  }
  const later = (fn, ms) => { const t = setTimeout(fn, ms); cleanups.push(() => clearTimeout(t)); return t; };

  /* ============================================================
   * TÍTULO
   * ============================================================ */
  SCREENS.title = (_, sc) => {
    const p = St.profile() || St.list()[0];
    const look = p ? p.look : { skin: 1, hairStyle: 'corto', hairColor: 0, suit: 'suit-rojo', mask: 'mask-antifaz', cape: 'cape-corta', emblem: 'emb-star', weapon: 'wp-rayo' };
    const bg = h('canvas', { class: 'title-bg px' }); const bgc = S.cityBg(Vby('polinomios'), 90, 160); bg.width = 90; bg.height = 160; bg.getContext('2d').drawImage(bgc, 0, 0);
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
      h('div', { class: 'credit', text: 'Hecho por Deiwy · Proyecto de Cálculo Diferencial' }));
    sc.appendChild(el);
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
  SCREENS.creator = (_, sc) => {
    const first = !St.list().length;
    const look = { skin: 1, hairStyle: 'corto', hairColor: 0, suit: 'suit-rojo', mask: 'mask-antifaz', cape: 'cape-corta', emblem: 'emb-star', weapon: 'wp-rayo', amulet: 'am-none' };
    const cv = h('canvas', { class: 'px cprev' }); liveHero(cv, () => look, { scale: 6 });
    const nameIn = h('input', { class: 'input', maxlength: '12', placeholder: 'Nombre del héroe', autocomplete: 'off', 'aria-label': 'Nombre del héroe' });
    const groups = h('div', { class: 'cgroups' });
    const refs = [];
    function group(title, opts, key, render) {
      const row = h('div', { class: 'copts' });
      const upd = () => $$('button', row).forEach((b, i) => b.classList.toggle('on', opts[i].v === look[key]));
      opts.forEach((o) => row.appendChild(h('button', { class: 'copt', 'aria-label': o.label, title: o.label, onclick: () => { look[key] = o.v; sfx('click'); upd(); } }, render(o))));
      groups.appendChild(h('div', { class: 'cgroup' }, h('h3', { text: title }), row)); refs.push(upd); upd();
    }
    group('Piel', D.SKINS.map((c, i) => ({ v: i, label: 'Tono ' + (i + 1), c })), 'skin', (o) => h('i', { class: 'sw', style: 'background:' + o.c }));
    group('Peinado', D.HAIR_STYLES.map((s) => ({ v: s.id, label: s.name })), 'hairStyle', (o) => h('span', { text: o.label }));
    group('Color de pelo', D.HAIR_COLORS.map((c, i) => ({ v: i, label: 'Color ' + (i + 1), c })), 'hairColor', (o) => h('i', { class: 'sw', style: 'background:' + o.c }));
    group('Traje', ['suit-rojo', 'suit-azul'].map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name, c: D.ITEM_BY_ID[id].main })), 'suit', (o) => h('i', { class: 'sw', style: 'background:' + o.c }));
    group('Máscara', ['mask-antifaz', 'mask-none'].map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name })), 'mask', (o) => h('span', { text: o.label }));
    group('Capa', ['cape-corta', 'cape-none'].map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name })), 'cape', (o) => h('span', { text: o.label }));
    group('Emblema', ['emb-star', 'emb-bolt'].map((id) => ({ v: id, label: D.ITEM_BY_ID[id].name })), 'emblem', (o) => h('span', { text: o.label }));
    const rand = () => { const r = (a) => a[Math.floor(Math.random() * a.length)]; look.skin = Math.floor(Math.random() * 6); look.hairStyle = r(D.HAIR_STYLES).id; look.hairColor = Math.floor(Math.random() * 8); look.suit = r(['suit-rojo', 'suit-azul']); look.mask = r(['mask-antifaz', 'mask-none']); look.cape = r(['cape-corta', 'cape-none']); look.emblem = r(['emb-star', 'emb-bolt']); refs.forEach((f) => f()); sfx('select'); };
    const ready = () => {
      A.unlock(); const p = St.newProfile(nameIn.value || 'Héroe', look); if (!p) return toast('Ya tienes 4 héroes. Borra uno para crear otro.', 'warn');
      sfx('levelup'); go('hub', { welcome: true });
    };
    sc.appendChild(h('div', { class: 'creator' },
      h('h1', { class: 'h1', text: first ? 'Crea tu héroe' : 'Nuevo héroe' }),
      h('div', { class: 'cstage' }, cv, h('button', { class: 'btn small ghost dice', onclick: rand }, '🎲 Sorpréndeme')),
      nameIn, groups,
      h('p', { class: 'hint', text: 'Más trajes, máscaras, capas y armas se desbloquean jugando: encuéntralos en el Vestidor.' }),
      h('div', { class: 'row' }, !first || St.list().length ? h('button', { class: 'btn ghost', onclick: () => go(St.list().length ? 'profiles' : 'title') }, 'Atrás') : null, h('button', { class: 'btn big', onclick: ready }, '¡Listo para luchar!'))));
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') ready(); });
  };

  /* ============================================================
   * CIUDAD (mapa)
   * ============================================================ */
  SCREENS.hub = (params, sc) => {
    const p = St.profile(), stats = St.stats();
    const daily = St.ensureDaily(); const dn = daily.ids.filter((id) => daily.done[id]).length;
    // siguiente distrito disponible
    const next = V.find((v) => St.unlocked(v) && !St.isCleared(v.id) && !v.endless) || (St.unlocked(Vby('duinity')) ? Vby('duinity') : V[0]);
    const map = h('div', { class: 'map' });
    V.forEach((v, i) => {
      const unl = St.unlocked(v), pr = St.prog(v.id), cleared = pr.tier >= 1, secret = v.boss && !unl;
      const side = i % 2 ? 'r' : 'l';
      const stars = h('div', { class: 'stars', 'aria-label': pr.stars + ' de 3 estrellas' }, [0, 1, 2].map((k) => img(k < pr.stars ? 'star' : 'starEmpty', 2)));
      const card = h('button', { class: `node ${side}${unl ? '' : ' locked'}${cleared ? ' cleared' : ''}${v.boss ? ' boss' : ''}${v === next && unl ? ' next' : ''}`, 'aria-label': `${secret ? 'Distrito secreto' : v.district}${unl ? '' : ', bloqueado'}`,
        onclick: () => { if (!unl) { sfx('deny'); toast(secret ? 'Vence a todos los villanos anteriores para descubrir este distrito.' : 'Derrota primero al villano anterior.', 'warn'); return; } sfx('select'); go('district', { id: v.id }); } },
        h('div', { class: 'nsprite' }, villainEl(v, v.boss ? 92 : 78, !unl), !unl ? img('lock', 3, null, 'nlock') : null),
        h('div', { class: 'ntext' },
          h('b', { class: 'nname', text: secret ? '???' : v.district }),
          h('span', { class: 'nvil', text: secret ? 'Jefe misterioso' : v.name }),
          unl && !v.endless ? stars : null,
          v.endless && unl ? h('span', { class: 'nbest', text: 'Récord: ' + p.stats.duinityBest + ' aciertos' }) : null,
          v === next && unl && !cleared ? h('span', { class: 'new', text: '¡Nuevo!' }) : null));
      map.appendChild(h('div', { class: 'mrow ' + side }, card, h('div', { class: 'mpin' + (cleared ? ' done' : unl ? ' open' : '') }, h('span', { text: String(v.n) }))));
    });
    sc.appendChild(h('div', { class: 'hubwrap' }, topbar(),
      h('div', { class: 'cta' }, h('div', { class: 'cta-l' }, h('b', { text: 'Ciudad Límite' }), h('small', { text: `${stats.districts}/14 villanos · ${stats.stars}/42 ★` })),
        h('button', { class: 'chip', onclick: () => { sfx('click'); go('goals'); } }, '📋 Misiones ', h('b', { text: dn + '/3' }))),
      h('button', { class: 'btn big playnext', onclick: () => { sfx('select'); go('district', { id: next.id }); } }, img('play', 3), h('span', { text: 'Continuar: ' + (next.boss && !St.unlocked(next) ? 'Siguiente' : next.name) })),
      map));
    if (params.welcome) later(() => toast(`¡Bienvenido, <b>${esc(p.name)}</b>! Ciudad Límite te necesita.`, '', 3800), 400);
    if (params.scrollTo) later(() => { const n = $('.node.next', sc); if (n) n.scrollIntoView({ block: 'center' }); }, 60);
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
    const repaso = h('div', { class: 'repaso', hidden: true }, h('h3', { text: 'Repaso rápido: ' + v.tema }), h('ul', null, (D.REPASO[v.topic] || []).map((t) => h('li', { text: t }))));
    const tiers = h('div', { class: 'tiers' });
    const NAMES = ['Fácil', 'Normal', 'Difícil'], MUL = ['×1', '×1,5', '×2'];
    function renderTiers() {
      tiers.innerHTML = '';
      [1, 2, 3].forEach((t) => tiers.appendChild(h('button', { class: 'tier' + (t === tier ? ' on' : '') + (tierUnlocked(t) ? '' : ' off'), disabled: !tierUnlocked(t), 'aria-pressed': t === tier ? 'true' : 'false', onclick: () => { tier = t; sfx('click'); renderTiers(); } }, h('b', { text: NAMES[t - 1] }), h('small', { text: tierUnlocked(t) ? 'Premios ' + MUL[t - 1] : 'Bloqueado' }), !tierUnlocked(t) ? img('lock', 2) : null)));
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
      v.endless ? null : h('h3', { class: 'h3', text: 'Dificultad' }), v.endless ? null : tiers,
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
    battle = B.start({
      container: holder, villain: v, tier: params.tier, look: p.look, perks: St.perks(),
      onEnd: (res) => finishBattle(v, params.tier, res),
      onQuit: () => { battle = null; go('district', { id: v.id, tier: params.tier }); },
    });
  };
  function finishBattle(v, tier, res) {
    const mul = [1, 1.5, 2][tier - 1];
    let coins = Math.round(res.coins * mul), xp = res.correct * 10 + Math.round(res.answered * 2);
    if (res.win) { coins += Math.round((40 + v.n * 4) * mul) + (res.stars === 3 ? 30 : 0); xp += Math.round(70 * mul); }
    if (res.endless) { coins += Math.min(200, res.correct * 3); }
    const before = St.profile().level;
    St.addCoins(coins);
    const ups = St.addXp(xp);
    const rec = St.recordBattle(v, res);
    const ach = St.checkAch();
    let chest = null; if (res.win && res.stars === 3 && Math.random() < 0.6) chest = St.openChest(true);
    St.save();
    battle = null;
    go('results', { id: v.id, tier, res, coins, xp, ups, ach, chest, first: rec && rec.firstClear, before });
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
      h('div', { class: 'rw' }, img('bolt', 3), h('b', { text: '+' + P.xp }), h('small', { text: 'experiencia' })),
      h('div', { class: 'rw' }, img('star', 3), h('b', { text: acc + '%' }), h('small', { text: 'precisión' })),
      h('div', { class: 'rw' }, img('heart', 3), h('b', { text: String(res.bestStreak) }), h('small', { text: 'mejor racha' })));
    const mist = res.mistakes.length ? h('div', { class: 'mist' }, h('h3', { class: 'h3', text: `Para repasar (${res.mistakes.length})` }), res.mistakes.map(mistakeCard)) : h('p', { class: 'hint', text: res.answered ? '¡Ni un error para repasar!' : '' });
    const nextV = V[V.indexOf(v) + 1];
    const canNext = res.win && nextV && St.unlocked(nextV);
    sc.appendChild(h('div', { class: 'results ' + (win ? 'win' : 'lose') },
      h('div', { class: 'rhead' }, h('div', { class: 'rvil', style: `--glow:${v.glow}` }, villainEl(v, 96)), h('div', { class: 'rbubble' }, h('p', { text: '“' + (res.win ? v.defeat : v.intro.split('.')[0] + '…') + '”' }))),
      h('h1', { class: 'h1 rtitle', text: title }),
      res.endless ? null : stars,
      rewards,
      P.ups && P.ups.length ? h('div', { class: 'levelup' }, h('b', { text: '¡Subiste al nivel ' + P.ups[P.ups.length - 1].level + '!' }), h('small', { text: P.ups.map((u) => `Nivel ${u.level}: +${u.coins} monedas${u.item ? ' · ' + D.ITEM_BY_ID[u.item].name : ''}`).join(' · ') })) : null,
      P.chest && P.chest.ok ? h('div', { class: 'levelup chest' }, img('chest', 3), h('b', { text: '¡Cofre de botín!' }), h('small', { text: P.chest.item ? `Conseguiste: ${P.chest.item.name} (${D.RARITY[P.chest.item.rarity].name})` : `+${P.chest.coins} monedas extra` })) : null,
      mist,
      h('div', { class: 'rbtns' },
        canNext ? h('button', { class: 'btn big', onclick: () => { sfx('select'); go('district', { id: nextV.id }); } }, 'Siguiente distrito') : null,
        h('button', { class: 'btn' + (canNext ? '' : ' big'), onclick: () => { sfx('select'); go('district', { id: v.id, tier: P.tier }); } }, res.win ? 'Volver a luchar' : 'Reintentar'),
        h('button', { class: 'btn ghost', onclick: () => { sfx('back'); go('hub', { scrollTo: true }); } }, 'Volver a la ciudad'))));
    // sonidos y avisos
    if (res.win) { A.play('menu'); later(() => sfx('win'), 100); [0, 1, 2].forEach((k) => { if (k < res.stars) later(() => sfx('star', k), 500 + k * 450); }); } else later(() => sfx('lose'), 100);
    if (P.ups && P.ups.length) later(() => sfx('levelup'), 1900);
    announceAch(P.ach);
    if (P.first) later(() => toast(`¡Nuevo distrito desbloqueado!`, 'ach'), 2200);
  };
  function mistakeCard(m) {
    const q = h('div', { class: 'mcard' }, h('div', { class: 'mq', text: m.text }));
    if (m.table) q.appendChild(h('div', { class: 'mtable', html: '<table><tr>' + m.table.head.map((c, i) => (i ? '<td>' : '<th>') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>' + m.table.rows.map((r) => '<tr>' + r.map((c, i) => (i ? '<td>' : '<th>') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>' }));
    q.appendChild(h('div', { class: 'mans' }, h('span', { class: 'ok', text: '✔ ' + m.options[m.correct] })));
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
    if (it.cat === 'suit' || it.cat === 'cape') { cv.width = 80; cv.height = 92; ctx.drawImage(S.heroCanvas(L, 'idle', 0), 0, 0, 80, 92); }
    else if (it.cat === 'mask') { cv.width = 84; cv.height = 78; ctx.drawImage(S.heroCanvas(L, 'idle', 0), 4, 0, 28, 26, 0, 0, 84, 78); }
    else if (it.cat === 'emblem') { cv.width = 84; cv.height = 84; const suit = D.ITEM_BY_ID[look.suit]; ctx.fillStyle = suit.main; ctx.fillRect(0, 0, 84, 84); const rows = S.EMB[it.shape]; const sc = Math.floor(60 / Math.max(rows[0].length, rows.length)), ox = Math.round((84 - rows[0].length * sc) / 2), oy = Math.round((84 - rows.length * sc) / 2); ctx.fillStyle = suit.accent === '#ffffff' ? '#fff' : S.lighten(suit.accent, 0.25); rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') ctx.fillRect(ox + i * sc, oy + j * sc, sc, sc); }); }
    else if (it.cat === 'weapon') {
      cv.width = 84; cv.height = 84; ctx.fillStyle = '#1a1033'; ctx.fillRect(0, 0, 84, 84); ctx.translate(42, 42); ctx.rotate(-0.6);
      const c1 = it.c1, c2 = it.c2, fx = it.fx;
      if (fx === 'bolt' || fx === 'wave') { ctx.fillStyle = c2; ctx.fillRect(-7, -26, 14, 52); ctx.fillStyle = c1; ctx.fillRect(-4, -30, 8, 56); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -24, 4, 30); }
      else if (fx === 'orb') { ctx.fillStyle = c2; ctx.fillRect(-18, -12, 36, 24); ctx.fillRect(-12, -18, 24, 36); ctx.fillStyle = c1; ctx.fillRect(-12, -12, 24, 24); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -6, 12, 12); }
      else if (fx === 'fire') { ctx.fillStyle = c2; ctx.fillRect(-16, -16, 32, 32); ctx.fillStyle = c1; ctx.fillRect(-11, -24, 22, 40); ctx.fillStyle = '#fff2a8'; ctx.fillRect(-5, -10, 10, 16); }
      else if (fx === 'ice') { ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(16, 0); ctx.lineTo(0, 28); ctx.lineTo(-16, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(8, 0); ctx.lineTo(0, 16); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill(); }
      else if (fx === 'double') { ctx.fillStyle = c2; ctx.fillRect(-20, -28, 10, 56); ctx.fillRect(10, -28, 10, 56); ctx.fillStyle = c1; ctx.fillRect(-18, -32, 6, 58); ctx.fillRect(12, -32, 6, 58); ctx.fillStyle = '#fff'; ctx.fillRect(-18, -20, 6, 20); ctx.fillRect(12, -20, 6, 20); }
      else { const g = ctx.createLinearGradient(0, -30, 0, 30); ['#ff4d6d', '#ffd23f', '#3ddc97', '#4da3ff', '#c58bff'].forEach((c, i) => g.addColorStop(i / 4, c)); ctx.fillStyle = g; ctx.fillRect(-9, -30, 18, 60); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -24, 4, 30); }
    } else { cv.width = 84; cv.height = 84; ctx.fillStyle = '#1a1033'; ctx.fillRect(0, 0, 84, 84); ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(AMULET_ICON[it.id] || '✨', 42, 46); }
    return cv;
  }
  SCREENS.wardrobe = (params, sc) => {
    const p = St.profile(); let cat = params.cat || 'suit', sel = null;
    const pv = {}; // vista previa (no guardada)
    const stage = h('canvas', { class: 'px wprev' });
    const lookNow = () => Object.assign({}, p.look, pv);
    liveHero(stage, lookNow, { scale: 6, pose: () => (Math.floor(Date.now() / 1600) % 4 === 0 ? 'shoot' : 'idle') });
    const tabs = h('div', { class: 'ctabs', role: 'tablist' });
    const grid = h('div', { class: 'igrid' });
    const bar = h('div', { class: 'ibar' });
    const summary = h('div', { class: 'wsum' });
    function owned(id) { return p.owned.includes(id); }
    function renderTabs() {
      tabs.innerHTML = '';
      D.CATS.forEach((c) => { const n = D.ITEMS.filter((i) => i.cat === c.id).length, o = D.ITEMS.filter((i) => i.cat === c.id && owned(i.id)).length; tabs.appendChild(h('button', { class: 'ctab' + (c.id === cat ? ' on' : ''), role: 'tab', 'aria-selected': c.id === cat ? 'true' : 'false', onclick: () => { cat = c.id; sel = null; sfx('click'); renderAll(); } }, h('span', { text: c.icon }), h('b', { text: c.name }), h('small', { text: `${o}/${n}` }))); });
    }
    function itemCard(it) {
      const eq = p.look[it.cat] === it.id, own = owned(it.id), rar = D.RARITY[it.rarity];
      const lockAch = it.unlock && !own;
      return h('button', { class: `icard r-${it.rarity}${eq ? ' eq' : ''}${own ? '' : ' lock'}${sel === it.id ? ' sel' : ''}`, 'aria-label': `${it.name}, ${rar.name}${eq ? ', puesto' : own ? '' : lockAch ? ', se consigue con un logro' : ', ' + it.price + ' monedas'}`, style: `--rc:${rar.color}`, onclick: () => choose(it) },
        itemPreview(it, lookNow()),
        h('b', { class: 'iname', text: it.name }),
        h('span', { class: 'irar', text: rar.name }),
        eq ? h('span', { class: 'ibadge on', text: 'Puesto' }) : own ? h('span', { class: 'ibadge', text: 'Tuyo' }) : lockAch ? h('span', { class: 'ibadge ach', text: '🏆 Logro' }) : h('span', { class: 'ibadge price' }, img('coin', 2), h('b', { text: String(it.price) })));
    }
    function choose(it) {
      sel = it.id;
      if (owned(it.id)) { St.equip(it.id); delete pv[it.cat]; sfx('select'); }
      else { pv[it.cat] = it.id; sfx('click'); }
      renderAll();
    }
    function renderBar() {
      bar.innerHTML = ''; const it = sel && D.ITEM_BY_ID[sel];
      if (!it) { bar.appendChild(h('p', { class: 'hint', text: 'Toca un objeto para probártelo. Los que ya tienes se equipan al instante.' })); return; }
      const own = owned(it.id), rar = D.RARITY[it.rarity];
      bar.appendChild(h('div', { class: 'binfo' }, h('b', { text: it.name }), h('small', { class: 'brar', style: 'color:' + rar.color, text: rar.name }), it.perk ? h('p', { class: 'perk', text: it.perk }) : null));
      if (own) bar.appendChild(h('span', { class: 'ibadge on big', text: p.look[it.cat] === it.id ? 'Puesto ✓' : 'Tuyo' }));
      else if (it.unlock) bar.appendChild(h('span', { class: 'ibadge ach big', text: '🏆 Se gana con el logro “' + (D.ACH.find((a) => a.id === it.unlock.ach) || {}).name + '”' }));
      else bar.appendChild(h('button', { class: 'btn buy' + (p.coins >= it.price ? '' : ' cant'), onclick: () => {
        const r = St.buy(it.id); if (!r.ok) { sfx('deny'); toast(r.err, 'warn'); return; }
        sfx('buy'); St.equip(it.id); delete pv[it.cat]; toast(`¡Compraste <b>${esc(it.name)}</b> y te lo pusiste!`, ''); announceAch(r.ach); renderAll();
      } }, img('coin', 3), h('span', { text: ` Comprar · ${it.price}` })));
    }
    function renderAll() {
      renderTabs(); grid.innerHTML = '';
      const items = D.ITEMS.filter((i) => i.cat === cat).sort((a, b) => (owned(b.id) - owned(a.id)) || a.price - b.price);
      items.forEach((it) => grid.appendChild(itemCard(it)));
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
    sc.appendChild(h('div', { class: 'wardrobe' }, topbar(), h('div', { class: 'wstage' }, stage, h('div', { class: 'wname', text: p.name })), chest, tabs, grid, bar, summary));
    renderAll();
  };

  /* ============================================================
   * METAS (misiones + logros)
   * ============================================================ */
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
    V.filter((v) => v.n <= 14).forEach((v) => { const det = h('details', { class: 'acc' }, h('summary', null, villainEl(v, 34), h('b', { text: v.tema })), h('ul', null, (D.REPASO[v.topic] || []).map((t) => h('li', { text: t })))); wrap.appendChild(det); });
    sc.appendChild(wrap);
  };

  /* ============================================================
   * AJUSTES
   * ============================================================ */
  SCREENS.settings = (_, sc) => {
    const s = St.settings(), p = St.profile();
    const tog = (key, label, desc) => h('label', { class: 'set' }, h('div', null, h('b', { text: label }), desc ? h('small', { text: desc }) : null), h('input', { type: 'checkbox', checked: s[key] ? true : null, onchange: (e) => { St.setSetting(key, e.target.checked); if (key === 'music') { if (e.target.checked) { A.unlock(); A.play(MUSIC.settings); } } sfx('click'); } }), h('span', { class: 'sw2' }));
    const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s.volume), 'aria-label': 'Volumen', oninput: (e) => { St.setSetting('volume', +e.target.value); }, onchange: () => sfx('coin') });
    const code = h('textarea', { class: 'input code', rows: '3', placeholder: 'Pega aquí un código de guardado…', 'aria-label': 'Código de guardado' });
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = root.matchMedia && root.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const inst = h('div', { class: 'set-block' }, h('h3', { text: 'Instalar como app' }),
      standalone ? h('p', { class: 'hint', text: '¡Ya estás jugando como app!' }) : root.__installPrompt ? h('button', { class: 'btn', onclick: async () => { const ev = root.__installPrompt; ev.prompt(); await ev.userChoice; root.__installPrompt = null; go('settings'); } }, 'Instalar DuiX') :
        h('p', { class: 'hint', text: isIOS ? 'En iPhone/iPad: toca el botón Compartir y elige “Añadir a pantalla de inicio”.' : 'En el menú del navegador (⋮ o el ícono de instalar) elige “Instalar app” o “Añadir a pantalla de inicio”. En Mac/Windows aparece un ícono de instalar en la barra de direcciones.' }));
    sc.appendChild(h('div', { class: 'settings' }, topbar(), h('h1', { class: 'h1', text: 'Ajustes' }),
      h('div', { class: 'set-block' }, tog('sfx', 'Efectos de sonido'), tog('music', 'Música'), h('div', { class: 'set' }, h('div', null, h('b', { text: 'Volumen' })), vol)),
      h('div', { class: 'set-block' }, tog('crt', 'Pantalla retro (CRT)', 'Líneas de barrido y bordes suaves'), tog('reduceMotion', 'Reducir movimiento', 'Menos animaciones'), tog('big', 'Texto grande')),
      inst,
      h('div', { class: 'set-block' }, h('h3', { text: 'Progreso de ' + p.name }),
        h('p', { class: 'hint', text: 'Tu progreso se guarda en este dispositivo. Para llevarlo a otro, copia el código y pégalo allá.' }),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { const c = St.exportCode(); code.value = c; if (navigator.clipboard) navigator.clipboard.writeText(c).then(() => toast('Código copiado.', ''), () => toast('Copia el código del cuadro.', '')); else toast('Copia el código del cuadro.', ''); code.select(); } }, 'Copiar mi código'),
          h('button', { class: 'btn small ghost', onclick: () => { const r = St.importCode(code.value); if (r.ok) { toast('¡Héroe cargado!', ''); go('hub'); } else toast(r.err, 'warn'); } }, 'Cargar código')), code,
        h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: () => { St.logout(); go('profiles'); } }, 'Cambiar de héroe'),
          h('button', { class: 'btn small danger', onclick: () => modal({ title: '¿Borrar todo?', body: h('p', { text: 'Se borrarán TODOS los héroes y su progreso en este dispositivo.' }), buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Borrar todo', cls: 'danger', onClick: () => { St.resetAll(); go('title'); } }] }) }, 'Borrar todo'))),
      h('div', { class: 'about' }, h('b', { text: 'DuiX' }), h('p', { text: 'Juego de Cálculo Diferencial hecho por Deiwy, estudiante de Estadística.' }), h('small', { text: 'Temas: intervalos, fracciones, factorización, polinomios, plano cartesiano, desigualdades, funciones, desplazamientos, tabulaciones, potenciación, composición, radicales, logaritmos y trigonometría.' }))));
  };

  /* ---------- arranque ---------- */
  function boot() {
    applySettings();
    const unlockOnce = () => { A.unlock(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlockOnce, { once: true, passive: true }));
    document.addEventListener('visibilitychange', () => A.suspend(document.hidden));
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
    go('title');
  }

  root.DuiXUI = { boot, go, toast, _cur: () => cur, _battle: () => battle, SCREENS };
})(typeof window !== 'undefined' ? window : globalThis);
