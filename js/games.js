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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const PRAISE = ['¡POW!', '¡BAM!', '¡ZAP!', '¡BOOM!', '¡WHAM!', '¡GENIAL!'];
  const GAMES = { 1: { id: 'shoot', name: 'Disparo', icon: '🎯' }, 2: { id: 'run', name: 'Carrera', icon: '🏃' }, 3: { id: 'pairs', name: 'Pares', icon: '🧩' } };

  /* ------------------------------------------------------------------
   * Núcleo común: HUD, corazones, puntaje, pausa, informe
   * ------------------------------------------------------------------ */
  function core(cfg, kind, bodyHtml, ctlHtml) {
    const v = cfg.villain, perks = cfg.perks || {}, tier = cfg.tier;
    const startHearts = 3 + (perks.hearts || 0);
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
      <div class="bt-pausemenu" hidden><div class="bt-pbox"><h2>Pausa</h2><button class="btn big" data-a="resume">Seguir jugando</button><div class="bt-pset"><b>Música</b><div class="seg bt-mpick"></div><label class="set bt-sfxrow"><span>Efectos de sonido</span><input type="checkbox" class="bt-sfxchk"><span class="sw2"></span></label></div><button class="btn ghost" data-a="quit">Salir</button></div></div>`;
    cfg.container.appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    const api = { wrap, $, st, v, perks, tier, destroyed: false, raf: 0, last: 0, onTick: null, onResume: null };
    const mult = () => 1 + Math.min(2, Math.floor(Math.max(0, st.streak - 1) / 3) * 0.5);
    api.mult = mult;
    api.hearts = () => { const h = $('.bt-hearts'); h.innerHTML = ''; for (let i = 0; i < st.maxHearts; i++) { const im = new Image(); im.alt = ''; im.src = S.icon(i < st.hearts ? 'heart' : 'heartEmpty', 3); h.appendChild(im); } if (st.shield > 0) h.appendChild(el('span', 'bt-shield', '🛡')); };
    api.hud = (frac, text) => {
      $('.bt-score').textContent = String(Math.round(st.score));
      $('.bt-coins b').textContent = String(St.profile() ? St.profile().coins + st.coins : st.coins);
      const m = mult(); $('.bt-combo').textContent = st.streak >= 2 ? `Racha ${st.streak}${m > 1 ? ' · x' + m : ''}` : '';
      $('.bt-hpbar i').style.width = clamp(frac, 0, 1) * 100 + '%'; $('.bt-hptxt').textContent = text || '';
    };
    api.damage = () => {
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
    api.toggle = (p) => { if (st.over) return; st.paused = p === undefined ? !st.paused : p; $('.bt-pausemenu').hidden = !st.paused; A.sfx('pause'); if (!st.paused) { api.last = 0; api.onResume && api.onResume(); } };
    // música / efectos
    { const mp = $('.bt-mpick'), chk = $('.bt-sfxchk');
      const now = () => { const q = St.settings(); return !q.music ? 'off' : q.musicStyle === 'calma' ? 'calma' : 'arcade'; };
      const draw = () => { mp.innerHTML = ''; [['arcade', 'Arcade'], ['calma', 'Calmada'], ['off', 'Sin música']].forEach(([id, label]) => { const b = el('button', 'segb' + (now() === id ? ' on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { A.unlock(); if (id === 'off') St.setSetting('music', false); else { St.setSetting('musicStyle', id); St.setSetting('music', true); } draw(); }); mp.appendChild(b); }); };
      draw(); chk.checked = !!St.settings().sfx; chk.addEventListener('change', () => St.setSetting('sfx', chk.checked)); }
    $('.bt-pause').addEventListener('click', () => api.toggle(true));
    $('.bt-pausemenu').addEventListener('click', (e) => { const a = e.target.dataset && e.target.dataset.a; if (a === 'resume') api.toggle(false); if (a === 'quit') { api.destroy(); cfg.onQuit && cfg.onQuit(); } });
    const onVis = () => { if (document.hidden) api.toggle(true); };
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
    const v = cfg.villain, N = v.boss ? 5 : 4;
    const body = `<div class="bt-q"><div class="bt-qtag"></div><div class="bt-qtext"></div><div class="bt-qtable"></div><div class="bt-explain" hidden></div></div>
      <div class="bt-field"><canvas></canvas><div class="bt-banner" hidden></div></div>${BIGHTML}`;
    const ctl = `<button class="bt-btn bt-hint"><img alt="" src="${S.icon('bulb', 3)}"><span>Pista</span><em></em></button>
      <div class="bt-keys">Toca un carril (o desliza) para correr hasta él<br><small>Teclado: ← → o 1-4 · H pista</small></div>`;
    const c = core(cfg, 'run', body, ctl), st = c.st, $ = c.$, cv = $('.bt-field canvas'), ctx = cv.getContext('2d');
    const intro = qIntro(c), LW = 360;
    let W = 0, H = 0, dpr = 1, LH = 560, qn = 0, q = null, gates = [], lane = 1, hx = 1.5, state = 'intro', sT = 0, readFor = 3, T = 13, tt = 0, parts = [], floats = [], shake = 0, flash = 0, scroll = 0;
    const T0 = 0.2, hintCost = () => Math.max(1, Math.round(20 * ((cfg.perks || {}).hintCost || 1)));
    const villain = S.villainCanvas(v), heroPose = (t) => S.heroCanvas(cfg.look, 'idle', Math.floor(t * 8) % 4);

    function resize() { const f = $('.bt-field'); const w = f.clientWidth, h = f.clientHeight; if (w < 10 || h < 10) return; dpr = Math.min(2.5, root.devicePixelRatio || 1); W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; LH = H * (LW / W); }
    // geometría en perspectiva
    const hy = () => LH * 0.2, heroY = () => LH - 20;
    const yAt = (t) => hy() + (heroY() - 70 - hy()) * (t * t * 0.55 + t * 0.45) + 70 * t * 0.0;
    const sAt = (t) => 0.5 + 0.5 * t;
    const laneW = (t) => 56 + 30 * t;
    const xAt = (t, l) => LW / 2 + (l - 1.5) * laneW(t);
    function wrapLines(text, maxW) {
      const tokens = []; let cur = '';
      for (let i = 0; i < text.length; i++) { cur += text[i]; const n = text[i + 1]; if (text[i] === ' ' || (text[i] === ')' && n === '(') || (text[i] === ',' && n === ' ')) { tokens.push(cur); cur = ''; } }
      if (cur) tokens.push(cur);
      for (let fs = 16; fs >= 9; fs--) {
        ctx.font = `700 ${fs}px ${FONT}`; const lines = []; let line = '', ok = true;
        for (const t of tokens) { if (ctx.measureText(t.trimEnd()).width > maxW) { ok = false; break; } if (ctx.measureText((line + t).trimEnd()).width <= maxW) line += t; else { lines.push(line.trimEnd()); line = t; } }
        if (line) lines.push(line.trimEnd()); if (ok && lines.length <= (fs > 12 ? 2 : 3)) return { lines, fs };
      }
      ctx.font = `700 9px ${FONT}`; const out = []; let l = ''; for (const ch of text) { if (ctx.measureText(l + ch).width > maxW) { out.push(l); l = ch; } else l += ch; } out.push(l); return { lines: out, fs: 9 };
    }
    function next() {
      try { q = Q.generate(v.topic, v.topic === 'mix' ? Math.max(2, cfg.tier) : cfg.tier); } catch (e) { q = Q.generate('fracciones', 1); }
      qn++; fillQ(c, q, topicTag(v, q));
      gates = q.options.map((t, i) => { const lay = wrapLines(t, 74); return { lane: i, text: t, lines: lay.lines, fs: lay.fs, ok: i === q.correct, h: Math.max(40, lay.lines.length * lay.fs * 1.22 + 16), crossed: false, hit: 0 }; });
      const more = 1, len = q.text.length + (q.table ? 30 : 0) + q.options.reduce((a, o) => a + o.length, 0) * 0.4;
      readFor = Math.min(8, Math.max(3, 1.7 + len * 0.05)) * more; T = Math.max(10.5, 14 - qn * 0.6); tt = 0;
      state = 'read'; sT = 0; intro.show(q, readFor, topicTag(v, q)); c.hud(1 - st.answered / N, st.answered + '/' + N);
    }
    function resolve() {
      const g = gates[lane]; st.answered++; const x = xAt(1, lane), y = heroY() - 50;
      if (g.ok) {
        const clean = !st.qWrong; if (clean) { st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
        const r = c.gain(clean, 0); g.hit = 1; burst(x, y, ['#ffe14a', '#fff', LANE_COL[lane]], 26, 200, 0.7); floats.push({ x, y: y - 20, text: '+' + r.g, c: '#ffe14a', size: 22, t: 0, life: 0.9 });
        A.sfx('correct'); A.sfx('hit'); setTimeout(() => A.sfx('coin'), 90); shake = 6; c.banner(PRAISE[Math.floor(Math.random() * PRAISE.length)], 'good', 700);
        if (st.answered >= N) { st.over = true; st.win = true; state = 'end'; sT = 0; A.sfx('levelup'); c.banner('¡VICTORIA!', 'go'); c.hud(0, N + '/' + N); return; }
        state = 'between'; sT = 0; c.hud(1 - st.answered / N, st.answered + '/' + N);
      } else {
        st.streak = 0; g.hit = -1; c.log(q, lane); const hurt = c.damage(); burst(x, y, ['#ff3b5c', '#7a6aa8'], 20, 160, 0.6); floats.push({ x, y: y - 20, text: '✖', c: '#ff4d4d', size: 30, t: 0, life: 0.9 });
        shake = 10; flash = 0.35; explainBox(c, 'La correcta era «' + q.options[q.correct] + '». ' + q.explain); void hurt;
        if (st.hearts <= 0) { st.over = true; st.win = false; state = 'end'; sT = 0; A.sfx('lose'); c.banner('¡DERROTA!', 'lose'); return; }
        st.qWrong = true; state = 'between'; sT = 0; gates.forEach((k) => { if (k.ok) k.hit = 2; });
      }
      c.hud(1 - st.answered / N, st.answered + '/' + N);
    }
    function burst(x, y, col, n, sp, life) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.3 + Math.random()) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, t: 0, life: life * (0.5 + Math.random() * 0.7), c: Array.isArray(col) ? col[i % col.length] : col, s: 2 + Math.floor(Math.random() * 3) }); } }
    function setLane(l) { lane = clamp(l, 0, 3); }
    function hint() {
      if (state !== 'play') return; const wrong = gates.filter((g) => !g.ok && !g.crossed); if (wrong.length < 2) { A.sfx('deny'); return; }
      if (!St.spend(hintCost())) { A.sfx('deny'); floats.push({ x: LW / 2, y: LH * 0.6, text: '¡Faltan monedas!', c: '#ff9a9a', size: 15, t: 0, life: 1 }); return; }
      wrong[Math.floor(Math.random() * wrong.length)].crossed = true; st.hintsUsed++; A.sfx('hint'); if (q.hint) explainBox(c, '💡 Pista: ' + q.hint); c.hud(1 - st.answered / N, st.answered + '/' + N);
    }
    $('.bt-hint em').textContent = hintCost();
    $('.bt-hint').addEventListener('click', () => { A.unlock(); hint(); });
    const laneFromX = (e) => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * LW; return clamp(Math.floor((x - (LW / 2 - laneW(1) * 2)) / laneW(1)), 0, 3); };
    let drag = false;
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); A.unlock(); drag = true; setLane(laneFromX(e)); });
    cv.addEventListener('pointermove', (e) => { if (drag) setLane(laneFromX(e)); });
    root.addEventListener('pointerup', () => { drag = false; });
    c.keys = (e) => { const k = e.key; if (k >= '1' && k <= '4') { setLane(+k - 1); e.preventDefault(); } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { setLane(lane - 1); e.preventDefault(); } else if (k === 'ArrowRight' || k === 'd' || k === 'D') { setLane(lane + 1); e.preventDefault(); } else if (k === 'h' || k === 'H') hint(); };
    root.addEventListener('resize', resize); const ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe($('.bt-field'));
    c.cleanup = () => { root.removeEventListener('resize', resize); if (ro) ro.disconnect(); };
    st.qWrong = false;

    c.onTick = (dt, t) => {
      { const f = cv.parentNode; if (f && (Math.abs(f.clientWidth - W) > 1 || Math.abs(f.clientHeight - H) > 1)) resize(); }
      if (W <= 0) return;
      sT += dt; hx += (lane + 0.5 - hx + 1 - 1) * Math.min(1, dt * 14); scroll += dt * (state === 'play' ? 1 : 0.35);
      parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }); parts = parts.filter((p) => p.t < p.life); floats.forEach((f) => { f.t += dt; f.y -= 26 * dt; }); floats = floats.filter((f) => f.t < f.life);
      shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt);
      if (state === 'intro') { if (sT > 0.1 && !st.said) { st.said = true; c.banner('¡A CORRER!', 'go', 1200); } if (sT > 1.4) { state = 'wait'; next(); } }
      else if (state === 'read') { if (sT >= readFor) { state = 'settle'; sT = 0; intro.settle(); A.sfx('tick'); } }
      else if (state === 'settle') { if (sT >= 0.55) { intro.end(); state = 'play'; sT = 0; tt = 0; st.qWrong = false; A.sfx('go'); c.banner('¡YA!', 'go', 550); } }
      else if (state === 'play') { tt += dt / T; if (tt >= 1) { tt = 1; resolve(); } }
      else if (state === 'between') { if (sT >= (st.qWrong ? 2.6 : 0.95)) { if (st.over) return; next(); } }
      else if (state === 'end') { if (sT > (st.win ? 2.6 : 2.0) && !st.reported) { st.reported = true; cfg.onEnd(c.report()); } }
    };
    function drawGate(g, t) {
      const lw = laneW(t), w = lw * 0.94, sc = w / 78, gh = g.h * sc, x = xAt(t, g.lane), y = yAt(t);
      const col = LANE_COL[g.lane]; const pop = g.hit > 0 && state !== 'play';
      ctx.save(); ctx.translate(x, y); if (g.hit === -1) ctx.globalAlpha = 0.5;
      // poste
      ctx.fillStyle = '#1a1033'; ctx.fillRect(-w / 2 - 3, -gh - 4, 6 * sc, gh + 4); ctx.fillRect(w / 2 - 3 * sc, -gh - 4, 6 * sc, gh + 4);
      const bx = -w / 2, by = -gh - gh * 0.1;
      ctx.fillStyle = '#1a1033'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - 3, by - 3, w + 6, gh + 6, 10 * sc) : ctx.rect(bx - 3, by - 3, w + 6, gh + 6); ctx.fill();
      ctx.fillStyle = g.crossed ? '#3a3355' : g.hit === 2 ? '#3ddc97' : pop ? '#ffd23f' : '#2a1e6b'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, w, gh, 8 * sc) : ctx.rect(bx, by, w, gh); ctx.fill();
      ctx.strokeStyle = g.crossed ? '#6a6390' : col; ctx.lineWidth = 3 * sc; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx + 9 * sc, by + 9 * sc, 8 * sc, 0, 6.283); ctx.fill(); ctx.fillStyle = '#1a1033'; ctx.font = `800 ${10 * sc}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(g.lane + 1), bx + 9 * sc, by + 9.5 * sc);
      ctx.fillStyle = g.crossed ? '#8a83b0' : (pop || g.hit === 2) ? '#1a1033' : '#fff'; ctx.font = `700 ${g.fs * sc}px ${FONT}`; const lh = g.fs * 1.22 * sc, y0 = by + gh / 2 - (g.lines.length - 1) * lh / 2 + 1;
      g.lines.forEach((l, i) => ctx.fillText(l, 0, y0 + i * lh, w - 8 * sc));
      if (g.crossed) { ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 4 * sc; ctx.beginPath(); ctx.moveTo(bx + 6, by + 6); ctx.lineTo(bx + w - 6, by + gh - 6); ctx.moveTo(bx + w - 6, by + 6); ctx.lineTo(bx + 6, by + gh - 6); ctx.stroke(); }
      ctx.restore();
    }
    c.onPaused = () => {};
    const draw = (t) => {
      if (W <= 0) return; const sc = W / LW; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.scale(sc, sc); if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      const y0 = hy(), pal = v.pal;
      // cielo
      let g = ctx.createLinearGradient(0, 0, 0, y0 + 10); g.addColorStop(0, '#0d0720'); g.addColorStop(1, S.mix ? S.mix('#2a1e6b', pal.main, 0.35) : '#3a2a8f'); ctx.fillStyle = g; ctx.fillRect(-10, -10, LW + 20, y0 + 20);
      for (let i = 0; i < 26; i++) { const sx = (i * 97 + 13) % LW, sy = (i * 53) % (y0 - 8); ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 2 + i)})`; ctx.fillRect(sx, sy, 2, 2); }
      // siluetas de ciudad en el horizonte
      ctx.fillStyle = '#150c33'; for (let i = 0; i < 12; i++) { const bw = 34, bx = i * 32 - 8, bh = 16 + ((i * 37) % 30); ctx.fillRect(bx, y0 - bh, bw, bh + 2); ctx.fillStyle = 'rgba(255,220,120,.5)'; for (let k = 0; k < 3; k++) ctx.fillRect(bx + 6 + k * 9, y0 - bh + 6 + ((i + k) % 3) * 8, 3, 3); ctx.fillStyle = '#150c33'; }
      // suelo
      g = ctx.createLinearGradient(0, y0, 0, LH); g.addColorStop(0, '#1b1140'); g.addColorStop(1, '#0d0720'); ctx.fillStyle = g; ctx.fillRect(-10, y0, LW + 20, LH - y0 + 10);
      // pista
      const rt = xAt(0, 0) - laneW(0) / 2, rt2 = xAt(0, 3) + laneW(0) / 2, rb = xAt(1, 0) - laneW(1) / 2, rb2 = xAt(1, 3) + laneW(1) / 2, yb = yAt(1) + 90;
      ctx.fillStyle = '#2b2160'; ctx.beginPath(); ctx.moveTo(rt, y0); ctx.lineTo(rt2, y0); ctx.lineTo(xAt(1.6, 3) + laneW(1.6) / 2, yb + 200); ctx.lineTo(xAt(1.6, 0) - laneW(1.6) / 2, yb + 200); ctx.fill();
      // bordes neón
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rt, y0); ctx.lineTo(xAt(1.6, 0) - laneW(1.6) / 2, yb + 200); ctx.moveTo(rt2, y0); ctx.lineTo(xAt(1.6, 3) + laneW(1.6) / 2, yb + 200); ctx.stroke();
      // separadores de carril
      for (let l = 1; l < 4; l++) { ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LW / 2 + (l - 2) * laneW(0), y0); ctx.lineTo(LW / 2 + (l - 2) * laneW(1.6), yb + 200); ctx.stroke(); }
      // rayas que avanzan
      for (let i = 0; i < 9; i++) { const ph = ((i / 9 + scroll * 0.35) % 1), tt2 = ph * ph; const yy = y0 + (yb - y0) * tt2, ww = 2 + 6 * tt2, hh = 3 + 16 * tt2; ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let l = 1; l < 4; l++) ctx.fillRect(LW / 2 + (l - 2) * (laneW(0) + (laneW(1) - laneW(0)) * tt2) - ww / 2, yy, ww, hh); }
      // postes laterales que pasan
      for (let i = 0; i < 6; i++) { const ph = ((i / 6 + scroll * 0.3) % 1), tt2 = ph * ph, yy = y0 + (yb + 30 - y0) * tt2, off = 118 + 150 * tt2, s2 = 0.3 + tt2 * 1.2; [-1, 1].forEach((sd) => { const px = LW / 2 + sd * off; ctx.fillStyle = '#100826'; ctx.fillRect(px - 3 * s2, yy - 34 * s2, 6 * s2, 34 * s2); ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(px, yy - 36 * s2, 7 * s2, 0, 6.283); ctx.fill(); }); }
      // villano al fondo
      { const vs = 78, bob = Math.sin(t * 2.4) * 3; ctx.save(); ctx.globalAlpha = state === 'end' && st.win ? Math.max(0, 1 - sT / 1.2) : 1; ctx.drawImage(villain, LW / 2 - vs / 2, y0 - vs * 0.82 + bob, vs, vs); ctx.restore(); }
      // puertas
      if (state === 'play' || state === 'between' || state === 'end') { const tp = state === 'play' ? tt : 1; const tv = T0 + (1 - T0) * tp; [...gates].sort((a, b) => a.lane - b.lane).forEach((gt) => drawGate(gt, tv)); }
      // héroe
      { const hs = 2, hc = heroPose(t), hw = S.HERO_W * hs, hh = S.HERO_H * hs; const px = LW / 2 + (hx - 2) * laneW(1), bob = Math.abs(Math.sin(t * 9)) * 4;
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(px, heroY() + 2, 26, 6, 0, 0, 6.283); ctx.fill(); ctx.drawImage(hc, Math.round(px - hw / 2), Math.round(heroY() - hh - bob + 6), hw, hh);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(Math.round(px - laneW(1) / 2), yAt(0.5), laneW(1), heroY() - yAt(0.5)); }
      parts.forEach((p) => { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }); ctx.globalAlpha = 1;
      floats.forEach((f) => { ctx.globalAlpha = clamp(1 - f.t / f.life, 0, 1); ctx.font = `${f.size}px Bangers, ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a1033'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }); ctx.globalAlpha = 1;
      // barra de llegada
      if (state === 'play') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(10, 6, LW - 20, 6); ctx.fillStyle = tt > 0.75 ? '#ff3b5c' : '#3ddc97'; ctx.fillRect(10, 6, (LW - 20) * tt, 6); }
      ctx.restore();
      if (flash > 0) { ctx.fillStyle = `rgba(255,30,60,${Math.min(0.4, flash)})`; ctx.fillRect(0, 0, W, H); }
    };
    let dr = 0; const dl = (ts) => { if (c.destroyed || c.wrap.parentNode == null) return; dr = requestAnimationFrame(dl); draw(ts / 1000); }; dr = requestAnimationFrame(dl);
    const oldClean = c.cleanup; c.cleanup = () => { cancelAnimationFrame(dr); oldClean(); };
    c.hud(1, '0/' + N); c.start(); resize();
    return { destroy: c.destroy, refresh: () => c.hud(1 - st.answered / N, st.answered + '/' + N), pause: () => c.toggle(true), state: st, _run: { go: (l) => setLane(l), get gates() { return gates; }, get lane() { return lane; }, get st() { return state; } } };
  }

  /* ------------------------------------------------------------------
   * NIVEL 3 · PARES
   * ------------------------------------------------------------------ */
  function startPairs(cfg) {
    const v = cfg.villain, N = v.boss ? 5 : 4, TOTAL = N * 30;
    const body = `<div class="gp-head"><div class="gp-help"><b>Une cada problema con su resultado</b><span>Toca uno de la izquierda y luego su respuesta</span></div><div class="gp-time"><i></i><span></span></div></div>
      <div class="gp-board"><div class="gp-col gp-left"></div><div class="gp-col gp-right"></div></div><div class="bt-explain gp-explain" hidden></div>`;
    const ctl = `<button class="bt-btn bt-hint"><img alt="" src="${S.icon('bulb', 3)}"><span>Pista</span><em></em></button><div class="bt-keys">Aciertos seguidos = más puntos<br><small>Cada error cuesta un corazón</small></div>`;
    const c = core(cfg, 'pairs', body, ctl), st = c.st, $ = c.$;
    const hintCost = () => Math.max(1, Math.round(20 * ((cfg.perks || {}).hintCost || 1)));
    // preguntas cortas con respuesta única
    const items = [], seenA = new Set(), seenT = new Set(); let tries = 0;
    const lvl = v.topic === 'mix' ? 3 : cfg.tier;
    while (items.length < N && tries < 160) {
      tries++; let q; try { q = Q.generate(v.topic, lvl); } catch (e) { continue; }
      const a = String(q.options[q.correct]), lim = tries < 90 ? [62, 24] : [110, 40];
      if (q.table || q.text.length > lim[0] || a.length > lim[1] || seenA.has(a) || seenT.has(q.text)) continue;
      seenA.add(a); seenT.add(q.text); items.push({ q, a, done: false, bad: false, sel: false });
    }
    while (items.length < N) { const q = Q.generate('fracciones', 1); const a = String(q.options[q.correct]); if (seenA.has(a)) continue; seenA.add(a); items.push({ q, a, done: false, bad: false, sel: false }); }
    const answers = items.map((it, i) => ({ text: it.a, idx: i })).sort(() => Math.random() - 0.5);
    const L = $('.gp-left'), R = $('.gp-right'); let cur = null, locked = true, over = false, left = TOTAL, started = false;
    const ansTexts = answers.map((a) => a.text);
    items.forEach((it, i) => { const b = el('button', 'gp-card gp-q'); b.type = 'button'; b.style.animationDelay = i * 0.08 + 's'; b.innerHTML = '<i class="gp-n">' + (i + 1) + '</i><span>' + esc(it.q.text) + '</span>'; b.addEventListener('click', () => pickQ(i)); it.el = b; L.appendChild(b); });
    answers.forEach((a, k) => { const b = el('button', 'gp-card gp-a'); b.type = 'button'; b.style.animationDelay = (0.3 + k * 0.08) + 's'; b.innerHTML = '<span>' + esc(a.text) + '</span>'; b.addEventListener('click', () => pickA(k)); a.el = b; R.appendChild(b); });
    const fit = (b) => { const t = b.querySelector('span'), n = t.textContent.length; t.style.fontSize = n > 46 ? '13px' : n > 30 ? '15px' : n > 16 ? '17px' : '20px'; };
    items.forEach((it) => fit(it.el)); answers.forEach((a) => fit(a.el));
    const mark = (it) => { if (!it.counted) { it.counted = true; st.answered++; } };
    const upd = () => { c.hud(1 - st.answered / N, st.answered + '/' + N); const tm = $('.gp-time'); tm.querySelector('i').style.width = clamp(left / TOTAL, 0, 1) * 100 + '%'; tm.querySelector('span').textContent = Math.max(0, Math.ceil(left)) + ' s'; tm.classList.toggle('low', left < 20); };
    function pickQ(i) { if (locked || over || st.paused || items[i].done) return; A.unlock(); if (cur === i) { items[i].el.classList.remove('sel'); cur = null; return; } items.forEach((it) => it.el.classList.remove('sel')); cur = i; items[i].el.classList.add('sel'); A.sfx('click'); }
    function pickA(k) {
      if (locked || over || st.paused) return; const a = answers[k]; if (a.done) return; A.unlock();
      if (cur == null) { a.el.classList.remove('nudge'); void a.el.offsetWidth; a.el.classList.add('nudge'); A.sfx('deny'); return; }
      const it = items[cur];
      if (a.idx === cur) {
        const clean = !it.bad; mark(it); if (clean) { st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
        const r = c.gain(clean, Math.min(40, left / TOTAL * 40)); it.done = a.done = true; it.el.classList.remove('sel'); it.el.classList.add('ok'); a.el.classList.add('ok');
        A.sfx('correct'); A.sfx('hit'); setTimeout(() => A.sfx('coin'), 90); const f = el('b', 'gp-float', '+' + r.g); a.el.appendChild(f); setTimeout(() => f.remove(), 900);
        cur = null; $('.bt-explain').hidden = true; upd();
        if (items.every((x) => x.done)) { over = true; st.over = true; st.win = true; A.sfx('levelup'); c.banner('¡VICTORIA!', 'go'); setTimeout(() => { if (!c.destroyed) cfg.onEnd(c.report()); }, 2400); }
      } else {
        it.bad = true; mark(it); if (!it.logged) { it.logged = true; c.log(it.q, answers.indexOf(a), ansTexts, answers.findIndex((x) => x.idx === cur)); }
        st.streak = 0; c.damage(); a.el.classList.remove('bad'); void a.el.offsetWidth; a.el.classList.add('bad'); it.el.classList.remove('bad'); void it.el.offsetWidth; it.el.classList.add('bad');
        const box = $('.gp-explain'); box.textContent = 'Ese no es. ' + (it.q.hint ? '💡 ' + it.q.hint : 'Revisa el procedimiento y prueba otra respuesta.'); box.hidden = false; upd();
        if (st.hearts <= 0) { over = true; st.over = true; st.win = false; A.sfx('lose'); c.banner('¡DERROTA!', 'lose'); setTimeout(() => { if (!c.destroyed) cfg.onEnd(c.report()); }, 2000); }
      }
    }
    function hint() {
      if (locked || over || st.paused) return; if (cur == null) { A.sfx('deny'); const box = $('.gp-explain'); box.textContent = 'Primero toca un problema de la izquierda y luego pide la pista.'; box.hidden = false; return; }
      if (!St.spend(hintCost())) { A.sfx('deny'); const b = $('.bt-hint'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
      st.hintsUsed++; const a = answers.find((x) => x.idx === cur); A.sfx('hint'); a.el.classList.add('glow'); items[cur].bad = true; setTimeout(() => a.el.classList.remove('glow'), 1800); upd();
    }
    $('.bt-hint em').textContent = hintCost(); $('.bt-hint').addEventListener('click', () => { A.unlock(); hint(); });
    c.keys = (e) => { const k = e.key; if (k >= '1' && k <= '9') { const i = +k - 1; if (i < N) { pickQ(i); e.preventDefault(); } } else if (k === 'h' || k === 'H') hint(); };
    let t0 = 0;
    c.onTick = (dt) => {
      if (!started) { t0 += dt; if (t0 > 0.05 && !st.said) { st.said = true; c.banner('¡UNE LOS PARES!', 'go', 1100); } if (t0 > 1.3) { started = true; locked = false; A.sfx('go'); } return; }
      if (over) return; left -= dt; if (left <= 0) { left = 0; over = true; st.over = true; st.win = false; upd(); items.forEach((it) => { if (!it.done && !it.logged) { it.logged = true; it.bad = true; mark(it); c.log(it.q, -1, ansTexts, answers.findIndex((x) => x.idx === items.indexOf(it))); } }); A.sfx('lose'); c.banner('¡SE ACABÓ EL TIEMPO!', 'lose'); setTimeout(() => { if (!c.destroyed) cfg.onEnd(c.report()); }, 2000); return; }
      upd();
    };
    c.hud(1, '0/' + N); upd(); c.start();
    return { destroy: c.destroy, refresh: upd, pause: () => c.toggle(true), state: st, _p: { order: () => answers.map((a) => a.idx) } };
  }

  function start(cfg) {
    const v = cfg.villain;
    if (!v.endless && !cfg.room) { if (cfg.tier === 2) return startRun(cfg); if (cfg.tier === 3) return startPairs(cfg); }
    return root.DuiXBattle.start(cfg);
  }
  root.DuiXGames = { start, GAMES, startRun, startPairs };
})(window);
