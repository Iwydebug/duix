/* DuiX — Batalla arcade (shooter de respuestas) */
(function (root) {
  'use strict';
  const D = root.DuiXData, S = root.DuiXSprites, A = root.DuiXAudio, Q = root.DuiXQ, St = root.DuiXStore;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "DejaVu Sans", Arial, sans-serif';
  const LW = 360, LANES = 4, LANE_W = LW / LANES, LANE_COL = ['#ff7a59', '#ffd23f', '#5ce1e6', '#c58bff'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const TAUNTS = ['¡Jajaja!', '¡Fallaste!', '¡Muy lento!', '¡Ni cerca!', '¡Auch!', '¡Piensa mejor!', '¡Otra vez!'];
  const PRAISE = ['¡POW!', '¡BAM!', '¡ZAP!', '¡CRASH!', '¡BOOM!', '¡WHAM!'];

  function start(cfg) {
    const v = cfg.villain, tier = cfg.tier, look = cfg.look, perks = cfg.perks || {}, endless = !!v.endless;
    const root_ = cfg.container;
    const level = () => (endless ? Math.min(3, 1 + Math.floor(st.correct / 5)) : v.topic === 'mix' ? Math.max(2, tier) : tier);
    // Preguntas por pelea: bajan al subir la dificultad (villano normal 4·3·2, jefe 5·4·3). En sala las fija el anfitrión.
    const QUESTIONS_PER_FIGHT = (v.boss ? [5, 4, 3] : [4, 3, 2])[tier - 1] || 4, room = cfg.room || null;
    const maxHp = endless ? Infinity : room ? room.total : QUESTIONS_PER_FIGHT;
    const amb = root.DuiXAmbient ? root.DuiXAmbient.scene({ seed: v.id, topic: v.topic === 'mix' ? 'all' : v.topic, pal: v.pal, mode: 'battle' }) : null;
    let lastSnap = '';
    const weapon = D.ITEM_BY_ID[look.weapon] || D.ITEM_BY_ID['wp-rayo'];
    const startHearts = 3 + (perks.hearts || 0);
    const FALL_T = cfg.fallSecs || [27, 23, 19][tier - 1]; // segundos que tarda una cápsula en llegar al héroe
    const baseSpeed = () => (LH * 0.8) / FALL_T;

    const st = {
      hp: maxHp, hearts: startHearts, maxHearts: startHearts, shield: perks.shield || 0, score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, coins: 0, power: 0,
      hintsUsed: 0, heartsLost: 0, mistakes: [], qIndex: 0, time: 0, state: 'intro', stateT: 0, paused: false, over: false, q: null, qWrong: false, qMiss: false, goldQ: false, lane: 1,
    };
    const caps = [], bolts = [], parts = [], floats = [], eshots = [];
    const hero = { x: LANE_W * 1.5, tx: LANE_W * 1.5, shootT: 0, hurtT: 0 };
    const vil = { x: LW / 2, hurtT: 0, shake: 0, dead: false, deadT: 0, bubble: '', bubbleT: 0 };
    let shake = 0, flash = 0, W = 0, H = 0, dpr = 1, raf = 0, last = 0, destroyed = false, bgCv = null, bgKey = '';

    /* ---------- DOM ---------- */
    const wrap = el('div', 'bt');
    wrap.innerHTML = `
      <div class="bt-hud">
        <div class="bt-hearts" aria-label="Vidas"></div>
        <div class="bt-mid"><div class="bt-score">0</div><div class="bt-combo"></div></div>
        <div class="bt-right"><div class="bt-coins"><img alt="" src="${S.icon('coin', 3)}"><b>0</b></div><button class="bt-pause" aria-label="Pausa"><img alt="" src="${S.icon('pause', 3)}"></button></div>
      </div>
      <div class="bt-boss"><span class="bt-bname">${esc(v.name)}</span><div class="bt-hpbar"><i></i></div><span class="bt-hptxt"></span></div>
      <div class="bt-q"><div class="bt-qtag"></div><div class="bt-qtext"></div><div class="bt-qtable"></div><div class="bt-explain" hidden></div></div>
      <div class="bt-field"><canvas></canvas><div class="bt-bubble" hidden></div><div class="bt-banner" hidden></div></div>
      <div class="bt-big" hidden><div class="bt-bigtag"></div><div class="bt-bigtext"></div><div class="bt-bigtab"></div><div class="bt-bigbar"><i></i></div></div>
      <div class="bt-ctl">
        <button class="bt-btn bt-hint"><img alt="" src="${S.icon('bulb', 3)}"><span>Pista</span><em></em></button>
        <div class="bt-keys">Toca una respuesta para dispararle<br><small>Teclado: 1-4 · H pista · Espacio poder</small></div>
        <button class="bt-btn bt-super" disabled><img alt="" src="${S.icon('bolt', 3)}"><span>Poder</span><i class="bt-pw"><b></b></i></button>
      </div>
      <div class="bt-pausemenu" hidden><div class="bt-pbox"><h2>Pausa</h2><button class="btn big" data-a="resume">Seguir luchando</button>${cfg.room || !cfg.onRestart ? '' : '<button class="btn" data-a="restart">↻ Reiniciar</button>'}${cfg.lockSettings ? '' : '<div class="bt-pset"><b>Música</b><div class="seg bt-mpick"></div><label class="set bt-sfxrow"><span>Efectos de sonido</span><input type="checkbox" class="bt-sfxchk"><span class="sw2"></span></label></div>'}<button class="btn ghost" data-a="quit">Salir del combate</button></div></div>`;
    if (room) wrap.classList.add('room');
    root_.appendChild(wrap);
    if (cfg.extraTop) wrap.insertBefore(cfg.extraTop, wrap.querySelector('.bt-boss'));
    const $ = (s) => wrap.querySelector(s);
    const cv = $('.bt-field canvas'), ctx = cv.getContext('2d');
    const hpBar = $('.bt-hpbar i');

    function renderHearts() {
      const h = $('.bt-hearts'); h.innerHTML = ''; if (room && room.noHearts) { h.textContent = '⚔ Sala'; h.className = 'bt-hearts room'; return; }
      for (let i = 0; i < st.maxHearts; i++) { const im = new Image(); im.alt = ''; im.src = S.icon(i < st.hearts ? 'heart' : 'heartEmpty', 3); h.appendChild(im); }
      if (st.shield > 0) { const b = el('span', 'bt-shield', '🛡'); h.appendChild(b); }
    }
    function renderHud() {
      $('.bt-score').textContent = String(Math.round(st.score));
      $('.bt-coins b').textContent = String(St.profile() ? St.profile().coins + st.coins : st.coins);
      const mult = multOf();
      $('.bt-combo').textContent = st.streak >= 2 ? `Racha ${st.streak}${mult > 1 ? ' · x' + mult : ''}` : '';
      if (endless) { hpBar.style.width = '100%'; $('.bt-hptxt').textContent = st.correct + ' ✔'; }
      else if (room && room.hp) { const r = room.hp(); hpBar.style.width = Math.max(0, Math.min(100, r.frac * 100)) + '%'; $('.bt-hptxt').textContent = r.text; }
      else { hpBar.style.width = Math.max(0, st.hp / maxHp * 100) + '%'; $('.bt-hptxt').textContent = Math.max(0, st.hp) + '/' + maxHp; }
      const sb = $('.bt-super'); sb.disabled = st.power < 100 || st.state !== 'play'; sb.classList.toggle('ready', st.power >= 100);
      $('.bt-pw b').style.width = clamp(st.power, 0, 100) + '%';
      const hc = hintCost(); $('.bt-hint em').textContent = hc;
      if (cfg.onProgress) { const snap = [Math.round(st.score), st.correct, st.answered, st.hearts, st.over ? 1 : 0].join(); if (snap !== lastSnap) { lastSnap = snap; cfg.onProgress({ score: Math.round(st.score), correct: st.correct, qi: st.answered, hearts: st.hearts, over: !!st.over }); } }
    }
    const multOf = () => 1 + Math.min(2, Math.floor(Math.max(0, st.streak - 1) / 3) * 0.5);
    const hintCost = () => Math.max(1, Math.round(20 * (perks.hintCost || 1)));

    /* ---------- tamaño ---------- */
    function resize() {
      const f = $('.bt-field'); const r = { width: f.clientWidth, height: f.clientHeight }; if (r.width < 10 || r.height < 10) return;
      dpr = Math.min(2.5, root.devicePixelRatio || 1); W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      LH = H * (LW / W);
    }
    let LH = 560;
    const ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe($('.bt-field')); root.addEventListener('resize', resize);

    /* ---------- preguntas y cápsulas ---------- */
    const FLOOR = () => LH - 100;
    function wrapText(text, maxW) {
      const tokens = []; let cur = '';
      for (let i = 0; i < text.length; i++) { cur += text[i]; const n = text[i + 1]; if (text[i] === ' ' || (text[i] === ')' && n === '(') || (text[i] === ',' && n === ' ')) { tokens.push(cur); cur = ''; } }
      if (cur) tokens.push(cur);
      for (let fs = 16; fs >= 9; fs--) {
        ctx.font = `700 ${fs}px ${FONT}`; const lines = []; let line = '', ok = true;
        for (const t of tokens) {
          if (ctx.measureText(t.trimEnd()).width > maxW) { ok = false; break; }
          if (ctx.measureText((line + t).trimEnd()).width <= maxW) line += t; else { lines.push(line.trimEnd()); line = t; }
        }
        if (line) lines.push(line.trimEnd());
        if (ok && (lines.length <= (fs > 12 ? 2 : 4))) return { lines, fs };
      }
      // último recurso: cortar por caracteres
      ctx.font = `700 9px ${FONT}`; const out = []; let l = '';
      for (const ch of text) { if (ctx.measureText(l + ch).width > maxW) { out.push(l); l = ch; } else l += ch; }
      out.push(l); return { lines: out, fs: 9 };
    }
    /* ---------- pregunta grande que se acomoda en su recuadro ---------- */
    function showBig(q) {
      const bg = $('.bt-big'), qbox = $('.bt-q');
      bg.querySelector('.bt-bigtag').textContent = $('.bt-qtag').textContent;
      const bt = bg.querySelector('.bt-bigtext'); bt.textContent = q.text; bt.className = 'bt-bigtext' + (q.text.length > 90 ? ' xl' : q.text.length > 60 ? ' long' : q.text.length > 38 ? ' mid' : '');
      bg.querySelector('.bt-bigtab').innerHTML = $('.bt-qtable').innerHTML;
      const bar = bg.querySelector('.bt-bigbar i'); bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = 'width ' + st.readFor + 's linear'; bar.style.width = '0%';
      bg.classList.remove('settle'); bg.style.transition = 'none'; bg.style.transform = ''; bg.style.opacity = ''; bg.hidden = false; bg.classList.add('pop');
      { const fr = $('.bt-field').getBoundingClientRect(), wr = wrap.getBoundingClientRect(); bg.style.top = '0px'; const hh = bg.offsetHeight; bg.style.top = Math.max(fr.top - wr.top + 8, fr.top - wr.top + fr.height * 0.42 - hh / 2) + 'px'; }
      qbox.style.visibility = 'hidden'; st.bigOn = true; A.sfx('tick');
    }
    function settleBig() {
      const bg = $('.bt-big'), qbox = $('.bt-q'); bg.classList.remove('pop');
      const a = bg.getBoundingClientRect(), b = qbox.getBoundingClientRect();
      const sc = Math.min(1, b.width / a.width), dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      bg.style.transition = 'transform .5s cubic-bezier(.5,0,.2,1), opacity .2s .4s'; bg.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`; bg.style.opacity = '0';
    }
    function endBig() { const bg = $('.bt-big'); bg.hidden = true; bg.style.transform = ''; bg.style.opacity = ''; $('.bt-q').style.visibility = ''; st.bigOn = false; }
    function nextQuestion() {
      let q; try { q = room ? room.getQuestion(st.qIndex) : Q.generate(v.topic, level()); } catch (e) { q = Q.generate('fracciones', 1); }
      st.q = q; st.qWrong = false; st.qMiss = false; st.goldQ = false; st.qIndex++; st.qHint = 0;
      $('.bt-qtag').textContent = v.topic === 'mix' ? (D.VILLAINS.find((x) => x.topic === q.topic) || { tema: '' }).tema : v.tema;
      const qt = $('.bt-qtext'); qt.textContent = q.text; qt.className = 'bt-qtext' + (q.text.length > 70 ? ' long' : q.text.length > 46 ? ' mid' : '');
      const tb = $('.bt-qtable'); tb.innerHTML = '';
      if (q.table) { let h = '<table><tr>' + q.table.head.map((c, i) => (i ? '<td>' : '<th>') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>'; q.table.rows.forEach((r) => { h += '<tr>' + r.map((c, i) => (i ? '<td class="' + (c === '?' ? 'qm' : '') + '">' : '<th>') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>'; }); tb.innerHTML = h + '</table>'; }
      $('.bt-explain').hidden = true;
      const speed = baseSpeed() * (1 + Math.min(0.15, st.qIndex * 0.01)) * (1 - (perks.slow || 0)) * (endless ? 1 + Math.min(0.6, st.correct * 0.02) : 1);
      caps.length = 0;
      q.options.forEach((t, i) => {
        const lay = wrapText(t, LANE_W - 20), h = Math.max(36, lay.lines.length * lay.fs * 1.22 + 14);
        caps.push({ lane: i, x: LANE_W * (i + 0.5), y: (st.qIndex === 1 ? 126 - h - i * 12 : -h - 6 - i * 16), h, w: LANE_W - 8, lines: lay.lines, fs: lay.fs, ok: i === q.correct, state: 'fall', vy: speed * (0.94 + ((i * 7 + st.qIndex * 3) % 5) * 0.03), wob: Math.random() * 6, t: 0, text: t, targeted: false });
      });
      st.spawnT = 0;
      if (st.qIndex === 1) {
        st.state = 'read'; st.stateT = 0;
        const more = cfg.moreTime ? 1.7 : 1, len = q.text.length + (q.table ? 30 : 0) + q.options.reduce((a, o) => a + o.length, 0) * 0.4;
        st.readFor = Math.min(10, Math.max(4, 2 + len * 0.06)) * more;
        showBig(q);
      } else { // flujo continuo: la pregunta cambia con un golpe y las cápsulas ya vienen cayendo
        st.state = 'play'; st.stateT = 0; const qb = $('.bt-q'); qb.classList.remove('flip'); void qb.offsetWidth; qb.classList.add('flip'); A.sfx('tick');
      }
      renderHud();
    }

    /* ---------- efectos ---------- */
    const burst = (x, y, c, n, sp, life) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.3 + Math.random()) * (sp || 120); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: (life || 0.6) * (0.5 + Math.random() * 0.7), t: 0, c: Array.isArray(c) ? c[i % c.length] : c, s: 2 + Math.floor(Math.random() * 3), g: 220 }); } };
    const float = (x, y, text, c, size) => floats.push({ x, y, text, c: c || '#fff', size: size || 22, t: 0, life: 0.9 });
    const say = (text, ms) => { vil.bubble = text; vil.bubbleT = (ms || 1600) / 1000; const b = $('.bt-bubble'); b.textContent = text; b.hidden = false; };
    const banner = (text, cls, ms) => { const b = $('.bt-banner'); b.textContent = text; b.className = 'bt-banner ' + (cls || ''); b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; if (ms) setTimeout(() => { if (!destroyed) b.hidden = true; }, ms); };
    const explain = (t) => { const e = $('.bt-explain'); e.textContent = t; e.hidden = false; };

    /* ---------- disparo ---------- */
    function fire(lane) {
      if (st.state !== 'play' || st.paused || st.over) return;
      const c = caps[lane]; if (!c || c.state !== 'fall' || c.targeted) return;
      c.targeted = true; st.lane = lane; hero.tx = c.x; hero.shootT = 0.2;
      const sx = hero.x + 26, sy = LH - 114;
      bolts.push({ x: sx, y: sy, sx, sy, cap: c, t: 0, fx: weapon.fx, c1: weapon.c1, c2: weapon.c2, q: st.qIndex, hue: 0 });
      A.sfx('shoot');
    }
    function resolveHit(b) {
      const c = b.cap; if (b.q !== st.qIndex || st.state !== 'play') return;
      burst(c.x, c.y + c.h / 2, c.ok ? ['#ffe14a', '#fff', '#5ce1e6'] : ['#ff4d4d', '#fff', '#a02030'], 26, 170, 0.6);
      if (c.ok) onCorrect(c); else onWrong(c);
    }
    function onCorrect(c) {
      const clean = !st.qWrong && !st.qMiss;
      c.state = 'dead'; st.answered++;
      if (clean) { st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
      const mult = clean ? multOf() : 1, tb = clamp(1 - c.y / FLOOR(), 0, 1) * 40;
      const gain = Math.round((clean ? 100 : 40) * mult * (st.goldQ ? 2 : 1) + (clean ? tb : 0));
      st.score += gain; const cg = clean ? 3 + (st.streak >= 5 ? 2 : 0) + (st.goldQ ? 2 : 0) : 1; st.coins += Math.round(cg * (1 + (perks.coins || 0)));
      st.power = Math.min(100, st.power + (clean ? 20 : 8));
      float(c.x, c.y, '+' + gain, '#ffe14a', 22); float(hero.x, LH - 130, '+' + Math.round(cg * (1 + (perks.coins || 0))) + '¢', '#ffd23f', 16);
      caps.forEach((o) => { if (o !== c && o.state === 'fall') { o.state = 'dead'; burst(o.x, o.y + o.h / 2, '#7a6aa8', 10, 90, 0.5); } });
      if (!endless) { st.hp--; vil.hurtT = 0.22; vil.shake = 0.3; }
      shake = Math.max(shake, 5); A.sfx('hit'); A.sfx('correct'); if (st.streak >= 3 && clean) A.sfx('combo', st.streak);
      setTimeout(() => A.sfx('coin'), 90);
      banner(PRAISE[Math.floor(Math.random() * PRAISE.length)], 'good', 700);
      if (!endless && st.hp <= 0) return victory();
      st.state = 'between'; st.stateT = 0; st.wait = 0.22; renderHud();
    }
    function damageHero() {
      if (st.shield > 0) { st.shield--; float(hero.x, LH - 130, '¡ESCUDO!', '#8fe6ff', 16); A.sfx('power'); renderHearts(); return false; }
      if (room && room.noHearts) { hero.hurtT = 0.4; shake = 6; flash = 0.2; A.sfx('hurt'); return true; }
      st.hearts--; st.heartsLost++; hero.hurtT = 0.4; shake = 9; flash = 0.35; A.sfx('hurt'); renderHearts();
      eshots.push({ x: vil.x, y: 90, tx: hero.x, ty: LH - 90, t: 0 });
      if (Math.random() < 0.5) say(TAUNTS[Math.floor(Math.random() * TAUNTS.length)], 1100);
      return true;
    }
    function logMistake(chosen) { const q = st.q; if (!st.qLogged) { st.qLogged = true; st.mistakes.push({ topic: q.topic, text: q.text, options: q.options, correct: q.correct, chosen: typeof chosen === 'number' ? chosen : -1, explain: q.explain, table: q.table || null }); } }
    function onWrong(c) {
      c.state = 'dead'; st.qWrong = true; st.streak = 0; st.power = Math.floor(st.power * 0.5); st.qLogged = false; logMistake(c.lane);
      A.sfx('wrong'); float(c.x, c.y, '✖', '#ff4d4d', 30);
      damageHero(); renderHud();
      if (st.hearts <= 0) { explain('Elegiste «' + st.q.options[c.lane] + '». La correcta era «' + st.q.options[st.q.correct] + '». ' + st.q.explain); return defeat(); }
    }
    function onMiss(c) {
      // la respuesta correcta tocó el suelo
      st.qMiss = true; st.streak = 0; st.answered++; st.qLogged = false; logMistake(-1); c.state = 'good'; c.goldT = 0;
      caps.forEach((o) => { if (o !== c && o.state === 'fall') { o.state = 'dead'; burst(o.x, o.y + o.h / 2, '#7a6aa8', 8, 80, 0.4); } });
      A.sfx('wrong'); damageHero(); explain('Se acabó el tiempo. La respuesta era «' + st.q.options[st.q.correct] + '». ' + st.q.explain); renderHud();
      if (st.hearts <= 0) return defeat();
      st.state = 'between'; st.stateT = 0; st.wait = 1.2;
    }

    /* ---------- ayudas ---------- */
    function useHint() {
      if (st.state !== 'play' || st.paused) return;
      const wrong = caps.filter((c) => c.state === 'fall' && !c.ok);
      if (wrong.length < 2) { A.sfx('deny'); return; }
      const cost = hintCost(); if (!St.spend(cost)) { A.sfx('deny'); const b = $('.bt-hint'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); float(hero.x, LH - 140, '¡Faltan monedas!', '#ff9a9a', 14); return; }
      const c = wrong[Math.floor(Math.random() * wrong.length)]; c.state = 'dead'; burst(c.x, c.y + c.h / 2, ['#ffe14a', '#fff'], 18, 120, 0.5); st.hintsUsed++; A.sfx('hint'); float(c.x, c.y, 'Descartada', '#ffe14a', 13); if (st.q.hint) explain('💡 Pista: ' + st.q.hint); renderHud();
      persistCoinsHint(-cost);
    }
    function persistCoinsHint() { /* las monedas ya se descuentan en Store.spend */ }
    function usePower() {
      if (st.state !== 'play' || st.paused || st.power < 100) return;
      st.power = 0; st.goldQ = true; A.sfx('power'); flash = 0.25; shake = 6;
      caps.forEach((c) => { if (c.state === 'fall' && !c.ok) { c.state = 'dead'; burst(c.x, c.y + c.h / 2, ['#5ce1e6', '#fff', '#c58bff'], 22, 160, 0.6); } });
      banner('¡SUPERPODER!', 'power', 900); renderHud();
    }

    /* ---------- fin ---------- */
    function finish(win) {
      if (st.over) return; st.over = true; st.win = win; st.state = 'end'; st.stateT = 0;
    }
    function victory() { finish(true); vil.dead = true; A.sfx('boom'); say(v.defeat, 2400); burst(vil.x, 70, [v.pal.main, v.pal.accent, '#fff'], 80, 240, 1.2); renderHud(); }
    function defeat() { finish(false); A.sfx('lose'); banner(endless ? '¡FIN DEL INFINITO!' : '¡DERROTA!', 'lose'); renderHud(); }
    function report() {
      const acc = st.answered ? st.correct / st.answered : 0;
      let stars = 0; if (st.win) stars = st.heartsLost === 0 ? 3 : (st.heartsLost === 1 || acc >= 0.75) ? 2 : 1;
      return { win: !!st.win && !endless, stars, correct: st.correct, answered: st.answered, bestStreak: st.bestStreak, mistakes: st.mistakes, score: Math.round(st.score), coins: st.coins, heartsLost: st.heartsLost, hintsUsed: st.hintsUsed, tier, time: Math.round(st.time), endless };
    }

    /* ---------- bucle ---------- */
    function update(dt) {
      st.time += dt; st.stateT += dt;
      hero.x += (hero.tx - hero.x) * Math.min(1, dt * 16); hero.shootT = Math.max(0, hero.shootT - dt); hero.hurtT = Math.max(0, hero.hurtT - dt);
      vil.hurtT = Math.max(0, vil.hurtT - dt); vil.shake = Math.max(0, vil.shake - dt); shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt);
      if (vil.bubbleT > 0) { vil.bubbleT -= dt; if (vil.bubbleT <= 0) $('.bt-bubble').hidden = true; }
      if (st.state === 'intro') {
        if (st.stateT > 0.1 && !st.said) { st.said = true; say(v.intro.length > 60 ? v.intro.slice(0, v.intro.lastIndexOf(' ', 60)) + '…' : v.intro, 2600); banner('¡A LUCHAR!', 'go', 1300); }
        if (st.stateT > 1.5) nextQuestion();
      } else if (st.state === 'read') {
        if (st.stateT >= st.readFor) { st.state = 'settle'; st.stateT = 0; settleBig(); A.sfx('tick'); }
      } else if (st.state === 'settle') {
        if (st.stateT >= 0.55) { endBig(); st.state = 'play'; st.stateT = 0; A.sfx('go'); banner('¡YA!', 'go', 550); renderHud(); }
      } else if (st.state === 'play') {
        caps.forEach((c) => {
          if (c.state !== 'fall') return; c.t += dt; c.y += c.vy * dt; c.x = LANE_W * (c.lane + 0.5) + Math.sin(c.t * 1.6 + c.wob) * 3;
          if (c.y + c.h >= FLOOR()) { if (c.ok) onMiss(c); else { c.state = 'dead'; burst(c.x, FLOOR(), '#7a6aa8', 8, 70, 0.4); } }
        });
        // si solo queda la correcta y ninguna otra, sigue igual
      } else if (st.state === 'between') {
        if (st.stateT >= st.wait && !st.over) { if (room && st.qIndex >= room.total) { if (st.hearts > 0) victory(); else defeat(); } else nextQuestion(); }
      } else if (st.state === 'end') {
        if (st.stateT > (st.win ? 2.6 : 2.0) && !st.reported) { st.reported = true; cfg.onEnd(report()); }
      }
      caps.forEach((c) => { if (c.state === 'good') c.goldT += dt; });
      for (const b of bolts) {
        b.t += dt; const tx = b.cap.x, ty = b.cap.y + b.cap.h / 2, dx = tx - b.sx, dy = ty - b.sy, d = Math.hypot(dx, dy) || 1, sp = 1100, prog = clamp(b.t * sp / d, 0, 1);
        b.px = b.x; b.py = b.y; b.x = b.sx + dx * prog; b.y = b.sy + dy * prog;
        if (b.fx === 'wave') b.x += Math.sin(b.t * 40) * 14 * (1 - prog);
        if (Math.random() < 0.9) parts.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 30, vy: 30, life: 0.25, t: 0, c: b.fx === 'rainbow' ? `hsl(${(b.t * 900) % 360},100%,60%)` : Math.random() < 0.5 ? b.c1 : b.c2, s: 2, g: 0 });
        if (prog >= 1) { b.done = true; resolveHit(b); }
      }
      for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].done) bolts.splice(i, 1);
      for (const e of eshots) { e.t += dt * 2.4; }
      for (let i = eshots.length - 1; i >= 0; i--) if (eshots[i].t >= 1) eshots.splice(i, 1);
      for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].life) parts.splice(i, 1);
      for (const f of floats) { f.t += dt; f.y -= 34 * dt; }
      for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t >= floats[i].life) floats.splice(i, 1);
      if (vil.dead) { vil.deadT += dt; if (Math.random() < 0.5) burst(vil.x + (Math.random() - 0.5) * 70, 70 + (Math.random() - 0.5) * 60, [v.pal.main, '#fff', v.pal.accent], 3, 160, 0.6); }
    }

    /* ---------- dibujo ---------- */
    function rr(x, y, w, h, r, fill, stroke, lw) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    function drawBolt(b) {
      const dx = b.x - (b.px === undefined ? b.x : b.px), dy = b.y - (b.py === undefined ? b.y : b.py), ang = Math.atan2(dy, dx) + Math.PI / 2;
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(ang);
      if (b.fx === 'bolt') { ctx.fillStyle = b.c2; ctx.fillRect(-3, -10, 6, 20); ctx.fillStyle = b.c1; ctx.fillRect(-2, -12, 4, 22); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -9, 2, 14); }
      else if (b.fx === 'orb') { ctx.fillStyle = b.c2; ctx.fillRect(-6, -4, 12, 8); ctx.fillRect(-4, -6, 8, 12); ctx.fillStyle = b.c1; ctx.fillRect(-4, -4, 8, 8); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -2, 4, 4); }
      else if (b.fx === 'fire') { ctx.fillStyle = b.c2; ctx.fillRect(-6, -6, 12, 12); ctx.fillStyle = b.c1; ctx.fillRect(-4, -8, 8, 14); ctx.fillStyle = '#fff2a8'; ctx.fillRect(-2, -4, 4, 6); }
      else if (b.fx === 'ice') { ctx.fillStyle = b.c2; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 0); ctx.lineTo(0, 10); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = b.c1; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(3, 0); ctx.lineTo(0, 6); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill(); }
      else if (b.fx === 'wave') { ctx.fillStyle = b.c2; ctx.fillRect(-4, -8, 8, 16); ctx.fillStyle = b.c1; ctx.fillRect(-2, -10, 4, 18); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -6, 2, 8); }
      else if (b.fx === 'double') { ctx.fillStyle = b.c2; ctx.fillRect(-8, -10, 4, 20); ctx.fillRect(4, -10, 4, 20); ctx.fillStyle = b.c1; ctx.fillRect(-7, -12, 2, 22); ctx.fillRect(5, -12, 2, 22); ctx.fillStyle = '#fff'; ctx.fillRect(-7, -8, 2, 8); ctx.fillRect(5, -8, 2, 8); }
      else { const h = (b.t * 700) % 360; ctx.fillStyle = `hsl(${h},100%,55%)`; ctx.fillRect(-5, -10, 10, 20); ctx.fillStyle = `hsl(${(h + 120) % 360},100%,65%)`; ctx.fillRect(-3, -12, 6, 22); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -8, 2, 12); }
      ctx.restore();
    }
    function drawCap(c, t) {
      if (c.state === 'dead') return;
      const x = c.x - c.w / 2, y = Math.round(c.y), gold = c.state === 'good', col = gold ? '#ffe14a' : LANE_COL[c.lane];
      // paracaídas
      if (c.state === 'fall') {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 2, y - 4); ctx.quadraticCurveTo(c.x, y - 26, x + c.w - 2, y - 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1a1033'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2, y - 4); ctx.lineTo(x + 12, y + 2); ctx.moveTo(x + c.w - 2, y - 4); ctx.lineTo(x + c.w - 12, y + 2); ctx.stroke();
      }
      const pulse = gold ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
      // sombra dura estilo cómic
      rr(x + 3, y + 3, c.w, c.h, 6, '#0d0724');
      rr(x, y, c.w, c.h, 6, gold ? `rgba(255,${200 + pulse * 55},70,1)` : (st.goldQ && c.ok ? '#3a2a10' : '#231a4e'), '#1a1033', 3);
      rr(x + 1.5, y + 1.5, c.w - 3, c.h - 3, 5, null, col, 2);
      // número de carril
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 9, y + 9, 7, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#1a1033'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#1a1033'; ctx.font = `700 10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(c.lane + 1), x + 9, y + 9.5);
      ctx.fillStyle = gold ? '#1a1033' : '#fff'; ctx.font = `700 ${c.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lh = c.fs * 1.22, y0 = y + c.h / 2 - (c.lines.length - 1) * lh / 2 + 1;
      c.lines.forEach((l, i) => ctx.fillText(l, c.x, y0 + i * lh, c.w - 8));
    }
    function draw(t) {
      const sc = W / LW;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.scale(sc, sc);
      const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake : 0; ctx.translate(sx, sy);
      // fondo
      const bw = 90, bh = Math.ceil(LH / 4 / 8) * 8, key = bw + 'x' + bh; if (key !== bgKey) { bgKey = key; bgCv = S.cityBg(v, bw, bh); }
      ctx.drawImage(bgCv, -6, -6, LW + 12, bh * 4 + 12);
      if (amb && !St.settings().reduceMotion) amb.overlay(ctx, LW, LH, t, 2); else if (amb) amb.overlay(ctx, LW, LH, 3, 2);
      // columnas de carril
      for (let i = 0; i < LANES; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.07)'; ctx.fillRect(i * LANE_W, 0, LANE_W, LH); }
      if (st.state === 'play') { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(st.lane * LANE_W, 0, LANE_W, LH); }
      // línea de peligro
      ctx.fillStyle = 'rgba(255,60,80,.18)'; ctx.fillRect(0, FLOOR(), LW, 3); ctx.fillStyle = 'rgba(255,60,80,.35)'; for (let x = 0; x < LW; x += 16) ctx.fillRect(x, FLOOR(), 8, 3);
      // villano
      const vs = v.boss ? 2.3 : 2.0, vw = 64 * vs, vy = 0 + Math.sin(t * 2) * 3 + (vil.dead ? Math.min(60, vil.deadT * 40) : 0);
      if (!vil.dead) { const gc = v.glow || v.pal.accent, cy = vy + vw * 0.42, g = ctx.createRadialGradient(vil.x, cy, 8, vil.x, cy, vw * 0.78); g.addColorStop(0, gc + '55'); g.addColorStop(1, gc + '00'); ctx.fillStyle = g; ctx.fillRect(vil.x - vw, cy - vw, vw * 2, vw * 2); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(vil.x, vy + vw * 0.86 + 6, vw * 0.3, 7, 0, 0, 6.283); ctx.fill(); }
      if (!(vil.dead && vil.deadT > 0.9 && Math.floor(vil.deadT * 20) % 2)) {
        ctx.save(); ctx.globalAlpha = vil.dead ? Math.max(0, 1 - vil.deadT / 2.2) : 1;
        const shx = vil.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
        ctx.drawImage(S.villainCanvas(v, vil.hurtT > 0), Math.round(vil.x - vw / 2 + shx), Math.round(vy - 8 * vs / 2 + 4), Math.round(vw), Math.round(vw));
        ctx.restore();
      }
      // insignia orbitando (símbolo del tema)
      { const a = t * 1.1, ox = vil.x + Math.cos(a) * (vw * 0.62), oy = vw * 0.42 + Math.sin(a) * 14 + vy; ctx.save(); ctx.globalAlpha = vil.dead ? 0 : 1; ctx.fillStyle = '#1a1033'; ctx.beginPath(); ctx.arc(ox, oy, 19, 0, 6.283); ctx.fill(); ctx.fillStyle = v.pal.accent; ctx.beginPath(); ctx.arc(ox, oy, 16, 0, 6.283); ctx.fill(); ctx.fillStyle = '#1a1033'; ctx.font = `700 ${v.glyph.length > 3 ? 11 : v.glyph.length > 2 ? 13 : 17}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v.glyph, ox, oy + 1, 30); ctx.restore(); }
      // disparos del villano (visual)
      eshots.forEach((e) => { const x = e.x + (e.tx - e.x) * e.t, y = e.y + (e.ty - e.y) * e.t; ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 2, 4, 4); });
      // cápsulas
      if (st.state !== 'read' && st.state !== 'settle') caps.forEach((c) => drawCap(c, t));
      // héroe
      { const pose = hero.shootT > 0 ? 'shoot' : 'idle', frame = Math.floor(t * 6) % 4, hc = S.heroCanvas(look, pose, frame), hs = 2, hw = S.HERO_W * hs, hh = S.HERO_H * hs;
        const bob = Math.sin(t * 5) * 1.5, hurt = hero.hurtT > 0 && Math.floor(hero.hurtT * 20) % 2 === 0;
        ctx.save(); if (hurt) ctx.globalAlpha = 0.35; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(hero.x, LH - 8, 26, 6, 0, 0, 6.283); ctx.fill();
        ctx.drawImage(hc, Math.round(hero.x - hw / 2), Math.round(LH - hh - 6 + bob), hw, hh); ctx.restore(); }
      bolts.forEach(drawBolt);
      // partículas
      parts.forEach((p) => { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }); ctx.globalAlpha = 1;
      // textos flotantes
      floats.forEach((f) => { ctx.globalAlpha = clamp(1 - f.t / f.life, 0, 1); ctx.font = `${f.size}px Bangers, ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a1033'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }); ctx.globalAlpha = 1;
      ctx.restore();
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, flash)})`; ctx.fillRect(0, 0, W, H); }
      if (hero.hurtT > 0.2) { ctx.fillStyle = `rgba(255,30,60,${(hero.hurtT - 0.2) * 0.9})`; ctx.fillRect(0, 0, W, H); }
    }
    function loop(ts) {
      if (destroyed) return; raf = requestAnimationFrame(loop);
      { const f = cv.parentNode; if (f && (Math.abs(f.clientWidth - W) > 1 || Math.abs(f.clientHeight - H) > 1)) resize(); }
      if (!last) last = ts; const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      if (!st.paused && W > 0) { update(dt); }
      if (W > 0) draw(ts / 1000);
    }

    /* ---------- entrada ---------- */
    function laneFromEvent(e) { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * LW; return clamp(Math.floor(x / LANE_W), 0, LANES - 1); }
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); A.unlock(); fire(laneFromEvent(e)); });
    function onKey(e) {
      if (destroyed) return;
      const k = e.key;
      if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); togglePause(); return; }
      if (st.paused) return;
      if (k >= '1' && k <= '4') { e.preventDefault(); fire(+k - 1); }
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { st.lane = clamp(st.lane - 1, 0, 3); hero.tx = LANE_W * (st.lane + 0.5); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { st.lane = clamp(st.lane + 1, 0, 3); hero.tx = LANE_W * (st.lane + 0.5); e.preventDefault(); }
      else if (k === 'Enter' || k === 'ArrowUp' || k === 'w' || k === 'W') { fire(st.lane); e.preventDefault(); }
      else if (k === ' ') { e.preventDefault(); if (st.power >= 100) usePower(); else fire(st.lane); }
      else if (k === 'h' || k === 'H') useHint();
      else if (k === 's' || k === 'S') usePower();
    }
    root.addEventListener('keydown', onKey);
    $('.bt-hint').addEventListener('click', () => { A.unlock(); useHint(); });
    $('.bt-super').addEventListener('click', () => { A.unlock(); usePower(); });
    function togglePause(force) {
      if (st.over) return; const p = force === undefined ? !(room ? !$('.bt-pausemenu').hidden : st.paused) : force; if (room) { $('.bt-pausemenu').hidden = !p; return; } st.paused = p; $('.bt-pausemenu').hidden = !p; A.sfx('pause'); if (!p) last = 0;
    }
    if (!cfg.lockSettings) {
      const mp = $('.bt-mpick'), chk = $('.bt-sfxchk');
      const now = () => { const q = St.settings(); return !q.music ? 'off' : q.musicStyle === 'calma' ? 'calma' : 'arcade'; };
      const draw = () => { mp.innerHTML = ''; [['arcade', 'Arcade'], ['calma', 'Calmada'], ['off', 'Sin música']].forEach(([id, label]) => { const b = el('button', 'segb' + (now() === id ? ' on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { A.unlock(); if (id === 'off') St.setSetting('music', false); else { St.setSetting('musicStyle', id); St.setSetting('music', true); } draw(); }); mp.appendChild(b); }); };
      draw(); chk.checked = !!St.settings().sfx; chk.addEventListener('change', () => St.setSetting('sfx', chk.checked));
    }
    $('.bt-pause').addEventListener('click', () => togglePause(true));
    $('.bt-pausemenu').addEventListener('click', (e) => { const a = e.target.dataset && e.target.dataset.a; if (a === 'resume') togglePause(false); if (a === 'quit') { destroy(); cfg.onQuit && cfg.onQuit(); } if (a === 'restart' && cfg.onRestart) { destroy(); cfg.onRestart(); } });
    const onVis = () => { if (document.hidden && !room) togglePause(true); };
    document.addEventListener('visibilitychange', onVis);

    function destroy() { destroyed = true; cancelAnimationFrame(raf); root.removeEventListener('keydown', onKey); root.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect(); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }

    renderHearts(); renderHud(); resize(); raf = requestAnimationFrame(loop);
    return { destroy, refresh: renderHud, pause: () => togglePause(true), state: st, _fire: fire, _hint: useHint, _power: usePower, _caps: caps };
  }

  root.DuiXBattle = { start };
})(typeof window !== 'undefined' ? window : globalThis);
