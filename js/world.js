/* DuiX — Mundo de la sala (mapa tipo "Among Us").
 * Un colegio-nave con cafetería (mesa de emergencia), laboratorio, biblioteca, gimnasio, cancha, sótano y sala de máquinas.
 * Los 3 juegos son MISIONES que están en consolas repartidas por el mapa. El impostor puede eliminar cerca de un tripulante,
 * los cuerpos quedan en el suelo y cualquiera puede reportarlos. Visión limitada (como en el juego original) y joystick táctil.
 * Este módulo solo dibuja y mueve; las reglas de la partida (votos, muertes, fin) viven en rooms.js.
 */
(function (root) {
  'use strict';
  const S = root.DuiXSprites, A = root.DuiXAudio;
  const TS = 16, MW = 70, MH = 46;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const HS = 0.5;                 // escala del avatar
  const SPEED = 74;               // unidades por segundo
  const VIS_CREW = 118, VIS_IMP = 158;
  const USE_R = 30, EMG_R = 44, REP_R = 46, KILL_R = 34;

  /* ---------- diseño del mapa (en baldosas de 16×16) ---------- */
  const ROOMS = [
    { id: 'cafe', name: 'Plaza Cartesiana', sub: 'Plano cartesiano', x: 24, y: 14, w: 22, h: 14, a: '#8d93b8', b: '#8086ac' },
    { id: 'lab', name: 'Laboratorio Entra-Sale', sub: 'Funciones', x: 3, y: 3, w: 16, h: 11, a: '#4f948e', b: '#478a84' },
    { id: 'biblio', name: 'Torre de los Mil Términos', sub: 'Polinomios', x: 26, y: 2, w: 18, h: 8, a: '#9a7650', b: '#8e6b47' },
    { id: 'gym', name: 'Gimnasio Exponencial', sub: 'Potenciación', x: 52, y: 3, w: 15, h: 11, a: '#c0733f', b: '#b46a38' },
    { id: 'cancha', name: 'Mercado Fraccionado', sub: 'Fracciones', x: 3, y: 32, w: 16, h: 11, a: '#4f9a60', b: '#478f58' },
    { id: 'sotano', name: 'Mina Radical', sub: 'Radicales', x: 26, y: 34, w: 18, h: 9, a: '#50566e', b: '#484e65' },
    { id: 'maq', name: 'Fábrica de Factores', sub: 'Factorización', x: 52, y: 32, w: 15, h: 11, a: '#626880', b: '#596078' },
    { id: 'enf', name: 'Muelle de los Extremos', sub: 'Intervalos', x: 3, y: 17, w: 12, h: 9, a: '#a9c0d2', b: '#9db5c8' },
    { id: 'admin', name: 'Observatorio de las Ondas', sub: 'Trigonometría', x: 55, y: 17, w: 12, h: 9, a: '#80618f', b: '#745784' },
  ];
  const HALLS = [
    [33, 10, 4, 4], [33, 28, 4, 6], [15, 19, 9, 4], [46, 19, 9, 4], [8, 14, 4, 3], [19, 5, 7, 4], [44, 5, 8, 4],
    [58, 14, 4, 3], [8, 26, 4, 6], [58, 26, 4, 6], [19, 36, 7, 4], [44, 36, 8, 4],
  ];
  // estaciones de misión: 2 por juego
  const STATIONS = [
    { id: 'lab', kind: 'shoot', name: 'Disparo de respuestas', room: 'Laboratorio Entra-Sale', tx: 11.5, ty: 8.5 },
    { id: 'maq', kind: 'shoot', name: 'Disparo de respuestas', room: 'Fábrica de Factores', tx: 59.5, ty: 37.5 },
    { id: 'gym', kind: 'run', name: 'Carrera de carteles', room: 'Gimnasio Exponencial', tx: 59.5, ty: 8.5 },
    { id: 'cancha', kind: 'run', name: 'Carrera de carteles', room: 'Mercado Fraccionado', tx: 10.5, ty: 37.5 },
    { id: 'sotano', kind: 'maze', name: 'Laberinto Pac-Man', room: 'Mina Radical', tx: 34.5, ty: 38.5 },
    { id: 'biblio', kind: 'maze', name: 'Laberinto Pac-Man', room: 'Torre de los Mil Términos', tx: 35.5, ty: 5.5 },
  ];
  STATIONS.forEach((s) => { s.x = s.tx * TS; s.y = s.ty * TS; });
  const VENTS = [
    { id: 'v1', tx: 4.5, ty: 12.5, room: 'Laboratorio Entra-Sale' }, { id: 'v2', tx: 28.5, ty: 8.5, room: 'Torre de los Mil Términos' }, { id: 'v3', tx: 65.5, ty: 12.5, room: 'Gimnasio Exponencial' },
    { id: 'v4', tx: 7.5, ty: 24.5, room: 'Muelle de los Extremos' }, { id: 'v5', tx: 56.5, ty: 22.5, room: 'Observatorio de las Ondas' }, { id: 'v6', tx: 17.5, ty: 41.5, room: 'Mercado Fraccionado' },
    { id: 'v7', tx: 42.5, ty: 41.5, room: 'Mina Radical' }, { id: 'v8', tx: 59.5, ty: 41.5, room: 'Fábrica de Factores' },
  ];
  VENTS.forEach((v) => { v.x = v.tx * TS; v.y = v.ty * TS; });
  // red de túneles: cada rejilla conecta solo con sus 2 vecinas más cercanas (como Among Us)
  const VLINK = {}; VENTS.forEach((v) => { VLINK[v.id] = VLINK[v.id] || new Set(); VENTS.filter((w) => w !== v).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y)).slice(0, 2).forEach((w) => { VLINK[v.id].add(w.id); (VLINK[w.id] = VLINK[w.id] || new Set()).add(v.id); }); });
  function ventNeighbors(v) { return VENTS.filter((w) => VLINK[v.id].has(w.id)); }
  const KIND_ICON = { shoot: '🎯', run: '🏃', maze: '👻' };
  const TABLE = { x: 35 * TS, y: 21.5 * TS }; // botón de emergencia
  // objetos del escenario: [tipo, x, y, w, h, sólido]
  const PROPS = [
    ['table', 26, 16, 3, 2, 1], ['table', 41, 16, 3, 2, 1], ['table', 26, 24, 3, 2, 1], ['table', 41, 24, 3, 2, 1],
    ['emg', 33, 20, 4, 3, 1], ['vend', 30, 14, 2, 1, 1], ['vend', 38, 14, 2, 1, 1], ['plant', 24, 14, 1, 1, 1], ['plant', 45, 27, 1, 1, 1],
    ['board', 7, 3, 6, 1, 1], ['bench', 6, 6, 4, 2, 1], ['bench', 6, 10, 4, 2, 1], ['bench', 13, 6, 4, 2, 1], ['bench', 13, 10, 4, 2, 1],
    ['shelf', 27, 2, 5, 1, 1], ['shelf', 38, 2, 5, 1, 1], ['rtable', 30, 5, 3, 2, 1], ['rtable', 38, 5, 3, 2, 1],
    ['weights', 54, 4, 3, 2, 1], ['weights', 54, 10, 3, 2, 1], ['mat', 63, 4, 3, 3, 0], ['mat', 63, 9, 3, 3, 0],
    ['hoop', 3, 36, 1, 3, 1], ['hoop', 18, 36, 1, 3, 1], ['bench', 6, 33, 4, 1, 1], ['bench', 12, 41, 4, 1, 1],
    ['pipe', 27, 34, 6, 1, 1], ['crate', 28, 38, 2, 2, 1], ['crate', 40, 38, 2, 2, 1], ['crate', 40, 36, 2, 2, 1],
    ['machine', 53, 33, 3, 3, 1], ['machine', 63, 33, 3, 3, 1], ['machine', 53, 39, 3, 3, 1], ['machine', 63, 39, 3, 3, 1],
    ['bed', 4, 18, 3, 2, 1], ['bed', 4, 22, 3, 2, 1], ['bed', 10, 18, 3, 2, 1], ['bed', 10, 22, 3, 2, 1],
    ['desk', 58, 19, 5, 2, 1], ['plant', 55, 24, 1, 1, 1], ['plant', 66, 24, 1, 1, 1],
  ];

  const L = { built: false };
  function layout() {
    if (L.built) return L;
    const area = new Uint8Array(MW * MH), walk = new Uint8Array(MW * MH), roomOf = new Int8Array(MW * MH).fill(-1);
    const fill = (x, y, w, h, fn) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < MW && j < MH) fn(i, j); };
    HALLS.forEach((r) => fill(r[0], r[1], r[2], r[3], (i, j) => { area[j * MW + i] = 1; walk[j * MW + i] = 1; }));
    ROOMS.forEach((r, k) => fill(r.x, r.y, r.w, r.h, (i, j) => { area[j * MW + i] = 1; walk[j * MW + i] = 1; roomOf[j * MW + i] = k; }));
    PROPS.forEach((p) => { if (p[5]) fill(p[1], p[2], p[3], p[4], (i, j) => { walk[j * MW + i] = 0; }); });
    L.area = area; L.walk = walk; L.roomOf = roomOf; L.built = true;
    return L;
  }
  const walkable = (x, y) => { layout(); const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return tx >= 0 && ty >= 0 && tx < MW && ty < MH && L.walk[ty * MW + tx] === 1; };
  const canStand = (x, y) => walkable(x - 5, y - 3) && walkable(x + 5, y - 3) && walkable(x - 5, y + 2) && walkable(x + 5, y + 2);
  const roomIdxAt = (x, y) => { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return tx >= 0 && ty >= 0 && tx < MW && ty < MH ? L.roomOf[ty * MW + tx] : -1; };
  // puntos de aparición alrededor de la mesa de emergencia
  function spawnPoint(seed, n) {
    let hsh = 0; String(seed).split('').forEach((c) => { hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0; });
    const a = ((hsh % 360) / 360) * 6.283 + (n || 0) * 0.7;
    for (let k = 0; k < 40; k++) { const ang = a + k * 0.55, r = 62 + (k % 4) * 9, x = TABLE.x + Math.cos(ang) * r, y = TABLE.y + 8 + Math.sin(ang) * r * 0.78; if (canStand(x, y)) return { x, y }; }
    return { x: TABLE.x, y: TABLE.y + 56 };
  }

  /* ---------- pintado del mapa (una sola vez) ---------- */
  let MAPCV = null;
  function buildMap() {
    if (MAPCV) return MAPCV;
    layout();
    const cv = document.createElement('canvas'); cv.width = MW * TS; cv.height = MH * TS; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#06041a'; g.fillRect(0, 0, cv.width, cv.height);
    let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < 380; i++) { g.fillStyle = rnd() < 0.2 ? '#9fb4ff' : '#ffffff'; g.globalAlpha = 0.25 + rnd() * 0.6; g.fillRect(Math.floor(rnd() * cv.width), Math.floor(rnd() * cv.height), 1, 1); } g.globalAlpha = 1;
    const A_ = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH && L.area[j * MW + i] === 1;
    // suelo
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      if (!A_(i, j)) continue; const k = L.roomOf[j * MW + i], R = k >= 0 ? ROOMS[k] : null, even = (i + j) % 2 === 0;
      g.fillStyle = R ? (even ? R.a : R.b) : (even ? '#737998' : '#6a7090'); g.fillRect(i * TS, j * TS, TS, TS);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(i * TS, j * TS, TS, 1); g.fillRect(i * TS, j * TS, 1, TS);
      g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(i * TS, j * TS + TS - 1, TS, 1);
      if (!R && (i * 5 + j * 3) % 6 === 0) { g.fillStyle = '#ffd23f'; g.globalAlpha = 0.5; g.font = '700 11px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['π', '∑', '∞', '∫', 'Δ', '√', 'θ', '%'][(i + j) % 8], i * TS + 8, j * TS + 8); g.globalAlpha = 1; }
    }
    // paredes
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      if (A_(i, j)) continue; let near = false; for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) if (A_(i + di, j + dj)) { near = true; break; }
      if (!near) continue; const x = i * TS, y = j * TS;
      if (A_(i, j + 1)) { // cara frontal
        const gr = g.createLinearGradient(0, y, 0, y + TS); gr.addColorStop(0, '#9aa0c8'); gr.addColorStop(1, '#6d7399'); g.fillStyle = gr; g.fillRect(x, y, TS, TS);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + 6, TS, 1); g.fillRect(x + (i % 2 ? 4 : 11), y, 1, TS); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, TS, 1);
        g.fillStyle = '#24273d'; g.fillRect(x, y + TS - 3, TS, 3);
      } else { g.fillStyle = '#343855'; g.fillRect(x, y, TS, TS); g.fillStyle = '#4a4f73'; g.fillRect(x + 1, y + 1, TS - 2, 2); }
    }
    // decoración del suelo por sala
    const R_ = (id) => ROOMS.find((r) => r.id === id);
    { const r = R_('gym'); g.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 1; k < 4; k++) g.fillRect((r.x + 1) * TS, (r.y + 1 + k * 2.4) * TS, (r.w - 2) * TS, 2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect((r.x + 1) * TS, (r.y + 1) * TS, 3, (r.h - 2) * TS); }
    { const r = R_('cancha'); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.strokeRect((r.x + 1.5) * TS, (r.y + 1.5) * TS, (r.w - 3) * TS, (r.h - 3) * TS); g.beginPath(); g.moveTo((r.x + r.w / 2) * TS, (r.y + 1.5) * TS); g.lineTo((r.x + r.w / 2) * TS, (r.y + r.h - 1.5) * TS); g.stroke(); g.beginPath(); g.arc((r.x + r.w / 2) * TS, (r.y + r.h / 2) * TS, 26, 0, 6.283); g.stroke(); }
    { const r = R_('sotano'); g.strokeStyle = 'rgba(255,210,63,.35)'; g.lineWidth = 2; for (let i = 0; i < r.w; i += 3) { g.strokeRect((r.x + i) * TS + 1, (r.y + r.h - 3) * TS + 1, TS * 3 - 2, TS * 3 - 2); } }
    { const r = R_('lab'); for (let i = 0; i < r.w; i++) { g.fillStyle = i % 2 ? '#ffd23f' : '#1a1033'; g.fillRect((r.x + i) * TS, (r.y + r.h - 1) * TS + 11, TS, 4); } }
    { const r = R_('biblio'); g.fillStyle = 'rgba(160,40,60,.45)'; g.fillRect((r.x + 4) * TS, (r.y + 3) * TS, (r.w - 8) * TS, 4 * TS); g.strokeStyle = 'rgba(255,210,63,.5)'; g.lineWidth = 1; g.strokeRect((r.x + 4) * TS + 2, (r.y + 3) * TS + 2, (r.w - 8) * TS - 4, 4 * TS - 4); }
    { const r = R_('admin'); g.fillStyle = 'rgba(255,210,63,.18)'; g.fillRect((r.x + 2) * TS, (r.y + 4) * TS, (r.w - 4) * TS, 4 * TS); }
    { const r = R_('cafe'); g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.ellipse(TABLE.x, TABLE.y, 92, 70, 0, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(255,60,80,.45)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.stroke(); g.setLineDash([]); }

    // ---- decoración matemática por escenario ----
    const txt = (t, x, y, size, col, al) => { g.save(); g.font = '800 ' + size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col || 'rgba(255,255,255,.8)'; if (al != null) g.globalAlpha = al; g.fillText(t, x, y); g.restore(); };
    { // Plaza Cartesiana: ejes, marcas y parábola
      const r = R_('cafe'), x0 = r.x * TS + 10, x1 = (r.x + r.w) * TS - 10, y0 = r.y * TS + 10, y1 = (r.y + r.h) * TS - 10;
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, TABLE.y); g.lineTo(x1, TABLE.y); g.moveTo(TABLE.x, y0); g.lineTo(TABLE.x, y1); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(x1, TABLE.y); g.lineTo(x1 - 7, TABLE.y - 4); g.lineTo(x1 - 7, TABLE.y + 4); g.fill(); g.beginPath(); g.moveTo(TABLE.x, y0); g.lineTo(TABLE.x - 4, y0 + 7); g.lineTo(TABLE.x + 4, y0 + 7); g.fill();
      g.lineWidth = 1; for (let k = -10; k <= 10; k++) { if (!k) continue; g.beginPath(); g.moveTo(TABLE.x + k * 16, TABLE.y - 3); g.lineTo(TABLE.x + k * 16, TABLE.y + 3); g.stroke(); if (k % 2 === 0 && Math.abs(k) < 9) txt(String(k / 2), TABLE.x + k * 16, TABLE.y + 11, 7, 'rgba(255,255,255,.7)'); }
      for (let k = -4; k <= 4; k++) { if (!k) continue; g.beginPath(); g.moveTo(TABLE.x - 3, TABLE.y + k * 16); g.lineTo(TABLE.x + 3, TABLE.y + k * 16); g.stroke(); }
      txt('x', x1 - 4, TABLE.y - 10, 10, '#ffd23f'); txt('y', TABLE.x + 10, y0 + 4, 10, '#ffd23f');
      g.strokeStyle = 'rgba(92,225,230,.8)'; g.lineWidth = 2; g.beginPath(); for (let k = -4.4; k <= 4.4; k += 0.2) { const px = TABLE.x + k * 32, py = TABLE.y - (4 - k * k * 0.4) * 16 + 64; if (k === -4.4) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke();
      txt('y = x²', TABLE.x + 126, TABLE.y - 40, 9, '#5ce1e6');
    }
    { const r = R_('lab'); txt('x  ➜  [ f ]  ➜  f(x)', (r.x + r.w / 2) * TS, (r.y + 9.3) * TS, 11, '#fff', 0.85); txt('f(x) = 2x + 1', (r.x + r.w / 2) * TS, (r.y + 9.9) * TS, 9, '#ffd23f', 0.9); }
    { const r = R_('biblio'); txt('x³ + 2x² − 5x + 1', (r.x + r.w / 2) * TS, (r.y + 5) * TS, 12, '#ffe9a8', 0.95); txt('(grado 3 · 4 términos)', (r.x + r.w / 2) * TS, (r.y + 5) * TS + 14, 8, '#fff', 0.8); }
    { const r = R_('gym'); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= 1.001; k += 0.04) { const px = (r.x + 2) * TS + k * (r.w - 4) * TS, py = (r.y + r.h - 1.5) * TS - Math.pow(k, 3) * (r.h - 4) * TS; if (!k) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); txt('y = 2ˣ', (r.x + 6) * TS, (r.y + 3) * TS, 12, '#fff', 0.9); txt('2¹=2  2²=4  2³=8', (r.x + r.w - 5) * TS, (r.y + r.h - 0.9) * TS, 9, '#fff', 0.9); }
    { const r = R_('cancha'), cx = (r.x + r.w / 2) * TS, cy = (r.y + r.h / 2) * TS; for (let k = 0; k < 4; k++) { g.fillStyle = ['rgba(255,210,63,.55)', 'rgba(255,122,200,.5)', 'rgba(92,225,230,.5)', 'rgba(255,255,255,.35)'][k]; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 28, k * 1.5708, (k + 1) * 1.5708); g.closePath(); g.fill(); } txt('¼', cx + 12, cy + 12, 12, '#1a1033'); txt('½', (r.x + 3) * TS, (r.y + 2.2) * TS, 16, '#fff', 0.85); txt('¾', (r.x + r.w - 3) * TS, (r.y + 2.2) * TS, 16, '#fff', 0.85); txt('⅓ + ⅙ = ½', cx, (r.y + r.h - 2.2) * TS, 10, '#fff', 0.9); }
    { const r = R_('sotano'); [['√x', 3, 5], ['∛', 9, 7], ['√9 = 3', 14, 6], ['x^½', 6, 3.4]].forEach((a) => txt(a[0], (r.x + a[1]) * TS, (r.y + a[2]) * TS, 12, '#ffd23f', 0.7)); }
    { const r = R_('maq'); txt('x² − x − 6', (r.x + r.w / 2) * TS, (r.y + 2.5) * TS, 10, '#fff', 0.9); txt('= (x + 2)(x − 3)', (r.x + r.w / 2) * TS, (r.y + 3.4) * TS, 9, '#ffd23f', 0.95); txt('5 × 3 = 15', (r.x + r.w / 2) * TS, (r.y + r.h - 1.5) * TS, 9, '#fff', 0.6); }
    { const r = R_('enf'), y = (r.y + 3.4) * TS; g.strokeStyle = 'rgba(40,60,90,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo((r.x + 1) * TS, y); g.lineTo((r.x + r.w - 1) * TS, y); g.stroke(); for (let k = 0; k <= 6; k++) { const px = (r.x + 2) * TS + k * 24; g.beginPath(); g.moveTo(px, y - 4); g.lineTo(px, y + 4); g.stroke(); txt(String(k - 1), px, y + 12, 8, '#1a2a44'); } txt('[', (r.x + 3) * TS + 6, y - 9, 14, '#e02a3a'); txt(')', (r.x + 2) * TS + 5 * 24, y - 9, 14, '#e02a3a'); txt('[0, 4)', (r.x + 6) * TS, y - 20, 9, '#1a2a44'); }
    { const r = R_('admin'), y = (r.y + 6.6) * TS; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.beginPath(); for (let k = 0; k <= 1.001; k += 0.02) { const px = (r.x + 1) * TS + k * (r.w - 2) * TS, py = y - Math.sin(k * 6.283 * 1.5) * 12; if (!k) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); txt('y = sen x', (r.x + 3) * TS, (r.y + 1.7) * TS, 10, '#ffd23f', 0.9); txt('sen²x + cos²x = 1', (r.x + r.w - 4) * TS, (r.y + r.h - 0.8) * TS, 8, '#fff', 0.85); }
    // letreros de los escenarios sobre la pared
    ROOMS.forEach((r) => { const cx = (r.x + r.w / 2) * TS, cy = (r.y - 1) * TS + 7, w = Math.min(r.w * TS - 10, g.measureText(r.name).width + 30); g.save(); g.font = '900 9px ' + FONT; const tw = g.measureText(r.name.toUpperCase()).width + 16; g.fillStyle = '#0f1124'; g.fillRect(cx - tw / 2, cy - 7, tw, 14); g.strokeStyle = '#ffd23f'; g.lineWidth = 1; g.strokeRect(cx - tw / 2 + 0.5, cy - 6.5, tw - 1, 13); g.fillStyle = '#ffd23f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r.name.toUpperCase(), cx, cy + 0.5); g.restore(); });
    // ventilaciones
    VENTS.forEach((v) => { const x = v.x - 11, y = v.y - 7; g.fillStyle = '#05050f'; g.fillRect(x - 2, y - 2, 26, 18); g.fillStyle = '#566078'; g.fillRect(x, y, 22, 14); g.fillStyle = '#10121f'; for (let k = 0; k < 4; k++) g.fillRect(x + 2, y + 2 + k * 3, 18, 1.6); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, y, 22, 1); });
    // objetos
    const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    PROPS.forEach((p) => {
      const t = p[0], x = p[1] * TS, y = p[2] * TS, w = p[3] * TS, h = p[4] * TS;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 2, y + h - 2, w, 5);
      if (t === 'table' || t === 'rtable') { rect(x, y, w, h, '#2a1a10'); rect(x + 1, y + 1, w - 2, h - 3, t === 'table' ? '#d9d3c0' : '#a06a3c'); rect(x + 3, y + 3, w - 6, 2, 'rgba(255,255,255,.35)'); rect(x - 2, y + h - 1, w + 4, 3, '#3a3f5c'); rect(x + 4, y - 3, 6, 3, '#e44'); rect(x + w - 12, y - 3, 6, 3, '#4aa3ff'); }
      else if (t === 'emg') { g.fillStyle = '#1b1b2a'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2 + 2, w / 2 + 2, h / 2 + 3, 0, 0, 6.283); g.fill(); g.fillStyle = '#c9ced9'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 6.283); g.fill(); g.fillStyle = '#9aa2b8'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 6, h / 2 - 5, 0, 0, 6.283); g.fill(); }
      else if (t === 'vend') { rect(x, y, w, h, '#1a1033'); rect(x + 2, y + 2, w - 4, h - 6, '#ff5a7a'); rect(x + 4, y + 4, 10, h - 10, '#5ce1e6'); rect(x + 18, y + 4, w - 22, 6, '#ffd23f'); rect(x + 18, y + 12, 3, 3, '#fff'); }
      else if (t === 'plant') { rect(x + 3, y + 8, 10, 7, '#7a4a2a'); g.fillStyle = '#3fbf5f'; g.beginPath(); g.arc(x + 8, y + 6, 6, 0, 6.283); g.fill(); g.fillStyle = '#2f9f4a'; g.beginPath(); g.arc(x + 11, y + 4, 4, 0, 6.283); g.fill(); }
      else if (t === 'board') { rect(x, y, w, h, '#2a1a10'); rect(x + 2, y + 2, w - 4, h - 5, '#1f4d3a'); g.fillStyle = '#fff'; g.font = '700 9px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText("lím f(x) · f'(x)=dy/dx", x + 6, y + 8); }
      else if (t === 'bench') { rect(x, y, w, h, '#2f3550'); rect(x + 1, y + 1, w - 2, h - 4, '#c9ced9'); rect(x + 4, y + 5, w - 8, 3, 'rgba(0,0,0,.18)'); if (h > TS) { g.fillStyle = '#5ce1e6'; g.fillRect(x + 6, y + 6, 6, 8); g.fillStyle = '#ff7ac8'; g.fillRect(x + w - 14, y + 8, 6, 6); g.fillStyle = '#9dff8a'; g.fillRect(x + w / 2, y + 7, 5, 7); } }
      else if (t === 'shelf') { rect(x, y, w, h, '#2a1a10'); rect(x + 1, y + 1, w - 2, h - 3, '#6b4423'); const cs = ['#e44', '#4aa3ff', '#ffd23f', '#9dff8a', '#c58cff', '#ff9a3c']; for (let k = 0; k < w / 5 - 1; k++) { rect(x + 3 + k * 5, y + 3, 4, h - 8, cs[(k * 7 + p[1]) % cs.length]); } }
      else if (t === 'weights') { rect(x, y, w, h, '#1e2238'); rect(x + 1, y + 1, w - 2, h - 3, '#454b6e'); rect(x + 6, y + 6, w - 12, 4, '#c9ced9'); rect(x + 4, y + 3, 4, 10, '#ff5a7a'); rect(x + w - 8, y + 3, 4, 10, '#ff5a7a'); }
      else if (t === 'mat') { rect(x, y, w, h, 'rgba(60,200,255,.55)'); g.strokeStyle = 'rgba(255,255,255,.6)'; g.strokeRect(x + 1, y + 1, w - 2, h - 2); }
      else if (t === 'hoop') { rect(x, y, w, h, '#2a2f48'); rect(x + 3, y + 8, w - 6, h - 16, '#ff9a3c'); g.fillStyle = '#fff'; g.fillRect(x + 5, y + 14, w - 10, 3); }
      else if (t === 'pipe') { rect(x, y, w, h, '#2a2f48'); rect(x + 1, y + 3, w - 2, 9, '#7b839c'); rect(x + 1, y + 3, w - 2, 2, '#c9ced9'); for (let k = 8; k < w; k += 24) rect(x + k, y + 1, 4, 13, '#ffd23f'); }
      else if (t === 'crate') { rect(x, y, w, h, '#3a2412'); rect(x + 1, y + 1, w - 2, h - 3, '#b3803f'); g.strokeStyle = '#6b4423'; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, w - 8, h - 9); g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + w - 4, y + h - 5); g.stroke(); }
      else if (t === 'machine') { rect(x, y, w, h, '#14172a'); rect(x + 1, y + 1, w - 2, h - 3, '#7c849e'); rect(x + 5, y + 5, w - 10, 14, '#0f2a33'); for (let k = 0; k < 4; k++) rect(x + 7 + k * 9, y + 8, 6, 8, ['#5ce1e6', '#9dff8a', '#ffd23f', '#ff5a7a'][k]); rect(x + 5, y + 24, w - 10, 6, '#454b6e'); rect(x + 8, y + 33, 8, 8, '#e44'); rect(x + w - 16, y + 33, 8, 8, '#4aa3ff'); }
      else if (t === 'bed') { rect(x, y, w, h, '#2f3550'); rect(x + 1, y + 1, w - 2, h - 3, '#f2f6fb'); rect(x + 1, y + 1, 12, h - 3, '#9dd0ff'); rect(x + w - 10, y + 6, 6, 18, '#e44'); rect(x + w - 13, y + 12, 12, 6, '#e44'); }
      else if (t === 'desk') { rect(x, y, w, h, '#2a1a10'); rect(x + 1, y + 1, w - 2, h - 3, '#8a5a30'); rect(x + 8, y + 4, 22, 14, '#0f2a33'); rect(x + 10, y + 6, 18, 10, '#5ce1e6'); rect(x + w - 26, y + 6, 14, 8, '#fff'); }
    });
    MAPCV = cv; return cv;
  }

  /* ---------- montaje ---------- */
  function mount(container, o) {
    layout(); const map = buildMap();
    const cv = document.createElement('canvas'); cv.className = 'wd-cv'; container.appendChild(cv);
    const ctx = cv.getContext('2d');
    const fogCv = document.createElement('canvas'), fctx = fogCv.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, dead = false, z = 2, frozen = false, ghost = false, active = true;
    const me = { x: 0, y: 0, f: 1, moving: false, vx: 0, vy: 0 };
    const sp0 = spawnPoint(o.pid, 0); me.x = sp0.x; me.y = sp0.y;
    const others = {}; const keys = {}; const floats = []; const parts = [];
    let joy = null, lastSent = 0, sx = -1, sy = -1, sf = 1, roomShown = -2, roomT = 0, lastBtn = '', hintT = 0;
    let curUse = null, curRep = null, curKill = null, tasksOpen = false, blackUntil = 0;

    /* HUD en DOM */
    const hud = document.createElement('div'); hud.className = 'wd-hud';
    const barFill = document.createElement('i'), barTxt = document.createElement('b');
    const bar = document.createElement('div'); bar.className = 'wd-prog'; const lab = document.createElement('small'); lab.textContent = 'TAREAS COMPLETADAS';
    const track = document.createElement('div'); track.className = 'wd-track'; track.appendChild(barFill); track.appendChild(barTxt); bar.appendChild(lab); bar.appendChild(track);
    const tasksBtn = document.createElement('button'); tasksBtn.type = 'button'; tasksBtn.className = 'wd-tbtn'; tasksBtn.textContent = '📋 Tareas ▾';
    const tasksBox = document.createElement('div'); tasksBox.className = 'wd-tasks'; tasksBox.hidden = true;
    tasksBtn.addEventListener('click', () => { tasksOpen = !tasksOpen; tasksBox.hidden = !tasksOpen; tasksBtn.textContent = tasksOpen ? '📋 Tareas ▴' : '📋 Tareas ▾'; A.sfx('click'); });
    const left = document.createElement('div'); left.className = 'wd-left'; left.appendChild(bar); left.appendChild(tasksBtn); left.appendChild(tasksBox);
    const role = document.createElement('div'); role.className = 'wd-role';
    const mapBtn = document.createElement('button'); mapBtn.type = 'button'; mapBtn.className = 'wd-mapbtn'; mapBtn.setAttribute('aria-label', 'Mapa'); mapBtn.textContent = '🗺️';
    const leaveB = document.createElement('button'); leaveB.type = 'button'; leaveB.className = 'wd-mapbtn wd-leave'; leaveB.setAttribute('aria-label', 'Salir'); leaveB.textContent = '⏏';
    leaveB.addEventListener('click', () => { A.sfx('click'); o.onLeave && o.onLeave(); });
    const right = document.createElement('div'); right.className = 'wd-right'; right.appendChild(role); right.appendChild(mapBtn); right.appendChild(leaveB);
    const roomEl = document.createElement('div'); roomEl.className = 'wd-room'; roomEl.hidden = true;
    const hintEl = document.createElement('div'); hintEl.className = 'wd-hint'; hintEl.hidden = true;
    const mkBtn = (cls, ico, txt) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'wd-b ' + cls; b.innerHTML = '<span>' + ico + '</span><small>' + txt + '</small>'; return b; };
    const bUse = mkBtn('use', '🖐️', 'USAR'), bRep = mkBtn('rep', '📣', 'REPORTAR'), bKill = mkBtn('kill', '🔪', 'ELIMINAR'), bSab = mkBtn('sab', '⚡', 'SABOTAJE');
    const cd2 = document.createElement('i'); cd2.className = 'wd-cd'; bSab.appendChild(cd2);
    const cd = document.createElement('i'); cd.className = 'wd-cd'; bKill.appendChild(cd);
    const act = document.createElement('div'); act.className = 'wd-act'; act.appendChild(bSab); act.appendChild(bRep); act.appendChild(bKill); act.appendChild(bUse);
    hud.appendChild(left); hud.appendChild(right); hud.appendChild(roomEl); hud.appendChild(hintEl); hud.appendChild(act);
    container.appendChild(hud);
    const stop = (e) => e.stopPropagation();
    [hud].forEach((el) => el.addEventListener('pointerdown', stop));

    const doUse = () => { if (frozen || !curUse) return; if (curUse.type === 'emg') o.onEmergency && o.onEmergency(); else if (curUse.type === 'vent') showVents(curUse.vent); else o.onUse && o.onUse(curUse.st); };
    const extra = document.createElement('div'); extra.className = 'wd-extra'; hud.appendChild(extra); let extraKey = '', extraT = 0;
    function closeExtra() { hud.classList.remove('xo'); extra.innerHTML = ''; extraKey = ''; clearTimeout(extraT); }
    function openExtra(key, items) {
      if (extraKey === key) { closeExtra(); return; } closeExtra(); extraKey = key; hud.classList.add('xo'); A.sfx('select');
      items.forEach((it) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'wd-x ' + (it.cls || ''); b.innerHTML = '<span>' + it.ico + '</span><small>' + it.txt + '</small>'; b.addEventListener('click', (e) => { e.stopPropagation(); closeExtra(); it.fn(); }); b.addEventListener('pointerdown', (e) => e.stopPropagation()); extra.appendChild(b); });
      extraT = setTimeout(closeExtra, 7000);
    }
    const SABS = [{ k: 'dark', ico: '🌑', txt: 'Apagón' }, { k: 'turbo', ico: '⏩', txt: 'Turbo' }, { k: 'fog', ico: '🌫️', txt: 'Niebla' }, { k: 'steal', ico: '💸', txt: 'Robo' }];
    const doSab = () => { if (frozen || ghost) return; if (o.sabCd && o.sabCd() > 0) { A.sfx('deny'); return; } openExtra('sab', SABS.map((x) => ({ ico: x.ico, txt: x.txt, cls: 'sab', fn: () => o.onSabotage && o.onSabotage(x.k) }))); };
    bSab.addEventListener('click', doSab);
    function showVents(from) {
      const nb = ventNeighbors(from);
      openExtra('vent', nb.map((v) => ({ ico: '🕳️', txt: v.room, cls: 'vent', fn: () => { me.x = v.x; me.y = v.y + 8; sx = -1; A.sfx('power'); for (let k = 0; k < 16; k++) { const a = Math.random() * 6.283; parts.push({ x: me.x, y: me.y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, t: 0, life: 0.6, c: '#9aa6c8' }); } } })));
    }
    const doRep = () => { if (frozen || !curRep) return; o.onReport && o.onReport(curRep); };
    const doKill = () => {
      if (frozen || !curKill) return; const cdl = o.killCd ? o.killCd() : 0; if (cdl > 0) { A.sfx('deny'); return; }
      const t = curKill, p = others[t]; if (p) { me.x = p.x; me.y = p.y; } o.onKill && o.onKill(t, me.x, me.y); A.sfx('boom'); floats.push({ x: me.x, y: me.y - 30, text: '¡Eliminado!', c: '#ff4d6d', t: 0, life: 1.1 });
    };
    bUse.addEventListener('click', doUse); bRep.addEventListener('click', doRep); bKill.addEventListener('click', doKill);
    mapBtn.addEventListener('click', () => { A.sfx('click'); showBigMap(); });
    function showBigMap() {
      if (container.querySelector('.wd-bigmap')) return;
      const w = document.createElement('div'); w.className = 'wd-bigmap'; const c = document.createElement('canvas'); c.width = MW * 8; c.height = MH * 8; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(map, 0, 0, c.width, c.height);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 11px ' + FONT;
      ROOMS.forEach((r) => { const tx = (r.x + r.w / 2) * 8, ty = (r.y + r.h / 2) * 8; g.fillStyle = 'rgba(0,0,0,.55)'; const tw = g.measureText(r.name).width + 8; g.fillRect(tx - tw / 2, ty - 8, tw, 16); g.fillStyle = '#fff'; g.fillText(r.name, tx, ty); });
      const tks = (o.getTasks && o.getTasks()) || [];
      STATIONS.forEach((s) => { const t = tks.find((q) => q.st === s.id); if (!t) return; g.fillStyle = t.done ? '#3fdc7a' : '#ffd23f'; g.beginPath(); g.arc(s.x / TS * 8, s.y / TS * 8, 7, 0, 6.283); g.fill(); g.fillStyle = '#1a1033'; g.font = '800 10px ' + FONT; g.fillText(t.done ? '✓' : '!', s.x / TS * 8, s.y / TS * 8 + 1); });
      if (o.isImp && o.isImp()) VENTS.forEach((v) => { g.fillStyle = '#000'; g.fillRect(v.x / TS * 8 - 5, v.y / TS * 8 - 3, 10, 7); g.fillStyle = '#9aa6c8'; g.fillRect(v.x / TS * 8 - 4, v.y / TS * 8 - 2, 8, 5); });
      g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(TABLE.x / TS * 8, TABLE.y / TS * 8, 5, 0, 6.283); g.fill();
      g.fillStyle = '#5ce1e6'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(me.x / TS * 8, me.y / TS * 8, 5, 0, 6.283); g.stroke(); g.fill();
      const cap = document.createElement('div'); cap.className = 'wd-cap'; cap.textContent = '🟡 misión pendiente · ✅ hecha · 🔴 botón de emergencia · 🔵 tú. Toca para cerrar.';
      w.appendChild(c); w.appendChild(cap); w.addEventListener('click', () => w.remove()); container.appendChild(w);
    }

    function resize() { const r = container.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return; dpr = Math.min(2, root.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); z = clamp(Math.sqrt(W * H / (340 * 255)), 1.4, 2.6); fogCv.width = Math.round(W / 2); fogCv.height = Math.round(H / 2); }
    const ro = root.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(container); root.addEventListener('resize', resize);

    /* entrada: joystick flotante (táctil o ratón) + teclado */
    cv.addEventListener('pointerdown', (e) => { if (frozen) return; e.preventDefault(); A.unlock(); try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } const r = cv.getBoundingClientRect(); joy = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top }; });
    cv.addEventListener('pointermove', (e) => { if (joy && e.pointerId === joy.id) { const r = cv.getBoundingClientRect(); joy.x = e.clientX - r.left; joy.y = e.clientY - r.top; } });
    const jup = (e) => { if (joy && (!e || e.pointerId === joy.id)) joy = null; };
    cv.addEventListener('pointerup', jup); cv.addEventListener('pointercancel', jup); cv.addEventListener('lostpointercapture', jup);
    const KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'];
    const kd = (e) => { const k = e.key.toLowerCase(), t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA') return; if (KEYS.includes(k)) { keys[k] = true; e.preventDefault(); } else if (!e.repeat && (k === 'e' || k === ' ')) { doUse(); e.preventDefault(); } else if (!e.repeat && k === 'r') doRep(); else if (!e.repeat && k === 'q') doKill(); else if (!e.repeat && k === 'f') doSab(); };
    const ku = (e) => { keys[e.key.toLowerCase()] = false; };
    root.addEventListener('keydown', kd); root.addEventListener('keyup', ku);

    function inputVec() {
      let kx = 0, ky = 0; if (keys.arrowleft || keys.a) kx--; if (keys.arrowright || keys.d) kx++; if (keys.arrowup || keys.w) ky--; if (keys.arrowdown || keys.s) ky++;
      if (kx || ky) { const m = Math.hypot(kx, ky); return { x: kx / m, y: ky / m, m: 1 }; }
      if (joy) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), R = 44; if (d > 8) { const m = Math.min(1, d / R); return { x: dx / d, y: dy / d, m }; } }
      return { x: 0, y: 0, m: 0 };
    }
    const spriteFor = (look, fr) => { try { return S.heroCanvas(look || {}, 'idle', fr); } catch (e) { return null; } };
    const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

    function drawStation(s, t, st) {
      const x = s.x, y = s.y; const mine = st; // {done} o undefined
      g_(); function g_() {
        ctx.save(); ctx.translate(x, y); ctx.scale(1.45, 1.45);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-14, 6, 28, 5);
        ctx.fillStyle = '#14172a'; ctx.fillRect(-14, -12, 28, 20); ctx.fillStyle = mine ? (mine.done ? '#1f6b44' : '#2a2f5c') : '#3a3f55'; ctx.fillRect(-12, -10, 24, 14);
        ctx.fillStyle = mine && !mine.done ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.35)'; ctx.font = '13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(mine && mine.done ? '✅' : KIND_ICON[s.kind], 0, -3);
        ctx.fillStyle = '#c9ced9'; ctx.fillRect(-12, 5, 24, 2);
        if (mine && !mine.done) { const a = 0.55 + 0.45 * Math.sin(t * 5); ctx.globalAlpha = a; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.strokeRect(-17, -15, 34, 26); ctx.globalAlpha = 1; const by = -26 + Math.sin(t * 6) * 3; ctx.fillStyle = '#000'; ctx.font = '900 20px ' + FONT; ctx.fillText('❗', 0, by + 1); ctx.fillStyle = '#ffd23f'; ctx.fillText('❗', 0, by); }
        ctx.restore();
      }
    }
    function drawBody(b, look, t) {
      const spr = spriteFor(look, 0); ctx.save(); ctx.translate(b.x, b.y);
      ctx.fillStyle = 'rgba(160,20,40,.55)'; ctx.beginPath(); ctx.ellipse(0, 2, 14, 6, 0, 0, 6.283); ctx.fill();
      if (spr) { const hw = S.HERO_W * HS, hh = S.HERO_H * HS; ctx.save(); ctx.translate(0, -4); ctx.rotate(Math.PI / 2); ctx.globalAlpha = 0.95; ctx.drawImage(spr, -hw / 2, -hh + 2, hw, hh); ctx.restore(); }
      ctx.font = '12px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🦴', 8, -4); ctx.restore();
      ctx.save(); ctx.translate(b.x, b.y - 16 + Math.sin(t * 5) * 2); ctx.font = '900 22px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText('💀', 0.5, 0.5); ctx.fillText('💀', 0, 0); ctx.restore();
    }
    function drawPlayer(pl, look, x, y, f, moving, isMe, t, isGhost, alpha) {
      const spr = spriteFor(look, moving ? Math.floor(t * 10) % 4 : 0); if (!spr) return;
      const hw = S.HERO_W * HS, hh = S.HERO_H * HS, bob = moving ? Math.abs(Math.sin(t * 12)) * 1.6 : Math.sin(t * 2 + x) * 0.4, fl = isGhost ? -2 - Math.abs(Math.sin(t * 2.5)) * 3 : 0;
      ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
      if (!isGhost) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y, 8, 2.8, 0, 0, 6.283); ctx.fill(); } else ctx.globalAlpha *= 0.5;
      ctx.translate(x, y + fl); if (f < 0) ctx.scale(-1, 1); ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, -hw / 2, -hh + 2 - bob, hw, hh); ctx.restore();
      ctx.save(); ctx.globalAlpha = (alpha == null ? 1 : alpha) * (isGhost ? 0.55 : 1); ctx.font = '800 7px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const nm = String(pl && pl.name || '').slice(0, 10), w = ctx.measureText(nm).width + 5;
      ctx.fillStyle = isMe ? 'rgba(255,210,63,.95)' : 'rgba(10,5,30,.78)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y + 5 + fl), Math.round(w), 9); ctx.fillStyle = isMe ? '#1a1033' : '#fff'; ctx.fillText(nm, x, y + 9.5 + fl); ctx.restore();
    }

    function tick(ts) {
      if (dead) return; raf = requestAnimationFrame(tick);
      if (!last) last = ts; const dt = Math.min(0.05, (ts - last) / 1000); last = ts; const t = ts / 1000;
      if (!active) return;
      if (W <= 0) { resize(); return; }
      // movimiento
      const iv = frozen ? { x: 0, y: 0, m: 0 } : inputVec(); me.moving = false;
      if (iv.m > 0) {
        const sp = SPEED * iv.m * dt * (ghost ? 1.12 : 1), nx = me.x + iv.x * sp, ny = me.y + iv.y * sp;
        if (ghost) { me.x = clamp(nx, 20, MW * TS - 20); me.y = clamp(ny, 20, MH * TS - 20); me.moving = true; if (!walkable(me.x, me.y)) { /* fantasma atraviesa paredes */ } }
        else { if (canStand(nx, me.y)) { me.x = nx; me.moving = true; } if (canStand(me.x, ny)) { me.y = ny; me.moving = true; } }
        if (Math.abs(iv.x) > 0.15) me.f = iv.x > 0 ? 1 : -1;
      }
      // red
      const now = Date.now();
      if (now - lastSent > 140 && (Math.abs(me.x - sx) > 0.6 || Math.abs(me.y - sy) > 0.6 || me.f !== sf || (!me.moving && lastSent && sx !== -1 && now - lastSent > 2500))) { lastSent = now; sx = me.x; sy = me.y; sf = me.f; o.setPos(Math.round(me.x * 10) / 10, Math.round(me.y * 10) / 10, me.f, me.moving ? 1 : 0); }
      const players = o.getPlayers() || {}, pos = o.getPos() || {}, bodies = (o.getBodies && o.getBodies()) || {};
      Object.keys(players).forEach((id) => { if (id === o.pid) return; const q = pos[id]; if (!q || !q.w || typeof q.x !== 'number') return; let c = others[id]; if (!c) c = others[id] = { x: q.x, y: q.y, f: q.f || 1, moving: false }; const ddx = q.x - c.x, ddy = q.y - c.y, dd = Math.hypot(ddx, ddy); c.moving = dd > 1.5; if (dd > 90) { c.x = q.x; c.y = q.y; } else { const k = Math.min(1, dt * 9); c.x += ddx * k; c.y += ddy * k; } if (q.f) c.f = q.f; });
      Object.keys(others).forEach((id) => { if (!players[id]) delete others[id]; });
      parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].life) parts.splice(i, 1);
      floats.forEach((f) => { f.t += dt; f.y -= 16 * dt; }); for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t >= floats[i].life) floats.splice(i, 1);
      // ¿qué tengo cerca?
      const R = ghost ? 9999 : (o.isImp && o.isImp() ? VIS_IMP : (Date.now() < blackUntil ? 34 : VIS_CREW));
      const tks = (o.getTasks && o.getTasks()) || [], imp = !!(o.isImp && o.isImp());
      let use = null, ud = 1e9;
      STATIONS.forEach((s) => { const d = dist(me.x, me.y, s.x, s.y), tk = tks.find((q) => q.st === s.id); if (d < USE_R && d < ud && ((tk && !tk.done) || (imp && !ghost))) { use = { type: 'st', st: s, tk }; ud = d; } });
      if (!use && !ghost && dist(me.x, me.y, TABLE.x, TABLE.y) < EMG_R && o.canEmergency && o.canEmergency()) use = { type: 'emg' };
      if (!use && imp && !ghost) VENTS.forEach((v) => { const d = dist(me.x, me.y, v.x, v.y); if (d < 26 && d < ud) { use = { type: 'vent', vent: v }; ud = d; } });
      curUse = use; if (extraKey === 'vent' && !(use && use.type === 'vent')) closeExtra(); if (frozen || ghost) closeExtra();
      curRep = null; let rd = 1e9; if (!ghost) Object.keys(bodies).forEach((id) => { const b = bodies[id]; if (!b) return; const d = dist(me.x, me.y, b.x, b.y); if (d < REP_R && d < rd) { rd = d; curRep = id; } });
      curKill = null; let kd2 = 1e9; if (imp && !ghost) Object.keys(others).forEach((id) => { const pl = players[id]; if (!pl || pl.dead || pl.online === false || (o.isImpId && o.isImpId(id))) return; const c = others[id], d = dist(me.x, me.y, c.x, c.y); if (d < KILL_R && d < kd2) { kd2 = d; curKill = id; } });
      const cdl = imp && o.killCd ? o.killCd() : 0;
      const sig = (use ? (use.type === 'emg' ? 'E' : 'U') : '-') + (curRep ? 'R' : '-') + (imp ? (ghost ? '-' : 'K') : '-') + (curKill ? 'k' : '-') + (cdl > 0 ? 'c' : '-') + (frozen ? 'f' : '-') + (ghost ? 'g' : '-') + (use && use.type === 'vent' ? 'V' : '-');
      if (sig !== lastBtn) {
        lastBtn = sig; bUse.classList.toggle('on', !!use); bUse.querySelector('span').textContent = use && use.type === 'vent' ? '🕳️' : use && use.type === 'emg' ? '🚨' : use && use.st && imp && !(use.tk && !use.tk.done) ? '🎭' : '🖐️'; bUse.querySelector('small').textContent = use && use.type === 'vent' ? 'TÚNEL' : use && use.type === 'emg' ? 'REUNIÓN' : use ? (imp && !(use.tk && !use.tk.done) ? 'FINGIR' : 'MISIÓN') : 'USAR';
        bRep.classList.toggle('on', !!curRep); bRep.hidden = ghost; bKill.hidden = !imp || ghost; bSab.hidden = !imp || ghost; bSab.classList.toggle('on', !(o.sabCd && o.sabCd() > 0)); bKill.classList.toggle('on', !!curKill && cdl <= 0); bKill.classList.toggle('cool', cdl > 0);
      }
      if (imp) { const sc = o.sabCd ? o.sabCd() : 0; cd2.style.setProperty('--p', sc > 0 ? Math.min(1, sc / 22000) : 0); bSab.querySelector('small').textContent = sc > 0 ? Math.ceil(sc / 1000) + ' s' : 'SABOTAJE'; bSab.classList.toggle('on', sc <= 0); }
      if (imp) cd.style.setProperty('--p', cdl > 0 ? Math.min(1, cdl / (o.killMax || 20000)) : 0); if (imp && cdl > 0) bKill.querySelector('small').textContent = Math.ceil(cdl / 1000) + ' s'; else if (imp) bKill.querySelector('small').textContent = 'ELIMINAR';
      // nombre de la sala
      const ri = roomIdxAt(me.x, me.y); if (ri !== roomShown) { roomShown = ri; if (ri >= 0) { roomEl.textContent = ROOMS[ri].name + ' · ' + ROOMS[ri].sub; roomEl.hidden = false; roomEl.classList.remove('in'); void roomEl.offsetWidth; roomEl.classList.add('in'); roomT = now + 2200; } }
      if (roomT && now > roomT) { roomEl.hidden = true; roomT = 0; }
      // pista contextual
      const hint = use && use.type === 'vent' ? 'Túnel secreto: toca TÚNEL para viajar a otro escenario' : use && use.type === 'emg' ? 'Botón de emergencia: convoca una reunión' : use && use.st ? (use.tk && !use.tk.done ? '¡Toca USAR para empezar: ' + use.st.name + '!' : 'Finge hacer la tarea') : curRep ? '¡Hay un cuerpo! Toca REPORTAR' : curKill && imp && cdl <= 0 ? 'Cerca de un tripulante: ELIMINAR' : '';
      if (hint !== hintEl.dataset.h) { hintEl.dataset.h = hint; hintEl.textContent = hint; hintEl.hidden = !hint; }

      /* ---- dibujar ---- */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#06041a'; ctx.fillRect(0, 0, W, H);
      const vw = W / z, vh = H / z; const cx = me.x - vw / 2, cy = me.y - vh * 0.48;   // la cámara siempre centra al jugador: nunca queda tapado en los bordes del mapa
      ctx.save(); ctx.scale(z, z); ctx.translate(-Math.round(cx * z) / z, -Math.round(cy * z) / z);
      ctx.drawImage(map, 0, 0);
      // botón rojo de la mesa
      { const press = (use && use.type === 'emg') ? 1 : 0; ctx.fillStyle = '#5a0f1a'; ctx.beginPath(); ctx.ellipse(TABLE.x, TABLE.y + 1, 12, 8, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = press ? '#ff6b6b' : '#e02a3a'; ctx.beginPath(); ctx.ellipse(TABLE.x, TABLE.y - 1 - (press ? 0 : 1), 10, 6.5, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(TABLE.x - 3, TABLE.y - 3, 4, 2, 0, 0, 6.283); ctx.fill(); ctx.font = '800 6px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('EMERGENCIA', TABLE.x, TABLE.y - 15); if (!ghost) { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 4); ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(TABLE.x, TABLE.y, 16, 11, 0, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; } }
      // rótulos de sala (en el suelo)
      ctx.font = '800 9px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ROOMS.forEach((r) => { const tx = (r.x + r.w / 2) * TS, ty = (r.y + r.h - 1.2) * TS; if (Math.abs(tx - me.x) < vw && Math.abs(ty - me.y) < vh) ctx.fillText(r.name.toUpperCase(), tx, ty); }); ctx.globalAlpha = 1;
      STATIONS.forEach((s) => { if (Math.abs(s.x - me.x) < vw && Math.abs(s.y - me.y) < vh) drawStation(s, t, tks.find((q) => q.st === s.id)); });
      Object.keys(bodies).forEach((id) => { const b = bodies[id]; if (!b) return; if (!ghost && dist(me.x, me.y, b.x, b.y) > R) return; drawBody(b, players[id] && players[id].look, t); });
      const list = [];
      Object.keys(players).forEach((id) => {
        const pl = players[id]; if (!pl || pl.online === false) return;
        if (id === o.pid) { list.push({ id, pl, x: me.x, y: me.y, f: me.f, mv: me.moving, me: true, g: ghost }); return; }
        const c = others[id]; if (!c) return; const g2 = !!pl.dead;
        if (g2 && !ghost) return; // los fantasmas solo los ven otros fantasmas
        const d = dist(me.x, me.y, c.x, c.y); if (!ghost && d > R + 30) return;
        list.push({ id, pl, x: c.x, y: c.y, f: c.f, mv: c.moving, g: g2, a: ghost ? 1 : clamp((R + 30 - d) / 40, 0, 1) });
      });
      list.sort((a, b) => a.y - b.y).forEach((e) => drawPlayer(e.pl, e.me ? (o.getLook() || e.pl.look) : e.pl.look, e.x, e.y, e.f, e.mv, !!e.me, t, e.g, e.a));
      parts.forEach((p) => { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }); ctx.globalAlpha = 1;
      floats.forEach((f) => { ctx.globalAlpha = clamp(1 - f.t / f.life, 0, 1); ctx.font = '800 11px ' + FONT; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a1033'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }); ctx.globalAlpha = 1;
      ctx.restore();
      // niebla de visión (los fantasmas ven todo)
      if (!ghost) {
        const fw = fogCv.width, fh = fogCv.height, k = fw / vw; fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, fw, fh); fctx.fillStyle = 'rgba(5,3,20,.93)'; fctx.fillRect(0, 0, fw, fh);
        fctx.globalCompositeOperation = 'destination-out'; const px = (me.x - cx) * k, py = (me.y - 8 - cy) * k, rr = R * k, gr = fctx.createRadialGradient(px, py, rr * 0.35, px, py, rr); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); fctx.fillStyle = gr; fctx.beginPath(); fctx.arc(px, py, rr, 0, 6.283); fctx.fill();
        ctx.imageSmoothingEnabled = true; ctx.drawImage(fogCv, 0, 0, W, H); ctx.imageSmoothingEnabled = false;
      } else { ctx.fillStyle = 'rgba(80,120,255,.10)'; ctx.fillRect(0, 0, W, H); }
      // flechas hacia las misiones pendientes (y botón de emergencia lejos): siempre se ven en el borde
      if (!frozen) {
        const pend = STATIONS.filter((s2) => { const tk = tks.find((q) => q.st === s2.id); return tk && !tk.done; }); const mx0 = 40, mx1 = W - 40, my0 = 128, my1 = H - 128;
        pend.forEach((s2) => {
          const sx2 = (s2.x - cx) * z, sy2 = (s2.y - cy) * z; if (sx2 > 30 && sx2 < W - 30 && sy2 > 110 && sy2 < H - 110) return;
          const ccx = (me.x - cx) * z, ccy = (me.y - cy) * z, ang = Math.atan2(sy2 - ccy, sx2 - ccx); let ax = clamp(sx2, mx0, mx1), ay = clamp(sy2, my0, my1);
          ctx.save(); ctx.translate(ax, ay); ctx.globalAlpha = 0.95; ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 6.283); ctx.fill(); ctx.stroke();
          ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(21, -8); ctx.lineTo(21, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.rotate(-ang); ctx.font = '22px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(KIND_ICON[s2.kind], 0, 1); ctx.restore();
        });
      }
      // joystick
      if (joy && !frozen) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(d, 44), nx = d ? dx / d * m : 0, ny = d ? dy / d * m : 0; ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 46, 0, 6.283); ctx.fill(); ctx.globalAlpha = 0.85; ctx.fillStyle = '#cfd6ff'; ctx.beginPath(); ctx.arc(joy.ox + nx, joy.oy + ny, 22, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
    }
    resize(); raf = requestAnimationFrame(tick);

    return {
      me, canvas: cv,
      destroy() { dead = true; cancelAnimationFrame(raf); root.removeEventListener('keydown', kd); root.removeEventListener('keyup', ku); root.removeEventListener('resize', resize); if (ro) ro.disconnect(); if (cv.parentNode) cv.parentNode.removeChild(cv); if (hud.parentNode) hud.parentNode.removeChild(hud); const bm = container.querySelector('.wd-bigmap'); if (bm) bm.remove(); },
      setActive(b) { active = !!b; if (b) { last = 0; resize(); } joy = null; },
      setFrozen(b) { frozen = !!b; if (b) joy = null; },
      setGhost(b) { ghost = !!b; lastBtn = ''; if (b) { role.textContent = '👻 Fantasma'; role.classList.add('ghost'); } },
      setLook() { /* el avatar se lee con getLook() en cada cuadro */ },
      blackout(ms) { blackUntil = Date.now() + ms; },
      gather(n) { const s = spawnPoint(o.pid, n || 0); me.x = s.x; me.y = s.y; sx = -1; joy = null; },
      setProgress(frac, txt) { barFill.style.width = Math.round(clamp(frac, 0, 1) * 100) + '%'; barTxt.textContent = txt || Math.round(clamp(frac, 0, 1) * 100) + '%'; },
      setTasks(list, imp) {
        tasksBox.innerHTML = ''; (list || []).forEach((t) => { const s = STATIONS.find((q) => q.id === t.st) || {}; const d = document.createElement('div'); d.className = 'wd-task' + (t.done ? ' done' : ''); d.textContent = (t.done ? '✅ ' : KIND_ICON[t.kind] + ' ') + (s.room || '') + ': ' + (s.name || '') + (imp ? ' (falsa)' : ''); tasksBox.appendChild(d); });
        if (imp) { role.textContent = '🕵️ IMPOSTOR'; role.className = 'wd-role imp'; } else { role.textContent = '🧑‍🚀 Tripulante'; role.className = 'wd-role crew'; } if (ghost) { role.textContent = '👻 Fantasma'; role.classList.add('ghost'); }
      },
      float(text, c) { floats.push({ x: me.x, y: me.y - 30, text, c: c || '#ffd23f', t: 0, life: 1.4 }); },
      burst(x, y, c) { for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283; parts.push({ x, y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, t: 0, life: 0.7, c: c || '#ffd23f' }); } },
    };
  }

  root.DuiXWorld = { ventNeighbors, mount, layout, STATIONS, VENTS, ROOMS, TABLE, TS, MW, MH, _walkable: walkable, _canStand: canStand, KIND_ICON, spawnPoint };
})(window);
