/* DuiX — Salas multijugador (estilo Kahoot)
 * - El anfitrión crea la sala, publica las preguntas (SIN la respuesta correcta) y controla el ritmo.
 * - Cada jugador responde desde su celular; el anfitrión califica y publica el resultado de cada pregunta.
 * - Estados de la sala: lobby → (read → answer → reveal) × n preguntas → end
 */
(function (root) {
  'use strict';
  const D = root.DuiXData, S = root.DuiXSprites, A = root.DuiXAudio, St = root.DuiXStore, Q = root.DuiXQ, N = root.DuiXNet, U = root.DuiXUI;
  const K = U.kit, h = K.h, esc = K.esc, sfx = K.sfx, toast = K.toast, modal = K.modal, go = K.go, SCREENS = K.SCREENS;
  const TOPICS = D.VILLAINS.filter((v) => v.n <= 14);
  const COLORS = ['#ff7a59', '#ffd23f', '#5ce1e6', '#c58bff'], SHAPES = ['▲', '◆', '●', '■'];
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ', MAX_PLAYERS = 60;
  const LSK = 'duix.room', LSH = 'duix.hostsecret', LSR = 'duix.rewarded';
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ok */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ok */ } };
  const timing = (cfg) => ({ read: cfg.more ? 9000 : 4500, ans: Math.round(cfg.secs * 1000 * (cfg.more ? 1.5 : 1)), rev: cfg.more ? 10000 : 7000 });
  const newCode = () => { let c = ''; for (let i = 0; i < 4; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return c; };
  const linkFor = (code) => location.origin + location.pathname.replace(/index\.html$/, '') + '?sala=' + code + (N.mode === 'local' ? '&net=local' : '');
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const arr = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.keys(x).sort((a, b) => a - b).map((k) => x[k]) : []);
  const normT = (t) => (t ? { head: arr(t.head), rows: arr(t.rows).map(arr) } : null);
  const netErr = (e) => (e && e.message) || 'No se pudo conectar. Revisa tu internet.';

  function seg(opts, get, set) {
    const box = h('div', { class: 'seg', role: 'radiogroup' });
    const draw = () => { box.innerHTML = ''; opts.forEach(([v, label]) => box.appendChild(h('button', { type: 'button', class: 'segb' + (get() === v ? ' on' : ''), role: 'radio', 'aria-checked': get() === v ? 'true' : 'false', onclick: () => { set(v); sfx('click'); draw(); } }, label))); };
    draw(); return box;
  }
  function switchRow(label, desc, get, set) {
    return h('label', { class: 'set' }, h('div', null, h('b', { text: label }), desc ? h('small', { text: desc }) : null), h('input', { type: 'checkbox', checked: get() ? true : null, onchange: (e) => { set(e.target.checked); sfx('click'); } }), h('span', { class: 'sw2' }));
  }
  function questionTable(t) {
    if (!t) return null;
    const cells = (r) => arr(r).map((c, j) => (j ? '<td>' : '<th>') + esc(c) + (j ? '</td>' : '</th>')).join('');
    return h('div', { class: 'mtable', html: '<table><tr>' + arr(t.head).map((c, i) => (i ? '<td>' : '<th>') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>' + arr(t.rows).map((r) => '<tr>' + cells(r) + '</tr>').join('') + '</table>' });
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

  /* ============================================================
   * MENÚ DE SALAS
   * ============================================================ */
  SCREENS.rooms = (params, sc) => {
    const codeIn = h('input', { class: 'input code4', maxlength: '4', placeholder: 'CÓDIGO', 'aria-label': 'Código de la sala', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', value: (params.code || '').slice(0, 4) });
    codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
    const msg = h('p', { class: 'hint err', role: 'alert' });
    const resume = h('div', { class: 'resume', hidden: true });
    const joinBtn = h('button', { class: 'btn big', onclick: () => joinRoom(codeIn.value, msg, joinBtn) }, 'Entrar');
    codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBtn.click(); });
    sc.appendChild(h('div', { class: 'rooms' }, K.topbar(), h('h1', { class: 'h1', text: 'Salas' }),
      h('p', { class: 'hint', text: 'Juega en vivo con tus compañeros: todos ven la misma pregunta y gana quien acierte más rápido. Necesitas internet.' }),
      resume,
      h('div', { class: 'set-block roomcard' }, h('h3', { text: 'Unirme a una sala' }), h('div', { class: 'joinrow' }, codeIn, joinBtn), msg),
      h('div', { class: 'set-block roomcard' }, h('h3', { text: 'Crear una sala' }), h('p', { class: 'hint', text: 'Tú eliges las preguntas, el tiempo y la dificultad. Los demás entran con un código o un QR.' }), h('button', { class: 'btn', onclick: () => { sfx('select'); go('roomCreate'); } }, 'Crear sala'))));
    if (params.code && params.code.length === 4) later(() => joinBtn.click(), 300);
    // ¿hay una sala en curso de la que volver?
    const sess = lsGet(LSK);
    if (sess && sess.code) {
      N.ready().then(() => N.get('rooms/' + sess.code + '/state')).then((s) => {
        if (!s) { lsDel(LSK); return; }
        resume.hidden = false; resume.appendChild(h('div', { class: 'set-block roomcard' }, h('h3', { text: 'Tienes una sala abierta: ' + sess.code }), h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => go('room', { code: sess.code, role: sess.role }) }, 'Volver a la sala'),
          h('button', { class: 'btn small ghost', onclick: () => { lsDel(LSK); resume.hidden = true; } }, 'Olvidar'))));
      }).catch(() => {});
    }
  };
  const later = K.later;

  async function joinRoom(raw, msg, btn) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
    msg.textContent = '';
    if (code.length !== 4) { msg.textContent = 'El código tiene 4 letras.'; sfx('deny'); return; }
    const p = St.profile(); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Conectando…';
    try {
      await N.ready();
      const [state, cfg, players] = await Promise.all([N.get('rooms/' + code + '/state'), N.get('rooms/' + code + '/cfg'), N.get('rooms/' + code + '/players')]);
      if (!state || !cfg) { msg.textContent = 'No encontré esa sala. Revisa el código.'; sfx('deny'); return; }
      const mine = players && players[p.id];
      if (!mine && state.phase !== 'lobby') { msg.textContent = 'Esa partida ya empezó. Espera a la siguiente.'; sfx('deny'); return; }
      if (!mine && players && Object.keys(players).length >= MAX_PLAYERS) { msg.textContent = 'La sala está llena.'; sfx('deny'); return; }
      if (!mine) await N.set('rooms/' + code + '/players/' + p.id, { name: p.name, look: p.look, score: 0, streak: 0, correct: 0, answered: 0, online: true, joined: N.TS });
      lsSet(LSK, { code, role: 'player', pid: p.id });
      sfx('select'); go('room', { code, role: 'player' });
    } catch (e) { msg.textContent = netErr(e); sfx('deny'); } finally { btn.disabled = false; btn.textContent = old; }
  }

  /* ============================================================
   * CREAR SALA
   * ============================================================ */
  SCREENS.roomCreate = (_, sc) => {
    const c = { n: 10, level: 0, topics: new Set(TOPICS.map((v) => v.topic)), secs: 20, more: false, hostPlays: true };
    const chips = h('div', { class: 'tchips' });
    const drawChips = () => { chips.innerHTML = ''; TOPICS.forEach((v) => chips.appendChild(h('button', { type: 'button', class: 'tchip' + (c.topics.has(v.topic) ? ' on' : ''), 'aria-pressed': c.topics.has(v.topic) ? 'true' : 'false', onclick: () => { if (c.topics.has(v.topic)) { if (c.topics.size > 1) c.topics.delete(v.topic); else { toast('Deja al menos un tema.', 'warn'); return; } } else c.topics.add(v.topic); sfx('click'); drawChips(); } }, v.tema))); };
    drawChips();
    const msg = h('p', { class: 'hint err', role: 'alert' }), btn = h('button', { class: 'btn big' }, 'Crear sala');
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Creando…'; msg.textContent = '';
      try { await createRoom(c); } catch (e) { msg.textContent = netErr(e); sfx('deny'); btn.disabled = false; btn.textContent = 'Crear sala'; }
    });
    sc.appendChild(h('div', { class: 'rooms' }, K.topbar(), h('h1', { class: 'h1', text: 'Nueva sala' }),
      h('div', { class: 'set-block' }, h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Número de preguntas' })), seg([[5, '5'], [10, '10'], [15, '15'], [20, '20']], () => c.n, (v) => { c.n = v; })),
        h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Dificultad' }), h('small', { text: '“Creciente” empieza fácil y termina difícil.' })), seg([[1, 'Fácil'], [2, 'Media'], [3, 'Difícil'], [0, 'Creciente']], () => c.level, (v) => { c.level = v; })),
        h('div', { class: 'set col' }, h('div', null, h('b', { text: 'Tiempo por pregunta' })), seg([[15, '15 s'], [20, '20 s'], [30, '30 s'], [45, '45 s']], () => c.secs, (v) => { c.secs = v; }))),
      h('div', { class: 'set-block' }, h('h3', { text: 'Temas' }), h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: () => { TOPICS.forEach((v) => c.topics.add(v.topic)); sfx('click'); drawChips(); } }, 'Todos')), chips),
      h('div', { class: 'set-block' }, switchRow('Más tiempo para leer', 'Más segundos para leer y para responder (para todos)', () => c.more, (v) => { c.more = v; }),
        switchRow('Yo también juego', 'Apágalo si solo vas a proyectar la pantalla', () => c.hostPlays, (v) => { c.hostPlays = v; })),
      msg, btn, h('button', { class: 'btn ghost', onclick: () => { sfx('back'); go('rooms'); } }, 'Volver')));
  };

  function buildQuestions(cfg) {
    const order = shuffle(cfg.topics), qs = [], seen = new Set();
    for (let i = 0; i < cfg.n; i++) {
      const topic = order[i % order.length], level = cfg.level || Math.min(3, Math.floor(i * 3 / cfg.n) + 1);
      let q = null;
      for (let t = 0; t < 6 && !q; t++) { try { const x = Q.generate(topic, level); if (!seen.has(x.text)) q = x; } catch (e) { q = null; } }
      if (!q) q = Q.generate('fracciones', 1, { noRecent: true });
      seen.add(q.text); q.topic = topic; qs.push(q);
    }
    return qs;
  }
  async function createRoom(c) {
    const p = St.profile();
    await N.ready();
    const cfg = { n: c.n, level: c.level, topics: Array.from(c.topics), secs: c.secs, more: !!c.more, hostPlays: !!c.hostPlays, v: 1 };
    const qs = buildQuestions(cfg);
    let code = '', ok = false;
    for (let i = 0; i < 10 && !ok; i++) { code = newCode(); ok = (await N.get('rooms/' + code + '/state')) === null; }
    if (!ok) throw new Error('No se pudo crear un código libre. Inténtalo otra vez.');
    const pub = {}; qs.forEach((q, i) => { pub[i] = { topic: q.topic, text: q.text, options: q.options }; if (q.table) pub[i].table = q.table; });
    const room = { host: p.id, hostName: p.name, hostOnline: true, created: N.TS, cfg, state: { phase: 'lobby', qi: 0, t0: N.TS }, questions: pub };
    if (cfg.hostPlays) room.players = { [p.id]: { name: p.name, look: p.look, score: 0, streak: 0, correct: 0, answered: 0, online: true, joined: N.TS } };
    await N.set('rooms/' + code, room);
    lsSet(LSH, { code, qs: qs.map((q) => ({ correct: q.correct, explain: q.explain })) });
    lsSet(LSK, { code, role: 'host', pid: p.id });
    sfx('select'); go('room', { code, role: 'host' });
  }

  /* ============================================================
   * SALA (lobby + partida + podio)
   * ============================================================ */
  SCREENS.room = (params, sc) => {
    const code = params.code, role = params.role, p = St.profile(), pid = p.id, isHost = role === 'host';
    const P = 'rooms/' + code;
    const R = { cfg: null, state: null, players: {}, questions: null, reveal: null, answerCount: 0, hostOnline: true };
    const secret = isHost ? lsGet(LSH) : null;
    const secrets = secret && secret.code === code ? secret.qs : null;
    const my = { qi: -1, choice: -1, locked: false, mistakes: [], streakBest: 0, logged: {}, rewarded: null };
    const subs = [], timers = [];
    let viewKey = '', revSub = null, ansSub = null, revFor = -1, ansFor = -1, doing = '', left = false, offline = false;
    const box = h('div', { class: 'room' });
    const banner = h('div', { class: 'rbanner', hidden: true });
    sc.appendChild(h('div', { class: 'roomwrap' }, banner, box));
    A.play('menu');

    const stop = () => { left = true; subs.forEach((f) => { try { f(); } catch (e) { /* ok */ } }); if (revSub) revSub(); if (ansSub) ansSub(); timers.forEach(clearInterval); };
    K.onLeave(stop);

    const playing = () => !isHost || (R.cfg && R.cfg.hostPlays);
    const nowMs = () => N.now();
    const myP = () => R.players[pid] || null;
    const ranking = () => Object.keys(R.players).map((id) => Object.assign({ id }, R.players[id])).sort((a, b) => (b.score - a.score) || (b.correct - a.correct) || String(a.name).localeCompare(String(b.name)));
    const setBanner = (t) => { banner.hidden = !t; banner.textContent = t || ''; };

    /* ----- conexión ----- */
    function announce() {
      if (playing()) { N.set(P + '/players/' + pid + '/online', true).catch(() => {}); N.onDisconnect(P + '/players/' + pid + '/online', false).catch(() => {}); }
      if (isHost) { N.set(P + '/hostOnline', true).catch(() => {}); N.onDisconnect(P + '/hostOnline', false).catch(() => {}); }
    }
    subs.push(N.onConnection((on) => { offline = !on; if (on) { announce(); if (!R.hostOnline && !isHost) setBanner('El anfitrión perdió la conexión. Espera…'); else setBanner(''); } else setBanner('Sin conexión… reconectando'); }));

    /* ----- suscripciones ----- */
    N.get(P + '/cfg').then((cfg) => { R.cfg = cfg; render(true); });
    subs.push(N.on(P + '/questions', (v) => { R.questions = v; if (v && ['read', 'answer', 'reveal'].includes(R.state && R.state.phase)) render(true); }));
    subs.push(N.on(P + '/players', (v) => { R.players = v || {}; onPlayers(); }));
    subs.push(N.on(P + '/hostOnline', (v) => { R.hostOnline = v !== false; if (!isHost) setBanner(!R.hostOnline && R.state && R.state.phase !== 'end' ? 'El anfitrión perdió la conexión. Espera…' : ''); }));
    subs.push(N.on(P + '/state', (s) => {
      if (s === null) { if (R.state && R.state.phase === 'end') return; showClosed(); return; }
      R.state = s;
      if (s.phase !== 'lobby') { subReveal(s.qi); if (isHost) subAnswers(s.qi); }
      render(false);
    }));
    function subReveal(qi) { if (revFor === qi) return; if (revSub) revSub(); revFor = qi; R.reveal = null; revSub = N.on(P + '/reveal/' + qi, (v) => { R.reveal = v; if (R.state && R.state.phase === 'reveal') render(true); }); }
    function subAnswers(qi) { if (ansFor === qi) return; if (ansSub) ansSub(); ansFor = qi; R.answerCount = 0; ansSub = N.on(P + '/answers/' + qi, (v) => { R.answerCount = v ? Object.keys(v).length : 0; updateLive(); }); }

    function onPlayers() {
      const ph = R.state && R.state.phase;
      if (ph === 'lobby' || ph === 'reveal' || ph === 'end') render(true); else updateLive();
    }
    function showClosed() {
      stop(); lsDel(LSK); if (isHost) lsDel(LSH);
      box.innerHTML = ''; box.appendChild(h('div', { class: 'rpanel' }, h('h2', { class: 'rtitle', text: 'La sala se cerró' }), h('p', { class: 'hint', text: 'El anfitrión cerró la sala o ya no existe.' }), h('button', { class: 'btn big', onclick: () => go('rooms') }, 'Volver a Salas')));
    }

    /* ----- ritmo (solo el anfitrión) ----- */
    const writeState = (extra, state) => N.update(P, Object.assign({ state }, extra || {}));
    async function hostAdvance(force) {
      const s = R.state, cfg = R.cfg; if (!s || !cfg || s.phase === 'lobby' || s.phase === 'end') return;
      const t = timing(cfg), el = nowMs() - (s.t0 || nowMs()), cur = s.phase + ':' + s.qi;
      if (doing === cur) return;
      const online = Object.values(R.players).filter((x) => x.online !== false).length;
      try {
        if (s.phase === 'read' && (force || el >= t.read)) { doing = cur; await writeState(null, { phase: 'answer', qi: s.qi, t0: N.TS }); }
        else if (s.phase === 'answer' && (force || el >= t.ans + 400 || (online > 0 && R.answerCount >= online && el > 1500))) { doing = cur; await hostReveal(t); }
        else if (s.phase === 'reveal' && (force || el >= t.rev)) { doing = cur; if (s.qi + 1 < cfg.n) await writeState(null, { phase: 'read', qi: s.qi + 1, t0: N.TS }); else await writeState(null, { phase: 'end', qi: s.qi, t0: N.TS }); }
      } catch (e) { doing = ''; }
    }
    async function hostReveal(t) {
      const s = R.state, qi = s.qi, sec = secrets && secrets[qi];
      if (!sec) throw new Error('sin respuestas');
      const answers = (await N.get(P + '/answers/' + qi)) || {};
      const upd = {}, res = {}, dist = [0, 0, 0, 0], t0 = s.t0 || 0;
      Object.keys(R.players).forEach((id) => {
        const pl = R.players[id], a = answers[id];
        let ms = a && typeof a.at === 'number' ? Math.max(0, a.at - t0) : 0, valid = a && typeof a.c === 'number' && a.c >= 0 && a.c < 4 && ms <= t.ans + 2500;
        if (valid) dist[a.c]++;
        const ok = !!valid && a.c === sec.correct; ms = Math.min(ms, t.ans);
        const pts = ok ? 600 + Math.round(400 * (1 - ms / t.ans)) + Math.min(pl.streak || 0, 5) * 30 : 0;
        res[id] = { c: valid ? a.c : -1, ok, pts };
        upd['players/' + id + '/score'] = (pl.score || 0) + pts; upd['players/' + id + '/streak'] = ok ? (pl.streak || 0) + 1 : 0;
        upd['players/' + id + '/correct'] = (pl.correct || 0) + (ok ? 1 : 0); upd['players/' + id + '/answered'] = (pl.answered || 0) + 1;
      });
      upd['reveal/' + qi] = { correct: sec.correct, explain: sec.explain || '', dist, res };
      upd.state = { phase: 'reveal', qi, t0: N.TS };
      await N.update(P, upd);
    }
    if (isHost) {
      if (!secrets) setBanner('Perdí las respuestas de esta sala (se borraron los datos del navegador). Crea una sala nueva.');
      timers.push(setInterval(() => { if (!left && !offline) hostAdvance(false); }, 300));
    }
    async function hostStart() {
      const n = Object.keys(R.players).length;
      if (!n) { toast('Aún no hay jugadores.', 'warn'); sfx('deny'); return; }
      if (!secrets) { toast('No tengo las respuestas de esta sala. Crea una nueva.', 'warn'); sfx('deny'); return; }
      try { sfx('go'); A.play('battle'); await writeState(null, { phase: 'read', qi: 0, t0: N.TS }); } catch (e) { toast(netErr(e), 'warn'); }
    }

    /* ----- respuesta del jugador ----- */
    function answer(i) {
      const s = R.state; if (!s || s.phase !== 'answer' || my.locked || !playing()) return;
      my.locked = true; my.choice = i; my.qi = s.qi; sfx('select');
      N.set(P + '/answers/' + s.qi + '/' + pid, { c: i, at: N.TS }).catch(() => { my.locked = false; toast('No se envió. Toca otra vez.', 'warn'); render(true); });
      render(true);
    }

    /* ----- vistas ----- */
    const qOf = (i) => { const q = R.questions && R.questions[i]; return q ? Object.assign({}, q, { options: arr(q.options) }) : null; };
    const topicName = (q) => { const v = TOPICS.find((x) => x.topic === q.topic); return v ? v.tema : ''; };
    function timerBar() { return h('div', { class: 'rq-timer' }, h('div', { class: 'rq-bar' }, h('i')), h('b', { class: 'rq-sec' })); }
    function optionsEl(q, mode, rv) {
      const wrap = h('div', { class: 'ropts' + (mode === 'dim' ? ' dim' : '') });
      arr(q.options).forEach((o, i) => {
        let cls = 'ropt', extra = null;
        if (mode === 'locked' && my.choice === i) cls += ' picked';
        if (mode === 'locked' && my.choice !== i) cls += ' faded';
        if (mode === 'reveal' && rv) {
          if (i === rv.correct) cls += ' good'; else if (rv.mine && rv.mine.c === i) cls += ' bad'; else cls += ' faded';
          extra = h('span', { class: 'rdist', text: String(arr(rv.dist)[i] || 0) });
        }
        wrap.appendChild(h('button', { type: 'button', class: cls, style: '--oc:' + COLORS[i], disabled: mode === 'live' ? null : true, onclick: mode === 'live' ? () => answer(i) : null, 'aria-label': 'Opción ' + (i + 1) + ': ' + o },
          h('span', { class: 'rshape', text: SHAPES[i] }), h('span', { class: 'rtxt', text: o }), extra, mode === 'reveal' && rv && i === rv.correct ? h('span', { class: 'rmark', text: '✔' }) : mode === 'reveal' && rv && rv.mine && rv.mine.c === i && i !== rv.correct ? h('span', { class: 'rmark', text: '✖' }) : null));
      });
      return wrap;
    }
    function board(limit, highlightMe) {
      const rk = ranking(), rows = rk.slice(0, limit), me = rk.findIndex((x) => x.id === pid);
      const el = h('ol', { class: 'rboard' });
      const row = (x, i) => h('li', { class: 'rrow' + (x.id === pid ? ' me' : '') }, h('span', { class: 'rpos', text: String(i + 1) }), K.headThumb(x.look || {}, 'rh'), h('b', { class: 'rname', text: x.name }), h('span', { class: 'rscore', text: String(x.score || 0) }));
      rows.forEach((x, i) => el.appendChild(row(x, i)));
      if (highlightMe && me >= limit) { el.appendChild(h('li', { class: 'rgap', text: '…' })); el.appendChild(row(rk[me], me)); }
      return el;
    }
    function hostStrip() {
      if (!isHost) return null;
      const s = R.state;
      return h('div', { class: 'hoststrip' }, h('span', { class: 'hcount' }, '👥 ', h('b', { class: 'hc', text: String(Object.keys(R.players).length) })),
        s && s.phase === 'answer' ? h('span', { class: 'hans' }, '✍️ ', h('b', { class: 'ha', text: R.answerCount + '/' + Object.values(R.players).filter((x) => x.online !== false).length })) : null,
        s && ['read', 'answer', 'reveal'].includes(s.phase) ? h('button', { class: 'btn small', onclick: () => { sfx('click'); hostAdvance(true); } }, 'Saltar ▶') : null,
        h('button', { class: 'btn small ghost', onclick: () => confirmLeave() }, 'Cerrar'));
    }
    function confirmLeave() {
      const ph = R.state && R.state.phase;
      if (isHost) modal({ title: '¿Cerrar la sala?', body: h('p', { text: 'La partida termina para todos.' }), buttons: [{ label: 'Seguir', cls: 'ghost' }, { label: 'Cerrar sala', cls: 'danger', onClick: () => closeRoom() }] });
      else if (ph === 'lobby' || ph === 'end') leave();
      else modal({ title: '¿Salir de la partida?', body: h('p', { text: 'Perderás tu lugar en el ranking.' }), buttons: [{ label: 'Seguir jugando', cls: 'ghost' }, { label: 'Salir', cls: 'danger', onClick: () => leave() }] });
    }
    async function closeRoom() { try { await N.remove(P); } catch (e) { /* ok */ } lsDel(LSK); lsDel(LSH); stop(); go('rooms'); }
    async function leave() {
      const ph = R.state && R.state.phase;
      try { if (playing() && ph === 'lobby') await N.remove(P + '/players/' + pid); else if (playing()) await N.set(P + '/players/' + pid + '/online', false); } catch (e) { /* ok */ }
      lsDel(LSK); stop(); go('rooms');
    }

    function viewLobby() {
      const pls = ranking().sort((a, b) => (a.joined || 0) - (b.joined || 0)), link = linkFor(code);
      const list = h('div', { class: 'plist' }, pls.map((x) => h('div', { class: 'pchip' + (x.id === pid ? ' me' : '') }, K.headThumb(x.look || {}, 'rh'), h('b', { text: x.name }))));
      if (!pls.length) list.appendChild(h('p', { class: 'hint', text: 'Esperando jugadores…' }));
      const cfg = R.cfg || {};
      const lines = [`${cfg.n || '?'} preguntas`, cfg.level ? ['', 'fáciles', 'medias', 'difíciles'][cfg.level] : 'dificultad creciente', `${cfg.secs || '?'} s por pregunta`].concat(cfg.more ? ['más tiempo para leer'] : []);
      box.appendChild(h('div', { class: 'rpanel lobby' }, h('div', { class: 'rtop' }, h('button', { class: 'btn small ghost', onclick: () => confirmLeave() }, isHost ? 'Cerrar sala' : 'Salir')),
        h('p', { class: 'hint', text: isHost ? 'Los demás entran en DuiX → Salas con este código:' : 'Estás dentro. Espera a que el anfitrión empiece.' }),
        h('div', { class: 'bigcode', 'aria-label': 'Código de la sala ' + code.split('').join(' ') }, code.split('').map((c) => h('span', { text: c }))),
        isHost ? h('div', { class: 'qrbox' }, drawQR(link, 176), h('button', { class: 'btn small ghost', onclick: () => { if (navigator.share) navigator.share({ title: 'DuiX', text: 'Entra a mi sala de DuiX', url: link }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast('Enlace copiado.', ''), () => toast(link, '')); else toast(link, ''); } }, 'Compartir enlace')) : null,
        h('p', { class: 'cfgline', text: lines.join(' · ') }),
        h('h3', { class: 'rsub' }, 'Jugadores (', h('b', { class: 'pc', text: String(pls.length) }), ')'), list,
        isHost ? h('button', { class: 'btn big', onclick: hostStart }, 'Empezar partida') : null));
    }
    function viewQuestion(phase) {
      const s = R.state, q = qOf(s.qi); if (!q || !R.cfg) { box.appendChild(h('div', { class: 'rpanel' }, h('p', { class: 'hint', text: 'Cargando pregunta…' }))); return; }
      const head = h('div', { class: 'rq-head' }, h('span', { class: 'rq-n', text: `Pregunta ${s.qi + 1}/${R.cfg.n}` }), h('span', { class: 'rq-topic', text: topicName(q) }));
      const qbox = h('div', { class: 'rq-box' }, h('div', { class: 'rq-text', text: q.text }), questionTable(q.table));
      const strip = hostStrip();
      if (phase === 'read') {
        box.appendChild(h('div', { class: 'rpanel play' }, strip, head, qbox, h('p', { class: 'rq-msg', text: playing() ? 'Lee con calma… las respuestas se abren enseguida.' : 'Los jugadores están leyendo…' }), timerBar(), optionsEl(q, 'dim')));
      } else if (phase === 'answer') {
        if (my.qi !== s.qi) { my.qi = s.qi; my.locked = false; my.choice = -1; }
        const mode = !playing() ? 'dim' : my.locked ? 'locked' : 'live';
        box.appendChild(h('div', { class: 'rpanel play' }, strip, head, qbox, h('p', { class: 'rq-msg', text: !playing() ? 'Los jugadores están respondiendo…' : my.locked ? '¡Respuesta enviada! Esperando al resto…' : '¡Elige tu respuesta!' }), timerBar(), optionsEl(q, mode)));
      } else {
        const rv = R.reveal;
        if (!rv) { box.appendChild(h('div', { class: 'rpanel' }, strip, head, qbox, h('p', { class: 'hint', text: 'Calculando resultados…' }))); return; }
        const mine = rv.res && rv.res[pid];
        if (playing() && mine && !my.logged[s.qi]) {
          my.logged[s.qi] = true;
          if (!mine.ok) my.mistakes.push({ topic: q.topic, text: q.text, table: normT(q.table), options: arr(q.options), correct: rv.correct, chosen: mine.c, explain: rv.explain || '' });
          const pl = myP(); my.streakBest = Math.max(my.streakBest, mine.ok ? (pl && pl.streak) || 0 : 0);
          later(() => sfx(mine.ok ? 'coin' : 'deny'), 120);
        }
        const rvv = Object.assign({ mine }, rv);
        let verdict = null;
        if (playing() && mine) {
          const pl = myP();
          verdict = h('div', { class: 'rverdict ' + (mine.ok ? 'ok' : 'no') }, h('b', { text: mine.ok ? '¡Correcto!' : mine.c === -1 ? '⏱ No alcanzaste a responder' : 'Casi…' }),
            mine.ok ? h('span', { class: 'rpts', text: '+' + mine.pts }) : null, mine.ok && pl && pl.streak > 1 ? h('small', { text: '🔥 Racha de ' + pl.streak }) : null);
        }
        box.appendChild(h('div', { class: 'rpanel play' }, strip, head, qbox, verdict, optionsEl(q, 'reveal', rvv), rv.explain ? h('p', { class: 'rq-explain', text: rv.explain }) : null, h('h3', { class: 'rsub', text: 'Ranking' }), board(5, true)));
      }
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
      if (playing() && mineP) {
        const key = code + ':' + ((R.cfg && R.cfg.n) || 0), done = lsGet(LSR);
        if (!my.rewarded && !(done && done.key === key && done.pid === pid)) {
          my.rewarded = St.recordRoom({ correct: mineP.correct || 0, answered: mineP.answered || 0, rank: me + 1, total: rk.length, bestStreak: my.streakBest, mistakes: my.mistakes });
          lsSet(LSR, { key, pid, at: Date.now() });
          if (my.rewarded) { later(() => sfx('win'), 200); K.announceAch(my.rewarded.ach); }
        }
        if (my.rewarded) reward = h('div', { class: 'rreward' }, h('b', { text: 'Puesto ' + (me + 1) + ' de ' + rk.length }), h('span', null, K.img('coin', 2), ' +' + my.rewarded.coins + ' monedas · +' + my.rewarded.xp + ' XP' + (my.rewarded.bonus ? ' (incluye premio de podio)' : '')), my.mistakes.length ? h('small', { text: 'Tus ' + my.mistakes.length + ' errores quedaron en el Cuaderno para repasar.' }) : h('small', { text: '¡Sin errores!' }));
      }
      const rest = h('ol', { class: 'rboard', start: 4 }, rk.slice(3).map((x, i) => h('li', { class: 'rrow' + (x.id === pid ? ' me' : '') }, h('span', { class: 'rpos', text: String(i + 4) }), K.headThumb(x.look || {}, 'rh'), h('b', { class: 'rname', text: x.name }), h('span', { class: 'rscore', text: String(x.score || 0) }))));
      box.appendChild(h('div', { class: 'rpanel end' }, h('h2', { class: 'rtitle', text: '¡Fin de la partida!' }), pod, reward, rk.length > 3 ? rest : null,
        isHost ? h('button', { class: 'btn big', onclick: () => closeRoom() }, 'Cerrar sala') : h('button', { class: 'btn big', onclick: () => leave() }, 'Salir'),
        !isHost ? h('button', { class: 'btn ghost', onclick: () => go('notebook') }, 'Ver Cuaderno') : null));
    }

    function render(force) {
      const s = R.state; if (left || !s || !R.cfg) return;
      const key = s.phase + ':' + s.qi + ':' + (s.phase === 'answer' ? (my.locked ? 'L' : 'O') : '');
      if (!force && key === viewKey) return;
      viewKey = key; box.innerHTML = '';
      if (s.phase === 'lobby') viewLobby(); else if (s.phase === 'end') { A.play('menu'); viewEnd(); } else viewQuestion(s.phase);
      tickUI();
    }
    function updateLive() {
      const hc = box.querySelector('.hc'), ha = box.querySelector('.ha'), pc = box.querySelector('.pc');
      if (hc) hc.textContent = String(Object.keys(R.players).length);
      if (ha) ha.textContent = R.answerCount + '/' + Object.values(R.players).filter((x) => x.online !== false).length;
      if (pc) pc.textContent = String(Object.keys(R.players).length);
    }
    let lastSec = -1;
    function tickUI() {
      const s = R.state, cfg = R.cfg; if (!s || !cfg) return;
      const bar = box.querySelector('.rq-bar i'), sec = box.querySelector('.rq-sec'); if (!bar) return;
      const t = timing(cfg), total = s.phase === 'read' ? t.read : t.ans, el = Math.max(0, nowMs() - (s.t0 || nowMs())), rem = Math.max(0, total - el);
      bar.style.width = Math.max(0, Math.min(100, rem / total * 100)) + '%';
      bar.parentNode.classList.toggle('low', rem < 5000 && s.phase === 'answer');
      const secs = Math.ceil(rem / 1000); sec.textContent = String(secs);
      if (secs !== lastSec) { lastSec = secs; if (s.phase === 'answer' && secs <= 5 && secs > 0 && playing() && !my.locked) sfx('tick'); }
    }
    timers.push(setInterval(tickUI, 120));
    // sonido al abrir respuestas
    subs.push(N.on(P + '/state/phase', (ph) => { if (ph === 'answer') { sfx('go'); A.play('battle'); } }));
  };

  // por si la dirección trae ?sala=CODIGO y ya hay héroe elegido, la navegación de ui.js lo lleva a Salas
})(window);
