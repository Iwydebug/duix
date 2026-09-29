/* DuiX — fondos animados (dragones, símbolos matemáticos, estrellas, ondas, ciudad).
 * Todo se calcula a partir del tiempo (sin estado), así sirve igual para el mapa (canvas propio)
 * y para el arcade (se dibuja encima del fondo de cada villano).
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const mulberry = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hashStr = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const fract = (x) => x - Math.floor(x);
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "DejaVu Sans", Arial, sans-serif';

  const SYMS = {
    intervalos: ['[a,b)', '∪', '∩', '∞', '(a,b]', '[ ]'], fracciones: ['½', '¾', '⅔', 'a/b', '÷', '⅝'], factorizacion: ['(x+a)', 'x²', '·', '2·3', '(x−b)'],
    polinomios: ['x³', '2x²', '+', 'x⁴', 'P(x)'], plano: ['(x,y)', '↗', '+', '−', 'y', 'x'], desigualdades: ['<', '>', '≤', '≥', '≠'],
    funciones: ['f(x)', '→', 'g(x)', 'y=x', 'f+g'], desplazamientos: ['↔', '↕', 'x−h', '+k', '↗'], tabulaciones: ['x|y', '1 2 3', '▦', 'f(2)'],
    potenciacion: ['aⁿ', 'x²', '2³', '10⁶', 'x⁻¹'], composicion: ['f∘g', 'g(f)', '(f∘g)(x)', '∘'], radicales: ['√', '∛', 'x^½', '√x', 'ⁿ√'],
    logaritmos: ['log', 'ln', 'logₐ', 'e', 'eˣ'], trigonometria: ['sen', 'cos', 'tan', 'π', 'θ', '180°'],
    all: ['π', '∑', '∞', '√', '∫', 'x²', 'f(x)', '≠', '≤', 'log', 'sen', 'θ', 'Δ', 'e', 'lím', '0/0'],
  };
  const COL = ['#5ce1e6', '#ffd23f', '#ff7ac8', '#c58bff', '#9dff8a', '#ffffff'];

  /* ---------- dragón en pixel art (3 posiciones de ala) ---------- */
  const dragonCache = {};
  function dragonSprite(main, shade, light, frame) {
    const k = main + shade + light + frame; if (dragonCache[k]) return dragonCache[k];
    const W = 28, H = 20, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const P = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const ink = '#1a1033';
    // ala trasera (detrás del cuerpo)
    const wingPts = [[[13, 9], [8, 1], [18, 3]], [[13, 9], [7, 5], [19, 5]], [[13, 10], [9, 16], [19, 15]]][frame === 3 ? 1 : frame];
    const tri = (pts, col) => { const [a, b, d] = pts; const minY = Math.min(a[1], b[1], d[1]), maxY = Math.max(a[1], b[1], d[1]); for (let y = minY; y <= maxY; y++) { const xs = []; [[a, b], [b, d], [d, a]].forEach(([p, q]) => { if ((p[1] <= y && q[1] >= y) || (q[1] <= y && p[1] >= y)) { if (p[1] === q[1]) { xs.push(p[0], q[0]); } else xs.push(p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1])); } }); if (xs.length) { const x0 = Math.round(Math.min(...xs)), x1 = Math.round(Math.max(...xs)); R(x0, y, x1 - x0 + 1, 1, col); } } };
    tri(wingPts, shade);
    { const [a, b, d] = wingPts; const inner = [[a[0], a[1]], [Math.round((a[0] + b[0]) / 2 + 1), Math.round((a[1] + b[1]) / 2 + (frame === 2 ? -1 : 1))], [Math.round((a[0] + d[0]) / 2), Math.round((a[1] + d[1]) / 2 + (frame === 2 ? -1 : 1))]]; tri(inner, light); }
    // cola
    [[1, 12], [2, 12], [3, 11], [4, 11], [5, 12], [6, 12], [7, 11]].forEach(([x, y]) => P(x, y, main)); P(0, 11, shade); P(0, 13, shade); P(1, 11, shade);
    // cuerpo
    R(8, 10, 10, 4, main); R(9, 14, 8, 1, shade); R(10, 13, 7, 1, light);
    // patas
    R(10, 15, 2, 2, shade); R(15, 15, 2, 2, shade);
    // cuello y cabeza
    R(18, 9, 3, 3, main); R(19, 7, 3, 3, main); R(21, 6, 5, 4, main); R(24, 8, 3, 2, main); R(22, 10, 4, 1, shade);
    P(23, 7, light); P(24, 7, ink); // ojo
    P(26, 8, ink); // nariz
    P(21, 5, shade); P(20, 4, shade); P(22, 4, shade); P(21, 3, shade); // cuernos
    // púas del lomo
    [9, 11, 13, 15].forEach((x) => P(x, 9, shade));
    dragonCache[k] = cv; return cv;
  }

  /* ---------- escena ---------- */
  function scene(o) {
    o = o || {};
    const seed = hashStr(String(o.seed || 'duix')), R = mulberry(seed);
    const syms = (o.topic && SYMS[o.topic]) || SYMS.all;
    const mode = o.mode || 'hub';
    const nSym = o.symbols !== undefined ? o.symbols : (mode === 'hub' ? 22 : 9);
    const nStars = mode === 'hub' ? 70 : 34;
    const pal = o.pal || null;
    const dcols = pal ? [[pal.main, pal.shade, pal.light]] : [['#7b4dff', '#3b1f9e', '#c9b3ff'], ['#19c6a6', '#0b7a68', '#9ff5e4'], ['#ff6b4a', '#a52f1a', '#ffc2a8'], ['#ffd23f', '#b07a00', '#fff2a8']];
    const symbols = Array.from({ length: nSym }, () => ({ x: R(), ph: R(), sp: 0.012 + R() * 0.03, sway: 4 + R() * 10, size: 9 + Math.floor(R() * 12), s: syms[Math.floor(R() * syms.length)], c: COL[Math.floor(R() * COL.length)], rot: (R() - 0.5) * 0.5 }));
    const stars = Array.from({ length: nStars }, () => ({ x: R(), y: R() * 0.62, ph: R() * TAU, big: R() < 0.16 }));
    const dragons = Array.from({ length: o.dragons !== undefined ? o.dragons : (mode === 'hub' ? 3 : 1) }, (_, i) => { const c = dcols[i % dcols.length]; return { c, per: 26 + R() * 22, gap: 3 + R() * 9, off: R() * 40, y: 0.1 + R() * (mode === 'hub' ? 0.5 : 0.16), s: mode === 'hub' ? (i === 0 ? 2 : 1) : 1, dir: i % 2 ? -1 : 1, fire: R() < 0.7 }; });
    const towers = Array.from({ length: 22 }, () => ({ w: 5 + Math.floor(R() * 7), h: 8 + Math.floor(R() * 26), lit: R() })).map((t, i, a) => { t.x = a.slice(0, i).reduce((s, q) => s + q.w + 1, 0); return t; });
    const towerW = towers.reduce((s, t) => s + t.w + 1, 0);

    function drawSky(ctx, w, h, t) {
      const g = ctx.createLinearGradient(0, 0, 0, h); const ph = (Math.sin(t * 0.05) + 1) / 2;
      g.addColorStop(0, '#0d0524'); g.addColorStop(0.45, ph > 0.5 ? '#25104f' : '#1e0f45'); g.addColorStop(0.8, '#5a1f7a'); g.addColorStop(1, '#a3327c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    function drawStars(ctx, w, h, t, px) {
      stars.forEach((s) => { const tw = Math.sin(t * 1.6 + s.ph); if (tw < -0.55) return; ctx.globalAlpha = 0.35 + 0.5 * (tw + 1) / 2; ctx.fillStyle = s.big ? '#fff2a8' : '#cfe8ff'; const x = Math.round(s.x * w), y = Math.round(s.y * h); if (s.big) { ctx.fillRect(x - px, y, px * 3, px); ctx.fillRect(x, y - px, px, px * 3); } else ctx.fillRect(x, y, px, px); }); ctx.globalAlpha = 1;
    }
    function drawMoon(ctx, w, h, t, px) {
      const cx = w * 0.8, cy = h * 0.14, r = Math.min(w, h) * 0.085;
      const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 3); g.addColorStop(0, 'rgba(255,230,160,.35)'); g.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = g; ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(214,170,90,.55)'; [[-0.3, -0.2, 0.22], [0.28, 0.1, 0.16], [-0.05, 0.38, 0.12]].forEach(([dx, dy, rr]) => { ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, rr * r, 0, TAU); ctx.fill(); });
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = px; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.6, r * 0.45, -0.5 + Math.sin(t * 0.3) * 0.05, 0, TAU); ctx.stroke();
    }
    function drawWaves(ctx, w, h, t, px, strong) {
      const defs = [['rgba(92,225,230,', 0.30, 0.06, 0.05, 0.9], ['rgba(255,122,200,', 0.36, 0.05, 0.04, -0.7], ['rgba(197,139,255,', 0.42, 0.07, 0.035, 0.5]];
      ctx.lineWidth = px * 1.2;
      defs.forEach(([c, y0, a, k, sp], i) => { ctx.strokeStyle = c + (strong ? 0.34 : 0.16) + ')'; ctx.beginPath(); for (let x = 0; x <= w; x += px * 3) { const y = h * y0 + Math.sin(x * k / px + t * sp + i) * a * h + Math.sin(x * k * 2.3 / px - t * sp * 0.6) * a * h * 0.35; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); });
    }
    function drawClouds(ctx, w, h, t, px) {
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      for (let i = 0; i < 4; i++) { const cx = ((fract(i * 0.27 + t * 0.004 * (1 + i * 0.3)) * (w + 120)) - 60), cy = h * (0.2 + i * 0.13); for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(cx + k * 7 * px - (k % 2 ? 0 : 3 * px)), Math.round(cy - (k === 2 ? 4 * px : k % 2 ? 2 * px : 0)), 9 * px, 4 * px); }
    }
    function drawGrid(ctx, w, h, t, px) {
      const hy = h * 0.8; ctx.save(); ctx.beginPath(); ctx.rect(0, hy, w, h - hy); ctx.clip();
      const g = ctx.createLinearGradient(0, hy, 0, h); g.addColorStop(0, 'rgba(255,90,200,.28)'); g.addColorStop(1, 'rgba(60,20,120,.5)'); ctx.fillStyle = g; ctx.fillRect(0, hy, w, h - hy);
      ctx.strokeStyle = 'rgba(255,140,230,.55)'; ctx.lineWidth = px;
      for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.02, hy); ctx.lineTo(w / 2 + i * w * 0.2, h); ctx.stroke(); }
      for (let i = 0; i < 9; i++) { const f = fract(i / 9 + t * 0.06), y = hy + (f * f) * (h - hy); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.restore(); ctx.fillStyle = 'rgba(255,200,250,.7)'; ctx.fillRect(0, Math.round(hy), w, px);
    }
    function drawSkyline(ctx, w, h, t, px) {
      const base = h * 0.8;
      for (let layer = 0; layer < 2; layer++) {
        const off = -((t * (layer ? 1.6 : 0.8)) % towerW) * px * 0.4; ctx.fillStyle = layer ? '#150a33' : '#0d0724';
        for (let rep = 0; rep < Math.ceil(w / (towerW * px)) + 2; rep++) towers.forEach((tw, i) => {
          const x = Math.round(off + rep * towerW * px + tw.x * px + (layer ? 3 * px : 0)), th = tw.h * px * (layer ? 0.75 : 1);
          ctx.fillRect(x, Math.round(base - th), tw.w * px, Math.round(th) + 1);
          if (!layer) { for (let y = 3; y < tw.h - 2; y += 4) for (let xx = 1; xx < tw.w - 1; xx += 2) { const on = Math.sin(t * 0.7 + i * 3.1 + y * 1.7 + xx) > (tw.lit - 0.55) * 1.6; if (on) { ctx.fillStyle = (i + y) % 3 ? '#ffd23f' : '#5ce1e6'; ctx.globalAlpha = 0.65; ctx.fillRect(x + xx * px, Math.round(base - th) + y * px, px, px * 2); ctx.globalAlpha = 1; } } ctx.fillStyle = '#0d0724'; }
        });
      }
    }
    function drawSymbols(ctx, w, h, t, px, alpha) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      symbols.forEach((s, i) => {
        const p = fract(s.ph + t * s.sp), y = h + 20 - p * (h + 40), x = s.x * w + Math.sin(t * 0.5 + i * 2) * s.sway * px;
        const fade = Math.sin(p * Math.PI); ctx.globalAlpha = Math.max(0, fade) * alpha;
        ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(s.rot + Math.sin(t * 0.4 + i) * 0.12);
        ctx.font = `700 ${Math.round(s.size * px)}px ${FONT}`; ctx.lineWidth = px; ctx.strokeStyle = 'rgba(13,7,36,.8)'; ctx.strokeText(s.s, 0, 0); ctx.fillStyle = s.c; ctx.fillText(s.s, 0, 0); ctx.restore();
      });
      ctx.globalAlpha = 1;
    }
    function drawDragons(ctx, w, h, t, px, alpha) {
      dragons.forEach((d, i) => {
        const cyc = d.per + d.gap, tt = (t + d.off) % cyc; if (tt > d.per) return;
        const p = tt / d.per, dw = 28 * d.s * px, x = d.dir > 0 ? -dw + p * (w + dw * 2) : w + dw - p * (w + dw * 2), y = h * d.y + Math.sin(t * 0.9 + i * 2) * 6 * px;
        const fr = [0, 1, 2, 1][Math.floor(t * 5 + i) % 4];
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x), Math.round(y)); if (d.dir < 0) ctx.scale(-1, 1);
        // sombra/estela
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(Math.round(-dw * 0.45), Math.round(14 * d.s * px), Math.round(dw * 0.8), Math.round(2 * px));
        ctx.imageSmoothingEnabled = false; ctx.drawImage(dragonSprite(d.c[0], d.c[1], d.c[2], fr), 0, 0, Math.round(dw), Math.round(20 * d.s * px));
        if (d.fire && Math.sin(t * 1.3 + i * 5) > 0.55) { for (let k = 0; k < 7; k++) { const fx = dw + k * 4 * d.s * px + ((t * 40 + k * 9) % 6) * px, fy = 8 * d.s * px + Math.sin(t * 20 + k) * 2 * px; ctx.globalAlpha = alpha * (1 - k / 8); ctx.fillStyle = k < 3 ? '#fff2a8' : k < 5 ? '#ffb02e' : '#ff5a2e'; ctx.fillRect(Math.round(fx), Math.round(fy), Math.round((5 - k * 0.4) * px), Math.round((4 - k * 0.3) * px)); } }
        ctx.restore();
      });
    }
    function drawShooting(ctx, w, h, t, px) {
      const per = 9, k = Math.floor(t / per), p = (t % per) / 0.9; if (p > 1) return;
      const r = mulberry(seed + k * 131), sx = r() * w * 0.7, sy = r() * h * 0.25, len = 60 * px;
      ctx.save(); ctx.globalAlpha = 1 - p; const x = sx + p * len * 2, y = sy + p * len; const g = ctx.createLinearGradient(x, y, x - len, y - len / 2); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = g; ctx.lineWidth = px * 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y - len / 2); ctx.stroke(); ctx.restore();
    }

    /* ---------- mundo de fantasía (mapa de niveles): montañas con parallax, islas flotantes, cristales ---------- */
    const ridge = (n, amp, seedOff) => { const r = mulberry(seed + seedOff), pts = []; for (let i = 0; i <= n; i++) pts.push(0.5 + (r() - 0.5) * amp); return pts; };
    const RIDGES = [ridge(28, 0.9, 11), ridge(24, 1.0, 22), ridge(20, 1.1, 33)];
    const islands = Array.from({ length: 7 }, (_, i) => { const r = mulberry(seed + 900 + i); return { x: r(), y: 0.12 + r() * 0.5, w: 12 + Math.floor(r() * 12), ph: r() * TAU, par: 0.25 + r() * 0.35, c: r() < 0.5 ? '#3fe0a0' : '#c58bff' }; });
    const crystals = Array.from({ length: 16 }, (_, i) => { const r = mulberry(seed + 1300 + i); return { x: r(), h: 5 + Math.floor(r() * 8), c: ['#5ce1e6', '#ff7ac8', '#ffd23f', '#9dff8a'][Math.floor(r() * 4)], ph: r() * TAU }; });
    function drawWorldSky(ctx, w, h, t) {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a0430'); g.addColorStop(0.4, '#2a1170'); g.addColorStop(0.75, '#7a2a9a'); g.addColorStop(1, '#ff6fa8');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const ag = ctx.createLinearGradient(0, h * 0.2, w, h * 0.5); const a = 0.10 + 0.05 * Math.sin(t * 0.3); ag.addColorStop(0, 'rgba(92,225,230,0)'); ag.addColorStop(0.5, `rgba(92,225,230,${a})`); ag.addColorStop(1, 'rgba(255,122,200,0)'); ctx.fillStyle = ag; ctx.fillRect(0, h * 0.1, w, h * 0.5);
    }
    function drawIslands(ctx, w, h, t, px, scroll) {
      islands.forEach((it, i) => {
        const H2 = h * 1.1, x = Math.round(it.x * w), y = Math.round((((it.y * h - (scroll || 0) * it.par) % H2) + H2) % H2 - h * 0.05 + Math.sin(t * 0.7 + it.ph) * 3 * px), iw = it.w * px;
        ctx.fillStyle = '#1a0f3d'; ctx.fillRect(x - iw / 2, y, iw, 3 * px); ctx.fillRect(x - iw / 2 + px * 2, y + 3 * px, iw - px * 4, 2 * px); ctx.fillRect(x - iw / 4, y + 5 * px, iw / 2, 2 * px);
        ctx.fillStyle = it.c; ctx.fillRect(x - iw / 2, y - px, iw, px * 1.5);
        ctx.fillStyle = '#ffd23f'; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 2 + i); ctx.fillRect(x + px, y - 5 * px, px * 2, px * 4); ctx.globalAlpha = 1;
      });
    }
    function drawMountains(ctx, w, h, t, px, scroll) {
      const cols = ['#2a1670', '#1d0f52', '#120839'], base = [0.72, 0.8, 0.9], sp = [0.10, 0.22, 0.4];
      RIDGES.forEach((pts, L) => {
        const off = -(scroll || 0) * sp[L]; ctx.fillStyle = cols[L]; ctx.beginPath(); ctx.moveTo(0, h);
        const step = w / (pts.length - 3);
        for (let i = 0; i < pts.length; i++) { const x = (i - 1) * step - ((off * 0.15) % step), y = h * base[L] - pts[i] * h * (0.12 + L * 0.03) - ((off * 0.05) % 6); ctx.lineTo(x, y); }
        ctx.lineTo(w + step, h); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = L === 0 ? 'rgba(255,122,200,.35)' : 'rgba(92,225,230,.22)'; ctx.lineWidth = px; ctx.stroke();
      });
      crystals.forEach((c, i) => { const x = Math.round(c.x * w), y = Math.round(h * 0.94), ch = c.h * px; ctx.fillStyle = c.c; ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 2 + c.ph); ctx.beginPath(); ctx.moveTo(x, y - ch); ctx.lineTo(x + 2 * px, y); ctx.lineTo(x - 2 * px, y); ctx.fill(); ctx.globalAlpha = 1; });
    }
    function drawFireflies(ctx, w, h, t, px) { for (let i = 0; i < 26; i++) { const r = mulberry(seed + 2000 + i), bx = r(), by = r(), ph = r() * TAU; const x = (bx * w + Math.sin(t * 0.6 + ph) * 14 * px) , y = (by * h + Math.cos(t * 0.5 + ph) * 10 * px); ctx.globalAlpha = 0.25 + 0.6 * Math.max(0, Math.sin(t * 2 + ph)); ctx.fillStyle = i % 2 ? '#ffe98a' : '#9dffef'; ctx.fillRect(Math.round(x), Math.round(y), px, px); } ctx.globalAlpha = 1; }

    return {
      /** Fondo completo (mapa) */
      full(ctx, w, h, t, px, scroll) {
        ctx.imageSmoothingEnabled = false;
        if (o.world) { drawWorldSky(ctx, w, h, t); drawStars(ctx, w, h, t, px); drawMoon(ctx, w, h, t, px); drawShooting(ctx, w, h, t, px); drawClouds(ctx, w, h, t, px); drawIslands(ctx, w, h, t, px, scroll); drawDragons(ctx, w, h, t, px, 0.95); drawMountains(ctx, w, h, t, px, scroll); drawSymbols(ctx, w, h, t, px, 0.3); drawFireflies(ctx, w, h, t, px); return; }
        drawSky(ctx, w, h, t); drawStars(ctx, w, h, t, px); drawMoon(ctx, w, h, t, px); drawShooting(ctx, w, h, t, px); drawClouds(ctx, w, h, t, px); drawWaves(ctx, w, h, t, px, true);
        drawDragons(ctx, w, h, t, px, 0.95); drawGrid(ctx, w, h, t, px); drawSkyline(ctx, w, h, t, px); drawSymbols(ctx, w, h, t, px, 0.34);
      },
      /** Capa animada encima del fondo de un villano (arcade) */
      overlay(ctx, w, h, t, px) {
        ctx.save(); ctx.imageSmoothingEnabled = false;
        drawStars(ctx, w, h, t, px); drawWaves(ctx, w, h, t, px, false); drawDragons(ctx, w, h, t, px, 0.5); drawSymbols(ctx, w, h, t, px, 0.24); drawShooting(ctx, w, h, t, px);
        ctx.restore();
      },
    };
  }

  /* ---------- MUNDO DE CARAMELO (mapa y menús) ---------- */
  const hex2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const lerpC = (a, b, t) => { const x = hex2(a), y = hex2(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; };
  const ZONES = [['#3aa7ff', '#8ad8ff', '#d6f2ff'], ['#ff6fbf', '#ffab9e', '#ffe6a8'], ['#4a2fb8', '#a56bff', '#ff9fe0']];
  const CANDY = ['#ff7ac8', '#5df2c0', '#ffe45c', '#ffa63d', '#5cc8ff', '#b58cff', '#ff5d6e'];
  const INK = '#4a1f6e';

  function candyScene(seedStr) {
    const R = mulberry(hashStr(seedStr || 'candy'));
    const PI = Math.PI, r0 = (v) => Math.round(v);
    const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(r0(x), r0(y), r0(w), r0(h)); };
    const circ = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(r0(x), r0(y), r, 0, 2 * PI); c.fill(); };

    /* ----- objetos de dulce ----- */
    function lolli(c, x, y, r, c1, c2) {
      rect(c, x - 1, y + r, 2, r * 2.2, '#fff4e0'); rect(c, x, y + r, 1, r * 2.2, '#dcc9a6');
      circ(c, x, y, r + 1.4, INK); circ(c, x, y, r, c1);
      c.fillStyle = c2; for (let u = 0; u < 1; u += 0.012) { const rad = u * (r - 0.8), th = u * PI * 5; c.fillRect(r0(x + Math.cos(th) * rad - 0.5), r0(y + Math.sin(th) * rad - 0.5), 1.6, 1.6); }
      rect(c, x - r * 0.55, y - r * 0.65, 2, 2, 'rgba(255,255,255,.9)');
    }
    function cane(c, x, y, h) {
      const pts = []; for (let i = 0; i < h; i++) pts.push([x, y + 5 + i]); for (let a = PI; a >= 0; a -= 0.22) pts.push([x + 5 + Math.cos(a) * 5, y + 5 - Math.sin(a) * 5]);
      pts.forEach(([px, py]) => rect(c, px - 2.5, py - 2.5, 5, 5, INK)); pts.forEach(([px, py], i) => rect(c, px - 1.5, py - 1.5, 3, 3, Math.floor(i / 3) % 2 ? '#ffffff' : '#ff4d6d'));
    }
    function gum(c, x, y, r, col) {
      c.fillStyle = INK; c.beginPath(); c.arc(r0(x), r0(y), r + 1.4, PI, 0); c.lineTo(x + r + 1.4, y + r * 0.6 + 1.4); c.lineTo(x - r - 1.4, y + r * 0.6 + 1.4); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(r0(x), r0(y), r, PI, 0); c.lineTo(x + r, y + r * 0.6); c.lineTo(x - r, y + r * 0.6); c.fill();
      for (let i = 0; i < 6; i++) rect(c, x - r + 2 + (i * 5) % (r * 2 - 3), y - r * 0.8 + (i * 3) % (r * 1.2), 1, 1, 'rgba(255,255,255,.9)');
      rect(c, x - r * 0.5, y - r * 0.6, 2, 2, 'rgba(255,255,255,.9)');
    }
    function cupcake(c, x, y, s, col) {
      c.fillStyle = INK; c.beginPath(); c.moveTo(x - 7 * s - 1, y); c.lineTo(x + 7 * s + 1, y); c.lineTo(x + 5 * s + 1, y + 9 * s + 1); c.lineTo(x - 5 * s - 1, y + 9 * s + 1); c.fill();
      c.fillStyle = '#ffd08a'; c.beginPath(); c.moveTo(x - 6 * s, y + 1); c.lineTo(x + 6 * s, y + 1); c.lineTo(x + 4.5 * s, y + 8.5 * s); c.lineTo(x - 4.5 * s, y + 8.5 * s); c.fill();
      for (let i = -2; i <= 2; i++) rect(c, x + i * 2.4 * s, y + 1, 1, 8 * s, 'rgba(180,110,50,.45)');
      circ(c, x, y - 2 * s, 8 * s + 1.4, INK); circ(c, x, y - 2 * s, 8 * s, col); circ(c, x, y - 7 * s, 5.5 * s + 1.4, INK); circ(c, x, y - 7 * s, 5.5 * s, col); circ(c, x, y - 11 * s, 3 * s, '#ff2d55'); rect(c, x - 1, y - 12 * s, 1.5, 1.5, '#fff');
    }
    function donut(c, x, y, r, col) {
      c.lineWidth = r * 0.95 + 3; c.strokeStyle = INK; c.beginPath(); c.arc(x, y, r * 0.62, 0, 2 * PI); c.stroke();
      c.lineWidth = r * 0.95; c.strokeStyle = '#f3b26a'; c.beginPath(); c.arc(x, y, r * 0.62, 0, 2 * PI); c.stroke();
      c.lineWidth = r * 0.6; c.strokeStyle = col; c.beginPath(); c.arc(x, y - 0.5, r * 0.64, 0, 2 * PI); c.stroke();
      for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3; rect(c, x + Math.cos(a) * r * 0.64, y + Math.sin(a) * r * 0.64, 2, 1, CANDY[(i * 2) % CANDY.length]); }
    }
    function cone(c, x, y, s) {
      c.fillStyle = INK; c.beginPath(); c.moveTo(x - 6 * s - 1, y); c.lineTo(x + 6 * s + 1, y); c.lineTo(x, y + 16 * s + 2); c.fill();
      c.fillStyle = '#eaa55a'; c.beginPath(); c.moveTo(x - 5 * s, y + 1); c.lineTo(x + 5 * s, y + 1); c.lineTo(x, y + 15 * s); c.fill();
      c.strokeStyle = 'rgba(150,90,30,.6)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 2.2 * s, y + 1); c.lineTo(x, y + 14 * s); c.stroke(); }
      circ(c, x, y - 1 * s, 7 * s + 1.4, INK); circ(c, x, y - 1 * s, 7 * s, '#ff9ad5'); circ(c, x, y - 8 * s, 6 * s + 1.4, INK); circ(c, x, y - 8 * s, 6 * s, '#7ff0d0'); circ(c, x, y - 13 * s, 2.4 * s, '#ff2d55');
    }
    function star(c, x, y, r, col) {
      const path = (rr) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, q = i % 2 ? rr * 0.45 : rr; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); };
      c.fillStyle = INK; path(r + 1.6); c.fill(); c.fillStyle = col; path(r); c.fill(); rect(c, x - r * 0.2, y - r * 0.5, 2, 2, 'rgba(255,255,255,.9)');
    }
    function cloud(c, x, y, s) {
      const bl = [[0, 0, 7], [8, -3, 9], [17, 0, 7], [8, 3, 8], [-1, 3, 5], [18, 3, 5]];
      bl.forEach(([dx, dy, rr]) => circ(c, x + dx * s, y + dy * s + 2, rr * s, '#ffd1ec')); bl.forEach(([dx, dy, rr]) => circ(c, x + dx * s, y + dy * s, rr * s, '#ffffff'));
    }
    function island(c, x, y, w, t, i) {
      const bob = Math.sin(t * 0.7 + i * 2) * 2;
      y += bob; c.fillStyle = '#5b3520'; c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.quadraticCurveTo(x + w * 0.2, y + w * 0.7, x, y + w * 0.75); c.quadraticCurveTo(x - w * 0.2, y + w * 0.7, x - w / 2, y); c.fill();
      c.fillStyle = '#7b4a2e'; c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.quadraticCurveTo(x + w * 0.25, y + w * 0.5, x, y + w * 0.55); c.quadraticCurveTo(x - w * 0.25, y + w * 0.5, x - w / 2, y); c.fill();
      c.fillStyle = INK; c.beginPath(); c.ellipse(x, y, w / 2 + 1.4, w * 0.16 + 1.4, 0, PI, 2 * PI); c.fill();
      c.fillStyle = '#8affc9'; c.beginPath(); c.ellipse(x, y, w / 2, w * 0.15, 0, PI, 2 * PI); c.fill();
      c.fillStyle = '#ff9ad5'; for (let k = -2; k <= 2; k++) { c.beginPath(); c.arc(x + k * w * 0.18, y - w * 0.05, 2.6, 0, PI); c.fill(); }
      lolli(c, x - w * 0.22, y - w * 0.32, 5, CANDY[i % 7], '#fff'); gum(c, x + w * 0.2, y - w * 0.1, 5, CANDY[(i + 3) % 7]);
    }
    function rainbow(c, w, h, scroll) {
      const cx = w * 0.5, cy = h * 0.66 - scroll * 0.08, base = w * 0.62;
      ['#ff4d6d', '#ff9a3d', '#ffe45c', '#5df2a0', '#5cc8ff', '#7a7cff', '#c58bff'].forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, base - i * 5, PI, 2 * PI); c.stroke(); }); c.globalAlpha = 1;
    }
    function sun(c, x, y, t) {
      for (let i = 0; i < 12; i++) { const a = i * PI / 6 + t * 0.25, l = i % 2 ? 6 : 10; c.strokeStyle = '#fff2a8'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); c.lineTo(x + Math.cos(a) * (12 + l), y + Math.sin(a) * (12 + l)); c.stroke(); }
      circ(c, x, y, 13, INK); circ(c, x, y, 11.6, '#ffe45c'); rect(c, x - 5, y - 2, 2, 3, INK); rect(c, x + 3, y - 2, 2, 3, INK); c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y + 1, 5, 0.2, PI - 0.2); c.stroke(); rect(c, x - 8, y + 2, 3, 2, 'rgba(255,120,150,.7)'); rect(c, x + 5, y + 2, 3, 2, 'rgba(255,120,150,.7)');
    }
    function candyBall(c, x, y, r, col, sym) {
      circ(c, x, y, r + 1.5, INK); circ(c, x, y, r, col); c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.22, -0.6, 0, 2 * PI); c.fill();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${Math.round(r * (sym.length > 2 ? 0.85 : 1.3))}px ${FONT}`; c.lineWidth = 2.4; c.strokeStyle = INK; c.strokeText(sym, x, y + 1, r * 1.7); c.fillStyle = '#fff'; c.fillText(sym, x, y + 1, r * 1.7);
    }
    const sparkle = (c, x, y, s, col) => { rect(c, x - s, y, s * 2 + 1, 1, col); rect(c, x, y - s, 1, s * 2 + 1, col); };

    /* ----- elementos de la escena (fijos por semilla) ----- */
    const near = Array.from({ length: 18 }, (_, i) => ({ kind: ['lolli', 'cane', 'gum', 'cupcake', 'donut', 'cone', 'star'][Math.floor(R() * 7)], side: i % 2, fx: 0.01 + R() * 0.08, wy: R(), s: 0.85 + R() * 0.5, c1: CANDY[Math.floor(R() * 7)], c2: CANDY[Math.floor(R() * 7)] }));
    const islands = Array.from({ length: 4 }, () => ({ fx: 0.12 + R() * 0.76, wy: R(), w: 34 + R() * 20 }));
    const clouds = Array.from({ length: 7 }, () => ({ x: R(), wy: R(), s: 0.7 + R() * 0.9, sp: 0.004 + R() * 0.008 }));
    const balls = Array.from({ length: 8 }, () => ({ x: 0.05 + R() * 0.9, ph: R(), sp: 0.009 + R() * 0.014, r: 7 + Math.floor(R() * 5), c: CANDY[Math.floor(R() * 7)], s: SYMS.all[Math.floor(R() * SYMS.all.length)], sway: 3 + R() * 6 }));
    const sparks = Array.from({ length: 34 }, () => ({ x: R(), y: R(), ph: R() * TAU }));
    const conf = Array.from({ length: 30 }, () => ({ x: R(), ph: R(), sp: 0.02 + R() * 0.03, c: CANDY[Math.floor(R() * 7)], sw: R() * TAU }));
    const drag = [['#ff9ad5', '#d0559f', '#ffe1f3'], ['#7fe8c8', '#2fa98a', '#d4fff1'], ['#ffe27a', '#e0a416', '#fff6c9'], ['#9ec5ff', '#4f7fe0', '#e0ecff']].map((cl, i) => ({ c: cl, per: 30 + R() * 20, gap: 2 + R() * 6, off: R() * 50, y: 0.08 + R() * 0.55, dir: i % 2 ? -1 : 1, s: i === 0 ? 1.8 : 1.3 }));
    const wrapY = (wy, f, scroll, P, m) => (((wy * P - scroll * f) % P) + P) % P - m;

    return {
      full(ctx, w, h, t, px, scroll, prog) {
        scroll = scroll || 0; prog = Math.max(0, Math.min(1, prog || 0));
        ctx.imageSmoothingEnabled = false;
        // cielo por zonas (día → atardecer → noche mágica)
        const zi = prog < 0.5 ? 0 : 1, zt = prog < 0.5 ? prog * 2 : (prog - 0.5) * 2, A = ZONES[zi], Bz = ZONES[zi + 1];
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, lerpC(A[0], Bz[0], zt)); g.addColorStop(0.55, lerpC(A[1], Bz[1], zt)); g.addColorStop(1, lerpC(A[2], Bz[2], zt)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        const night = prog > 0.6 ? (prog - 0.6) / 0.4 : 0;
        if (night > 0) { ctx.globalAlpha = night; stars.slice(0, 40).forEach((s) => { const tw = Math.sin(t * 1.6 + s.ph); if (tw > -0.4) rect(ctx, s.x * w, s.y * h, 1, 1, '#fff'); }); ctx.globalAlpha = 1; }
        ctx.lineJoin = 'round';
        sun(ctx, w * 0.82, h * 0.11 - scroll * 0.04, t); rainbow(ctx, w, h, scroll);
        clouds.forEach((cl, i) => { const y = wrapY(cl.wy, 0.14, scroll, h * 1.5, 30), x = ((cl.x + t * cl.sp) % 1) * (w + 80) - 40; ctx.globalAlpha = 0.92; cloud(ctx, x, y, cl.s); }); ctx.globalAlpha = 1;
        islands.forEach((il, i) => island(ctx, il.fx * w, wrapY(il.wy, 0.3, scroll, h * 1.9, 50), il.w, t, i));
        near.forEach((o, i) => {
          const x = o.side ? w - o.fx * w - 8 : o.fx * w + 8, y = wrapY(o.wy, 0.65, scroll, h * 1.7, 40), s = o.s;
          if (o.kind === 'lolli') lolli(ctx, x, y, 8 * s, o.c1, '#fff'); else if (o.kind === 'cane') cane(ctx, x - 5, y, 22 * s); else if (o.kind === 'gum') gum(ctx, x, y, 8 * s, o.c1);
          else if (o.kind === 'cupcake') cupcake(ctx, x, y + 6, s * 0.9, o.c1); else if (o.kind === 'donut') donut(ctx, x, y, 10 * s, o.c1); else if (o.kind === 'cone') cone(ctx, x, y, s * 0.85); else star(ctx, x, y, 8 * s, '#ffe45c');
        });
        // dragones de caramelo con estela de arcoíris
        drag.forEach((d, i) => {
          const cyc = d.per + d.gap, tt = (t + d.off) % cyc; if (tt > d.per) return;
          const p = tt / d.per, dw = 28 * d.s, x = d.dir > 0 ? -dw + p * (w + dw * 2) : w + dw - p * (w + dw * 2), y = h * d.y + Math.sin(t * 0.9 + i * 2) * 5, fr = [0, 1, 2, 1][Math.floor(t * 5 + i) % 4];
          for (let k = 0; k < 14; k++) { const tx = x + (d.dir > 0 ? -1 : 1) * (k * 4 + 6) - (d.dir > 0 ? 0 : 0), ty = y + 11 * d.s + Math.sin(t * 6 - k * 0.7) * 2; ctx.globalAlpha = 0.85 * (1 - k / 14); rect(ctx, tx, ty, 4, 3, `hsl(${(k * 28 + t * 120) % 360},95%,62%)`); } ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(r0(x), r0(y)); if (d.dir < 0) ctx.scale(-1, 1); ctx.imageSmoothingEnabled = false; ctx.drawImage(dragonSprite(d.c[0], d.c[1], d.c[2], fr), 0, 0, r0(28 * d.s), r0(20 * d.s)); ctx.restore();
        });
        // caramelos con símbolos matemáticos flotando
        balls.forEach((b, i) => { const p = fract(b.ph + t * b.sp), y = h + 20 - p * (h + 40), x = b.x * w + Math.sin(t * 0.6 + i * 2) * b.sway; ctx.globalAlpha = Math.max(0, Math.min(1, Math.sin(p * PI) * 2)) * 0.95; candyBall(ctx, x, y, b.r, b.c, b.s); }); ctx.globalAlpha = 1;
        // confeti de chispitas
        conf.forEach((f) => { const p = fract(f.ph + t * f.sp), y = -6 + p * (h + 12), x = f.x * w + Math.sin(t + f.sw) * 4; rect(ctx, x, y, 1, 3, f.c); });
        sparks.forEach((s) => { const tw = Math.sin(t * 2.2 + s.ph); if (tw > 0.55) sparkle(ctx, s.x * w, s.y * h, tw > 0.85 ? 2 : 1, '#fff'); });
      },
    };
  }
  const stars = Array.from({ length: 50 }, (_, i) => { const r = mulberry(i * 977 + 5); return { x: r(), y: r() * 0.7, ph: r() * TAU }; });

  /* ---------- montaje en pantalla (mapa y menús) ---------- */
  function mount(container, o) {
    o = o || {};
    const cv = document.createElement('canvas'); cv.className = 'ambient'; cv.setAttribute('aria-hidden', 'true');
    container.insertBefore(cv, container.firstChild);
    const sc = scene({ seed: o.seed || 'hub', mode: 'hub', world: !!o.world, topic: o.topic }), TH = o.hue ? (cv.style.filter = 'hue-rotate(' + o.hue + 'deg)') : 0, ctx = cv.getContext('2d'), PIX = 3, scEl = container.querySelector('#screen');
    let W = 0, H = 0, raf = 0, dead = false, last = 0, t0 = performance.now(), scroll = 0, prog = 0;
    const still = !!o.still;
    const readScroll = () => { if (!scEl) return; scroll = scEl.scrollTop / PIX; const range = scEl.scrollHeight - scEl.clientHeight; prog = range > 40 ? Math.min(1, scEl.scrollTop / range) : 0; if (still) sc.full(ctx, W, H, 12, 1, scroll, prog); };
    function size() { const r = container.getBoundingClientRect(); W = Math.max(60, Math.round(r.width / PIX)); H = Math.max(80, Math.round(r.height / PIX)); cv.width = W; cv.height = H; readScroll(); if (still) sc.full(ctx, W, H, 12, 1, scroll, prog); }
    function loop(ts) { if (dead) return; raf = requestAnimationFrame(loop); if (ts - last < 33) return; last = ts; if (document.hidden) return; sc.full(ctx, W, H, (ts - t0) / 1000 + 4, 1, scroll, prog); }
    if (scEl) scEl.addEventListener('scroll', readScroll, { passive: true });
    size(); const ro = root.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(container);
    if (!still) raf = requestAnimationFrame(loop);
    return { destroy() { dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (scEl) scEl.removeEventListener('scroll', readScroll); if (cv.parentNode) cv.parentNode.removeChild(cv); } };
  }

  root.DuiXAmbient = { scene, mount, SYMS };
})(typeof window !== 'undefined' ? window : globalThis);
