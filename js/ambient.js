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

    return {
      /** Fondo completo (mapa) */
      full(ctx, w, h, t, px) {
        ctx.imageSmoothingEnabled = false;
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

  /* ---------- montaje en pantalla (mapa y menús) ---------- */
  function mount(container, o) {
    o = o || {};
    const cv = document.createElement('canvas'); cv.className = 'ambient'; cv.setAttribute('aria-hidden', 'true');
    container.insertBefore(cv, container.firstChild);
    const sc = scene({ seed: o.seed || 'hub', mode: 'hub' }), ctx = cv.getContext('2d'), PIX = 3;
    let W = 0, H = 0, raf = 0, dead = false, last = 0, t0 = performance.now();
    const still = !!o.still;
    function size() { const r = container.getBoundingClientRect(); W = Math.max(60, Math.round(r.width / PIX)); H = Math.max(80, Math.round(r.height / PIX)); cv.width = W; cv.height = H; if (still) sc.full(ctx, W, H, 12, 1); }
    function loop(ts) { if (dead) return; raf = requestAnimationFrame(loop); if (ts - last < 33) return; last = ts; if (document.hidden) return; sc.full(ctx, W, H, (ts - t0) / 1000 + 4, 1); }
    size(); const ro = root.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(container);
    if (!still) raf = requestAnimationFrame(loop);
    return { destroy() { dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (cv.parentNode) cv.parentNode.removeChild(cv); } };
  }

  root.DuiXAmbient = { scene, mount, SYMS };
})(typeof window !== 'undefined' ? window : globalThis);
