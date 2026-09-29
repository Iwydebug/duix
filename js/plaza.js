/* DuiX — Plaza de la sala (lobby interactivo tipo "Among Us").
 * Todos los jugadores aparecen con su avatar, caminan libremente, hacen emotes, se cambian de ropa y recogen monedas mientras esperan.
 * Las posiciones viajan por la red en un nodo aparte (pos/<id>) para no saturar la lista de jugadores.
 */
(function (root) {
  'use strict';
  const S = root.DuiXSprites, A = root.DuiXAudio;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "DejaVu Sans", Arial, sans-serif';
  let LW = 360; const LH = 280, FLOOR_Y = 96, NW = 360; // NW: ancho de referencia para la red
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const EMOTES = ['👋', '😂', '😎', '🔥', '💃', '❤️', '⭐', '🎉'];

  function mount(container, o) {
    // o: { pid, code, getPlayers(), getPos(), setPos(x,y,f), sendEmote(e), getLook(), onCoin(n), seedKey }
    const cv = document.createElement('canvas'); cv.className = 'plaza-cv'; container.appendChild(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, dead = false, party = false, partyT = 0, chestOpen = 0, chestUsed = false;
    const me = { x: LW / 2 + (Math.random() - 0.5) * 100, y: FLOOR_Y + 90 + Math.random() * 40, tx: 0, ty: 0, f: 1, moving: false };
    me.tx = me.x; me.ty = me.y;
    const others = {}; // id → {x,y,tx,ty,f}
    const coins = []; let coinT = 3, coinsGot = 0; const parts = [], floats = [];
    let lastSent = 0, sx = 0, sy = 0, sf = 1;
    const keys = {};
    const clampP = () => { me.tx = clamp(me.tx, 20, LW - 20); me.ty = clamp(me.ty, FLOOR_Y + 14, LH - 8); };

    function resize() { const r = container.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return; dpr = Math.min(2.5, root.devicePixelRatio || 1); W = r.width; H = r.height; LW = clamp(LH * W / H, 300, 900); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px'; clampP(); }
    const toL = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * LW, y: (e.clientY - r.top) / r.height * LH }; };
    const sxOf = (x) => x / LW * NW, fromNet = (x) => x / NW * LW;
    const JUKE = { x: 40, y: FLOOR_Y - 6, w: 34, h: 50 }, CHEST = { get x() { return LW - 62; }, y: FLOOR_Y + 2, w: 40, h: 30 };
    let down = false;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); A.unlock(); const p = toL(e); down = true;
      if (p.x > JUKE.x - 6 && p.x < JUKE.x + JUKE.w + 6 && p.y > JUKE.y - 4 && p.y < JUKE.y + JUKE.h + 10) { party = !party; partyT = 0; A.sfx(party ? 'levelup' : 'click'); floats.push({ x: JUKE.x + 17, y: JUKE.y - 8, text: party ? '♪ ¡FIESTA!' : '♪', c: '#ff7ac8', t: 0, life: 1.2, size: 16 }); return; }
      if (p.x > CHEST.x - 6 && p.x < CHEST.x + CHEST.w + 6 && p.y > CHEST.y - 10 && p.y < CHEST.y + CHEST.h + 10) { me.tx = CHEST.x + 20; me.ty = CHEST.y + CHEST.h + 22; clampP(); me.chestGo = true; return; }
      me.tx = p.x; me.ty = p.y; clampP(); me.chestGo = false;
    });
    cv.addEventListener('pointermove', (e) => { if (down) { const p = toL(e); me.tx = p.x; me.ty = p.y; clampP(); } });
    const up = () => { down = false; }; root.addEventListener('pointerup', up);
    const kd = (e) => { const k = e.key.toLowerCase(); if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) { const t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA') return; keys[k] = true; e.preventDefault(); } };
    const ku = (e) => { keys[e.key.toLowerCase()] = false; };
    root.addEventListener('keydown', kd); root.addEventListener('keyup', ku);
    const ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(cv); root.addEventListener('resize', resize);

    const SYM = ['π', 'Σ', '∞', '√', '∫', 'Δ', 'x²'];
    function drawRoom(t) {
      // muro del fondo
      let g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y); g.addColorStop(0, '#1a0f45'); g.addColorStop(1, '#2d1a72'); ctx.fillStyle = g; ctx.fillRect(0, 0, LW, FLOOR_Y);
      ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let y = 0; y < FLOOR_Y; y += 16) for (let x = ((y / 16) % 2) * 20; x < LW; x += 40) ctx.fillRect(x, y, 38, 14);
      // ventanas con estrellas y luna
      [50, 150, 250].forEach((wx, i) => { const wy = 14; ctx.fillStyle = '#000'; ctx.fillRect(wx - 3, wy - 3, 66, 54); ctx.fillStyle = '#0a0530'; ctx.fillRect(wx, wy, 60, 48); for (let k = 0; k < 6; k++) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + k * 2 + i)); ctx.fillStyle = '#fff'; ctx.fillRect(wx + 4 + (k * 37 + i * 11) % 52, wy + 4 + (k * 23 + i * 7) % 40, 2, 2); } ctx.globalAlpha = 1; if (i === 1) { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(wx + 40, wy + 16, 9, 0, 6.283); ctx.fill(); } ctx.strokeStyle = '#5443b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + 30, wy); ctx.lineTo(wx + 30, wy + 48); ctx.moveTo(wx, wy + 24); ctx.lineTo(wx + 60, wy + 24); ctx.stroke(); });
      // letrero neón con el código
      { const cx = LW / 2, cy = 70; ctx.font = `800 13px ${FONT}`; const txt = 'SALA ' + o.code, w = ctx.measureText(txt).width + 24; ctx.fillStyle = '#000'; ctx.fillRect(cx - w / 2, cy - 13, w, 24); ctx.strokeStyle = party ? `hsl(${(t * 200) % 360},100%,65%)` : '#ff7ac8'; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2 + 1, cy - 12, w - 2, 22); ctx.fillStyle = party ? `hsl(${(t * 200 + 90) % 360},100%,70%)` : '#ffd23f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, cx, cy); }
      // suelo
      g = ctx.createLinearGradient(0, FLOOR_Y, 0, LH); g.addColorStop(0, '#3b2790'); g.addColorStop(1, '#1b0f4e'); ctx.fillStyle = g; ctx.fillRect(0, FLOOR_Y, LW, LH - FLOOR_Y);
      const cols = 12, tw = LW / cols; for (let j = 0; j < 8; j++) { const y0 = FLOOR_Y + j * ((LH - FLOOR_Y) / 8), y1 = FLOOR_Y + (j + 1) * ((LH - FLOOR_Y) / 8); for (let i = 0; i < cols; i++) if ((i + j) % 2) { ctx.fillStyle = party ? `hsla(${(t * 120 + i * 30 + j * 20) % 360},90%,55%,.35)` : 'rgba(255,255,255,.045)'; ctx.fillRect(i * tw, y0, tw, y1 - y0); } }
      ctx.strokeStyle = 'rgba(255,122,200,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, FLOOR_Y + 0.5); ctx.lineTo(LW, FLOOR_Y + 0.5); ctx.stroke();
      // alfombra
      ctx.fillStyle = 'rgba(255,122,200,.12)'; ctx.beginPath(); ctx.ellipse(LW / 2, FLOOR_Y + 100, 120, 44, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(255,210,63,.35)'; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
      // símbolos flotando
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 18px ${FONT}`; ctx.globalAlpha = 0.14; ctx.fillStyle = '#fff'; SYM.forEach((s, i) => { const y = LH - ((t * 12 + i * 47) % (LH + 30)) + 15; ctx.fillText(s, 30 + i * 48 + Math.sin(t + i) * 8, y); }); ctx.globalAlpha = 1;
      // rocola
      { const x = JUKE.x, y = JUKE.y; ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, JUKE.w + 4, JUKE.h + 4); ctx.fillStyle = '#7a2a9a'; ctx.fillRect(x, y, JUKE.w, JUKE.h); ctx.fillStyle = '#ff7ac8'; ctx.fillRect(x + 3, y + 3, JUKE.w - 6, 14); for (let k = 0; k < 5; k++) { ctx.fillStyle = ((Math.floor(t * (party ? 10 : 3)) + k) % 3) ? '#ffd23f' : '#5ce1e6'; ctx.fillRect(x + 4 + k * 6, y + 6, 4, 8); } ctx.fillStyle = '#1a1033'; ctx.fillRect(x + 6, y + 24, JUKE.w - 12, 16); ctx.fillStyle = party ? '#9dff8a' : '#5443b0'; ctx.beginPath(); ctx.arc(x + JUKE.w / 2, y + 32, 5, 0, 6.283); ctx.fill(); if (party) { ctx.fillStyle = '#ff7ac8'; ctx.font = `700 14px ${FONT}`; ctx.fillText('♪', x + JUKE.w + 8, y + 10 - (t * 20) % 20); ctx.fillText('♫', x - 8, y + 20 - (t * 26) % 24); } }
      // cofre
      { const x = CHEST.x, y = CHEST.y; ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y + 8, CHEST.w + 4, CHEST.h - 4); ctx.fillStyle = '#b3701f'; ctx.fillRect(x, y + 10, CHEST.w, CHEST.h - 8); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y + 18, CHEST.w, 3); ctx.fillRect(x + CHEST.w / 2 - 3, y + 16, 6, 8); ctx.fillStyle = '#8a5414'; if (chestOpen > 0) { ctx.fillRect(x - 2, y - 6 - chestOpen * 6, CHEST.w + 4, 12); } else { ctx.fillRect(x - 2, y, CHEST.w + 4, 12); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 2, y + 6, CHEST.w + 4, 2); } if (!chestUsed) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); ctx.fillStyle = '#fff'; ctx.fillRect(x + 6 + (t * 20) % 26, y + 2, 3, 3); ctx.globalAlpha = 1; } }
    }
    const spriteFor = (look, pose, fr) => { try { return S.heroCanvas(look || {}, pose, fr); } catch (e) { return null; } };
    function drawPlayer(pl, look, name, x, y, f, moving, emo, isMe, t) {
      const sc = 0.95 + (y - FLOOR_Y) / (LH - FLOOR_Y) * 0.6, hw = S.HERO_W * sc, hh = S.HERO_H * sc;
      const dancing = emo === '💃' || party, fr = moving ? Math.floor(t * 10) % 4 : dancing ? Math.floor(t * 6) % 4 : 0;
      const spr = spriteFor(look, 'idle', fr); if (!spr) return;
      const bob = moving ? Math.abs(Math.sin(t * 12)) * 3 * sc : dancing ? Math.abs(Math.sin(t * 8)) * 6 * sc : Math.sin(t * 2 + x) * 0.8;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y, 16 * sc, 4.5 * sc, 0, 0, 6.283); ctx.fill();
      ctx.translate(x, y); const fl = dancing && !moving ? (Math.floor(t * 4) % 2 ? -1 : 1) : f; if (fl < 0) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, -hw / 2, -hh + 4 * sc - bob, hw, hh); ctx.restore();
      // nombre
      ctx.font = `800 9px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const nm = String(name || '').slice(0, 10), w = ctx.measureText(nm).width + 8;
      ctx.fillStyle = isMe ? 'rgba(255,210,63,.95)' : 'rgba(10,5,30,.8)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y + 5 * sc), Math.round(w), 12); ctx.fillStyle = isMe ? '#1a1033' : '#fff'; ctx.fillText(nm, x, y + 5 * sc + 6.5);
      if (emo) { const by = y - hh - 4 * sc - 8 - bob; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1033'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 15, by - 14, 30, 26, 8) : ctx.rect(x - 15, by - 14, 30, 26); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 4, by + 11); ctx.lineTo(x, by + 17); ctx.lineTo(x + 4, by + 11); ctx.fillStyle = '#fff'; ctx.fill(); ctx.font = `18px ${FONT}`; ctx.fillText(emo, x, by); }
    }
    function tick(ts) {
      if (dead) return; raf = requestAnimationFrame(tick);
      if (!last) last = ts; const dt = Math.min(0.06, (ts - last) / 1000); last = ts; const t = ts / 1000;
      if (W <= 0) { resize(); return; }
      // mover
      let kx = 0, ky = 0; if (keys.arrowleft || keys.a) kx--; if (keys.arrowright || keys.d) kx++; if (keys.arrowup || keys.w) ky--; if (keys.arrowdown || keys.s) ky++;
      if (kx || ky) { me.tx = me.x + kx * 40; me.ty = me.y + ky * 40; clampP(); me.chestGo = false; }
      const dx = me.tx - me.x, dy = me.ty - me.y, d = Math.hypot(dx, dy), sp = 105 * dt;
      me.moving = d > 2; if (me.moving) { const k = Math.min(1, sp / d); me.x += dx * k; me.y += dy * k; if (Math.abs(dx) > 1.5) me.f = dx > 0 ? 1 : -1; }
      if (party) partyT += dt;
      // cofre
      if (me.chestGo && Math.abs(me.x - (CHEST.x + 20)) < 24 && Math.abs(me.y - (CHEST.y + CHEST.h + 22)) < 20) { me.chestGo = false; if (!chestUsed) { chestUsed = true; chestOpen = 1; A.sfx('levelup'); for (let i = 0; i < 24; i++) { const a = Math.random() * 6.283; parts.push({ x: CHEST.x + 20, y: CHEST.y + 6, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 60, t: 0, life: 0.9, c: ['#ffd23f', '#fff', '#ff7ac8'][i % 3], s: 3 }); } floats.push({ x: CHEST.x + 20, y: CHEST.y - 10, text: '+5 monedas', c: '#ffd23f', t: 0, life: 1.4, size: 15 }); o.onCoin && o.onCoin(5); } else { floats.push({ x: CHEST.x + 20, y: CHEST.y - 10, text: 'Vacío…', c: '#b6abe6', t: 0, life: 1, size: 13 }); } }
      if (chestOpen > 0 && chestUsed) chestOpen = Math.max(0.01, chestOpen - dt * 0.2);
      // monedas de la plaza (máx. 6 por ronda)
      coinT -= dt; if (coinT <= 0 && coins.length < 3 && coinsGot + coins.length < 6) { coinT = 9 + Math.random() * 8; coins.push({ x: 30 + Math.random() * (LW - 60), y: FLOOR_Y + 30 + Math.random() * (LH - FLOOR_Y - 45) }); }
      for (let i = coins.length - 1; i >= 0; i--) if (Math.hypot(coins[i].x - me.x, coins[i].y - me.y) < 18) { const c = coins.splice(i, 1)[0]; coinsGot++; A.sfx('coin'); floats.push({ x: c.x, y: c.y - 8, text: '+1', c: '#ffd23f', t: 0, life: 0.9, size: 15 }); o.onCoin && o.onCoin(1); }
      // red
      const now = Date.now();
      if (now - lastSent > 220 && (Math.abs(me.x - sx) > 1.5 || Math.abs(me.y - sy) > 1.5 || me.f !== sf)) { lastSent = now; sx = me.x; sy = me.y; sf = me.f; o.setPos(Math.round(sxOf(me.x) * 10) / 10, Math.round(me.y * 10) / 10, me.f); }
      const players = o.getPlayers() || {}, pos = o.getPos() || {};
      Object.keys(players).forEach((id) => { if (id === o.pid) return; const q0 = pos[id], q = q0 && typeof q0.x === 'number' ? { x: fromNet(q0.x), y: q0.y, f: q0.f, e: q0.e, et: q0.et } : q0; if (!others[id]) others[id] = { x: q ? q.x : LW / 2, y: q ? q.y : FLOOR_Y + 90, f: 1, moving: false }; const c = others[id]; if (q && typeof q.x === 'number') { const ddx = q.x - c.x, ddy = q.y - c.y, dd = Math.hypot(ddx, ddy); c.moving = dd > 2; const k = Math.min(1, dt * 7); c.x += ddx * k; c.y += ddy * k; if (q.f) c.f = q.f; } });
      Object.keys(others).forEach((id) => { if (!players[id]) delete others[id]; });
      parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].life) parts.splice(i, 1);
      floats.forEach((f) => { f.t += dt; f.y -= 24 * dt; }); for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t >= floats[i].life) floats.splice(i, 1);
      // dibujar
      const sc = W / LW; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H); ctx.save(); ctx.scale(sc, sc);
      drawRoom(t);
      coins.forEach((c) => { const b = Math.sin(t * 6 + c.x) * 2; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 4, 6, 2, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(c.x, c.y - 4 + b, 8, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(c.x, c.y - 4 + b, 6, 0, 6.283); ctx.fill(); });
      const list = [];
      Object.keys(players).forEach((id) => { const pl = players[id]; if (id === o.pid) list.push({ y: me.y, id, pl, x: me.x, f: me.f, mv: me.moving, me: true }); else if (others[id] && pl.online !== false) list.push({ y: others[id].y, id, pl, x: others[id].x, f: others[id].f, mv: others[id].moving }); });
      if (!players[o.pid]) list.push({ y: me.y, id: o.pid, pl: { name: 'Tú', look: o.getLook() }, x: me.x, f: me.f, mv: me.moving, me: true });
      list.sort((a, b) => a.y - b.y).forEach((e) => { const q = pos[e.id]; const emo = q && q.e && q.et && (o.now() - q.et) < 3200 ? q.e : ''; drawPlayer(e.pl, e.me ? o.getLook() : e.pl.look, e.pl.name, e.x, e.y, e.f, e.mv, emo, !!e.me, t); });
      parts.forEach((p) => { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }); ctx.globalAlpha = 1;
      floats.forEach((f) => { ctx.globalAlpha = clamp(1 - f.t / f.life, 0, 1); ctx.font = `${f.size}px Bangers, ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a1033'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }); ctx.globalAlpha = 1;
      ctx.restore();
    }
    resize(); raf = requestAnimationFrame(tick);
    return {
      destroy() { dead = true; cancelAnimationFrame(raf); root.removeEventListener('keydown', kd); root.removeEventListener('keyup', ku); root.removeEventListener('pointerup', up); root.removeEventListener('resize', resize); if (ro) ro.disconnect(); if (cv.parentNode) cv.parentNode.removeChild(cv); },
      me, EMOTES, canvas: cv,
      emote(e) { floats.push({ x: me.x, y: me.y - 60, text: '', c: '#fff', t: 0, life: 0.01, size: 1 }); },
    };
  }
  root.DuiXPlaza = { mount, EMOTES };
})(window);
