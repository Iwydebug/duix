/* DuiX — Salas multijugador en modo ARCADE
 * Todos los jugadores luchan a la vez contra el mismo villano con las mismas preguntas (el juego arcade de siempre),
 * ven el ranking en vivo arriba y el villano pierde vida con los aciertos de TODA la sala.
 * Estados de la sala: lobby → countdown (todos empiezan a la vez) → end
 * Las preguntas no viajan por la red: se generan igual en cada celular a partir de una "semilla" que fija el anfitrión.
 */
(function (root) {
  'use strict';
  const D = root.DuiXData, A = root.DuiXAudio, St = root.DuiXStore, Q = root.DuiXQ, N = root.DuiXNet, U = root.DuiXUI, B = root.DuiXBattle;
  const G = root.DuiXGames;
  const K = U.kit, h = K.h, sfx = K.sfx, toast = K.toast, modal = K.modal, go = K.go, SCREENS = K.SCREENS, later = K.later;
  const TOPICS = D.VILLAINS.filter((v) => !v.boss);
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
  // Impostores: Ninguno / Auto / 1 / 2 / 3 y un cuadro numérico para cualquier otro número
  function impRow(c) {
    const box = h('div', { class: 'seg', role: 'radiogroup' });
    const num = h('input', { type: 'number', inputmode: 'numeric', pattern: '[0-9]*', min: '1', max: '30', class: 'input impnum', placeholder: 'Otro nº', 'aria-label': 'Otro número de impostores' });
    const PRE = [[0, 'Ninguno'], [-1, 'Auto'], [1, '1'], [2, '2'], [3, '3']];
    const draw = () => { box.innerHTML = ''; PRE.forEach(([v, label]) => box.appendChild(h('button', { type: 'button', class: 'segb' + ((c.imp || 0) === v ? ' on' : ''), role: 'radio', 'aria-checked': (c.imp || 0) === v ? 'true' : 'false', onclick: () => { c.imp = v; num.value = ''; sfx('click'); draw(); } }, label)));
      const custom = (c.imp || 0) > 3; num.classList.toggle('on', custom); if (custom) num.value = String(c.imp); };
    num.addEventListener('input', () => { const v = Math.max(0, Math.min(30, parseInt(num.value, 10) || 0)); if (num.value === '') return; c.imp = v; draw(); });
    draw();
    return h('div', { class: 'set col' }, h('div', null, h('b', { text: '🕵️ Impostores' }), h('small', { text: 'Juegan normal pero sabotean (turbo, niebla, robo). Cada 3 preguntas todos votan quién es. Necesitas 3+ jugadores; el máximo real es la mitad menos 1.' })),
      h('div', { class: 'improw' }, box, num),
      h('small', { class: 'hint imphelp', html: '<b>Auto</b> = 1 impostor por cada 5 jugadores (equilibrado):<br>3–7 jug. → 1 · 8–12 → 2 · 13–17 → 3 · 20 → 4 · 30 → 6 · 40 → 8 · 60 → 12.<br>Con más impostores el juego es más caótico; con menos, más difícil de ganar para ellos.' }));
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
  function configBlocks(c) {
    const chips = h('div', { class: 'tchips' });
    const drawChips = () => { chips.innerHTML = ''; TOPICS.forEach((v) => chips.appendChild(h('button', { type: 'button', class: 'tchip' + (c.topics.has(v.topic) ? ' on' : ''), 'aria-pressed': c.topics.has(v.topic) ? 'true' : 'false', onclick: () => { if (c.topics.has(v.topic)) { if (c.topics.size > 1) c.topics.delete(v.topic); else { toast('Deja al menos un tema.', 'warn'); return; } } else c.topics.add(v.topic); sfx('click'); drawChips(); } }, v.tema))); };
    drawChips();
    return h('div', null,
      h('div', { class: 'set-block' }, h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Preguntas por jugador' }), h('small', { text: 'Cada jugador responde todas; 9 dura unos 5 minutos.' })), seg([[6, '6'], [9, '9'], [12, '12'], [15, '15']], () => c.n, (v) => { c.n = v; })),
        h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Dificultad' }), h('small', { text: '“Creciente” empieza fácil y termina difícil.' })), seg([[1, 'Fácil'], [2, 'Media'], [3, 'Difícil'], [0, 'Creciente']], () => c.level, (v) => { c.level = v; }))),
      h('div', { class: 'set-block' }, h('h3', { text: 'Temas' }), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small ghost', onclick: () => { TOPICS.forEach((v) => c.topics.add(v.topic)); sfx('click'); drawChips(); } }, 'Todos')), chips,
        h('small', { class: 'hint', text: 'Con un solo tema pelean contra su villano; con varios, contra El Indeterminado.' })),
      h('div', { class: 'set-block' }, h('h3', { text: 'Modo de juego' }),
        switchRow('Mezclar los 3 juegos', 'Disparo → Carrera → Laberinto Pac-Man (las preguntas se reparten entre los tres)', () => c.mix !== false, (v) => { c.mix = v; }),
        impRow(c)),
      h('div', { class: 'set-block' }, secsRow(c),
        switchRow('Yo también juego', 'Apágalo si solo vas a proyectar el ranking', () => c.hostPlays, (v) => { c.hostPlays = v; })));
  }
  function secsRow(c) {
    const out = h('b', { class: 'secsval', text: (c.secs || 30) + ' s' });
    const rng = h('input', { type: 'range', min: '15', max: '60', step: '5', value: String(c.secs || 30), 'aria-label': 'Segundos por pregunta', class: 'secsrng', oninput: (e) => { c.secs = +e.target.value; out.textContent = c.secs + ' s'; } });
    return h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Tiempo por pregunta' }), h('small', { text: 'Segundos que tarda la respuesta en llegar al héroe (15 s a 1 min). Vale para todos.' })), h('div', { class: 'secsrow' }, h('span', { text: '15' }), rng, h('span', { text: '60' }), out));
  }
  SCREENS.roomCreate = (_, sc) => {
    const c = { n: 9, level: 0, topics: new Set(TOPICS.map((v) => v.topic)), secs: 30, hostPlays: true, mix: true, imp: 1 };
    const blocks = configBlocks(c);
    const msg = h('p', { class: 'hint err', role: 'alert' }), btn = h('button', { class: 'btn big', type: 'button' }, 'Crear sala');
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Creando…'; msg.textContent = '';
      try { await createRoom(c); } catch (e) { msg.textContent = netErr(e); sfx('deny'); btn.disabled = false; btn.textContent = 'Crear sala'; }
    });
    sc.appendChild(h('div', { class: 'rooms' }, K.topbar(), h('h1', { class: 'h1', text: 'Nueva sala' }),
      blocks,
      msg, h('div', { class: 'actspace' }),
      (() => {
        const grip = h('span', { class: 'actgrip', 'aria-label': 'Arrastra para mover', text: '⠿' });
        const bar = h('div', { class: 'actbar fab' }, grip, h('button', { class: 'btn ghost', type: 'button', onclick: () => { sfx('back'); go('rooms'); } }, '← Volver'), btn);
        let dx = 0, dy = 0, drag = false;
        grip.addEventListener('pointerdown', (e) => { e.preventDefault(); drag = true; const b = bar.getBoundingClientRect(); dx = e.clientX - b.left; dy = e.clientY - b.top; bar.style.right = 'auto'; bar.style.bottom = 'auto'; bar.style.left = b.left + 'px'; bar.style.top = b.top + 'px'; try { grip.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } });
        grip.addEventListener('pointermove', (e) => { if (!drag) return; const w = bar.offsetWidth, hh = bar.offsetHeight; bar.style.left = Math.max(4, Math.min(root.innerWidth - w - 4, e.clientX - dx)) + 'px'; bar.style.top = Math.max(4, Math.min(root.innerHeight - hh - 4, e.clientY - dy)) + 'px'; });
        const up = () => { drag = false; }; grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
        return bar;
      })()));
  };
  async function createRoom(c) {
    const p = St.profile();
    await N.ready();
    const cfg = { n: c.n, level: c.level, topics: Array.from(c.topics), secs: Math.max(15, Math.min(60, c.secs || 30)), hostPlays: !!c.hostPlays, mix: c.mix !== false, imp: c.imp === undefined ? 0 : c.imp, seed: Math.floor(Math.random() * 4294967295), v: 4 };
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
    const R = { cfg: null, state: null, players: {}, pos: {}, playersLoaded: false, hostOnline: true, votes: {}, sab: null };
    const my = { finished: false, report: null, rewarded: null, back: false, round: -1 };
    const subs = [], timers = [];
    let viewKey = '', left = false, offline = false, battle = null, questions = null, lastWrite = 0, writeT = 0, pending = null, lastRank = 0, renderT = 0, cdTimer = 0, plaza = null, refs = {};
    let waitEl = null, waitIdx = -1, waitKey = '';
    let usedEmg = false, lastMeetId = '', meetEl = null, meetIv = 0;
    let seg = null, fx = { speedUntil: 0 }, impCd = 0, lastCp = 0, voteOpen = false, lastSabId = '', announced = {}, cdTick = 0;
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
        if (my.round >= 0) { my.finished = false; my.report = null; my.rewarded = null; my.back = false; questions = null; seg = null; announced = {}; if (battle) { try { battle.destroy(); } catch (e) { /* ok */ } battle = null; clearOverlays(); sc.classList.remove('s-battle'); holder.hidden = true; box.hidden = false; K.setAmbient(true, 'room'); } if (prev && prev.phase === 'end' && s.phase === 'lobby') toast('¡El anfitrión abrió una nueva partida!', ''); }
        my.round = s.round || 0; viewKey = '';
      }
      if (seg) { if (waitEl) tryAdvance(); else if (battle && (s.seg || 0) > seg.i && s.phase === 'countdown') { const bs = battle.state || {}; segDone({ score: Math.round(bs.score || 0), correct: bs.correct || 0, answered: bs.answered || 0, mistakes: bs.mistakes || [], bestStreak: bs.bestStreak || 0 }); } }
      render(false);
    }));
    function onPlayers() {
      const ph = R.state && R.state.phase;
      if (waitEl) { buildWait(seg && seg.i >= seg.plan.length); tryAdvance(); return; }
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
      let firstAt = 0, allAt = 0, lastSeg = -1;
      timers.push(setInterval(() => {   // el anfitrión sincroniza: todos juegan el mismo juego a la vez
        const s = R.state; if (left || offline || !s || s.phase !== 'countdown' || !R.cfg) return;
        const cur = s.seg || 0, plan = segPlan(R.cfg).length;
        if (cur !== lastSeg) { lastSeg = cur; firstAt = 0; allAt = 0; }
        if (cur < plan && nowMs() - (s.t0 || nowMs()) > 3500) {
          const act = Object.keys(R.players).filter((id) => R.players[id].online !== false && !R.players[id].done), fin = act.filter((id) => (R.players[id].sd || 0) > cur), now = Date.now();
          let go2 = false;
          if (act.length && fin.length === act.length) {
            if (!allAt) allAt = now;
            const vs = (R.votes && R.votes[cur]) || {}, voted = act.filter((id) => vs[id] != null).length;
            go2 = nImps() ? (voted >= act.length || now - allAt > 28000) : now - allAt > 1500;
          } else if (fin.length) { if (!firstAt) firstAt = now; if (now - firstAt > 100000) go2 = true; }
          if (go2) { allAt = 0; firstAt = 0; lastSeg = cur + 1; N.update(P, { 'state/seg': cur + 1 }).catch(() => {}); }
        }
        const el = nowMs() - (s.t0 || nowMs()), list = Object.values(R.players);
        if (el > 12000 && list.length && list.every((x) => x.done || x.online === false)) hostEnd();
        else if (el > 20 * 60 * 1000) hostEnd();
      }, 1000));
    }
    function hostEnd() { const s = R.state; if (!s || s.phase === 'end') return; N.update(P, { state: { phase: 'end', t0: N.TS, round: round(), seg: s.seg || 0, imps: s.imps || null } }).catch(() => {}); }
    async function hostStart() {
      const n = Object.keys(R.players).length;
      if (!n) { toast('Aún no hay jugadores.', 'warn'); sfx('deny'); return; }
      const ids = Object.keys(R.players).filter((id) => R.players[id].online !== false), cfgImp = (R.cfg && R.cfg.imp) || 0, want = Math.min(cfgImp < 0 ? Math.max(1, Math.round(ids.length / 5)) : cfgImp, Math.floor((ids.length - 1) / 2)), imps = {};
      if (ids.length >= 3) { const pool = ids.slice(); for (let k = 0; k < want; k++) { const i = Math.floor(Math.random() * pool.length); imps[pool.splice(i, 1)[0]] = true; } }
      try { sfx('go'); await N.update(P, { state: { phase: 'countdown', t0: N.TS, round: round(), seg: 0, imps: Object.keys(imps).length ? imps : null }, votes: null, sab: null }); } catch (e) { toast(netErr(e), 'warn'); }
    }
    async function hostRematch() {
      const upd = {}; Object.keys(R.players).forEach((id) => { if (R.players[id].online === false) upd['players/' + id] = null; else { upd['players/' + id + '/score'] = 0; upd['players/' + id + '/correct'] = 0; upd['players/' + id + '/qi'] = 0; upd['players/' + id + '/done'] = false; upd['players/' + id + '/sd'] = 0; } });
      upd['cfg/seed'] = Math.floor(Math.random() * 4294967295); upd.state = { phase: 'lobby', t0: N.TS, round: round() + 1, seg: 0 };
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
    /* ----- 3 juegos seguidos + impostor ----- */
    const KIND_NAME = { shoot: '🎯 Disparo', run: '🏃 Carrera', maze: '👻 Laberinto Pac-Man' };
    const segPlan = (cfg) => {
      const n = cfg.n; if (cfg.mix === false) return [['shoot', n]];
      const b = Math.floor(n / 3), r = n % 3, cnt = [b + (r > 0 ? 1 : 0), b + (r > 1 ? 1 : 0), b];
      return [['shoot', cnt[0]], ['run', cnt[1]], ['maze', cnt[2]]].filter((x) => x[1] > 0);
    };
    const imps = () => (R.state && R.state.imps) || {};
    const amImp = () => !!imps()[pid];
    const nImps = () => Object.keys(imps()).length;
    // ¿quién ya fue descubierto? (se calcula igual en todos los celulares a partir de los votos)
    function expelledMap() {
      const out = {}, ids = Object.keys(imps()); if (!ids.length) return out;
      const crew = Math.max(1, Object.keys(R.players).length - ids.length), need = Math.max(2, Math.ceil(crew * 0.4)), hits = {};
      Object.values(R.votes || {}).forEach((cp) => Object.keys(cp || {}).forEach((voter) => { const t = cp[voter]; if (imps()[t] && !imps()[voter]) { hits[t] = hits[t] || {}; hits[t][voter] = 1; } }));
      ids.forEach((t) => { if (hits[t] && Object.keys(hits[t]).length >= need) out[t] = true; });
      return out;
    }
    const speedMul = () => (Date.now() < fx.speedUntil ? 1.45 : 1);
    function curTotals() {
      const bs = (battle && battle.state) || { score: 0, correct: 0, answered: 0, mistakes: [], bestStreak: 0 }, b = seg ? seg.base : { score: 0, correct: 0, answered: 0 }, a = seg ? seg.agg : { mistakes: [], bestStreak: 0 };
      return { score: b.score + Math.round(bs.score || 0), correct: b.correct + (bs.correct || 0), answered: b.answered + (bs.answered || 0), mistakes: a.mistakes.concat(bs.mistakes || []), bestStreak: Math.max(a.bestStreak, bs.bestStreak || 0) };
    }
    const adjScore = (d) => { if (battle && battle.state) battle.state.score = Math.max(0, (battle.state.score || 0) + d); else if (seg) seg.base.score = Math.max(0, seg.base.score + d); };
    const overlay = (cls, html, ms) => { const e = h('div', { class: 'rov ' + cls, html }); holder.appendChild(e); if (ms) setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 350); }, ms); return e; };
    const clearOverlays = () => { clearInterval(meetIv); meetEl = null; holder.querySelectorAll('.rov,.imp-ui').forEach((e) => e.remove()); holder.classList.remove('fog'); waitEl = null; waitIdx = -1; waitKey = ''; };
    function startBattle() {
      if (battle || my.finished || left || !R.cfg) return;
      killPlaza(); questions = buildRoomQuestions(R.cfg);
      K.setAmbient(false); sc.classList.add('s-battle'); box.hidden = true; holder.hidden = false; setBanner('');
      A.play('battle'); updateRank();
      seg = { plan: segPlan(R.cfg), i: 0, off: 0, base: { score: 0, correct: 0, answered: 0 }, agg: { mistakes: [], bestStreak: 0 } };
      fx = { speedUntil: 0 }; impCd = 0; lastCp = 0; voteOpen = false; announced = {}; lastSabId = ((R.sab && R.sab.id) || '');
      usedEmg = false; lastMeetId = ''; clearOverlays(); setupImpUI(); setupEmgUI();
      const first = () => startSeg();
      if (nImps() && playing()) roleCard(first); else first();
    }
    function startSeg() {
      if (left || my.finished || !seg) return;
      const [kind, count] = seg.plan[seg.i], off = seg.off, cfg = R.cfg;
      const bcfg = {
        container: holder, villain: roomVillain(cfg), tier: cfg.level || 2, look: p.look, perks: {}, noTutorial: true, lockSettings: true, fallSecs: cfg.secs || (cfg.more ? 40 : 30), extraTop: rankEl, speedMul,
        room: { total: count, getQuestion: (i) => questions[off + i], hp: sharedHp, noHearts: true },
        onProgress: (snap) => onSnap(snap),
        onEnd: (rep) => { setTimeout(() => segDone(rep), 0); },
        onQuit: () => { battle = null; root.__roomBattle = null; leaveGame(); },
      };
      const factory = kind === 'shoot' ? (c2) => B.start(c2) : kind === 'run' ? (c2) => G.startRun(c2) : (c2) => G.startMaze(c2);
      if (seg.plan.length > 1 && seg.i > 0) overlay('segban', '<b>' + KIND_NAME[kind] + '</b><small>Juego ' + (seg.i + 1) + ' de ' + seg.plan.length + '</small>', 1300);
      battle = G.withTutorial(bcfg, kind, factory);
      root.__roomBattle = battle;
    }
    function onSnap(snap) {
      if (!seg) return;
      pushProgress({ score: seg.base.score + snap.score, correct: seg.base.correct + snap.correct, qi: seg.base.answered + snap.qi, over: false }, snap.over);
    }
    function segDone(rep) {
      if (left || my.finished || !seg) return;
      const count = seg.plan[seg.i][1];
      seg.base.score += rep.score; seg.base.correct += rep.correct; seg.base.answered += Math.max(rep.answered, 0);
      seg.agg.mistakes = seg.agg.mistakes.concat(rep.mistakes || []); seg.agg.bestStreak = Math.max(seg.agg.bestStreak, rep.bestStreak || 0);
      seg.off += count; seg.i++;
      if (battle) { try { battle.destroy(); } catch (e) { /* ok */ } battle = null; root.__roomBattle = null; }
      enterWait();
    }
    function finalizeMine() {
      const t = seg.base; let score = t.score;
      if (amImp() && !expelledMap()[pid]) score += 150;
      finishMine({ score, correct: t.correct, answered: t.answered, bestStreak: seg.agg.bestStreak, mistakes: seg.agg.mistakes, heartsLost: 0 });
    }
    /* ----- sala de espera entre juegos + reunión de votación ----- */
    function enterWait() {
      const idx = seg.i - 1, last = seg.i >= seg.plan.length;
      pushProgress({ score: seg.base.score, correct: seg.base.correct, qi: seg.base.answered, over: true }, true);
      N.update(P + '/players/' + pid, { sd: seg.i }).catch(() => {});
      waitIdx = idx; waitKey = '';
      waitEl = overlay('meet', '', 0);
      buildWait(last);
      A.play('menu'); sfx('win');
      tryAdvance();
    }
    const activePlayers = () => Object.keys(R.players).filter((id) => R.players[id].online !== false && !R.players[id].done);
    function buildWait(last) {
      if (!waitEl || !seg) return;
      const idx = waitIdx, ids = Object.keys(R.players), others = ids.filter((id) => id !== pid);
      const key = ids.join(',') + '|' + last; if (key === waitKey) { updateWait(); return; } waitKey = key;
      const name = KIND_NAME[seg.plan[idx][0]] || 'Juego', myV = (R.votes && R.votes[idx] && R.votes[idx][pid]) || null;
      waitEl.innerHTML = '';
      const vote = (id) => { N.set(P + '/votes/' + idx + '/' + pid, id || '-').catch(() => {}); sfx(id ? 'select' : 'back'); R.votes = R.votes || {}; (R.votes[idx] = R.votes[idx] || {})[pid] = id || '-'; waitKey = ''; buildWait(last); };
      const grid = nImps() && playing() ? h('div', { class: 'vgrid' }, others.map((id) => h('button', { type: 'button', class: 'vopt' + (myV === id ? ' sel' : ''), onclick: () => vote(id) }, K.headThumb(R.players[id].look || {}, ''), h('b', { text: String(R.players[id].name || '?').slice(0, 10) })))) : null;
      waitEl.appendChild(h('div', { class: 'vbox' },
        h('small', { class: 'vt', text: last ? 'FIN DEL ÚLTIMO JUEGO' : 'JUEGO TERMINADO · ' + name }),
        h('h2', { text: nImps() && playing() ? '🚨 ¿Quién es el impostor?' : '¡Terminaste!' }),
        h('p', { class: 'vsub', text: nImps() && playing() ? 'Toca a quien creas que sabotea. Gana +100 si aciertas y −40 si fallas (se revela al terminar la reunión).' : 'Esperando a que todos terminen este juego…' }),
        grid,
        nImps() && playing() ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => vote(null) }, myV === '-' ? '✓ No voto (cambiar)' : 'No sé · no votar') : null,
        h('small', { class: 'vtimer meet-st', text: '' }),
        h('small', { class: 'vsub meet-next', text: last ? 'Después verás el podio.' : 'Sigue: ' + (KIND_NAME[seg.plan[seg.i][0]] || '') })));
      updateWait();
    }
    function updateWait() {
      if (!waitEl || !seg) return; const st2 = waitEl.querySelector('.meet-st'); if (!st2) return;
      const act = activePlayers(), done = act.filter((id) => (R.players[id].sd || 0) > waitIdx).length;
      st2.textContent = '✅ Terminaron ' + done + ' de ' + act.length + ' jugadores';
    }
    function tryAdvance() {
      if (!waitEl || waitIdx < 0 || !seg || waitEl.dataset.go) return;
      if (!R.state || (R.state.seg || 0) <= waitIdx) { updateWait(); return; }
      waitEl.dataset.go = '1'; const idx = waitIdx, last = seg.i >= seg.plan.length;
      // resultado de la reunión
      let html = '';
      if (nImps() && playing()) {
        const vs = (R.votes && R.votes[idx]) || {}, tally = {};
        Object.keys(vs).forEach((v) => { const t = vs[v]; if (t && t !== '-') tally[t] = (tally[t] || 0) + 1; });
        const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0], mine = vs[pid];
        if (mine && mine !== '-') { const ok = !!imps()[mine]; adjScore(ok ? +100 : -40); toast(ok ? '🎯 ¡Acertaste! ' + ((R.players[mine] || {}).name || '') + ' ES impostor (+100)' : '❌ ' + ((R.players[mine] || {}).name || '') + ' es inocente (−40)', ok ? 'ach' : 'warn'); }
        html = top ? '<b>Más votado: ' + esc2((R.players[top] || {}).name || '?') + ' (' + tally[top] + ')</b><small>' + (imps()[top] ? '¡Era IMPOSTOR!' : 'No era impostor…') + '</small>' : '<b>Nadie votó</b><small>El impostor sigue libre…</small>';
      }
      const next = () => { if (!seg || left || my.finished) return; waitEl && waitEl.remove(); waitEl = null; waitIdx = -1; waitKey = ''; if (seg.i < seg.plan.length) startSeg(); else finalizeMine(); };
      if (html) { waitEl.innerHTML = '<div class="vbox"><small class="vt">RESULTADO DE LA REUNIÓN</small><h2>🗳️</h2>' + html.replace('<b>', '<b class="vres">') + '</div>'; later(next, 2600); } else next();
    }
    const esc2 = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function finishMine(rep, quit) {
      if (my.finished || left) return; my.finished = true; my.report = rep;
      if (battle) { try { battle.destroy(); } catch (e) { /* ok */ } battle = null; }
      clearOverlays(); seg = null;
      sc.classList.remove('s-battle'); holder.hidden = true; box.hidden = false; K.setAmbient(true, 'room'); A.play('menu');
      const upd = { done: true, finishedAt: N.TS }; if (rep) { upd.score = rep.score; upd.correct = rep.correct; upd.qi = rep.answered; }
      if (quit) upd.online = false;
      clearTimeout(writeT); pending = null;
      N.update(P + '/players/' + pid, upd).catch(() => {});
      viewKey = ''; render(true);
    }

    /* ----- impostor: rol, sabotajes y votaciones ----- */
    function roleCard(done) {
      const imp = amImp(), n = nImps();
      const e = overlay('rolecard ' + (imp ? 'imp' : 'crew'), imp
        ? '<div class="rc-ico">🕵️</div><h2>¡ERES EL IMPOSTOR!</h2><p>Juega normal para que no sospechen y usa tu botón <b>🕵️ Sabotaje</b>: turbo a los demás, niebla o robar puntos. Si te descubren, pierdes tus poderes.</p><small>No se lo digas a nadie 🤫</small>'
        : '<div class="rc-ico">🧑‍🚀</div><h2>Eres TRIPULANTE</h2><p>Entre ustedes hay <b>' + n + ' impostor' + (n > 1 ? 'es' : '') + '</b>. Responde bien y, cada 3 preguntas, vota quién crees que es. ¡Acertar da +100!</p><small>Si ves cosas raras (turbo, niebla, puntos que se van)… es sabotaje.</small>');
      e.addEventListener('click', () => { e.remove(); done(); }, { once: true });
      sfx(imp ? 'boom' : 'select');
      const t = setTimeout(() => { if (e.parentNode) { e.remove(); done(); } }, 4200); timers.push(t);
    }
    function setupImpUI() {
      if (!nImps() || !playing()) return;
      const imp = amImp();
      const tag = h('div', { class: 'imp-ui imp-tag ' + (imp ? 'imp' : 'crew'), text: imp ? '🕵️ IMPOSTOR' : '🧑‍🚀 Tripulante' });
      holder.appendChild(tag);
      if (!imp) return;
      const btn = h('button', { type: 'button', class: 'imp-ui imp-btn', 'aria-label': 'Sabotaje' }, h('span', { class: 'ib-i', text: '🕵️' }), h('small', { text: 'Sabotaje' }), h('i', { class: 'ib-cd' }));
      const menu = h('div', { class: 'imp-ui imp-menu', hidden: true },
        [['turbo', '⏩', 'Turbo', 'Todo va más rápido 8 s'], ['fog', '🌫️', 'Niebla', 'No ven bien 6 s'], ['steal', '💸', 'Robo', '−60 pts a cada uno, +50 para ti']].map(([k, ico, nm, ds]) => h('button', { type: 'button', class: 'imp-opt', onclick: () => { menu.hidden = true; doSabotage(k); } }, h('b', { text: ico + ' ' + nm }), h('small', { text: ds }))));
      btn.addEventListener('click', () => { if (expelledMap()[pid]) { toast('Te descubrieron: sin poderes.', 'warn'); return; } if (Date.now() < impCd) { sfx('deny'); return; } sfx('click'); menu.hidden = !menu.hidden; });
      holder.appendChild(btn); holder.appendChild(menu);
      cdTick = setInterval(() => { const left2 = Math.max(0, impCd - Date.now()), dead = !!expelledMap()[pid]; btn.classList.toggle('cd', left2 > 0 || dead); btn.classList.toggle('dead', dead); btn.querySelector('.ib-cd').style.setProperty('--p', dead ? 1 : left2 / 22000); }, 250); timers.push(cdTick);
    }
    /* ----- reunión de emergencia (como Among Us): la convoca cualquiera y se aplica a TODOS, aunque estén a mitad de un juego ----- */
    const MEET_SECS = 22;
    function setupEmgUI() {
      if (!nImps() || !playing()) return;
      const b = h('button', { type: 'button', class: 'imp-ui emg-btn', 'aria-label': 'Reunión de emergencia' }, h('span', { class: 'ib-i', text: '🚨' }), h('small', { text: 'Reunión' }));
      b.addEventListener('click', () => {
        if (usedEmg) { toast('Ya usaste tu reunión de emergencia.', 'warn'); sfx('deny'); return; }
        if (meetEl || waitEl || (R.meet && N.now() - (R.meet.t || 0) < (MEET_SECS + 6) * 1000)) { toast('Ya hay una reunión en curso.', 'warn'); sfx('deny'); return; }
        usedEmg = true; b.classList.add('cd'); const m = { id: Math.random().toString(36).slice(2, 8), by: pid, t: N.now() };
        N.set(P + '/meet', m).catch(() => {}); sfx('boom'); onMeet(m);
      });
      holder.appendChild(b);
    }
    function onMeet(v) {
      R.meet = v; if (!v || v.id === lastMeetId || left || my.finished || !seg || meetEl) return;
      if (!nImps() || !playing()) return;
      const remain = (v.t || 0) + MEET_SECS * 1000 - N.now(); if (remain < 3000) return;   // ya terminó
      lastMeetId = v.id; if (waitEl) { /* ya estás en sala de espera/votación: se mantiene */ }
      const st0 = battle && battle.state; if (st0) st0.paused = true;
      const key = 'e' + v.id, caller = (R.players[v.by] && R.players[v.by].name) || 'Alguien';
      const others = Object.keys(R.players).filter((id) => id !== pid && R.players[id].online !== false && !R.players[id].done);
      let myV = null, resolved = false;
      meetEl = h('div', { class: 'rov vote emg' });
      holder.appendChild(meetEl); sfx('boom'); try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) { /* ok */ }
      const render = () => {
        if (!meetEl || resolved) return; const secs = Math.max(0, Math.ceil(((v.t || 0) + MEET_SECS * 1000 - N.now()) / 1000));
        const vs = (R.votes && R.votes[key]) || {}, act = Object.keys(R.players).filter((id) => R.players[id].online !== false && !R.players[id].done);
        const tick = meetEl.querySelector('.vtimer');
        if (tick && meetEl.dataset.built) { tick.textContent = '⏱ ' + secs + ' s · votaron ' + act.filter((id) => vs[id]).length + ' de ' + act.length; return; }
        meetEl.dataset.built = '1'; meetEl.innerHTML = '';
        meetEl.appendChild(h('div', { class: 'vbox emgbox' }, h('small', { class: 'vt', text: '🚨 REUNIÓN DE EMERGENCIA' }), h('h2', { text: caller + (v.by === pid ? ' (tú)' : '') + ' convocó una reunión' }),
          h('p', { class: 'vsub', text: 'El juego está en pausa para todos. ¿Quién creen que es el impostor? Acertar da +100 y fallar −40.' }),
          h('div', { class: 'vgrid' }, others.map((id) => h('button', { type: 'button', class: 'vopt' + (myV === id ? ' sel' : ''), onclick: () => cast(id) }, K.headThumb(R.players[id].look || {}, ''), h('b', { text: String(R.players[id].name || '?').slice(0, 10) })))),
          h('button', { type: 'button', class: 'btn ghost small', onclick: () => cast('-') }, myV === '-' ? '✓ No voto (cambiar)' : 'No sé · no votar'),
          h('small', { class: 'vtimer', text: '' })));
        render();
      };
      const cast = (id) => { if (resolved) return; myV = id; sfx(id === '-' ? 'back' : 'select'); N.set(P + '/votes/' + key + '/' + pid, id).catch(() => {}); R.votes = R.votes || {}; (R.votes[key] = R.votes[key] || {})[pid] = id; if (meetEl) { delete meetEl.dataset.built; } render(); };
      const finish = () => {
        if (resolved) return; resolved = true; clearInterval(meetIv);
        const vs = (R.votes && R.votes[key]) || {}, tally = {}; Object.keys(vs).forEach((vv) => { const t = vs[vv]; if (t && t !== '-') tally[t] = (tally[t] || 0) + 1; });
        const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
        if (myV && myV !== '-' && !amImp()) { const ok = !!imps()[myV]; adjScore(ok ? +100 : -40); toast(ok ? '🎯 ¡Acertaste! ' + ((R.players[myV] || {}).name || '') + ' ES impostor (+100)' : '❌ ' + ((R.players[myV] || {}).name || '') + ' es inocente (−40)', ok ? 'ach' : 'warn'); }
        const html = top ? '<b class="vres">Más votado: ' + esc2((R.players[top] || {}).name || '?') + ' (' + tally[top] + ')</b><small>' + (imps()[top] ? '¡Era IMPOSTOR!' : 'No era impostor…') + '</small>' : '<b class="vres">Nadie votó</b><small>El impostor sigue libre…</small>';
        if (meetEl) meetEl.innerHTML = '<div class="vbox"><small class="vt">RESULTADO DE LA REUNIÓN</small><h2>🗳️</h2>' + html + '</div>';
        checkExpelled();
        later(() => { if (meetEl) { meetEl.remove(); meetEl = null; } const s1 = battle && battle.state; if (s1) s1.paused = false; }, 2600);
      };
      render();
      meetIv = setInterval(() => {
        if (resolved) return; const now = N.now(), end = (v.t || 0) + MEET_SECS * 1000, vs = (R.votes && R.votes[key]) || {}, act = Object.keys(R.players).filter((id) => R.players[id].online !== false && !R.players[id].done);
        render(); if (now >= end || (act.length && act.every((id) => vs[id]) && now > (v.t || 0) + 6000)) finish();
      }, 500); timers.push(meetIv);
    }
    subs.push(N.on(P + '/meet', onMeet));
    function doSabotage(k) {
      impCd = Date.now() + 22000; sfx('power');
      N.set(P + '/sab', { k, by: pid, id: Math.random().toString(36).slice(2, 8), t: N.now() }).catch(() => {});
      if (k === 'steal') { adjScore(+50); toast('💸 +50 puntos (robo)', ''); } else toast(k === 'turbo' ? '⏩ ¡Turbo enviado!' : '🌫️ ¡Niebla enviada!', '');
    }
    function onSab(v) {
      R.sab = v; if (!v || !battle || my.finished || v.id === lastSabId) return; lastSabId = v.id;
      if (v.by === pid || amImp() || N.now() - (v.t || 0) > 6000) return;
      const wrap = holder.querySelector('.bt'); if (wrap) { wrap.classList.remove('hurt'); void wrap.offsetWidth; wrap.classList.add('hurt'); }
      sfx('boom');
      if (v.k === 'turbo') { fx.speedUntil = Date.now() + 8000; toast('⚠️ ¡SABOTAJE! Todo va más rápido…', 'warn'); }
      else if (v.k === 'fog') { holder.classList.add('fog'); setTimeout(() => holder.classList.remove('fog'), 6000); toast('⚠️ ¡SABOTAJE! Niebla…', 'warn'); }
      else if (v.k === 'steal') { adjScore(-60); toast('⚠️ ¡SABOTAJE! −60 puntos', 'warn'); }
    }
    subs.push(N.on(P + '/sab', onSab));
    subs.push(N.on(P + '/votes', (v) => { R.votes = v || {}; checkExpelled(); if (waitEl) updateWait(); }));
    function checkExpelled() {
      const ex = expelledMap();
      Object.keys(ex).forEach((id) => { if (announced[id]) return; announced[id] = 1; const nm = (R.players[id] && R.players[id].name) || 'Alguien'; if (battle || box.hidden === false) toast('🚨 ¡' + nm + ' era IMPOSTOR y fue descubierto!', 'ach'); if (id === pid) toast('Te descubrieron: pierdes tus sabotajes.', 'warn'); });
    }
    function checkVote(answered) {
      if (!nImps() || !playing() || amImp() || voteOpen || !battle) return;
      const cp = Math.floor(answered / 3);
      if (cp > lastCp && answered < (R.cfg.n || 0)) { lastCp = cp; openVote(cp); }
      else if (amImp() && cp > lastCp) lastCp = cp;
    }
    function openVote(cp) {
      voteOpen = true; const st0 = battle && battle.state; if (st0) st0.paused = true;
      const others = Object.keys(R.players).filter((id) => id !== pid && R.players[id].online !== false);
      let secs = 15, done = false;
      const close = () => { if (done) return; done = true; clearInterval(iv); e.remove(); voteOpen = false; if (battle && battle.state) battle.state.paused = false; };
      const cast = (id) => {
        if (done) return; sfx(id ? 'select' : 'back');
        if (id) {
          N.set(P + '/votes/' + cp + '/' + pid, id).catch(() => {});
          const nm = R.players[id].name;
          if (imps()[id]) { adjScore(+100); toast('🎯 ¡Acertaste! ' + nm + ' ES impostor (+100)', 'ach'); sfx('win'); } else { adjScore(-40); toast('❌ ' + nm + ' es inocente (−40)', 'warn'); }
        }
        close();
      };
      const e = h('div', { class: 'rov vote' }, h('div', { class: 'vbox' }, h('small', { class: 'vt', text: 'VOTACIÓN ' + cp }), h('h2', { text: '¿Quién es el impostor?' }), h('p', { class: 'vsub', text: 'Piensa en quién sabotea: turbo, niebla o puntos que desaparecen.' }),
        h('div', { class: 'vgrid' }, others.map((id) => h('button', { type: 'button', class: 'vopt', onclick: () => cast(id) }, K.headThumb(R.players[id].look || {}, ''), h('b', { text: String(R.players[id].name).slice(0, 10) })))),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => cast(null) }, 'No sé · saltar'), h('small', { class: 'vtimer', text: secs + ' s' })));
      holder.appendChild(e);
      const iv = setInterval(() => { secs--; const t = e.querySelector('.vtimer'); if (t) t.textContent = secs + ' s'; if (secs <= 0) cast(null); }, 1000); timers.push(iv);
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
    function openSound() {
      const mp = h('div', { class: 'seg' });
      const now = () => { const q = St.settings(); return !q.music ? 'off' : q.musicStyle === 'calma' ? 'calma' : 'arcade'; };
      const draw = () => { mp.innerHTML = ''; [['arcade', 'Arcade'], ['calma', 'Calmada'], ['off', 'Sin música']].forEach(([id, label]) => mp.appendChild(h('button', { type: 'button', class: 'segb' + (now() === id ? ' on' : ''), onclick: () => { A.unlock(); if (id === 'off') St.setSetting('music', false); else { St.setSetting('musicStyle', id); St.setSetting('music', true); } draw(); } }, label))); };
      draw();
      modal({ title: 'Ajustes', body: h('div', { class: 'set-block' }, h('b', { text: 'Música' }), mp, switchRow('Efectos de sonido', '', () => St.settings().sfx, (v) => St.setSetting('sfx', v)), switchRow('Pantalla retro (CRT)', '', () => St.settings().crt, (v) => St.setSetting('crt', v))), buttons: [{ label: 'Listo' }] });
    }
    function openHostConfig() {
      const cfg0 = R.cfg || {}; const c = { n: cfg0.n || 8, level: cfg0.level || 0, topics: new Set(cfg0.topics || TOPICS.map((v) => v.topic)), secs: cfg0.secs || 30, hostPlays: cfg0.hostPlays !== false, mix: cfg0.mix !== false, imp: cfg0.imp || 0 };
      modal({ title: 'Configurar la sala', cls: 'hostcfg', body: h('div', { class: 'hostcfgbody' }, configBlocks(c), h('small', { class: 'hint', text: 'Solo tú ves esta configuración. Los cambios valen para la próxima partida.' })),
        buttons: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Guardar', cls: 'gold', onClick: () => {
          const upd = { n: c.n, level: c.level, topics: Array.from(c.topics), secs: Math.max(15, Math.min(60, c.secs || 30)), hostPlays: !!c.hostPlays, mix: c.mix !== false, imp: c.imp || 0 };
          N.update(P + '/cfg', upd).then(() => { toast('Configuración guardada', ''); sfx('buy'); }).catch((e) => toast(netErr(e), 'warn'));
          if (!!c.hostPlays !== (cfg0.hostPlays !== false)) { if (c.hostPlays) N.set(P + '/players/' + pid, { name: p.name, look: p.look, score: 0, correct: 0, qi: 0, done: false, online: true, joined: N.TS }).catch(() => {}); else N.remove(P + '/players/' + pid).catch(() => {}); }
        } }] });
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
      const lines = [`${cfg.n || '?'} preguntas`, cfg.level ? ['', 'fáciles', 'medias', 'difíciles'][cfg.level] : 'dificultad creciente'].concat([(cfg.secs || 30) + ' s por pregunta']);
      const plazaBox = h('div', { class: 'plazabox' });
      const emo = h('div', { class: 'emotes' }, root.DuiXPlaza.EMOTES.map((e) => h('button', { type: 'button', class: 'emo', 'aria-label': 'Emote ' + e, onclick: () => { sfx('click'); N.update(P + '/pos/' + pid, { e, et: N.TS }).catch(() => {}); if (e === '💃') sfx('levelup'); } }, e)).concat([h('button', { type: 'button', class: 'emo emo-wheel', 'aria-label': 'Rueda de emotes', onclick: () => { sfx('select'); K.emoteWheel((it) => { N.update(P + '/pos/' + pid, { e: 'dance:' + it.id, et: N.TS }).catch(() => {}); }); } }, '💃 Emotes')]));
      const plist = h('div', { class: 'plist' }), count = h('b', { class: 'pc', text: '0' });
      refs = { plist, count };
      const title = mode === 'lobby' ? (isHost ? 'Sala lista' : 'Estás dentro') : mode === 'live' ? (my.finished ? '¡Terminaste!' : 'Partida en curso') : '¡Fin de la partida!';
      const sub = mode === 'lobby' ? (isHost ? 'Los demás entran en DuiX → Salas con este código. ¡Mientras tanto, camina, baila y cámbiate de ropa!' : 'Espera a que el anfitrión empiece. ¡Camina por la plaza, haz emotes y cámbiate de ropa!') : mode === 'live' ? 'Espera a que terminen los demás mientras paseas por la plaza.' : (isHost ? 'Cuando todos estén en la plaza, abre una nueva partida.' : 'Espera a que el anfitrión abra una nueva partida.');
      const parts = [
        h('div', { class: 'rtop' }, h('button', { class: 'btn small ghost', type: 'button', onclick: () => confirmLeave() }, isHost ? 'Cerrar sala' : 'Salir'), mode === 'live' && isHost ? h('button', { class: 'btn small', type: 'button', onclick: () => { sfx('click'); hostEnd(); } }, 'Terminar ya ⏹') : null, h('button', { class: 'gear', type: 'button', 'aria-label': isHost ? 'Configurar la sala' : 'Ajustes de sonido', onclick: () => { sfx('select'); if (isHost && mode !== 'live') openHostConfig(); else openSound(); } }, '⚙')),
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
      const impIds = Object.keys(imps()), exm = expelledMap();
      const crewWon = impIds.length && impIds.every((id) => exm[id]);
      const reveal = impIds.length ? h('div', { class: 'imp-reveal' }, h('h3', { class: 'imp-win', text: crewWon ? '🎉 ¡Ganó la tripulación!' : '🕵️ ¡Ganaron los impostores!' }), h('b', { text: '🕵️ ' + (impIds.length > 1 ? 'Los impostores eran' : 'El impostor era') }),
        h('div', { class: 'ir-row' }, impIds.map((id) => { const x = R.players[id] || {}; return h('span', { class: 'ir-one' }, K.headThumb(x.look || {}, ''), h('b', { text: String(x.name || '???').slice(0, 10) }), h('small', { text: exm[id] ? '¡Descubierto!' : 'Escapó (+150)' })); }))) : null;
      box.appendChild(h('div', { class: 'rpanel end' }, h('h2', { class: 'rtitle', text: '¡Fin de la partida!' }), pod, reveal, reward, rk.length > 3 ? rest : null,
        h('button', { class: 'btn big', type: 'button', onclick: () => { sfx('select'); my.back = true; viewKey = ''; render(true); } }, '↩ Volver a la sala'),
        isHost ? h('button', { class: 'btn ghost', type: 'button', onclick: () => closeRoom() }, 'Cerrar sala') : h('button', { class: 'btn ghost', type: 'button', onclick: () => leave() }, 'Salir')));
    }

    function render(force) {
      const s = R.state; if (left || !s || !R.cfg) return;
      const ph = s.phase;
      if (ph === 'end') {
        if (battle) { if (!my.report) { const t = curTotals(); my.report = { mistakes: t.mistakes, bestStreak: t.bestStreak, score: t.score, correct: t.correct, answered: t.answered, heartsLost: 0 }; } try { battle.destroy(); } catch (e) { /* ok */ } battle = null; clearOverlays(); seg = null; sc.classList.remove('s-battle'); holder.hidden = true; box.hidden = false; K.setAmbient(true, 'room'); }
        clearInterval(cdTimer);
      }
      if (battle || waitEl) return; // el combate (o la reunión) manda
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
