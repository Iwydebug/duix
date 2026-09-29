/* DuiX — Salas multijugador en modo ARCADE
 * Todos los jugadores luchan a la vez contra el mismo villano con las mismas preguntas (el juego arcade de siempre),
 * ven el ranking en vivo arriba y el villano pierde vida con los aciertos de TODA la sala.
 * Estados de la sala: lobby → countdown (todos empiezan a la vez) → end
 * Las preguntas no viajan por la red: se generan igual en cada celular a partir de una "semilla" que fija el anfitrión.
 */
(function (root) {
  'use strict';
  const D = root.DuiXData, A = root.DuiXAudio, St = root.DuiXStore, Q = root.DuiXQ, N = root.DuiXNet, U = root.DuiXUI, B = root.DuiXBattle;
  const K = U.kit, h = K.h, sfx = K.sfx, toast = K.toast, modal = K.modal, go = K.go, SCREENS = K.SCREENS, later = K.later;
  const TOPICS = D.VILLAINS.filter((v) => v.n <= 14);
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ', MAX_PLAYERS = 60;
  const LSK = 'duix.room', LSR = 'duix.rewarded';
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ok */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ok */ } };
  const cleanCode = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const newCode = () => { let c = ''; for (let i = 0; i < 4; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return c; };
  const linkFor = (code) => location.origin + location.pathname.replace(/index\.html$/, '') + '?sala=' + code + (N.mode === 'local' ? '&net=local' : '');
  const netErr = (e) => (e && e.message) || 'No se pudo conectar. Revisa tu internet.';
  const mulberry = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  function seg(opts, get, set) {
    const box = h('div', { class: 'seg', role: 'radiogroup' });
    const draw = () => { box.innerHTML = ''; opts.forEach(([v, label]) => box.appendChild(h('button', { type: 'button', class: 'segb' + (get() === v ? ' on' : ''), role: 'radio', 'aria-checked': get() === v ? 'true' : 'false', onclick: () => { set(v); sfx('click'); draw(); } }, label))); };
    draw(); return box;
  }
  function switchRow(label, desc, get, set) {
    return h('label', { class: 'set' }, h('div', null, h('b', { text: label }), desc ? h('small', { text: desc }) : null), h('input', { type: 'checkbox', checked: get() ? true : null, onchange: (e) => { set(e.target.checked); sfx('click'); } }), h('span', { class: 'sw2' }));
  }
  function drawQR(text, size) {
    const cv = h('canvas', { class: 'qr', width: size, height: size });
    try {
      const qr = root.qrcode(0, 'M'); qr.addData(text); qr.make();
      const n = qr.getModuleCount(), cell = Math.floor(size / (n + 2)), off = Math.floor((size - cell * n) / 2), x = cv.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#1a1033';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect(off + c * cell, off + r * cell, cell, cell);
    } catch (e) { cv.style.display = 'none'; }
    return cv;
  }

  /* ---------- preguntas iguales para todos (semilla) ---------- */
  function buildRoomQuestions(cfg) {
    const R0 = mulberry(cfg.seed), order = cfg.topics.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R0() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const qs = [], seen = new Set();
    try {
      for (let i = 0; i < cfg.n; i++) {
        const topic = order[i % order.length], level = cfg.level || Math.min(3, Math.floor(i * 3 / cfg.n) + 1);
        let q = null;
        for (let a = 0; a < 8 && !q; a++) {
          Q._setRandom(mulberry((cfg.seed + i * 7919 + a * 104729) >>> 0));
          try { const x = Q.generate(topic, level, { noRecent: true }); if (x && !seen.has(x.text)) q = x; } catch (e) { q = null; }
        }
        if (!q) { Q._setRandom(mulberry((cfg.seed + i) >>> 0)); q = Q.generate('fracciones', 1, { noRecent: true }); }
        q.topic = topic; seen.add(q.text); qs.push(q);
      }
    } finally { Q._setRandom(Math.random); }
    return qs;
  }
  const roomVillain = (cfg) => (cfg.topics.length === 1 ? D.VILLAINS.find((v) => v.topic === cfg.topics[0]) : null) || D.VILLAINS.find((v) => v.id === 'indeterminado');

  /* ============================================================
   * MENÚ DE SALAS
   * ============================================================ */
  SCREENS.rooms = (params, sc) => {
    // Teclado propio en pantalla (funciona igual en cualquier celular, tablet o computador; el teclado físico también sirve)
    let code = cleanCode(params.code);
    const boxes = h('div', { class: 'codeboxes', role: 'group', 'aria-label': 'Código de la sala, 4 letras' });
    const drawBoxes = () => { boxes.innerHTML = ''; for (let i = 0; i < 4; i++) boxes.appendChild(h('span', { class: 'cbox' + (code[i] ? ' has' : '') + (i === code.length ? ' cur' : ''), text: code[i] || '' })); enterBtn.disabled = code.length !== 4; };
    const msg = h('p', { class: 'hint err', role: 'alert' });
    const resume = h('div', { class: 'resume', hidden: true });
    const enterBtn = h('button', { class: 'btn big', type: 'button', onclick: () => joinRoom(code, msg, enterBtn) }, 'Entrar');
    const press = (ch) => { if (code.length < 4) { code += ch; sfx('click'); msg.textContent = ''; drawBoxes(); } };
    const back = () => { if (code.length) { code = code.slice(0, -1); sfx('click'); drawBoxes(); } };
    const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const kb = h('div', { class: 'osk', 'aria-label': 'Teclado de letras' }, ROWS.map((row, ri) => h('div', { class: 'oskrow' }, row.split('').map((ch) => h('button', { type: 'button', class: 'oskkey', 'aria-label': ch, onclick: () => press(ch) }, ch)), ri === 2 ? h('button', { type: 'button', class: 'oskkey wide', 'aria-label': 'Borrar', onclick: back }, '⌫') : null)));
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (/^[a-zA-Z]$/.test(e.key)) { press(e.key.toUpperCase()); e.preventDefault(); }
      else if (e.key === 'Backspace') { back(); e.preventDefault(); }
      else if (e.key === 'Enter' && code.length === 4) { e.preventDefault(); enterBtn.click(); }
    };
    const onPaste = (e) => { const t = cleanCode((e.clipboardData && e.clipboardData.getData('text')) || ''); if (t) { code = t; drawBoxes(); e.preventDefault(); } };
    document.addEventListener('keydown', onKey); document.addEventListener('paste', onPaste);
    K.onLeave(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('paste', onPaste); });
    sc.appendChild(h('div', { class: 'rooms' }, K.topbar(), h('h1', { class: 'h1', text: 'Salas' }),
      h('p', { class: 'hint', text: 'Lucha junto a tus compañeros contra el mismo villano: mismas preguntas, ranking en vivo, y el villano pierde vida con los aciertos de todos. Necesitas internet.' }),
      resume,
      h('div', { class: 'set-block roomcard' }, h('h3', { text: 'Unirme a una sala' }), h('p', { class: 'hint', text: 'Escribe el código de 4 letras:' }), boxes, kb, msg, enterBtn),
      h('div', { class: 'set-block roomcard' }, h('h3', { text: 'Crear una sala' }), h('p', { class: 'hint', text: 'Tú eliges cuántas preguntas, la dificultad y los temas. Los demás entran con un código o un QR.' }), h('button', { class: 'btn', type: 'button', onclick: () => { sfx('select'); go('roomCreate'); } }, 'Crear sala'))));
    drawBoxes();
    if (code.length === 4) later(() => enterBtn.click(), 350);
    const sess = lsGet(LSK);
    if (sess && sess.code) {
      N.ready().then(() => N.get('rooms/' + sess.code + '/state')).then((st) => {
        if (!st) { lsDel(LSK); return; }
        resume.hidden = false; resume.appendChild(h('div', { class: 'set-block roomcard' }, h('h3', { text: 'Tienes una sala abierta: ' + sess.code }), h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', onclick: () => go('room', { code: sess.code, role: sess.role }) }, 'Volver a la sala'),
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => { lsDel(LSK); resume.hidden = true; } }, 'Olvidar'))));
      }).catch(() => {});
    }
  };

  async function joinRoom(raw, msg, btn) {
    const code = cleanCode(raw); msg.textContent = '';
    if (code.length !== 4) { msg.textContent = 'El código tiene 4 letras.'; sfx('deny'); return; }
    const p = St.profile(); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Conectando…';
    try {
      await N.ready();
      const [state, cfg, players] = await Promise.all([N.get('rooms/' + code + '/state'), N.get('rooms/' + code + '/cfg'), N.get('rooms/' + code + '/players')]);
      if (!state || !cfg) { msg.textContent = 'No encontré esa sala. Revisa el código.'; sfx('deny'); return; }
      const mine = players && players[p.id];
      if (!mine && state.phase === 'countdown') { msg.textContent = 'Esa partida ya empezó. Espera a la siguiente.'; sfx('deny'); return; }
      if (!mine && players && Object.keys(players).length >= MAX_PLAYERS) { msg.textContent = 'La sala está llena.'; sfx('deny'); return; }
      if (!mine) await N.set('rooms/' + code + '/players/' + p.id, { name: p.name, look: p.look, score: 0, correct: 0, qi: 0, done: false, online: true, joined: N.TS });
      lsSet(LSK, { code, role: 'player', pid: p.id });
      sfx('select'); go('room', { code, role: 'player' });
    } catch (e) { msg.textContent = netErr(e); sfx('deny'); } finally { btn.disabled = false; btn.textContent = old; }
  }

  /* ============================================================
   * CREAR SALA
   * ============================================================ */
  SCREENS.roomCreate = (_, sc) => {
    const c = { n: 8, level: 0, topics: new Set(TOPICS.map((v) => v.topic)), more: false, hostPlays: true };
    const chips = h('div', { class: 'tchips' });
    const drawChips = () => { chips.innerHTML = ''; TOPICS.forEach((v) => chips.appendChild(h('button', { type: 'button', class: 'tchip' + (c.topics.has(v.topic) ? ' on' : ''), 'aria-pressed': c.topics.has(v.topic) ? 'true' : 'false', onclick: () => { if (c.topics.has(v.topic)) { if (c.topics.size > 1) c.topics.delete(v.topic); else { toast('Deja al menos un tema.', 'warn'); return; } } else c.topics.add(v.topic); sfx('click'); drawChips(); } }, v.tema))); };
    drawChips();
    const msg = h('p', { class: 'hint err', role: 'alert' }), btn = h('button', { class: 'btn big', type: 'button' }, 'Crear sala');
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Creando…'; msg.textContent = '';
      try { await createRoom(c); } catch (e) { msg.textContent = netErr(e); sfx('deny'); btn.disabled = false; btn.textContent = 'Crear sala'; }
    });
    sc.appendChild(h('div', { class: 'rooms' }, K.topbar(), h('h1', { class: 'h1', text: 'Nueva sala' }),
      h('div', { class: 'set-block' }, h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Preguntas por jugador' }), h('small', { text: 'Cada jugador responde todas; 8 dura unos 4 minutos.' })), seg([[5, '5'], [8, '8'], [10, '10'], [15, '15']], () => c.n, (v) => { c.n = v; })),
        h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Dificultad' }), h('small', { text: '“Creciente” empieza fácil y termina difícil.' })), seg([[1, 'Fácil'], [2, 'Media'], [3, 'Difícil'], [0, 'Creciente']], () => c.level, (v) => { c.level = v; }))),
      h('div', { class: 'set-block' }, h('h3', { text: 'Temas' }), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small ghost', onclick: () => { TOPICS.forEach((v) => c.topics.add(v.topic)); sfx('click'); drawChips(); } }, 'Todos')), chips,
        h('small', { class: 'hint', text: 'Con un solo tema pelean contra su villano; con varios, contra El Indeterminado.' })),
      h('div', { class: 'set-block' }, switchRow('Más tiempo para leer', 'Las preguntas dan más tiempo antes de que caigan las respuestas (para todos)', () => c.more, (v) => { c.more = v; }),
        switchRow('Yo también juego', 'Apágalo si solo vas a proyectar el ranking', () => c.hostPlays, (v) => { c.hostPlays = v; })),
      msg, btn, h('button', { class: 'btn ghost', type: 'button', onclick: () => { sfx('back'); go('rooms'); } }, 'Volver')));
  };
  async function createRoom(c) {
    const p = St.profile();
    await N.ready();
    const cfg = { n: c.n, level: c.level, topics: Array.from(c.topics), more: !!c.more, hostPlays: !!c.hostPlays, seed: Math.floor(Math.random() * 4294967295), v: 3 };
    let code = '', ok = false;
    for (let i = 0; i < 10 && !ok; i++) { code = newCode(); ok = (await N.get('rooms/' + code + '/state')) === null; }
    if (!ok) throw new Error('No se pudo crear un código libre. Inténtalo otra vez.');
    const room = { host: p.id, hostName: p.name, hostOnline: true, created: N.TS, cfg, state: { phase: 'lobby', t0: N.TS, round: 0 } };
    if (cfg.hostPlays) room.players = { [p.id]: { name: p.name, look: p.look, score: 0, correct: 0, qi: 0, done: false, online: true, joined: N.TS } };
    await N.set('rooms/' + code, room);
    lsSet(LSK, { code, role: 'host', pid: p.id });
    sfx('select'); go('room', { code, role: 'host' });
  }

  /* ============================================================
   * SALA: plaza (lobby interactivo) → combate arcade → podio → de vuelta a la plaza
   * ============================================================ */
  SCREENS.room = (params, sc) => {
    const code = params.code, role = params.role, p = St.profile(), pid = p.id, isHost = role === 'host';
    const P = 'rooms/' + code;
    const R = { cfg: null, state: null, players: {}, pos: {}, playersLoaded: false, hostOnline: true };
    const my = { finished: false, report: null, rewarded: null, back: false, round: -1 };
    const subs = [], timers = [];
    let viewKey = '', left = false, offline = false, battle = null, questions = null, lastWrite = 0, writeT = 0, pending = null, lastRank = 0, renderT = 0, cdTimer = 0, plaza = null, refs = {};
    const box = h('div', { class: 'room' });
    const holder = h('div', { class: 'btholder', hidden: true });
    const banner = h('div', { class: 'rbanner', hidden: true });
    const rankEl = h('div', { class: 'bt-rank', 'aria-label': 'Ranking en vivo' });
    sc.appendChild(h('div', { class: 'roomwrap' }, banner, box)); sc.appendChild(holder);
    A.play('menu');

    const playing = () => !isHost || !!(R.cfg && R.cfg.hostPlays);
    const nowMs = () => N.now();
    const round = () => (R.state && R.state.round) || 0;
    const myP = () => R.players[pid] || null;
    const ranking = () => Object.keys(R.players).map((id) => Object.assign({ id }, R.players[id])).sort((a, b) => ((b.score || 0) - (a.score || 0)) || ((b.correct || 0) - (a.correct || 0)) || String(a.name).localeCompare(String(b.name)));
    const setBanner = (t) => { banner.hidden = !t; banner.textContent = t || ''; };
    const killPlaza = () => { if (plaza) { try { plaza.destroy(); } catch (e) { /* ok */ } plaza = null; } refs = {}; };
    function stop() {
      if (left) return; left = true; subs.forEach((f) => { try { f(); } catch (e) { /* ok */ } }); timers.forEach(clearInterval); clearTimeout(writeT); clearTimeout(renderT); clearInterval(cdTimer); killPlaza();
      if (battle) { try { battle.destroy(); } catch (e) { /* ok */ } battle = null; }
      try { N.remove(P + '/pos/' + pid).catch(() => {}); } catch (e) { /* ok */ }
    }
    K.onLeave(stop);

    /* ----- conexión ----- */
    function announce() {
      if (playing()) { N.set(P + '/players/' + pid + '/online', true).catch(() => {}); N.onDisconnect(P + '/players/' + pid + '/online', false).catch(() => {}); }
      N.onDisconnect(P + '/pos/' + pid, null).catch(() => {});
      if (isHost) { N.set(P + '/hostOnline', true).catch(() => {}); N.onDisconnect(P + '/hostOnline', false).catch(() => {}); }
    }
    subs.push(N.onConnection((on) => { offline = !on; if (on) { announce(); setBanner(!R.hostOnline && !isHost ? 'El anfitrión perdió la conexión. Espera…' : ''); } else setBanner('Sin conexión… reconectando'); }));

    /* ----- suscripciones ----- */
    subs.push(N.on(P + '/cfg', (cfg) => { if (cfg) { R.cfg = cfg; if (R.state) render(false); } }));
    subs.push(N.on(P + '/pos', (v) => { R.pos = v || {}; }));
    subs.push(N.on(P + '/players', (v) => { R.players = v || {}; R.playersLoaded = true; onPlayers(); }));
    subs.push(N.on(P + '/hostOnline', (v) => { R.hostOnline = v !== false; if (!isHost) setBanner(!R.hostOnline && R.state && R.state.phase !== 'end' ? 'El anfitrión perdió la conexión. Espera…' : ''); }));
    subs.push(N.on(P + '/state', (s) => {
      if (s === null) { if (R.state && R.state.phase === 'end') return; showClosed(); return; }
      const prev = R.state; R.state = s;
      if ((s.round || 0) !== my.round) { // nueva ronda: todo vuelve a empezar
        if (my.round >= 0) { my.finished = false; my.report = null; my.rewarded = null; my.back = false; questions = null; if (battle) { try { battle.destroy(); } catch (e) { /* ok */ } battle = null; sc.classList.remove('s-battle'); holder.hidden = true; box.hidden = false; K.setAmbient(true, 'room'); } if (prev && prev.phase === 'end' && s.phase === 'lobby') toast('¡El anfitrión abrió una nueva partida!', ''); }
        my.round = s.round || 0; viewKey = '';
      }
      render(false);
    }));
    function onPlayers() {
      const ph = R.state && R.state.phase;
      if (battle) { const now = Date.now(); if (now - lastRank > 900) { lastRank = now; updateRank(); if (battle.refresh) battle.refresh(); } return; }
      if (refs.plist) { refreshPlaza(); return; }
      if (ph === 'end') render(true); else if (ph === 'countdown') { clearTimeout(renderT); renderT = setTimeout(() => render(true), 350); } else render(false);
    }
    function showClosed() {
      stop(); lsDel(LSK); sc.classList.remove('s-battle'); holder.hidden = true; box.hidden = false;
      box.innerHTML = ''; box.appendChild(h('div', { class: 'rpanel' }, h('h2', { class: 'rtitle', text: 'La sala se cerró' }), h('p', { class: 'hint', text: 'El anfitrión cerró la sala o ya no existe.' }), h('button', { class: 'btn big', type: 'button', onclick: () => go('rooms') }, 'Volver a Salas')));
    }

    /* ----- anfitrión ----- */
    if (isHost) {
      timers.push(setInterval(() => {
        const s = R.state; if (left || offline || !s || s.phase !== 'countdown') return;
        const el = nowMs() - (s.t0 || nowMs()), list = Object.values(R.players);
        if (el > 12000 && list.length && list.every((x) => x.done || x.online === false)) hostEnd();
        else if (el > 20 * 60 * 1000) hostEnd();
      }, 1000));
    }
    function hostEnd() { const s = R.state; if (!s || s.phase === 'end') return; N.update(P, { state: { phase: 'end', t0: N.TS, round: round() } }).catch(() => {}); }
    async function hostStart() {
      const n = Object.keys(R.players).length;
      if (!n) { toast('Aún no hay jugadores.', 'warn'); sfx('deny'); return; }
      try { sfx('go'); await N.update(P, { state: { phase: 'countdown', t0: N.TS, round: round() } }); } catch (e) { toast(netErr(e), 'warn'); }
    }
    async function hostRematch() {
      const upd = {}; Object.keys(R.players).forEach((id) => { if (R.players[id].online === false) upd['players/' + id] = null; else { upd['players/' + id + '/score'] = 0; upd['players/' + id + '/correct'] = 0; upd['players/' + id + '/qi'] = 0; upd['players/' + id + '/done'] = false; } });
      upd['cfg/seed'] = Math.floor(Math.random() * 4294967295); upd.state = { phase: 'lobby', t0: N.TS, round: round() + 1 };
      try { sfx('select'); await N.update(P, upd); } catch (e) { toast(netErr(e), 'warn'); }
    }

    /* ----- ranking dentro del combate ----- */
    function updateRank() {
      const rk = ranking(), me = rk.findIndex((x) => x.id === pid); rankEl.innerHTML = '';
      const chip = (x, i) => h('span', { class: 'rk' + (x.id === pid ? ' me' : '') }, h('b', { text: String(i + 1) }), K.headThumb(x.look || {}, ''), h('span', { text: String(x.name).slice(0, 8) }), h('span', { text: String(x.score || 0) }));
      rk.slice(0, 3).forEach((x, i) => rankEl.appendChild(chip(x, i)));
      if (me >= 3) rankEl.appendChild(chip(rk[me], me));
    }
    const sharedHp = () => { const ps = Object.values(R.players), tot = ps.length * ((R.cfg && R.cfg.n) || 1), done = ps.reduce((s, x) => s + (x.correct || 0), 0), frac = tot ? 1 - done / tot : 1; return { frac, text: Math.round(frac * 100) + '%' }; };

    /* ----- combate ----- */
    function pushProgress(snap, immediate) {
      pending = snap; const now = Date.now();
      const write = () => { if (!pending) return; const s = pending; pending = null; lastWrite = Date.now(); N.update(P + '/players/' + pid, { score: s.score, correct: s.correct, qi: s.qi }).catch(() => {}); };
      if (immediate || now - lastWrite > 700) { clearTimeout(writeT); write(); } else { clearTimeout(writeT); writeT = setTimeout(write, 700 - (now - lastWrite)); }
    }
    function startBattle() {
      if (battle || my.finished || left || !R.cfg) return;
      killPlaza(); questions = buildRoomQuestions(R.cfg);
      K.setAmbient(false); sc.classList.add('s-battle'); box.hidden = true; holder.hidden = false; setBanner('');
      A.play('battle'); updateRank();
      battle = B.start({
        container: holder, villain: roomVillain(R.cfg), tier: R.cfg.level || 2, look: p.look, perks: {}, lockSettings: true, moreTime: !!R.cfg.more, extraTop: rankEl,
        room: { total: R.cfg.n, getQuestion: (i) => questions[i], hp: sharedHp, noHearts: true },
        onProgress: (snap) => pushProgress(snap, snap.over),
        onEnd: (rep) => { setTimeout(() => finishMine(rep), 0); },
        onQuit: () => { battle = null; root.__roomBattle = null; leaveGame(); },
      });
      root.__roomBattle = battle;
    }
    function finishMine(rep, quit) {
      if (my.finished || left) return; my.finished = true; my.report = rep;
      if (battle) { try { battle.destroy(); } catch (e) { /* ok */ } battle = null; }
      sc.classList.remove('s-battle'); holder.hidden = true; box.hidden = false; K.setAmbient(true, 'room'); A.play('menu');
      const upd = { done: true, finishedAt: N.TS }; if (rep) { upd.score = rep.score; upd.correct = rep.correct; upd.qi = rep.answered; }
      if (quit) upd.online = false;
      clearTimeout(writeT); pending = null;
      N.update(P + '/players/' + pid, upd).catch(() => {});
      viewKey = ''; render(true);
    }
    async function leaveGame() { lsDel(LSK); if (playing()) { try { await N.update(P + '/players/' + pid, { done: true, online: false }); } catch (e) { /* ok */ } } stop(); go('rooms'); }

    /* ----- vistas ----- */
    function boardFill(el, limit) {
      const rk = ranking(), n = (R.cfg && R.cfg.n) || 1; el.innerHTML = '';
      rk.slice(0, limit || 99).forEach((x, i) => {
        const prog = Math.min(100, Math.round((x.qi || 0) / n * 100));
        el.appendChild(h('li', { class: 'rrow' + (x.id === pid ? ' me' : '') }, h('span', { class: 'rpos', text: String(i + 1) }), K.headThumb(x.look || {}, 'rh'),
          h('div', { class: 'rmid' }, h('b', { class: 'rname', text: x.name }), h('div', { class: 'rprog' }, h('i', { style: 'width:' + prog + '%' }))),
          h('span', { class: 'rst', text: x.done ? '✔' : x.online === false ? '⚠' : '🎮' }), h('span', { class: 'rscore', text: String(x.score || 0) })));
      });
    }
    function bossBarEl() {
      const v = roomVillain(R.cfg || { topics: [] }), r = sharedHp();
      return h('div', { class: 'rboss' }, h('b', { text: v.name }), h('div', { class: 'rbar' }, h('i', { style: 'width:' + Math.max(0, r.frac * 100) + '%' })), h('span', { text: r.text }));
    }
    function confirmLeave() {
      const ph = R.state && R.state.phase;
      if (isHost) modal({ title: '¿Cerrar la sala?', body: h('p', { text: 'La sala se cierra para todos.' }), buttons: [{ label: 'Seguir', cls: 'ghost' }, { label: 'Cerrar sala', cls: 'danger', onClick: () => closeRoom() }] });
      else if (ph === 'lobby' || ph === 'end') leave();
      else modal({ title: '¿Salir de la partida?', body: h('p', { text: 'Perderás tu lugar en el ranking.' }), buttons: [{ label: 'Seguir jugando', cls: 'ghost' }, { label: 'Salir', cls: 'danger', onClick: () => leaveGame() }] });
    }
    async function closeRoom() { try { await N.remove(P); } catch (e) { /* ok */ } lsDel(LSK); stop(); go('rooms'); }
    async function leave() {
      const ph = R.state && R.state.phase;
      try { if (playing() && (ph === 'lobby' || ph === 'end')) await N.remove(P + '/players/' + pid); } catch (e) { /* ok */ }
      lsDel(LSK); stop(); go('rooms');
    }
    function openOutfit() {
      let cat = D.CATS[0].id; const prev = h('canvas', { class: 'px oprev' }); K.liveHero(prev, () => p.look, { scale: 4 });
      const tabs = h('div', { class: 'ctabs' }), grid = h('div', { class: 'ogrid' });
      const draw = () => {
        tabs.innerHTML = ''; D.CATS.forEach((c) => tabs.appendChild(h('button', { type: 'button', class: 'ctab' + (c.id === cat ? ' on' : ''), onclick: () => { cat = c.id; sfx('click'); draw(); } }, h('span', { text: c.icon || '•' }), h('b', { text: c.name }))));
        grid.innerHTML = ''; const its = D.ITEMS.filter((i) => i.cat === cat && p.owned.includes(i.id));
        if (!its.length) grid.appendChild(h('p', { class: 'hint', text: 'Aún no tienes objetos de esta categoría. ¡Consíguelos en la Ciudad!' }));
        its.forEach((it) => grid.appendChild(h('button', { type: 'button', class: 'ochip r-' + it.rarity + (p.look[it.cat] === it.id ? ' on' : ''), onclick: () => { St.equip(it.id); sfx('select'); N.update(P + '/players/' + pid, { look: p.look }).catch(() => {}); draw(); } }, it.name)));
      };
      draw(); modal({ title: 'Cámbiate de ropa', body: h('div', { class: 'outfit' }, h('div', { class: 'oprevbox' }, prev), tabs, grid), buttons: [{ label: 'Listo' }] });
    }
    function refreshPlaza() {
      if (!refs.plist) return; const pls = ranking().sort((a, b) => (a.joined || 0) - (b.joined || 0));
      refs.plist.innerHTML = ''; pls.forEach((x) => refs.plist.appendChild(h('div', { class: 'pchip' + (x.id === pid ? ' me' : '') + (x.online === false ? ' off' : '') }, K.headThumb(x.look || {}, 'rh'), h('b', { text: x.name }), x.done ? h('i', { text: '✔' }) : null)));
      if (refs.count) refs.count.textContent = String(pls.length);
      if (refs.board) boardFill(refs.board, 60);
      if (refs.boss) { const nb = bossBarEl(); refs.boss.replaceWith(nb); refs.boss = nb; }
    }
    // plaza: lobby (antes de jugar), live (ya terminé y espero) o after (terminó la partida y volví)
    function viewPlaza(mode) {
      const cfg = R.cfg || {}, link = linkFor(code), v = roomVillain(cfg.topics ? cfg : { topics: [] });
      const lines = [`${cfg.n || '?'} preguntas`, cfg.level ? ['', 'fáciles', 'medias', 'difíciles'][cfg.level] : 'dificultad creciente'].concat(cfg.more ? ['más tiempo para leer'] : []);
      const plazaBox = h('div', { class: 'plazabox' });
      const emo = h('div', { class: 'emotes' }, root.DuiXPlaza.EMOTES.map((e) => h('button', { type: 'button', class: 'emo', 'aria-label': 'Emote ' + e, onclick: () => { sfx('click'); N.update(P + '/pos/' + pid, { e, et: N.TS }).catch(() => {}); if (e === '💃') sfx('levelup'); } }, e)));
      const plist = h('div', { class: 'plist' }), count = h('b', { class: 'pc', text: '0' });
      refs = { plist, count };
      const title = mode === 'lobby' ? (isHost ? 'Sala lista' : 'Estás dentro') : mode === 'live' ? (my.finished ? '¡Terminaste!' : 'Partida en curso') : '¡Fin de la partida!';
      const sub = mode === 'lobby' ? (isHost ? 'Los demás entran en DuiX → Salas con este código. ¡Mientras tanto, camina, baila y cámbiate de ropa!' : 'Espera a que el anfitrión empiece. ¡Camina por la plaza, haz emotes y cámbiate de ropa!') : mode === 'live' ? 'Espera a que terminen los demás mientras paseas por la plaza.' : (isHost ? 'Cuando todos estén en la plaza, abre una nueva partida.' : 'Espera a que el anfitrión abra una nueva partida.');
      const parts = [
        h('div', { class: 'rtop' }, h('button', { class: 'btn small ghost', type: 'button', onclick: () => confirmLeave() }, isHost ? 'Cerrar sala' : 'Salir'), mode === 'live' && isHost ? h('button', { class: 'btn small', type: 'button', onclick: () => { sfx('click'); hostEnd(); } }, 'Terminar ya ⏹') : null),
        h('h2', { class: 'rtitle', text: title }),
        h('div', { class: 'bigcode small', 'aria-label': 'Código de la sala ' + code.split('').join(' ') }, code.split('').map((c) => h('span', { text: c }))),
        h('p', { class: 'hint', text: sub }),
        plazaBox, emo,
        h('div', { class: 'row plzrow' }, h('button', { class: 'btn small', type: 'button', onclick: () => { sfx('select'); openOutfit(); } }, '👕 Vestidor'),
          isHost && mode === 'lobby' ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => { const q = plazaBox.parentNode.querySelector('.qrbox'); if (q) q.hidden = !q.hidden; } }, '📱 QR') : null,
          isHost ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => { if (navigator.share) navigator.share({ title: 'DuiX', text: 'Entra a mi sala de DuiX', url: link }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast('Enlace copiado.', ''), () => toast(link, '')); else toast(link, ''); } }, 'Compartir') : null),
        isHost && mode === 'lobby' ? h('div', { class: 'qrbox', hidden: true }, drawQR(link, 176)) : null,
      ];
      if (mode !== 'lobby') { refs.boss = bossBarEl(); const bd = h('ol', { class: 'rboard' }); refs.board = bd; parts.push(refs.boss, h('h3', { class: 'rsub', text: mode === 'after' ? 'Resultado final' : 'Ranking en vivo' }), bd); }
      if (mode === 'lobby') parts.push(h('div', { class: 'rvil' }, K.villainEl(v, 64), h('div', null, h('b', { text: 'Villano: ' + v.name }), h('small', { text: lines.join(' · ') }))));
      parts.push(h('h3', { class: 'rsub' }, 'En la plaza (', count, ')'), plist);
      if (isHost && mode === 'lobby') parts.push(h('button', { class: 'btn big', type: 'button', onclick: hostStart }, 'Empezar partida'));
      if (isHost && mode === 'after') parts.push(h('button', { class: 'btn big', type: 'button', onclick: hostRematch }, '¡Nueva partida!'), h('button', { class: 'btn ghost', type: 'button', onclick: () => closeRoom() }, 'Cerrar sala'));
      if (!isHost && mode === 'after') parts.push(h('button', { class: 'btn ghost', type: 'button', onclick: () => leave() }, 'Salir de la sala'), h('button', { class: 'btn ghost', type: 'button', onclick: () => go('notebook') }, 'Ver Cuaderno'));
      box.appendChild(h('div', { class: 'rpanel lobby plz' }, parts));
      plaza = root.DuiXPlaza.mount(plazaBox, {
        pid, code, now: nowMs, getPlayers: () => R.players, getPos: () => R.pos, getLook: () => p.look,
        setPos: (x, y, f) => { N.update(P + '/pos/' + pid, { x, y, f }).catch(() => {}); }, onCoin: (n) => { St.addCoins(n); St.save(); K.refreshCoins && K.refreshCoins(); },
      });
      refreshPlaza();
    }
    function viewCountdown() {
      const v = roomVillain(R.cfg), s = R.state;
      const num = h('div', { class: 'cdnum', text: '3' });
      box.appendChild(h('div', { class: 'rpanel cd' }, h('h2', { class: 'rtitle', text: '¡A luchar!' }), h('div', { class: 'cdvil' }, K.villainEl(v, 120)), h('p', { class: 'hint', text: v.name + ' aparece… ¡prepárate!' }), num));
      clearInterval(cdTimer);
      const tick = () => {
        const el = nowMs() - (s.t0 || nowMs()), left3 = Math.ceil((3000 - el) / 1000);
        if (left3 > 0) { if (num.textContent !== String(left3)) { num.textContent = String(left3); sfx('tick'); } }
        else { clearInterval(cdTimer); if (playing() && !my.finished) startBattle(); }
      };
      cdTimer = setInterval(tick, 100); tick();
    }
    function viewEnd() {
      const rk = ranking(), me = rk.findIndex((x) => x.id === pid), mineP = me >= 0 ? rk[me] : null;
      const pod = h('div', { class: 'podium' });
      [1, 0, 2].forEach((idx) => {
        const x = rk[idx]; if (!x) { pod.appendChild(h('div', { class: 'pcol empty' })); return; }
        const cv = h('canvas', { class: 'px pheroc' }); K.liveHero(cv, () => x.look || {}, { scale: idx === 0 ? 4 : 3, pose: () => 'idle' });
        pod.appendChild(h('div', { class: 'pcol p' + (idx + 1) }, idx === 0 ? h('div', { class: 'crown', text: '👑' }) : null, cv, h('b', { class: 'pname', text: x.name }), h('span', { class: 'pscore', text: String(x.score || 0) }), h('div', { class: 'pstep' }, h('span', { text: String(idx + 1) }))));
      });
      let reward = null;
      if (playing() && mineP && mineP.done) {
        const key = code + ':' + ((R.cfg && R.cfg.seed) || 0), done = lsGet(LSR);
        if (!my.rewarded && !(done && done.key === key && done.pid === pid)) {
          const rep = my.report || { mistakes: [], bestStreak: 0 };
          my.rewarded = St.recordRoom({ correct: mineP.correct || 0, answered: Math.max(mineP.qi || 0, mineP.correct || 0), rank: me + 1, total: rk.length, bestStreak: rep.bestStreak || 0, mistakes: rep.mistakes || [] });
          lsSet(LSR, { key, pid, at: Date.now() });
          if (my.rewarded) { later(() => sfx('win'), 200); K.announceAch(my.rewarded.ach); }
        }
        if (my.rewarded) { const nm = (my.report && my.report.mistakes || []).length; reward = h('div', { class: 'rreward' }, h('b', { text: 'Puesto ' + (me + 1) + ' de ' + rk.length }), h('span', null, K.img('coin', 2), ' +' + my.rewarded.coins + ' monedas · +' + my.rewarded.xp + ' XP' + (my.rewarded.bonus ? ' (incluye premio de podio)' : '')), nm ? h('small', { text: 'Tus ' + nm + ' errores quedaron en el Cuaderno para repasar.' }) : h('small', { text: '¡Sin errores!' })); }
      }
      const rest = h('ol', { class: 'rboard' }, rk.slice(3).map((x, i) => h('li', { class: 'rrow' + (x.id === pid ? ' me' : '') }, h('span', { class: 'rpos', text: String(i + 4) }), K.headThumb(x.look || {}, 'rh'), h('div', { class: 'rmid' }, h('b', { class: 'rname', text: x.name })), h('span', { class: 'rscore', text: String(x.score || 0) }))));
      box.appendChild(h('div', { class: 'rpanel end' }, h('h2', { class: 'rtitle', text: '¡Fin de la partida!' }), pod, reward, rk.length > 3 ? rest : null,
        h('button', { class: 'btn big', type: 'button', onclick: () => { sfx('select'); my.back = true; viewKey = ''; render(true); } }, '↩ Volver a la sala'),
        isHost ? h('button', { class: 'btn ghost', type: 'button', onclick: () => closeRoom() }, 'Cerrar sala') : h('button', { class: 'btn ghost', type: 'button', onclick: () => leave() }, 'Salir')));
    }

    function render(force) {
      const s = R.state; if (left || !s || !R.cfg) return;
      const ph = s.phase;
      if (ph === 'end') {
        if (battle) { const bs = battle.state; if (!my.report) my.report = { mistakes: bs.mistakes, bestStreak: bs.bestStreak, score: Math.round(bs.score), correct: bs.correct, answered: bs.answered, heartsLost: bs.heartsLost }; try { battle.destroy(); } catch (e) { /* ok */ } battle = null; sc.classList.remove('s-battle'); holder.hidden = true; box.hidden = false; K.setAmbient(true, 'room'); }
        clearInterval(cdTimer);
      }
      if (battle) return; // el combate manda
      if (ph === 'countdown' && playing() && !my.finished && R.playersLoaded && nowMs() - (s.t0 || 0) > 3000) {
        const me = myP();
        if (me && me.done) { my.finished = true; }
        else if (me && (me.qi || 0) > 0) { finishMine(null, true); return; }
      }
      const key = ph + ':' + (my.finished ? 'F' : '') + (my.back ? 'B' : '') + ':' + my.round;
      if (!force && key === viewKey) return;
      viewKey = key; killPlaza(); box.innerHTML = '';
      if (ph === 'lobby') viewPlaza('lobby');
      else if (ph === 'end') { A.play('menu'); if (my.back) viewPlaza('after'); else viewEnd(); }
      else if (playing() && !my.finished && nowMs() - (s.t0 || 0) < 3000) viewCountdown();
      else if (playing() && !my.finished) { if (R.playersLoaded) startBattle(); else box.appendChild(h('div', { class: 'rpanel' }, h('p', { class: 'hint', text: 'Conectando…' }))); }
      else viewPlaza('live');
    }
  };
  root.DuiXRooms = { _battle: () => root.__roomBattle || null };
})(window);
