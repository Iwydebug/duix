/* DuiX — Juegos 2 y 3 de cada distrito.
 *   Nivel 2 «Carrera»: corres por 4 carriles hacia 4 puertas; eliges la puerta con la respuesta.
 *   Nivel 3 «Pares»:   unes cada problema con su resultado antes de que se acabe el tiempo.
 * Misma interfaz que Battle.start(cfg): {container, villain, tier, look, perks, onEnd(report), onQuit()}.
 */
(function (root) {
  'use strict';
  const D = root.DuiXData, S = root.DuiXSprites, A = root.DuiXAudio, Q = root.DuiXQ, St = root.DuiXStore;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "DejaVu Sans", Arial, sans-serif';
  const LANE_COL = ['#ff7a59', '#ffd23f', '#5ce1e6', '#c58bff'];
  const FB = root.DuiXFB;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const PRAISE = ['¡POW!', '¡BAM!', '¡ZAP!', '¡BOOM!', '¡WHAM!', '¡GENIAL!'];
  const GAMES = { 1: { id: 'shoot', name: 'Disparo', icon: '🎯' }, 2: { id: 'run', name: 'Carrera', icon: '🏃' }, 3: { id: 'maze', name: 'Laberinto', icon: '👾' } };

  /* ------------------------------------------------------------------
   * Núcleo común: HUD, corazones, puntaje, pausa, informe
   * ------------------------------------------------------------------ */
  function core(cfg, kind, bodyHtml, ctlHtml) {
    const v = cfg.villain, perks = cfg.perks || {}, tier = cfg.tier, room = cfg.room || null;
    const startHearts = room && room.noHearts ? 99 : 3 + (perks.hearts || 0);
    const st = { hearts: startHearts, maxHearts: startHearts, shield: perks.shield || 0, score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, coins: 0, hintsUsed: 0, heartsLost: 0, mistakes: [], time: 0, over: false, win: false, paused: false };
    const wrap = el('div', 'bt gm gm-' + kind);
    wrap.innerHTML = `
      <div class="bt-hud">
        <div class="bt-hearts" aria-label="Vidas"></div>
        <div class="bt-mid"><div class="bt-score">0</div><div class="bt-combo"></div></div>
        <div class="bt-right"><div class="bt-coins"><img alt="" src="${S.icon('coin', 3)}"><b>0</b></div><button class="bt-pause" aria-label="Pausa"><img alt="" src="${S.icon('pause', 3)}"></button></div>
      </div>
      <div class="bt-boss"><span class="bt-bname">${esc(v.name)}</span><div class="bt-hpbar"><i></i></div><span class="bt-hptxt"></span></div>
      ${bodyHtml}
      <div class="bt-ctl">${ctlHtml}</div>
      <div class="bt-pausemenu" hidden><div class="bt-pbox"><h2>Pausa</h2><button class="btn big" data-a="resume">Seguir jugando</button><button class="btn" data-a="restart">↻ Reiniciar</button><div class="bt-pset"><b>Música</b><div class="seg bt-mpick"></div><label class="set bt-sfxrow"><span>Efectos de sonido</span><input type="checkbox" class="bt-sfxchk"><span class="sw2"></span></label></div><button class="btn ghost" data-a="quit">Salir</button></div></div>`;
    if (room) { wrap.classList.add('room'); const rb = wrap.querySelector('[data-a=restart]'); if (rb) rb.remove(); }
    if (cfg.extraTop) wrap.insertBefore(cfg.extraTop, wrap.querySelector('.bt-boss'));
    cfg.container.appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    const api = { wrap, $, st, v, perks, tier, destroyed: false, raf: 0, last: 0, onTick: null, onResume: null };
    const mult = () => 1 + Math.min(2, Math.floor(Math.max(0, st.streak - 1) / 3) * 0.5);
    api.mult = mult;
    api.hearts = () => { const h = $('.bt-hearts'); h.innerHTML = ''; if (room && room.noHearts) { h.textContent = '⚔ Sala'; h.className = 'bt-hearts room'; return; } for (let i = 0; i < st.maxHearts; i++) { const im = new Image(); im.alt = ''; im.src = S.icon(i < st.hearts ? 'heart' : 'heartEmpty', 3); h.appendChild(im); } if (st.shield > 0) h.appendChild(el('span', 'bt-shield', '🛡')); };
    api.hud = (frac, text) => {
      $('.bt-score').textContent = String(Math.round(st.score));
      $('.bt-coins b').textContent = String(St.profile() ? St.profile().coins + st.coins : st.coins);
      const m = mult(); $('.bt-combo').textContent = st.streak >= 2 ? `Racha ${st.streak}${m > 1 ? ' · x' + m : ''}` : '';
      if (room && room.hp) { const r = room.hp(); $('.bt-hpbar i').style.width = clamp(r.frac, 0, 1) * 100 + '%'; $('.bt-hptxt').textContent = r.text; } else { $('.bt-hpbar i').style.width = clamp(frac, 0, 1) * 100 + '%'; $('.bt-hptxt').textContent = text || ''; }
      if (cfg.onProgress) { const snap = [Math.round(st.score), st.correct, st.answered, st.over ? 1 : 0].join(); if (snap !== api.lastSnap) { api.lastSnap = snap; cfg.onProgress({ score: Math.round(st.score), correct: st.correct, qi: st.answered, over: st.over }); } }
    };
    api.addScore = (d) => { st.score = Math.max(0, st.score + d); };
    api.speedMul = () => (cfg.speedMul ? cfg.speedMul() : 1);
    api.damage = () => {
      if (room && room.noHearts) { A.sfx('hurt'); wrap.classList.remove('hurt'); void wrap.offsetWidth; wrap.classList.add('hurt'); return true; }
      if (st.shield > 0) { st.shield--; A.sfx('power'); api.hearts(); return false; }
      st.hearts--; st.heartsLost++; A.sfx('hurt'); api.hearts();
      wrap.classList.remove('hurt'); void wrap.offsetWidth; wrap.classList.add('hurt'); return true;
    };
    api.gain = (clean, extra) => {
      const m = clean ? mult() : 1, g = Math.round((clean ? 100 : 40) * m + (extra || 0)); st.score += g;
      const cg = Math.round((clean ? 3 + (st.streak >= 5 ? 2 : 0) : 1) * (1 + (perks.coins || 0))); st.coins += cg; return { g, cg };
    };
    api.log = (q, chosenIdx, options, correctIdx) => { st.mistakes.push({ topic: q.topic, text: q.text, options: options || q.options, correct: correctIdx != null ? correctIdx : q.correct, chosen: chosenIdx, explain: q.explain, table: q.table || null }); };
    api.banner = (text, cls, ms) => { let b = $('.bt-banner'); if (!b) { b = el('div', 'bt-banner'); wrap.appendChild(b); } b.textContent = text; b.className = 'bt-banner gmb ' + (cls || ''); b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; if (ms) setTimeout(() => { if (!api.destroyed) b.hidden = true; }, ms); };
    api.report = () => {
      const acc = st.answered ? st.correct / st.answered : 0; let stars = 0; if (st.win) stars = st.heartsLost === 0 ? 3 : (st.heartsLost === 1 || acc >= 0.75) ? 2 : 1;
      return { win: !!st.win, stars, correct: st.correct, answered: st.answered, bestStreak: st.bestStreak, mistakes: st.mistakes, score: Math.round(st.score), coins: st.coins, heartsLost: st.heartsLost, hintsUsed: st.hintsUsed, tier, time: Math.round(st.time), endless: false };
    };
    api.toggle = (p) => { if (st.over) return; if (room) { const show = p === undefined ? $('.bt-pausemenu').hidden : p; $('.bt-pausemenu').hidden = !show; return; } st.paused = p === undefined ? !st.paused : p; $('.bt-pausemenu').hidden = !st.paused; A.sfx('pause'); if (!st.paused) { api.last = 0; api.onResume && api.onResume(); } };
    // música / efectos
    { const mp = $('.bt-mpick'), chk = $('.bt-sfxchk');
      const now = () => { const q = St.settings(); return !q.music ? 'off' : q.musicStyle === 'calma' ? 'calma' : 'arcade'; };
      const draw = () => { mp.innerHTML = ''; [['arcade', 'Arcade'], ['calma', 'Calmada'], ['off', 'Sin música']].forEach(([id, label]) => { const b = el('button', 'segb' + (now() === id ? ' on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { A.unlock(); if (id === 'off') St.setSetting('music', false); else { St.setSetting('musicStyle', id); St.setSetting('music', true); } draw(); }); mp.appendChild(b); }); };
      draw(); chk.checked = !!St.settings().sfx; chk.addEventListener('change', () => St.setSetting('sfx', chk.checked)); }
    $('.bt-pause').addEventListener('click', () => api.toggle(true));
    $('.bt-pausemenu').addEventListener('click', (e) => { const a = e.target.dataset && e.target.dataset.a; if (a === 'resume') api.toggle(false); if (a === 'quit') { api.destroy(); cfg.onQuit && cfg.onQuit(); } if (a === 'restart' && cfg.onRestart) { api.destroy(); cfg.onRestart(); } });
    const onVis = () => { if (document.hidden && !room) api.toggle(true); };
    document.addEventListener('visibilitychange', onVis);
    const loop = (ts) => {
      if (api.destroyed) return; api.raf = requestAnimationFrame(loop);
      if (!api.last) api.last = ts; const dt = Math.min(0.05, (ts - api.last) / 1000); api.last = ts;
      if (!st.paused) { st.time += dt; api.onTick && api.onTick(dt, ts / 1000); } else if (api.onPaused) api.onPaused(ts / 1000);
    };
    api.keys = null;
    const onKey = (e) => { if (api.destroyed) return; if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); api.toggle(); return; } if (!st.paused && api.keys) api.keys(e); };
    root.addEventListener('keydown', onKey);
    api.destroy = () => { api.destroyed = true; cancelAnimationFrame(api.raf); root.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); if (api.cleanup) api.cleanup(); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
    api.start = () => { api.hearts(); api.raf = requestAnimationFrame(loop); };
    return api;
  }

  /* pregunta grande que se acomoda en su recuadro (igual que el disparo) */
  function qIntro(c) {
    const $ = c.$, st = c.st;
    return {
      show(q, secs, tag) {
        const bg = $('.bt-big'), qbox = $('.bt-q');
        bg.querySelector('.bt-bigtag').textContent = tag;
        const bt = bg.querySelector('.bt-bigtext'); bt.textContent = q.text; bt.className = 'bt-bigtext' + (q.text.length > 90 ? ' xl' : q.text.length > 60 ? ' long' : q.text.length > 38 ? ' mid' : '');
        bg.querySelector('.bt-bigtab').innerHTML = $('.bt-qtable').innerHTML;
        const bar = bg.querySelector('.bt-bigbar i'); bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = 'width ' + secs + 's linear'; bar.style.width = '0%';
        bg.style.transition = 'none'; bg.style.transform = ''; bg.style.opacity = ''; bg.hidden = false; bg.classList.remove('pop'); void bg.offsetWidth; bg.classList.add('pop');
        const fr = $('.bt-field').getBoundingClientRect(), wr = c.wrap.getBoundingClientRect(); bg.style.top = '0px'; const hh = bg.offsetHeight;
        bg.style.top = Math.max(fr.top - wr.top + 8, fr.top - wr.top + fr.height * 0.42 - hh / 2) + 'px';
        qbox.style.visibility = 'hidden'; A.sfx('tick');
      },
      settle() {
        const bg = $('.bt-big'), qbox = $('.bt-q'); bg.classList.remove('pop');
        const a = bg.getBoundingClientRect(), b = qbox.getBoundingClientRect();
        const sc = Math.min(1, b.width / a.width), dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
        bg.style.transition = 'transform .5s cubic-bezier(.5,0,.2,1), opacity .2s .4s'; bg.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`; bg.style.opacity = '0';
      },
      end() { const bg = $('.bt-big'); bg.hidden = true; bg.style.transform = ''; bg.style.opacity = ''; $('.bt-q').style.visibility = ''; },
    };
  }
  const BIGHTML = '<div class="bt-big" hidden><div class="bt-bigtag"></div><div class="bt-bigtext"></div><div class="bt-bigtab"></div><div class="bt-bigbar"><i></i></div></div>';
  function fillQ(c, q, tag) {
    const $ = c.$; $('.bt-qtag').textContent = tag; const qt = $('.bt-qtext'); qt.textContent = q.text; qt.className = 'bt-qtext' + (q.text.length > 70 ? ' long' : q.text.length > 46 ? ' mid' : '');
    const tb = $('.bt-qtable'); tb.innerHTML = '';
    if (q.table) { let h = '<table><tr>' + q.table.head.map((x, i) => (i ? '<td>' : '<th>') + esc(x) + (i ? '</td>' : '</th>')).join('') + '</tr>'; q.table.rows.forEach((r) => { h += '<tr>' + r.map((x, i) => (i ? '<td class="' + (x === '?' ? 'qm' : '') + '">' : '<th>') + esc(x) + (i ? '</td>' : '</th>')).join('') + '</tr>'; }); tb.innerHTML = h + '</table>'; }
    $('.bt-explain').hidden = true;
  }
  const explainBox = (c, t) => { const e = c.$('.bt-explain'); e.textContent = t; e.hidden = false; };
  const topicTag = (v, q) => (v.topic === 'mix' ? (D.VILLAINS.find((x) => x.topic === q.topic) || { tema: '' }).tema : v.tema);

  /* ------------------------------------------------------------------
   * NIVEL 2 · CARRERA
   * ------------------------------------------------------------------ */
  function startRun(cfg) {
    const v = cfg.villain, room = cfg.room || null, N = room ? room.total : v.boss ? 4 : 3;
    const body = `<div class="bt-q"><div class="bt-qtag"></div><div class="bt-qtext"></div><div class="bt-qtable"></div><div class="bt-explain" hidden></div></div>
      <div class="bt-field"><canvas></canvas><div class="bt-banner" hidden></div></div>${BIGHTML}`;
    const ctl = `<button class="bt-btn bt-hint"><img alt="" src="${S.icon('bulb', 3)}"><span>Pista</span><em></em></button>
      <div class="bt-keys">Arrastra el dedo para mover a tu héroe en cualquier dirección<br><small>Teclado: flechas o WASD · H pista</small></div>`;
    const c = core(cfg, 'run', body, ctl), st = c.st, $ = c.$, cv = $('.bt-field canvas'), ctx = cv.getContext('2d');
    st.sigma = 0;
    const intro = qIntro(c); let LW = 360, GW = LW / 4 - 6;
    let W = 0, H = 0, dpr = 1, LH = 560, state = 'intro', sT = 0, readFor = 3, scroll = 0, spawned = 0, curIdx = -1, slowT = 0;
    const walls = [], items = [], parts = [], floats = [];
    let shake = 0, flash = 0, stun = 0, ended = false;
    const hero = { x: LW / 2, y: 0, tx: LW / 2, ty: 0, vx: 0, vy: 0, face: 1, blink: 0 };
    const keys = {}; let drag = false;
    const hintCost = () => Math.max(1, Math.round(20 * ((cfg.perks || {}).hintCost || 1)));
    const villain = S.villainCanvas(v);
    const D = 430, SPAWN_Y = -80;
    const baseV = () => (LH * 0.75 / 17) * (1 + Math.min(0.2, spawned * 0.05)) * (1 - (cfg.perks || {}).slow * 0.5 || 1) * (slowT > 0 ? 0.5 : 1) * (room && cfg.fallSecs ? Math.max(0.45, Math.min(1.5, 27 / cfg.fallSecs)) : 1) * c.speedMul();
    function resize() { const f = $('.bt-field'); const w = f.clientWidth, h = f.clientHeight; if (w < 10 || h < 10) return; dpr = Math.min(2.5, root.devicePixelRatio || 1); W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; { const sc0 = Math.min(W / 360, H / 320); LW = W / sc0; LH = H / sc0; GW = LW / 4 - 6; } if (!hero.y) { hero.y = hero.ty = LH - 60; hero.x = hero.tx = LW / 2; } hero.tx = clamp(hero.tx, 20, LW - 20); hero.x = clamp(hero.x, 20, LW - 20); }
    function wrapLines(text, maxW) {
      const tokens = []; let cur = '';
      for (let i = 0; i < text.length; i++) { cur += text[i]; const n = text[i + 1]; if (text[i] === ' ' || (text[i] === ')' && n === '(') || (text[i] === ',' && n === ' ')) { tokens.push(cur); cur = ''; } }
      if (cur) tokens.push(cur);
      for (let fs = 17; fs >= 9; fs--) {
        ctx.font = `700 ${fs}px ${FONT}`; const lines = []; let line = '', ok = true;
        for (const t of tokens) { if (ctx.measureText(t.trimEnd()).width > maxW) { ok = false; break; } if (ctx.measureText((line + t).trimEnd()).width <= maxW) line += t; else { lines.push(line.trimEnd()); line = t; } }
        if (line) lines.push(line.trimEnd()); if (ok && lines.length <= (fs > 12 ? 2 : 3)) return { lines, fs };
      }
      ctx.font = `700 9px ${FONT}`; const out = []; let l = ''; for (const ch of text) { if (ctx.measureText(l + ch).width > maxW) { out.push(l); l = ch; } else l += ch; } out.push(l); return { lines: out, fs: 9 };
    }
    function makeQ() { let q; if (room) { try { return room.getQuestion(spawned); } catch (e) { /* ok */ } } try { q = Q.generate(v.topic, v.topic === 'mix' ? Math.max(2, cfg.tier) : cfg.tier); } catch (e) { q = Q.generate('fracciones', 1); } return q; }
    function spawnWall(y) {
      const q = st.nextQ || makeQ(); st.nextQ = null; const idx = spawned++;
      const gates = q.options.map((t, i) => { const lay = wrapLines(t, GW - 10); return { lane: i, x: LW / 4 * i + 3, w: GW, h: Math.max(50, lay.lines.length * lay.fs * 1.22 + 18), lines: lay.lines, fs: lay.fs, text: t, ok: i === q.correct, gone: false, crossed: false, mark: 0 }; });
      walls.push({ q, idx, y, gates, resolved: false, wrong: false });
    }
    function spawnFiller(y) {
      const r = Math.random(); const lane = () => Math.floor(Math.random() * 4);
      if (r < 0.34) { const l = lane(); for (let k = 0; k < 5; k++) items.push({ t: 'coin', x: LW / 4 * (l + 0.5) + Math.sin(k * 0.9) * 26, y: y - k * 26, got: false }); }
      else if (r < 0.66) { const a = lane(); let b = lane(); while (b === a) b = lane(); [a, b].forEach((l) => items.push({ t: 'mine', x: LW / 4 * (l + 0.5) + (Math.random() - 0.5) * 30, y: y - Math.random() * 20, got: false })); if (Math.random() < 0.5) items.push({ t: 'mine', x: LW / 4 * (lane() + 0.5), y: y - 60, got: false }); }
      else if (r < 0.84) { const kind = ['shield', 'slow', 'heart', 'shield'][Math.floor(Math.random() * 4)]; items.push({ t: kind === 'heart' && st.hearts >= st.maxHearts ? 'shield' : kind, x: LW / 4 * (lane() + 0.5), y, got: false }); const l2 = lane(); for (let k = 0; k < 3; k++) items.push({ t: 'coin', x: LW / 4 * (l2 + 0.5), y: y - 40 - k * 24, got: false }); }
      else { items.push({ t: 'sigma', x: LW / 4 * (lane() + 0.5), y, got: false }); items.push({ t: 'coin', x: LW / 4 * (lane() + 0.5), y: y - 50, got: false }); }
    }
    const bad = { text: '' };
    function showQ(q) { fillQ(c, q, topicTag(v, q)); const qb = $('.bt-q'); qb.classList.remove('flip'); void qb.offsetWidth; qb.classList.add('flip'); A.sfx('tick'); }
    function burst(x, y, col, n, sp, life) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.3 + Math.random()) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, t: 0, life: life * (0.5 + Math.random() * 0.7), c: Array.isArray(col) ? col[i % col.length] : col, s: 2 + Math.floor(Math.random() * 3) }); } }
    const fl = (x, y, text, col, size) => floats.push({ x, y, text, c: col || '#fff', size: size || 20, t: 0, life: 0.9 });
    const prog = () => c.hud(1 - st.answered / N, st.answered + '/' + N);
    function finish(win) { if (ended) return; ended = true; st.over = true; st.win = win; state = 'end'; sT = 0; if (win) { A.sfx('levelup'); c.banner(room ? '¡LISTO!' : '¡VICTORIA!', 'go'); } else { A.sfx('lose'); c.banner('¡DERROTA!', 'lose'); } }
    function answerWall(w, g) {
      w.resolved = true; st.answered++; const x = g ? g.x + g.w / 2 : hero.x, y = g ? w.y + g.h / 2 : hero.y;
      if (g && g.ok) {
        FB.right(c.wrap, w.q, !w.wrong);
        const clean = !w.wrong; if (clean) { st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
        const r = c.gain(clean, 0); g.mark = 1; burst(x, y, ['#ffe14a', '#fff', LANE_COL[g.lane]], 26, 200, 0.7); fl(x, y - 16, '+' + r.g, '#ffe14a', 24);
        w.gates.forEach((o) => { if (o !== g) o.gone = true; });
        A.sfx('correct'); A.sfx('hit'); setTimeout(() => A.sfx('coin'), 90); shake = 6; if (st.streak >= 3 && clean) A.sfx('combo', st.streak);
        if (st.answered >= N) return finish(true);
      } else {
        st.streak = 0; w.wrong = true; c.log(w.q, g ? g.lane : -1); c.damage(); burst(x, y, ['#ff3b5c', '#7a6aa8'], 20, 160, 0.6); fl(x, y - 16, g ? '✖' : '¡Se pasó!', '#ff4d4d', g ? 30 : 20);
        shake = 10; flash = 0.35; if (g) g.gone = true; w.gates.forEach((o) => { if (o.ok) o.mark = 2; });
        explainBox(c, 'La correcta era «' + w.q.options[w.q.correct] + '». ' + w.q.explain); FB.reveal(c.wrap, w.q, g ? g.lane : -1, g ? '' : '¡Se pasó!');
        if (st.hearts <= 0) return finish(false);
        if (st.answered >= N) return finish(true);
      }
      prog();
    }
    function hint() {
      const w = walls.find((q) => !q.resolved); if (!w || state !== 'play') return; const wr = w.gates.filter((g) => !g.ok && !g.crossed && !g.gone); if (wr.length < 2) { A.sfx('deny'); return; }
      if (!St.spend(hintCost())) { A.sfx('deny'); fl(hero.x, hero.y - 50, '¡Faltan monedas!', '#ff9a9a', 15); return; }
      wr[Math.floor(Math.random() * wr.length)].crossed = true; st.hintsUsed++; A.sfx('hint'); if (w.q.hint) explainBox(c, '💡 Pista: ' + w.q.hint); prog();
    }
    $('.bt-hint em').textContent = hintCost(); $('.bt-hint').addEventListener('click', () => { A.unlock(); hint(); });
    const toL = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * LW, y: (e.clientY - r.top) / r.width * LW }; };
    const aim = (e) => { const p = toL(e); hero.tx = clamp(p.x, 20, LW - 20); hero.ty = clamp(p.y - 44, LH * 0.3, LH - 40); };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); A.unlock(); drag = true; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } aim(e); });
    cv.addEventListener('pointermove', (e) => { if (drag) aim(e); });
    const up = () => { drag = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    c.keys = (e) => { const k = e.key.toLowerCase(); if (k === 'h') hint(); };
    const kd = (e) => { keys[e.key.toLowerCase()] = true; if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(e.key.toLowerCase())) e.preventDefault(); }, ku = (e) => { keys[e.key.toLowerCase()] = false; };
    root.addEventListener('keydown', kd); root.addEventListener('keyup', ku);
    root.addEventListener('resize', resize); const ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe($('.bt-field'));
    let dr = 0; c.cleanup = () => { cancelAnimationFrame(dr); root.removeEventListener('resize', resize); root.removeEventListener('keydown', kd); root.removeEventListener('keyup', ku); if (ro) ro.disconnect(); };

    c.onTick = (dt) => {
      { const f = cv.parentNode; if (f && (Math.abs(f.clientWidth - W) > 1 || Math.abs(f.clientHeight - H) > 1)) resize(); }
      if (W <= 0) return; sT += dt;
      parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].life) parts.splice(i, 1);
      floats.forEach((f) => { f.t += dt; f.y -= 26 * dt; }); for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t >= floats[i].life) floats.splice(i, 1);
      shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt); stun = Math.max(0, stun - dt); slowT = Math.max(0, slowT - dt);
      // movimiento libre del héroe (dedo o teclado)
      const sp = 250; let kx = 0, ky = 0; if (keys.arrowleft || keys.a) kx -= 1; if (keys.arrowright || keys.d) kx += 1; if (keys.arrowup || keys.w) ky -= 1; if (keys.arrowdown || keys.s) ky += 1;
      if (kx || ky) { hero.tx = clamp(hero.tx + kx * sp * dt, 20, LW - 20); hero.ty = clamp(hero.ty + ky * sp * dt, LH * 0.3, LH - 40); }
      if (stun <= 0) { const dx = hero.tx - hero.x; hero.x += dx * Math.min(1, dt * 12); hero.y += (hero.ty - hero.y) * Math.min(1, dt * 12); if (Math.abs(dx) > 1.5) hero.face = dx > 0 ? 1 : -1; }
      if (state === 'intro') { if (sT > 0.1 && !st.said) { st.said = true; c.banner('¡A CORRER!', 'go', 1200); } if (sT > 1.3) { const q = makeQ(); st.nextQ = q; fillQ(c, q, topicTag(v, q)); state = 'read'; sT = 0; const len = q.text.length + (q.table ? 30 : 0) + q.options.reduce((a, o) => a + o.length, 0) * 0.4; readFor = Math.min(room ? 6 : 10, Math.max(room ? 3 : 4, 2 + len * 0.06)); intro.show(q, readFor, topicTag(v, q)); } }
      else if (state === 'read') { if (sT >= readFor) { state = 'settle'; sT = 0; intro.settle(); A.sfx('tick'); } }
      else if (state === 'settle') { if (sT >= 0.55) { intro.end(); state = 'play'; sT = 0; A.sfx('go'); c.banner('¡YA!', 'go', 550); spawnWall(SPAWN_Y); curIdx = 0; prog(); } }
      else if (state === 'play') {
        const vv = baseV(), dy = vv * dt; scroll += dy;
        walls.forEach((w) => { w.y += dy; }); items.forEach((it) => { it.y += dy; });
        // generar la siguiente pared + relleno entre paredes
        const last = walls[walls.length - 1];
        if (spawned < N && last && last.y >= SPAWN_Y + D) { spawnFiller(SPAWN_Y + D / 2 + 30); spawnWall(SPAWN_Y); }
        // pregunta actual = la primera pared sin resolver
        const cw = walls.find((w) => !w.resolved);
        if (cw && cw.idx !== curIdx) { curIdx = cw.idx; showQ(cw.q); }
        if (cw && cw.idx + 1 < N && !st.nextQ && spawned === cw.idx + 1) st.nextQ = makeQ();
        // colisiones del héroe
        const hx0 = hero.x - 13, hx1 = hero.x + 13, hy0 = hero.y - 34, hy1 = hero.y + 2;
        for (const w of walls) { if (w.resolved) continue; for (const g of w.gates) { if (g.gone) continue; if (hx1 > g.x && hx0 < g.x + g.w && hy1 > w.y && hy0 < w.y + g.h) { answerWall(w, g); break; } } if (w.resolved) continue; if (w.y > hero.y + 6) answerWall(w, null); if (ended) break; }
        if (!ended) for (const it of items) {
          if (it.got) continue; const dx = Math.abs(it.x - hero.x), dyy = Math.abs(it.y - (hero.y - 16));
          if (dx < 20 && dyy < 26) {
            it.got = true;
            if (it.t === 'coin') { st.coins += 1; st.score += 10; A.sfx('coin'); fl(it.x, it.y - 8, '+1¢', '#ffd23f', 14); }
            else if (it.t === 'sigma') { st.sigma++; A.sfx('levelup'); burst(it.x, it.y, ['#c58bff', '#fff', '#5ce1e6'], 20, 170, 0.7); fl(it.x, it.y - 10, '+1 Σ', '#e2b8ff', 22); }
            else if (it.t === 'shield') { st.shield++; c.hearts(); A.sfx('power'); fl(it.x, it.y - 10, '¡ESCUDO!', '#8fe6ff', 18); burst(it.x, it.y, '#8fe6ff', 14, 130, 0.6); }
            else if (it.t === 'slow') { slowT = 5; A.sfx('power'); fl(it.x, it.y - 10, '¡CÁMARA LENTA!', '#9dffef', 16); burst(it.x, it.y, '#9dffef', 14, 130, 0.6); }
            else if (it.t === 'heart') { if (st.hearts < st.maxHearts) st.hearts++; c.hearts(); A.sfx('levelup'); fl(it.x, it.y - 10, '+❤', '#ff8fa3', 22); }
            else if (it.t === 'mine') { A.sfx('boom'); burst(it.x, it.y, ['#ff8c1a', '#ffe14a', '#fff'], 30, 220, 0.7); st.score = Math.max(0, st.score - 40); st.streak = 0; stun = 0.5; shake = 12; flash = 0.25; fl(it.x, it.y - 12, '-40', '#ff6a5a', 22); }
          }
        }
        for (let i = walls.length - 1; i >= 0; i--) if (walls[i].y > LH + 120) walls.splice(i, 1);
        for (let i = items.length - 1; i >= 0; i--) if (items[i].y > LH + 60 || items[i].got) items.splice(i, 1);
        c.hud(1 - st.answered / N, st.answered + '/' + N);
      }
      else if (state === 'end') { scroll += 14 * dt; if (sT > (room ? 0.9 : st.win ? 2.6 : 2.0) && !st.reported) { st.reported = true; const r = c.report(); r.sigma = st.sigma; cfg.onEnd(r); } }
    };
    function drawGate(w, g) {
      const x = g.x, y = w.y, col = LANE_COL[g.lane]; ctx.save(); if (g.gone) { ctx.restore(); return; }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 3, y - 3, g.w + 6, g.h + 6, 12) : ctx.rect(x - 3, y - 3, g.w + 6, g.h + 6); ctx.fill();
      const gr = ctx.createLinearGradient(0, y, 0, y + g.h); if (g.mark === 1) { gr.addColorStop(0, '#fff2a8'); gr.addColorStop(1, '#ffd23f'); } else if (g.mark === 2) { gr.addColorStop(0, '#7cf0b8'); gr.addColorStop(1, '#22b070'); } else if (g.crossed) { gr.addColorStop(0, '#4a4570'); gr.addColorStop(1, '#2c2848'); } else { gr.addColorStop(0, '#4c38b8'); gr.addColorStop(1, '#2a1e6b'); }
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, g.w, g.h, 10) : ctx.rect(x, y, g.w, g.h); ctx.fill();
      ctx.strokeStyle = g.crossed ? '#6a6390' : col; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(x + 8, y + 3, g.w - 16, 3);
      ctx.fillStyle = g.mark ? '#1a1033' : g.crossed ? '#8a83b0' : '#fff'; ctx.font = `700 ${g.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const lh = g.fs * 1.22, y0 = y + g.h / 2 - (g.lines.length - 1) * lh / 2 + 3; g.lines.forEach((l, i) => ctx.fillText(l, x + g.w / 2, y0 + i * lh, g.w - 10));
      if (g.crossed) { ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + g.w - 8, y + g.h - 8); ctx.moveTo(x + g.w - 8, y + 8); ctx.lineTo(x + 8, y + g.h - 8); ctx.stroke(); }
      ctx.restore();
    }
    function drawItem(it, t) {
      const b = Math.sin(t * 6 + it.x) * 2; ctx.save(); ctx.translate(it.x, it.y + b); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (it.t === 'coin') { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.283); ctx.fill(); ctx.fillStyle = '#b07a00'; ctx.fillRect(-1, -4, 2, 8); }
      else if (it.t === 'mine') { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 6.283); ctx.fill(); ctx.fillStyle = '#4a3a6a'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ff3b3b'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8); ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; for (let k = 0; k < 8; k++) { const a = k * 0.785; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.stroke(); } }
      else { const col = it.t === 'sigma' ? '#c58bff' : it.t === 'shield' ? '#5ce1e6' : it.t === 'slow' ? '#9dffef' : '#ff5c7a', ico = it.t === 'sigma' ? 'Σ' : it.t === 'shield' ? '🛡' : it.t === 'slow' ? '⏳' : '❤'; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.283); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.283); ctx.fill(); ctx.fillStyle = it.t === 'sigma' ? '#1a1033' : '#fff'; ctx.font = `800 ${it.t === 'sigma' ? 20 : 15}px ${FONT}`; ctx.fillText(ico, 0, 1); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 20 + Math.sin(t * 5) * 2, 0, 6.283); ctx.stroke(); }
      ctx.restore();
    }
    const draw = (t) => {
      if (W <= 0) return; const sc = W / LW; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.scale(sc, sc); if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      const pal = v.pal;
      let g = ctx.createLinearGradient(0, 0, 0, LH); g.addColorStop(0, '#0d0720'); g.addColorStop(1, '#221457'); ctx.fillStyle = g; ctx.fillRect(-10, -10, LW + 20, LH + 20);
      // pista: cuadrícula neón que baja
      const off = scroll % 60; ctx.strokeStyle = 'rgba(140,110,255,.16)'; ctx.lineWidth = 2; for (let y = -60 + off; y < LH + 60; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LW, y); ctx.stroke(); }
      for (let l = 1; l < 4; l++) { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.setLineDash([16, 18]); ctx.lineDashOffset = -scroll; ctx.beginPath(); ctx.moveTo(l * LW / 4, 0); ctx.lineTo(l * LW / 4, LH); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, 5, LH); ctx.fillRect(LW - 5, 0, 5, LH); ctx.globalAlpha = 1;
      // símbolos matemáticos que bajan de fondo
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 26px ${FONT}`; ctx.globalAlpha = 0.09; ctx.fillStyle = '#fff'; ['π', '∑', '∞', '√', '∫', 'x²', 'Δ'].forEach((s, i) => { const y = ((i * 97 + scroll * 0.6) % (LH + 60)) - 30; ctx.fillText(s, 40 + ((i * 131) % 280), y); }); ctx.globalAlpha = 1;
      // villano arriba (bromea)
      { const vs = 60, bob = Math.sin(t * 2.4) * 3; ctx.globalAlpha = 0.9; ctx.drawImage(villain, LW / 2 - vs / 2, 4 + bob, vs, vs); ctx.globalAlpha = 1; }
      items.forEach((it) => { if (!it.got && it.y > -30 && it.y < LH + 30) drawItem(it, t); });
      walls.forEach((w) => { if (w.y > -120 && w.y < LH + 20) w.gates.forEach((gt) => drawGate(w, gt)); });
      // héroe
      { const hs = 2, hc = S.heroCanvas(cfg.look, 'idle', Math.floor(t * 8) % 4), hw = S.HERO_W * hs, hh = S.HERO_H * hs, bob = Math.abs(Math.sin(t * 10)) * 3, blink = stun > 0 && Math.floor(stun * 16) % 2 === 0;
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(hero.x, hero.y + 2, 24, 6, 0, 0, 6.283); ctx.fill(); if (blink) ctx.globalAlpha = 0.35; ctx.translate(hero.x, hero.y); if (hero.face < 0) ctx.scale(-1, 1); ctx.drawImage(hc, Math.round(-hw / 2), Math.round(-hh - bob + 6), hw, hh); ctx.restore();
        if (st.shield > 0) { ctx.strokeStyle = 'rgba(143,230,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hero.x, hero.y - 26, 38, 0, 6.283); ctx.stroke(); } }
      parts.forEach((p) => { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }); ctx.globalAlpha = 1;
      floats.forEach((f) => { ctx.globalAlpha = clamp(1 - f.t / f.life, 0, 1); ctx.font = `${f.size}px Bangers, ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a1033'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }); ctx.globalAlpha = 1;
      if (slowT > 0) { ctx.fillStyle = 'rgba(157,255,239,.08)'; ctx.fillRect(0, 0, LW, LH); }
      ctx.restore();
      if (flash > 0) { ctx.fillStyle = `rgba(255,30,60,${Math.min(0.4, flash)})`; ctx.fillRect(0, 0, W, H); }
    };
    const dl = (ts) => { if (c.destroyed || !c.wrap.parentNode) return; dr = requestAnimationFrame(dl); draw(ts / 1000); }; dr = requestAnimationFrame(dl);
    c.hud(1, '0/' + N); c.start(); resize();
    return { destroy: c.destroy, refresh: prog, pause: () => c.toggle(true), state: st, _run: { go: (x, y) => { hero.tx = x; hero.ty = y == null ? hero.ty : y; }, get walls() { return walls; }, get hero() { return hero; }, get st() { return state; }, get LH() { return LH; } } };
  }

  /* ------------------------------------------------------------------
   * NIVEL 3 · LABERINTO (estilo Pac-Man): tu héroe come la respuesta correcta y huye de los secuaces del villano
   * ------------------------------------------------------------------ */
  function fitText(ctx, text, maxW, maxLines, maxFs) {
    const tokens = []; let cur = '';
    for (let i = 0; i < text.length; i++) { cur += text[i]; const n = text[i + 1]; if (text[i] === ' ' || (text[i] === ')' && n === '(') || (text[i] === ',' && n === ' ')) { tokens.push(cur); cur = ''; } }
    if (cur) tokens.push(cur);
    for (let fs = maxFs; fs >= 8; fs--) {
      ctx.font = `800 ${fs}px ${FONT}`; const lines = []; let line = '', ok = true;
      for (const t of tokens) { if (ctx.measureText(t.trimEnd()).width > maxW) { ok = false; break; } if (ctx.measureText((line + t).trimEnd()).width <= maxW) line += t; else { lines.push(line.trimEnd()); line = t; } }
      if (line) lines.push(line.trimEnd()); if (ok && lines.length <= maxLines) return { lines, fs };
    }
    return { lines: [text.slice(0, 9)], fs: 8 };
  }
  function startMaze(cfg) {
    const v = cfg.villain, room = cfg.room || null, N = room ? room.total : v.boss ? 3 : 2;
    const body = `<div class="bt-q"><div class="bt-qtag"></div><div class="bt-qtext"></div><div class="bt-qtable"></div><div class="bt-explain" hidden></div></div>
      <div class="bt-field"><canvas></canvas><div class="bt-banner" hidden></div></div>${BIGHTML}`;
    const ctl = `<button class="bt-btn bt-hint"><img alt="" src="${S.icon('bulb', 3)}"><span>Pista</span><em></em></button>
      <div class="bt-keys">¡Cómete al fantasma con la respuesta correcta!<br><small>Desliza o usa flechas/WASD · Σ = poder · H pista</small></div>`;
    const c = core(cfg, 'maze', body, ctl), st = c.st, $ = c.$, cv = $('.bt-field canvas'), ctx = cv.getContext('2d');
    st.sigma = 0;
    const intro = qIntro(c); let LW = 360, COLS = 11, T = LW / COLS; const T0 = 360 / 11;
    let W = 0, H = 0, dpr = 1, LH = 560, ROWS = 11, oy = 0, grid = null, state = 'intro', sT = 0, readFor = 3, q = null, qn = 0, ended = false, shake = 0, flash = 0, fright = 0, invul = 0, dots = 0, hintT = 0;
    const parts = [], floats = [], pills = [], dotSet = new Map();
    const hero = { i: 5, j: 9, ni: 5, nj: 9, p: 1, dir: [0, 0], want: [0, 0], face: 1 };
    const hintCost = () => Math.max(1, Math.round(20 * ((cfg.perks || {}).hintCost || 1)));
    const villain = S.villainCanvas(v);
    const rnd = (() => { let s = (Date.now() ^ 0x9e3779b9) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    function resize() { const f = $('.bt-field'); const w = f.clientWidth, h = f.clientHeight; if (w < 10 || h < 10) return; dpr = Math.min(2.5, root.devicePixelRatio || 1); W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; { const sc0 = Math.min(W / 360, H / 320); LW = W / sc0; LH = H / sc0; } let nc = Math.round(LW / T0); nc = clamp(nc % 2 ? nc : nc + 1, 11, 33); T = LW / nc; const r = clamp(Math.floor(LH / T), 9, 21); const nr = r % 2 ? r : r - 1; if (!grid || nr !== ROWS || nc !== COLS) { ROWS = nr; COLS = nc; build(); if (q && grid) placePills(); } oy = (LH - ROWS * T) / 2; }
    let tun = [];
    const pass = (i, j) => (j >= 0 && j < ROWS && (i === -1 || i === COLS) && tun.indexOf(j) >= 0) || (i >= 0 && j >= 0 && i < COLS && j < ROWS && grid[j][i] === 0);
    const wrapI = (i) => (i < 0 ? COLS - 1 : i >= COLS ? 0 : i);
    function build() {
      grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
      const stack = [[1, 1]]; grid[1][1] = 0;
      while (stack.length) {
        const [ci, cj] = stack[stack.length - 1]; const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([a, b]) => [ci + a, cj + b, a / 2, b / 2]).filter(([x, y]) => x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1 && grid[y][x] === 1);
        if (!nb.length) { stack.pop(); continue; }
        const [x, y, hx, hy] = nb[Math.floor(rnd() * nb.length)]; grid[cj + hy][ci + hx] = 0; grid[y][x] = 0; stack.push([x, y]);
      }
      for (let j = 1; j < ROWS - 1; j++) for (let i = 1; i < COLS - 1; i++) if (grid[j][i] === 1 && ((i % 2 === 0) !== (j % 2 === 0)) && rnd() < 0.32) grid[j][i] = 0;
      // túneles laterales (como Pac-Man): filas impares abiertas en ambos bordes
      tun = []; { const rows = []; for (let j = 3; j < ROWS - 2; j += 2) if (grid[j][1] === 0 && grid[j][COLS - 2] === 0) rows.push(j); rows.sort(() => rnd() - 0.5); rows.slice(0, ROWS >= 15 ? 2 : 1).forEach((j) => { grid[j][0] = 0; grid[j][COLS - 1] = 0; tun.push(j); }); if (!tun.length) { const j = Math.floor(ROWS / 2) | 1; grid[j][1] = 0; grid[j][COLS - 2] = 0; grid[j][0] = 0; grid[j][COLS - 1] = 0; tun.push(j); } }
      dotSet.clear(); for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (grid[j][i] === 0) dotSet.set(i + ',' + j, true);
      const si = Math.floor(COLS / 2) | 1, sj = ROWS - 2; hero.i = hero.ni = si; hero.j = hero.nj = sj; hero.p = 1; hero.dir = [0, 0]; hero.want = [0, 0]; dotSet.delete(si + ',' + sj);
    }
    function bfs(fi, fj) { const d = Array.from({ length: ROWS }, () => Array(COLS).fill(-1)); const qu = [[fi, fj]]; d[fj][fi] = 0; for (let h = 0; h < qu.length; h++) { const [x, y] = qu[h]; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { if (pass(x + a, y + b)) { const nx = wrapI(x + a), ny = y + b; if (d[ny][nx] < 0) { d[ny][nx] = d[y][x] + 1; qu.push([nx, ny]); } } }); } return d; }
    function placePills() {
      pills.length = 0; const d = bfs(hero.ni, hero.nj), cand = []; for (let j = 1; j < ROWS - 1; j++) for (let i = 1; i < COLS - 1; i++) if (grid[j][i] === 0 && d[j][i] >= 5) cand.push([i, j]);
      cand.sort(() => rnd() - 0.5); const pick = [];
      for (const [i, j] of cand) { if (pick.every(([a, b]) => Math.abs(a - i) + Math.abs(b - j) >= 4)) pick.push([i, j]); if (pick.length === q.options.length) break; }
      for (const [i, j] of cand) { if (pick.length >= q.options.length) break; if (!pick.some(([a, b]) => a === i && b === j)) pick.push([i, j]); }
      q.options.forEach((t, k) => { const lay = fitText(ctx, t, T * 2.6, 2, 14); pills.push({ i: pick[k][0], j: pick[k][1], ni: pick[k][0], nj: pick[k][1], p: 1, dir: [0, 0], home: [pick[k][0], pick[k][1]], jail: 0, ghost: true, text: t, lines: lay.lines, fs: lay.fs, ok: k === q.correct, gone: false, mark: 0, k }); });
      const far = []; for (let j = 1; j < ROWS - 1; j += 2) for (let i = 1; i < COLS - 1; i += 2) if (grid[j][i] === 0 && d[j][i] >= 3 && !pick.some(([a, b]) => a === i && b === j)) far.push([i, j]);
      far.sort(() => rnd() - 0.5); far.slice(0, 2).forEach(([i, j]) => pills.push({ i, j, sigma: true, gone: false }));
    }
    function makeQ() { let x; if (room) { try { return room.getQuestion(qn - 1); } catch (e) { /* ok */ } } try { x = Q.generate(v.topic, v.topic === 'mix' ? 3 : cfg.tier); } catch (e) { x = Q.generate('fracciones', 1); } return x; }
    const fl = (x, y, text, col, size) => floats.push({ x, y, text, c: col || '#fff', size: size || 20, t: 0, life: 0.9 });
    const burst = (x, y, col, n, sp, life) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.3 + Math.random()) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, t: 0, life: life * (0.5 + Math.random() * 0.7), c: Array.isArray(col) ? col[i % col.length] : col, s: 2 + Math.floor(Math.random() * 3) }); } };
    const px = (i) => (i + 0.5) * T, py = (j) => oy + (j + 0.5) * T;
    const posOf = (e) => ({ x: px(e.i + (e.ni - e.i) * e.p), y: py(e.j + (e.nj - e.j) * e.p) });
    const prog = () => c.hud(1 - st.answered / N, st.answered + '/' + N);
    function newQuestion(first) { q = makeQ(); qn++; if (first) fillQ(c, q, topicTag(v, q)); else { fillQ(c, q, topicTag(v, q)); const qb = $('.bt-q'); qb.classList.remove('flip'); void qb.offsetWidth; qb.classList.add('flip'); A.sfx('tick'); } placePills(); }
    function finish(win) { if (ended) return; ended = true; st.over = true; st.win = win; state = 'end'; sT = 0; if (win) { A.sfx('levelup'); c.banner(room ? '¡LISTO!' : '¡VICTORIA!', 'go'); } else { A.sfx('lose'); c.banner('¡DERROTA!', 'lose'); } }
    function respawn() { invul = 2.2; hero.i = hero.ni = Math.floor(COLS / 2) | 1; hero.j = hero.nj = ROWS - 2; hero.p = 1; hero.dir = [0, 0]; hero.want = [0, 0]; }
    function eatPill(pl) {
      if (pl.sigma) { pl.gone = true; st.sigma++; fright = 7; A.sfx('levelup'); const p = posOf(hero); burst(p.x, p.y, ['#c58bff', '#fff', '#5ce1e6'], 26, 180, 0.8); fl(p.x, p.y - 20, '¡PODER! Los fantasmas huyen', '#e2b8ff', 16); return; }
      if (pl.gone) return; const p = posOf(hero);
      if (pl.ok) {
        pl.gone = true; st.answered += 1;
        FB.right(c.wrap, q, !q.wrong);
        const clean = !q.wrong; if (clean) { st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
        const r = c.gain(clean, 0); burst(p.x, p.y, ['#ffe14a', '#fff', '#3ddc97'], 30, 210, 0.8); fl(p.x, p.y - 20, '+' + r.g, '#ffe14a', 24); A.sfx('correct'); A.sfx('hit'); setTimeout(() => A.sfx('coin'), 90); shake = 6; if (st.streak >= 3 && clean) A.sfx('combo', st.streak);
        if (st.answered >= N) return finish(true);
        prog(); newQuestion(false);
      } else if (fright > 0) {
        pl.jail = 5; pl.i = pl.ni = pl.home[0]; pl.j = pl.nj = pl.home[1]; pl.p = 1; st.score += 150; A.sfx('hit'); const cp = posOf(pl); burst(cp.x, cp.y, ['#c58bff', '#fff'], 22, 180, 0.7); fl(cp.x, cp.y - 10, '¡A la cárcel! +150', '#e2b8ff', 16);
      } else if (invul <= 0) {
        st.streak = 0; q.wrong = true; c.log(q, pl.k); c.damage(); burst(p.x, p.y, ['#ff3b5c', '#7a6aa8'], 22, 170, 0.6); fl(p.x, p.y - 20, '✖ ¡Ese no era!', '#ff4d4d', 22); shake = 10; flash = 0.35; A.sfx('boom');
        FB.wrong(c.wrap, q, pl.k);
        explainBox(c, 'Ese no era. ' + (q.hint ? '💡 ' + q.hint : 'Sigue buscando la respuesta correcta.'));
        if (st.hearts <= 0) return finish(false);
        pl.jail = 3; pl.i = pl.ni = pl.home[0]; pl.j = pl.nj = pl.home[1]; pl.p = 1; respawn();
      }
    }
    function hint() {
      if (state !== 'play') return; const wr = pills.filter((p) => p.ghost && !p.ok && !p.gone); if (wr.length < 2) { A.sfx('deny'); return; }
      if (!St.spend(hintCost())) { A.sfx('deny'); return; }
      { const g = wr[Math.floor(rnd() * wr.length)]; g.gone = true; const gp = posOf(g); burst(gp.x, gp.y, ['#ff4d4d', '#fff'], 16, 140, 0.6); } st.hintsUsed++; A.sfx('hint'); hintT = 1; if (q.hint) explainBox(c, '💡 Pista: ' + q.hint); prog();
    }
    $('.bt-hint em').textContent = hintCost(); $('.bt-hint').addEventListener('click', () => { A.unlock(); hint(); });
    // entrada: deslizar, tocar (dirección desde el héroe) o teclado
    let sx = 0, sy = 0, sdown = false;
    const setWant = (dx, dy) => { hero.want = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); A.unlock(); sdown = true; sx = e.clientX; sy = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } });
    cv.addEventListener('pointermove', (e) => { if (!sdown) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) > 14) { setWant(dx, dy); sx = e.clientX; sy = e.clientY; sT = sT; } });
    cv.addEventListener('pointerup', (e) => { if (sdown && Math.hypot(e.clientX - sx, e.clientY - sy) <= 14) { const r = cv.getBoundingClientRect(), p = posOf(hero); setWant((e.clientX - r.left) / r.width * LW - p.x, (e.clientY - r.top) / r.width * LW - p.y); } sdown = false; });
    const KD = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
    const kd = (e) => { const k = e.key.toLowerCase(); if (KD[k]) { hero.want = KD[k]; e.preventDefault(); } else if (k === 'h') hint(); };
    root.addEventListener('keydown', kd);
    root.addEventListener('resize', resize); const ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe($('.bt-field'));
    let dr = 0; c.cleanup = () => { cancelAnimationFrame(dr); root.removeEventListener('resize', resize); root.removeEventListener('keydown', kd); if (ro) ro.disconnect(); };
    const stepEnt = (e, dt, speed, chooser) => {
      let rem = speed * dt;
      while (rem > 0) {
        if (e.p >= 1) { e.i = wrapI(e.ni); e.j = e.nj; e.ni = e.i; e.p = 1; const d = chooser(e); if (!d || (!d[0] && !d[1])) { e.dir = [0, 0]; return; } e.dir = d; e.ni = e.i + d[0]; e.nj = e.j + d[1]; e.p = 0; }
        const use = Math.min(rem, 1 - e.p); e.p += use; rem -= use;
      }
    };
    const heroChoose = (e) => { const w = e.want, d = e.dir; if ((w[0] || w[1]) && pass(e.i + w[0], e.j + w[1])) return w; if ((d[0] || d[1]) && pass(e.i + d[0], e.j + d[1])) return d; return [0, 0]; };
    const chaserChoose = (ch) => {
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => pass(ch.i + a, ch.j + b) && !(a === -ch.dir[0] && b === -ch.dir[1] && (ch.dir[0] || ch.dir[1])));
      if (!opts.length) return [-ch.dir[0], -ch.dir[1]];
      const chase = fright > 0 ? 0.75 : 0.42;
      if (Math.random() > chase) return opts[Math.floor(Math.random() * opts.length)];
      const d = bfs(hero.ni, hero.nj); let best = null, bv = fright > 0 ? -1 : 1e9; opts.forEach(([a, b]) => { const val = d[ch.j + b][wrapI(ch.i + a)]; if (fright > 0 ? val > bv : val < bv) { bv = val; best = [a, b]; } }); return best || opts[0];
    };
    c.onTick = (dt) => {
      { const f = cv.parentNode; if (f && (Math.abs(f.clientWidth - W) > 1 || Math.abs(f.clientHeight - H) > 1)) resize(); }
      if (W <= 0 || !grid) return; sT += dt;
      parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].life) parts.splice(i, 1);
      floats.forEach((f) => { f.t += dt; f.y -= 26 * dt; }); for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t >= floats[i].life) floats.splice(i, 1);
      shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt); fright = Math.max(0, fright - dt); invul = Math.max(0, invul - dt); hintT = Math.max(0, hintT - dt);
      if (state === 'intro') { if (sT > 0.1 && !st.said) { st.said = true; c.banner('¡AL LABERINTO!', 'go', 1200); } if (sT > 1.3) { newQuestion(true); state = 'read'; sT = 0; const len = q.text.length + (q.table ? 30 : 0) + q.options.reduce((a, o) => a + o.length, 0) * 0.4; readFor = Math.min(room ? 6 : 10, Math.max(room ? 3 : 4, 2 + len * 0.06)); intro.show(q, readFor, topicTag(v, q)); } }
      else if (state === 'read') { if (sT >= readFor) { state = 'settle'; sT = 0; intro.settle(); A.sfx('tick'); } }
      else if (state === 'settle') { if (sT >= 0.55) { intro.end(); state = 'play'; sT = 0; A.sfx('go'); c.banner('¡YA!', 'go', 550); prog(); } }
      else if (state === 'play') {
        // héroe: permite invertir en pleno paso
        if (hero.p < 1 && (hero.want[0] === -hero.dir[0] && hero.want[1] === -hero.dir[1]) && (hero.want[0] || hero.want[1])) { const a = [hero.i, hero.j]; hero.i = hero.ni; hero.j = hero.nj; hero.ni = a[0]; hero.nj = a[1]; hero.p = 1 - hero.p; hero.dir = hero.want; }
        stepEnt(hero, dt, 4.3, heroChoose); if (hero.dir[0]) hero.face = hero.dir[0];
        const hp = posOf(hero), ti = Math.round(hp.x / T - 0.5), tj = Math.round((hp.y - oy) / T - 0.5);
        const key = ti + ',' + tj; if (dotSet.has(key)) { dotSet.delete(key); st.score += 5; dots++; if (dots % 10 === 0) { st.coins += 1; A.sfx('coin'); fl(hp.x, hp.y - 20, '+1¢', '#ffd23f', 14); } else if (dots % 3 === 0) A.sfx('tick'); }
        for (const pl of pills.slice()) {
          if (pl.gone || ended) continue;
          if (pl.sigma) { if (Math.abs(pl.i - (hero.i + (hero.ni - hero.i) * hero.p)) < 0.6 && Math.abs(pl.j - (hero.j + (hero.nj - hero.j) * hero.p)) < 0.6) eatPill(pl); continue; }
          if (pl.jail > 0) { pl.jail -= dt; continue; }
          stepEnt(pl, dt, (fright > 0 ? 1.7 : 2.4 + Math.min(1, cfg.tier * 0.1 + qn * 0.2)) * (room && cfg.fallSecs ? Math.max(0.6, Math.min(1.35, 27 / cfg.fallSecs)) : 1) * c.speedMul(), chaserChoose);
          const cp = posOf(pl); if (Math.hypot(cp.x - hp.x, cp.y - hp.y) < T * 0.66) eatPill(pl);
        }
        c.hud(1 - st.answered / N, st.answered + '/' + N);
      }
      else if (state === 'end') { if (sT > (room ? 0.9 : st.win ? 2.6 : 2.0) && !st.reported) { st.reported = true; const r = c.report(); r.sigma = st.sigma; cfg.onEnd(r); } }
    };
    const draw = (t) => {
      if (W <= 0 || !grid) return; const sc = W / LW; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.scale(sc, sc); if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      const pal = v.pal; let g = ctx.createLinearGradient(0, 0, 0, LH); g.addColorStop(0, '#0a0524'); g.addColorStop(1, '#170c3d'); ctx.fillStyle = g; ctx.fillRect(-10, -10, LW + 20, LH + 20);
      // paredes neón
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (grid[j][i] === 1) {
        const x = i * T, y = oy + j * T; ctx.fillStyle = '#1b1a6b'; ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.75; ctx.lineWidth = 2;
        ctx.beginPath(); if (!(j > 0 && grid[j - 1][i] === 1)) { ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + T - 1, y + 1); } if (!(j < ROWS - 1 && grid[j + 1][i] === 1)) { ctx.moveTo(x + 1, y + T - 1); ctx.lineTo(x + T - 1, y + T - 1); } if (!(i > 0 && grid[j][i - 1] === 1)) { ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 1, y + T - 1); } if (!(i < COLS - 1 && grid[j][i + 1] === 1)) { ctx.moveTo(x + T - 1, y + 1); ctx.lineTo(x + T - 1, y + T - 1); } ctx.stroke(); ctx.globalAlpha = 1;
      }
      // portales de los túneles
      tun.forEach((j) => [0, COLS - 1].forEach((i) => { const x = px(i), y = py(j), r = T * (0.34 + 0.06 * Math.sin(t * 6 + i)); ctx.save(); ctx.globalAlpha = 0.85; ctx.strokeStyle = '#5ce1e6'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 1.25, 0, 0, 6.283); ctx.stroke(); ctx.strokeStyle = '#c58bff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, r * 0.35, r * 0.8, t * 3, 0, 6.283); ctx.stroke(); ctx.restore(); }));
      // puntos
      ctx.fillStyle = '#ffe9a8'; dotSet.forEach((_, k) => { const [i, j] = k.split(',').map(Number); ctx.fillRect(Math.round(px(i)) - 2, Math.round(py(j)) - 2, 4, 4); });
      // píldoras de poder y fantasmas-respuesta
      pills.forEach((pl) => {
        if (pl.gone) return;
        if (pl.sigma) { const x = px(pl.i), y = py(pl.j), bob = Math.sin(t * 5 + pl.i) * 2, r = 11 + Math.sin(t * 6) * 1.5; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y + bob, r + 3, 0, 6.283); ctx.fill(); ctx.fillStyle = '#c58bff'; ctx.beginPath(); ctx.arc(x, y + bob, r, 0, 6.283); ctx.fill(); ctx.fillStyle = '#1a1033'; ctx.font = `800 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Σ', x, y + bob + 1); return; }
        const home = { x: px(pl.home[0]), y: py(pl.home[1]) };
        if (pl.jail > 0) { ctx.strokeStyle = '#8a83b0'; ctx.lineWidth = 3; ctx.strokeRect(home.x - T * 0.45, home.y - T * 0.45, T * 0.9, T * 0.9); for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(home.x + k * T * 0.25, home.y - T * 0.45); ctx.lineTo(home.x + k * T * 0.25, home.y + T * 0.45); ctx.stroke(); } ctx.fillStyle = '#c9c2ee'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('🔒 ' + Math.ceil(pl.jail) + 's', home.x, home.y - T * 0.6); return; }
        const p = posOf(pl), col = LANE_COL[pl.k], fr = fright > 0, blink = fr && fright < 2 && Math.floor(t * 8) % 2, bw = T * 0.95, by = p.y + Math.sin(t * 6 + pl.k) * 1.5;
        ctx.save(); ctx.translate(p.x, by);
        ctx.fillStyle = fr ? (blink ? '#fff' : '#2a4bff') : col; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, -bw * 0.1, bw / 2, Math.PI, 0); const wob = Math.sin(t * 12 + pl.k) * 1.5; ctx.lineTo(bw / 2, bw / 2); for (let k = 0; k < 4; k++) { ctx.lineTo(bw / 2 - (k + 0.5) * (bw / 4), bw / 2 - 5 + (k % 2 ? 0 : wob)); ctx.lineTo(bw / 2 - (k + 1) * (bw / 4), bw / 2); } ctx.closePath(); ctx.fill(); ctx.stroke();
        const ex = pl.dir[0] * 2, ey = pl.dir[1] * 2; [-1, 1].forEach((sg) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sg * bw * 0.2, -bw * 0.15, bw * 0.13, 0, 6.283); ctx.fill(); ctx.fillStyle = fr ? '#ff4d6d' : '#1a1033'; ctx.beginPath(); ctx.arc(sg * bw * 0.2 + ex, -bw * 0.15 + ey, bw * 0.06, 0, 6.283); ctx.fill(); });
        ctx.restore();
        const lh = pl.fs * 1.15; ctx.font = `800 ${pl.fs}px ${FONT}`; const w = Math.max(...pl.lines.map((l) => ctx.measureText(l).width)) + 12, h = pl.lines.length * lh + 8;
        const lx = clamp(p.x, w / 2 + 2, LW - w / 2 - 2), ly = Math.max(h / 2 + 2, by - bw * 0.62 - h / 2);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx - w / 2 - 2, ly - h / 2 - 2, w + 4, h + 4, 9) : ctx.rect(lx - w / 2 - 2, ly - h / 2 - 2, w + 4, h + 4); ctx.fill();
        ctx.fillStyle = '#2a1f86'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx - w / 2, ly - h / 2, w, h, 8) : ctx.rect(lx - w / 2, ly - h / 2, w, h); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `800 ${pl.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; pl.lines.forEach((l, i) => ctx.fillText(l, lx, ly - h / 2 + 4 + lh * (i + 0.5) + 1));
      });
      // héroe
      { const p = posOf(hero), hh = T * 1.9, hs = hh / S.HERO_H, hw = S.HERO_W * hs, moving = hero.dir[0] || hero.dir[1], hc = S.heroCanvas(cfg.look, moving ? 'idle' : 'idle', moving ? Math.floor(t * 10) % 4 : 0);
        ctx.save(); ctx.translate(p.x, p.y + T * 0.42); if (invul > 0 && Math.floor(invul * 14) % 2) ctx.globalAlpha = 0.4; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 0, T * 0.4, T * 0.12, 0, 0, 6.283); ctx.fill(); if (hero.face < 0) ctx.scale(-1, 1); ctx.drawImage(hc, -hw / 2, -hh + 2, hw, hh); ctx.restore();
        if (fright > 0) { ctx.strokeStyle = 'rgba(197,139,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, T * 0.85 + Math.sin(t * 10) * 2, 0, 6.283); ctx.stroke(); } }
      parts.forEach((p) => { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }); ctx.globalAlpha = 1;
      floats.forEach((f) => { ctx.globalAlpha = clamp(1 - f.t / f.life, 0, 1); ctx.font = `${f.size}px Bangers, ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a1033'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }); ctx.globalAlpha = 1;
      ctx.restore(); if (flash > 0) { ctx.fillStyle = `rgba(255,30,60,${Math.min(0.4, flash)})`; ctx.fillRect(0, 0, W, H); }
    };
    const dl = (ts) => { if (c.destroyed || !c.wrap.parentNode) return; dr = requestAnimationFrame(dl); draw(ts / 1000); }; dr = requestAnimationFrame(dl);
    c.hud(1, '0/' + N); c.start(); resize();
    return { destroy: c.destroy, refresh: prog, pause: () => c.toggle(true), state: st, _mz: { get pills() { return pills; }, get hero() { return hero; }, get grid() { return grid; }, get st() { return state; }, bfs, want: (d) => { hero.want = d; }, pass, get cols() { return COLS; } } };
  }


  /* ------------------------------------------------------------------
   * Mini-tutorial (se puede omitir; "No volver a mostrar" lo guarda)
   * ------------------------------------------------------------------ */
  const TUT = {
    shoot: { name: 'Disparo', pages: [
      ['📖', 'Lee la pregunta', 'Arriba aparece un problema de Cálculo. Tómate tu tiempo: no hay prisa para pensar.'],
      ['🎯', 'Dispara a la respuesta correcta', 'Caen 4 respuestas. TOCA la que creas correcta y tu héroe le dispara (en compu: teclas 1 a 4).'],
      ['❤️', 'Cuidado con las vidas', 'Si le disparas a una incorrecta, o la correcta cae al suelo, pierdes una vida. Cada acierto daña al villano. 💡 Pista y ⚡ Poder te ayudan.'],
    ] },
    run: { name: 'Carrera', pages: [
      ['👆', 'Mueve a tu héroe', 'Arrastra el dedo por la pantalla y tu héroe te sigue (en compu: flechas o WASD).'],
      ['🚪', 'Cruza la puerta correcta', 'Cada puerta lleva una respuesta. Atraviesa SOLO la correcta. Esquiva las minas 💣.'],
      ['🪙', 'Recoge extras', 'Las monedas 🪙 suman puntos y Σ te da poderes. Si te equivocas, verás la explicación para aprender.'],
    ] },
    maze: { name: 'Laberinto', pages: [
      ['👆', 'Desliza para moverte', 'Desliza el dedo (o usa flechas/WASD) y tu héroe avanza por el laberinto comiendo puntitos.'],
      ['👻', 'Cómete al fantasma correcto', 'Cada fantasma lleva una respuesta. Cómete SOLO el de la respuesta correcta. Si tocas otro, pierdes una vida.'],
      ['⇄', 'Túneles y poder Σ', 'Los túneles de los lados te teletransportan al otro extremo. La píldora Σ asusta a los fantasmas: ¡puedes mandarlos a la cárcel!'],
    ] },
  };
  function withTutorial(cfg, kind, startFn) {
    const key = 'duix.tut.' + kind; let seen = false;
    try { seen = localStorage.getItem(key) === '1'; } catch (e) { /* ok */ }
    if (seen || cfg.noTutorial || root.__noTutorial) return startFn(cfg);
    const T = TUT[kind]; let i = 0, inner = null, dead = false, remember = false;
    const ov = el('div', 'tut'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Cómo se juega ' + T.name);
    function draw() {
      const pg = T.pages[i], last = i === T.pages.length - 1;
      ov.innerHTML = `<button class="tut-skip" data-a="skip">Omitir ✕</button>
        <div class="tut-card"><small class="tut-game">CÓMO SE JUEGA · ${esc(T.name.toUpperCase())}</small>
          <div class="tut-ico" aria-hidden="true">${pg[0]}</div><h2>${esc(pg[1])}</h2><p>${esc(pg[2])}</p>
          <div class="tut-dots">${T.pages.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
          <label class="tut-rem"><input type="checkbox" ${remember ? 'checked' : ''}> No volver a mostrar</label>
          <div class="tut-btns">${i > 0 ? '<button class="btn ghost" data-a="prev">Atrás</button>' : ''}<button class="btn big" data-a="next">${last ? '¡A jugar!' : 'Siguiente'}</button></div></div>`;
    }
    function finish() { if (dead) return; try { if (remember) localStorage.setItem(key, '1'); } catch (e) { /* ok */ } dead = true; ov.remove(); dead = false; inner = startFn(cfg); }
    ov.addEventListener('change', (e) => { if (e.target.type === 'checkbox') remember = e.target.checked; });
    ov.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; A.sfx('click'); const a = b.dataset.a; if (a === 'skip') finish(); else if (a === 'prev') { i = Math.max(0, i - 1); draw(); } else if (i >= T.pages.length - 1) finish(); else { i++; draw(); } });
    draw(); cfg.container.appendChild(ov);
    const none = { mistakes: [], score: 0, correct: 0, answered: 0, bestStreak: 0, hearts: 3 };
    return { destroy() { dead = true; ov.remove(); if (inner) inner.destroy(); }, refresh() { if (inner && inner.refresh) inner.refresh(); }, pause() { if (inner && inner.pause) inner.pause(); },
      get state() { return inner ? inner.state : none; }, get _mz() { return inner && inner._mz; }, get _fire() { return inner && inner._fire; }, get _caps() { return inner && inner._caps; }, get _hint() { return inner && inner._hint; }, get _power() { return inner && inner._power; } };
  }

  function start(cfg) {
    const v = cfg.villain;
    if (!v.endless && !cfg.room) { if (cfg.tier === 2) return withTutorial(cfg, 'run', startRun); if (cfg.tier === 3) return withTutorial(cfg, 'maze', startMaze); }
    return withTutorial(cfg, 'shoot', (c2) => root.DuiXBattle.start(c2));
  }
  root.DuiXGames = { start, GAMES, startRun, startMaze, withTutorial, TUT };
})(window);
