/* DuiX — motor de pixel art: héroe por capas, villanos, íconos y fondos.
 * Todo se dibuja con primitivas sobre un búfer pequeño y se le aplica un contorno
 * automático de 1 píxel para que se vea como sprite retro.
 */
(function (root) {
  'use strict';
  const D = root.DuiXData;

  /* ---------- color ---------- */
  const hexToRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const pack = (r, g, b, a) => ((a === undefined ? 255 : a) << 24) | (b << 16) | (g << 8) | r;
  const col = (hex) => { const [r, g, b] = hexToRgb(hex); return pack(r, g, b); };
  const mix = (hex, other, t) => { const a = hexToRgb(hex), b = hexToRgb(other); return '#' + [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0')).join(''); };
  const lighten = (h, t) => mix(h, '#ffffff', t);
  const darken = (h, t) => mix(h, '#000000', t);
  const lum = (h) => { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

  /* ---------- búfer de píxeles ---------- */
  function Buf(w, h) { this.w = w; this.h = h; this.ox = 0; this.oy = 0; this.d = new Uint32Array(w * h); }
  Buf.prototype.px = function (x, y, c) { x = (x + this.ox) | 0; y = (y + this.oy) | 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = typeof c === 'string' ? col(c) : c; };
  Buf.prototype.get = function (x, y) { x += this.ox; y += this.oy; return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; };
  Buf.prototype.rect = function (x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); };
  Buf.prototype.ell = function (cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.px(x, y, c);
    }
  };
  Buf.prototype.ring = function (cx, cy, rx, ry, t, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, v = dx * dx + dy * dy; if (v <= 1 && v >= Math.pow(1 - t / Math.min(rx, ry), 2)) this.px(x, y, c);
    }
  };
  Buf.prototype.poly = function (pts, c) {
    let minY = Infinity, maxY = -Infinity; pts.forEach((p) => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.px(x, y, c);
    }
  };
  Buf.prototype.line = function (x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
    for (;;) { this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };
  Buf.prototype.bmp = function (x, y, rows, map) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const k = r[i]; if (k !== '.' && k !== ' ') { const c = map[k] || map['#']; if (c) this.px(x + i, y + j, c); } } }); };
  Buf.prototype.outline = function (c) {
    const oc = typeof c === 'string' ? col(c) : c, src = this.d.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src[y * this.w + x]) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && src[yy * this.w + xx];
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.d[y * this.w + x] = oc;
    }
  };
  Buf.prototype.toCanvas = function () {
    const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
    const ctx = cv.getContext('2d'), id = ctx.createImageData(this.w, this.h); new Uint32Array(id.data.buffer).set(this.d); ctx.putImageData(id, 0, 0); return cv;
  };
  // espejo horizontal de una región
  Buf.prototype.mirrorFrom = function (cx) { for (let y = 0; y < this.h; y++) for (let x = cx; x < this.w; x++) { const m = 2 * cx - 1 - x; if (m >= 0 && this.d[y * this.w + x] === 0) { const v = this.get(m, y); if (v) this.d[y * this.w + x] = v; } } };

  const INK = '#1a1033';

  /* ---------- emblemas 7x7 ---------- */
  const EMB = {
    star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '##...##'],
    bolt: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],
    heart: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    inf: ['.##...##.', '#..#.#..#', '#...#...#', '#..#.#..#', '.##...##.'],
    pi: ['#######', '.#...#.', '.#...#.', '.#...#.', '.#...##'],
    sigma: ['#####.', '.#....', '..#...', '...#..', '..#...', '.#....', '#####.'],
    root: ['......##', '......#.', '#.....#.', '##....#.', '.#...#..', '..#.#...', '...#....'],
    flame: ['...#...', '..##...', '..###..', '.#####.', '#######', '#######', '.#####.'],
    deriv: ['..###.#', '..#...#', '.####..', '..#....', '..#....', '..#....', '.#.....'],
    zero: ['###..#.###', '#.#.#..#.#', '#.#.#..#.#', '###.#..###'],
  };

  /* ---------- VILLANOS ---------- */
  function P(v) { const p = v.pal; return { m: p.main, s: p.shade, l: p.light, a: p.accent, e: p.eye }; }
  const VB = {};
  const eyesAngry = (b, x1, x2, y, c, w) => { w = w || 4; b.rect(x1, y, w, 3, '#fff'); b.rect(x2, y, w, 3, '#fff'); b.rect(x1 + 1, y + 1, w - 2, 2, c); b.rect(x2 + 1, y + 1, w - 2, 2, c); b.line(x1 - 1, y - 2, x1 + w, y - 1, INK); b.line(x2 + w, y - 2, x2 - 1, y - 1, INK); b.line(x1, y - 2, x1 + w, y - 1, INK); b.line(x2 + w - 1, y - 2, x2 - 1, y - 1, INK); };
  const teeth = (b, x, y, n, c) => { for (let i = 0; i < n; i++) b.poly([[x + i * 3, y], [x + i * 3 + 3, y], [x + i * 3 + 1.5, y + 3]], c || '#fff'); };

  VB.brute = (b, p) => {
    b.rect(8, 24, 32, 12, p.m); b.rect(8, 24, 32, 2, p.l); b.rect(34, 26, 6, 10, p.s);
    b.rect(12, 36, 9, 8, p.s); b.rect(27, 36, 9, 8, p.s); b.rect(11, 43, 11, 3, p.a); b.rect(26, 43, 11, 3, p.a);
    b.rect(4, 26, 6, 14, p.m); b.rect(38, 26, 6, 14, p.m); b.rect(4, 39, 6, 4, p.a); b.rect(38, 39, 6, 4, p.a);
    b.rect(16, 8, 16, 16, p.m); b.rect(16, 8, 16, 3, p.l); b.rect(28, 10, 4, 14, p.s);
    b.rect(14, 5, 20, 5, p.a); b.rect(20, 2, 8, 4, p.a); b.rect(14, 5, 20, 1, lighten(p.a, 0.4));
    eyesAngry(b, 18, 26, 14, p.e, 4);
    b.rect(20, 20, 8, 2, INK); teeth(b, 20, 20, 3, '#fff');
    b.rect(8, 33, 32, 3, p.a); b.rect(22, 33, 4, 3, lighten(p.a, 0.4));
    // escudos: [ y (
    b.rect(-1, 24, 3, 20, '#fff'); b.rect(-1, 24, 7, 3, '#fff'); b.rect(-1, 41, 7, 3, '#fff');
  };
  VB.blob = (b, p) => {
    b.ell(16, 28, 13, 14, p.m); b.ell(32, 28, 13, 14, p.m);
    b.rect(15, 14, 18, 28, p.m);
    b.ell(13, 24, 7, 8, p.l);
    // fisura zigzag
    for (let y = 8; y < 46; y++) { const x = 23 + (y % 6 < 3 ? 0 : 2) - (y % 12 < 6 ? 1 : 0); b.px(x, y, 0); b.px(x + 1, y, 0); }
    b.rect(30, 34, 12, 8, p.s);
    // ojos desiguales
    b.ell(15, 21, 4, 5, '#fff'); b.ell(15, 22, 2, 3, p.e); b.ell(33, 23, 3, 3, '#fff'); b.px(33, 23, p.e); b.px(33, 24, p.e); b.line(11, 15, 19, 18, INK); b.line(30, 19, 36, 17, INK);
    // boca con dientes
    b.rect(14, 33, 22, 5, INK); teeth(b, 15, 33, 6, '#fff'); teeth(b, 16, 38, 5, '#fff');
    b.rect(4, 36, 6, 4, p.a); b.rect(38, 36, 6, 4, p.a);
    b.rect(12, 44, 8, 2, p.s); b.rect(28, 44, 8, 2, p.s);
  };
  VB.dino = (b, p) => {
    // cola
    b.poly([[34, 30], [46, 36], [47, 40], [30, 40]], p.m);
    // cuerpo
    b.ell(24, 32, 11, 10, p.m); b.ell(24, 36, 8, 6, p.l);
    // piernas
    b.rect(16, 38, 7, 8, p.s); b.rect(26, 38, 7, 8, p.s); b.rect(14, 44, 10, 3, p.a); b.rect(25, 44, 10, 3, p.a);
    // cabeza con hocico
    b.rect(10, 6, 24, 16, p.m); b.rect(3, 12, 12, 9, p.m); b.rect(28, 8, 6, 14, p.s); b.rect(10, 6, 24, 2, p.l);
    b.rect(5, 19, 20, 4, INK); teeth(b, 5, 19, 6, '#fff'); teeth(b, 9, 22, 5, '#fff');
    b.ell(24, 11, 4, 4, '#fff'); b.ell(24, 12, 2, 3, p.e); b.line(19, 7, 28, 10, INK);
    b.rect(7, 13, 2, 2, INK);
    // brazitos
    b.rect(14, 28, 5, 2, p.m); b.rect(17, 29, 3, 3, p.a);
    // púas
    [[20, 4], [26, 3], [32, 5], [38, 13], [40, 22], [38, 30]].forEach(([x, y]) => b.poly([[x - 3, y + 5], [x, y], [x + 3, y + 5]], p.a));
  };
  VB.witch = (b, p) => {
    // vestido
    b.poly([[16, 24], [32, 24], [42, 46], [6, 46]], p.m); b.poly([[26, 24], [32, 24], [42, 46], [28, 46]], p.s);
    b.rect(16, 30, 16, 3, p.a);
    // brazos múltiples
    [[6, 28, 16, 25], [2, 34, 12, 30], [42, 28, 32, 25], [46, 34, 36, 30]].forEach(([x1, y1, x2, y2]) => { b.line(x1, y1, x2, y2, p.l); b.line(x1, y1 + 1, x2, y2 + 1, p.l); b.rect(x1 - 1, y1 - 1, 3, 3, p.a); });
    // cabeza
    b.ell(24, 17, 8, 8, '#d7f2c0'); b.poly([[24, 17], [27, 24], [21, 24]], '#b8dca0');
    b.ell(24, 17, 8, 8, '#d7f2c0');
    eyesAngry(b, 17, 25, 14, p.e, 4);
    b.rect(20, 22, 8, 1, INK);
    // sombrero
    b.rect(10, 10, 28, 3, p.s); b.poly([[16, 10], [32, 10], [28, 0], [26, -6]], p.m); b.rect(16, 7, 16, 3, p.a);
    b.poly([[16, 10], [32, 10], [30, 0]], p.m);
  };
  VB.gentleman = (b, p) => {
    b.rect(12, 24, 24, 20, '#2a2a3d'); b.rect(20, 24, 8, 20, '#f5f5ff'); b.poly([[20, 24], [28, 24], [24, 34]], '#2a2a3d');
    b.rect(22, 25, 4, 3, p.a); b.rect(10, 26, 5, 14, '#2a2a3d'); b.rect(33, 26, 5, 14, '#2a2a3d'); b.rect(10, 40, 5, 3, '#fff'); b.rect(33, 40, 5, 3, '#fff');
    b.rect(14, 44, 8, 3, '#141420'); b.rect(26, 44, 8, 3, '#141420');
    b.ell(24, 16, 9, 9, p.m); b.rect(28, 12, 5, 9, p.s); b.ell(24, 16, 8, 8, p.m);
    // sombrero de copa
    b.rect(10, 8, 28, 3, '#141420'); b.rect(15, -2, 18, 11, '#141420'); b.rect(15, 5, 18, 3, p.a);
    // monóculo y bigote
    b.ring(28, 15, 4, 4, 1.3, '#ffd23f'); b.line(30, 19, 34, 28, '#ffd23f'); b.rect(14, 14, 4, 3, '#fff'); b.rect(15, 15, 2, 2, INK); b.rect(26, 14, 4, 3, '#fff'); b.rect(27, 15, 2, 2, INK);
    b.ell(20, 21, 4, 2, '#3a2a1a'); b.ell(28, 21, 4, 2, '#3a2a1a'); b.rect(22, 21, 4, 1, '#3a2a1a');
    b.line(14, 12, 19, 13, INK);
  };
  VB.croc = (b, p) => {
    // cola con púas
    b.poly([[34, 26], [48, 34], [46, 40], [32, 40]], p.m);
    b.ell(30, 34, 14, 10, p.m); b.ell(28, 38, 10, 6, p.l);
    b.rect(24, 42, 6, 5, p.s); b.rect(34, 42, 6, 5, p.s);
    // mandíbula superior e inferior formando "<"
    b.poly([[2, 22], [30, 6], [40, 10], [40, 24], [30, 24]], p.m);
    b.poly([[2, 26], [30, 26], [40, 26], [40, 40], [30, 42]], p.s);
    b.poly([[4, 25], [30, 25], [30, 27], [4, 27]], INK);
    for (let i = 0; i < 6; i++) { b.poly([[6 + i * 4.5, 24], [9 + i * 4.5, 24], [7.5 + i * 4.5, 20]], '#fff'); b.poly([[7 + i * 4.5, 28], [10 + i * 4.5, 28], [8.5 + i * 4.5, 32]], '#fff'); }
    b.ell(31, 10, 4, 4, '#fff'); b.ell(31, 11, 2, 3, p.e); b.line(26, 5, 36, 8, INK); b.rect(6, 15, 2, 2, INK);
    [[38, 3], [44, 6], [46, 12]].forEach(([x, y]) => b.poly([[x - 3, y + 5], [x, y], [x + 3, y + 5]], p.a));
    b.rect(36, 40, 6, 3, p.a);
  };
  VB.robot = (b, p) => {
    b.rect(8, 22, 32, 18, p.m); b.rect(8, 22, 32, 2, p.l); b.rect(34, 24, 6, 16, p.s);
    b.rect(12, 26, 24, 12, '#0b1424'); b.rect(13, 27, 22, 10, '#123');
    b.rect(12, 40, 10, 6, p.s); b.rect(26, 40, 10, 6, p.s); b.rect(10, 44, 14, 3, '#333b52'); b.rect(24, 44, 14, 3, '#333b52');
    b.rect(2, 24, 6, 14, p.s); b.rect(40, 24, 6, 14, p.s); b.rect(0, 36, 8, 6, p.a); b.rect(40, 36, 8, 6, p.a); b.rect(3, 42, 2, 3, p.a); b.rect(43, 42, 2, 3, p.a);
    b.rect(12, 6, 24, 16, p.m); b.rect(12, 6, 24, 2, p.l); b.rect(32, 8, 4, 14, p.s);
    b.rect(14, 11, 20, 6, '#1d2438'); b.rect(15, 12, 18, 4, p.e); b.rect(15, 12, 18, 1, lighten(p.e, 0.5)); b.rect(23, 11, 2, 6, '#1d2438');
    b.rect(23, 0, 2, 6, p.s); b.ell(24, 0, 3, 3, p.a);
    b.rect(16, 19, 16, 2, '#1d2438'); [18, 21, 24, 27, 30].forEach((x) => b.rect(x, 19, 1, 2, p.l));
    b.rect(6, 12, 6, 6, p.s); b.rect(36, 12, 6, 6, p.s);
  };
  VB.ghost = (b, p) => {
    // eco desfasado
    const echo = (dx, dy, c) => { b.ell(24 + dx, 18 + dy, 12, 13, c); b.rect(12 + dx, 18 + dy, 24, 22, c); };
    echo(7, -4, p.a);
    b.poly([[16, 36], [32, 36], [36, 46], [32, 42], [28, 46], [24, 42], [20, 46], [16, 42], [12, 46]], p.m);
    b.ell(24, 20, 12, 13, p.m); b.rect(12, 20, 24, 20, p.m);
    for (let i = 0; i < 4; i++) b.poly([[12 + i * 6, 38], [18 + i * 6, 38], [15 + i * 6, 46]], p.m);
    b.rect(30, 14, 6, 26, p.s); b.rect(16, 8, 8, 2, p.l);
    // brazos
    b.poly([[12, 26], [2, 22], [4, 28], [12, 32]], p.m); b.poly([[36, 26], [46, 22], [44, 28], [36, 32]], p.m);
    // ojos vacíos
    b.ell(18, 18, 4, 6, '#1a1033'); b.ell(30, 18, 4, 6, '#1a1033'); b.ell(18, 19, 1.5, 2, p.a); b.ell(30, 19, 1.5, 2, p.a);
    b.ell(24, 30, 3, 4, '#1a1033');
  };
  VB.tower = (b, p) => {
    // pilas de celdas (tabla)
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { const x = 10 + c * 10, y = 4 + r * 8, alt = (r + c) % 2; b.rect(x, y, 9, 7, alt ? p.m : p.l); b.rect(x, y + 6, 9, 1, p.s); b.rect(x + 8, y, 1, 7, p.s); }
    b.rect(9, 3, 31, 1, p.a); b.rect(9, 3, 1, 38, p.a); b.rect(39, 3, 1, 38, p.a);
    // cara en celdas
    b.rect(12, 6, 5, 5, '#fff'); b.rect(14, 8, 3, 3, INK); b.rect(31, 6, 5, 5, '#fff'); b.rect(32, 8, 3, 3, INK);
    b.line(11, 4, 17, 6, INK); b.line(36, 4, 30, 6, INK);
    b.rect(14, 22, 20, 5, INK); teeth(b, 15, 22, 6, '#fff');
    b.rect(11, 40, 8, 6, p.s); b.rect(29, 40, 8, 6, p.s);
    // reglas como brazos
    b.rect(1, 12, 8, 3, p.a); b.rect(1, 12, 1, 8, p.a); b.rect(39, 12, 8, 3, p.a); b.rect(46, 12, 1, 8, p.a);
    [3, 5].forEach((x) => b.px(x, 15, INK));
  };
  VB.muscle = (b, p) => {
    b.poly([[8, 22], [40, 22], [34, 40], [14, 40]], p.m); b.poly([[30, 22], [40, 22], [34, 40], [28, 40]], p.s);
    b.rect(14, 38, 20, 4, p.a); b.rect(14, 42, 8, 5, p.s); b.rect(26, 42, 8, 5, p.s);
    b.ell(6, 28, 7, 8, p.m); b.ell(42, 28, 7, 8, p.m); b.ell(5, 27, 3, 4, p.l); b.ell(41, 27, 3, 4, p.l);
    b.rect(2, 34, 8, 6, p.m); b.rect(38, 34, 8, 6, p.m); b.rect(1, 38, 9, 4, p.a); b.rect(38, 38, 9, 4, p.a);
    b.ell(24, 14, 8, 8, p.m); b.rect(28, 10, 4, 9, p.s); b.rect(16, 6, 16, 3, p.a);
    eyesAngry(b, 17, 25, 12, p.e, 4); b.rect(19, 19, 10, 2, INK); teeth(b, 20, 19, 3);
    // barra con discos
    b.rect(-1, 40, 50, 3, '#8a97ad'); b.rect(0, 34, 4, 15, '#333b52'); b.rect(44, 34, 4, 15, '#333b52');
    b.rect(14, 24, 20, 3, p.a);
  };
  VB.egg = (b, p) => {
    b.ell(24, 30, 15, 17, p.m); b.ell(24, 36, 12, 8, p.l); b.rect(32, 20, 7, 20, p.s);
    b.ell(24, 30, 15, 17, p.m); b.ell(21, 26, 11, 12, p.m);
    // pañuelo
    b.ell(24, 14, 12, 9, p.a); b.rect(12, 14, 24, 4, p.a); b.rect(14, 10, 20, 2, lighten(p.a, 0.4));
    // cara
    b.ell(24, 20, 8, 8, '#ffe1c4'); b.rect(19, 16, 3, 4, INK); b.rect(27, 16, 3, 4, INK); b.px(20, 16, '#fff'); b.px(28, 16, '#fff'); b.line(17, 14, 23, 16, INK); b.line(31, 14, 25, 16, INK);
    b.ell(24, 25, 3, 1.5, '#c0392b'); b.ell(18, 22, 2, 1.5, '#ff9db5'); b.ell(30, 22, 2, 1.5, '#ff9db5');
    // muñeca interior
    b.ell(24, 38, 7, 8, p.l); b.ell(24, 34, 5, 5, '#ffe1c4'); b.ell(24, 30, 6, 3, p.a); b.rect(22, 33, 1, 2, INK); b.rect(26, 33, 1, 2, INK);
    b.line(9, 32, 39, 32, p.s);
    b.rect(14, 46, 20, 1, p.s);
  };
  VB.miner = (b, p) => {
    b.rect(10, 24, 28, 18, '#3f5a8a'); b.rect(16, 24, 4, 8, '#3f5a8a'); b.rect(28, 24, 4, 8, '#3f5a8a'); b.rect(18, 28, 12, 8, '#2f4570');
    b.rect(10, 26, 28, 3, p.m); b.rect(11, 42, 10, 5, p.s); b.rect(27, 42, 10, 5, p.s);
    b.rect(4, 26, 6, 14, p.m); b.rect(38, 26, 6, 14, p.m); b.rect(3, 38, 8, 4, p.s); b.rect(37, 38, 8, 4, p.s);
    b.ell(24, 16, 10, 10, p.m); b.rect(30, 12, 4, 10, p.s);
    // casco con linterna
    b.ell(24, 9, 11, 7, p.a); b.rect(13, 9, 22, 4, p.a); b.rect(11, 12, 26, 2, darken(p.a, 0.2)); b.rect(21, 3, 6, 5, '#fff'); b.rect(22, 4, 4, 3, '#ffe14a');
    eyesAngry(b, 17, 25, 14, p.e, 4);
    // barba de raíces
    b.poly([[14, 20], [34, 20], [30, 30], [24, 26], [20, 33], [17, 26]], darken(p.m, 0.35));
    [[16, 27, 14, 32], [20, 30, 19, 36], [26, 28, 28, 34], [30, 26, 33, 31]].forEach(([x1, y1, x2, y2]) => b.line(x1, y1, x2, y2, darken(p.m, 0.35)));
    // pico
    b.rect(41, 18, 2, 24, '#8a6a4a'); b.poly([[34, 18], [48, 16], [46, 19], [36, 21]], '#c9d1de'); b.poly([[46, 16], [49, 20], [46, 20]], '#c9d1de');
  };
  VB.squid = (b, p) => {
    b.ell(24, 16, 15, 14, p.m); b.ell(20, 12, 8, 7, p.l); b.rect(32, 10, 7, 12, p.s); b.ell(24, 16, 15, 14, p.m);
    b.ell(24, 16, 15, 14, p.m); b.ell(19, 10, 6, 5, p.l);
    for (let i = 0; i < 7; i++) { const x = 9 + i * 5, w = (i % 2) ? 2 : -2; b.rect(x, 26, 4, 8, p.m); b.rect(x + w, 33, 4, 8, p.m); b.rect(x + w * 2, 40, 4, 6, p.s); b.px(x + 1, 30, p.l); b.px(x + w + 1, 37, p.l); }
    // ojos grandes
    b.ell(17, 17, 5, 6, '#fff'); b.ell(31, 17, 5, 6, '#fff'); b.ell(18, 18, 3, 4, p.e); b.ell(30, 18, 3, 4, p.e); b.rect(17, 17, 2, 3, INK); b.rect(30, 17, 2, 3, INK);
    b.line(11, 10, 20, 13, INK); b.line(37, 10, 28, 13, INK);
    b.rect(20, 25, 8, 2, INK);
    // burbujas
    b.ring(4, 8, 3, 3, 1, '#bfe0ff'); b.ring(44, 14, 2.5, 2.5, 1, '#bfe0ff'); b.ring(2, 20, 2, 2, 1, '#bfe0ff');
    b.rect(20, 2, 8, 3, p.a);
  };
  VB.queen = (b, p) => {
    // cabello / capa ondulada
    b.poly([[10, 14], [38, 14], [46, 46], [2, 46]], p.s);
    for (let y = 16; y < 46; y += 1) { const w = Math.round(2 * Math.sin(y * 0.55)); b.px(4 + w + (y - 16) * 0.05, y, p.a); b.px(43 + w - (y - 16) * 0.05, y, p.a); }
    b.poly([[14, 26], [34, 26], [40, 46], [8, 46]], p.m); b.poly([[26, 26], [34, 26], [40, 46], [28, 46]], p.l);
    b.rect(14, 26, 20, 3, p.a); b.rect(4, 26, 8, 3, p.m); b.rect(36, 26, 8, 3, p.m);
    b.ell(24, 17, 9, 9, '#ffe1f0'); b.rect(28, 13, 4, 9, '#f0bcd6'); b.ell(24, 17, 8, 8, '#ffe1f0');
    eyesAngry(b, 17, 25, 14, p.e, 4); b.rect(21, 22, 6, 1, '#c0392b');
    // corona
    b.poly([[13, 10], [13, 2], [18, 7], [24, 0], [30, 7], [35, 2], [35, 10]], p.a); b.rect(13, 9, 22, 2, darken(p.a, 0.2)); b.rect(23, 3, 2, 2, '#ff3b6b'); b.rect(15, 5, 2, 2, '#5ce1e6'); b.rect(31, 5, 2, 2, '#5ce1e6');
    // onda seno como cetro
    for (let x = 0; x < 12; x++) b.px(36 + x, 34 + Math.round(3 * Math.sin(x * 0.9)), p.a);
  };
  VB.void = (b, p) => {
    // masa oscura con picos
    const seed = [5, 9, 3, 12, 7, 4, 10, 6, 11, 8, 3, 9, 5, 12, 7, 4];
    const pts = []; for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, r = 17 + (i % 2 ? seed[(i >> 1) % 16] : 0); pts.push([24 + Math.cos(a) * r * 0.95, 25 + Math.sin(a) * r * 0.9]); }
    b.poly(pts, p.m); b.ell(24, 26, 13, 13, p.s);
    for (let i = 0; i < 40; i++) { const a = i * 2.4, r = (i * 7) % 13; b.px(24 + Math.cos(a) * r, 26 + Math.sin(a) * r * 0.9, p.l); }
    // ojos en forma de 0
    b.ring(17, 20, 5, 6, 2, p.e); b.ring(31, 20, 5, 6, 2, p.e); b.rect(16, 19, 2, 2, '#fff'); b.rect(30, 19, 2, 2, '#fff');
    // boca "/"
    b.line(20, 34, 28, 28, p.e); b.line(21, 34, 29, 28, p.e); b.line(19, 34, 27, 28, p.e);
    // tentáculos
    [[8, 40, 4, 46], [16, 44, 14, 48], [32, 44, 34, 48], [40, 40, 44, 46]].forEach(([x1, y1, x2, y2]) => { b.line(x1, y1, x2, y2, p.m); b.line(x1 + 1, y1, x2 + 1, y2, p.m); });
  };
  VB.king = (b, p) => {
    // halo infinito
    b.ring(14, 12, 9, 7, 2, p.a); b.ring(34, 12, 9, 7, 2, p.a); b.rect(21, 9, 6, 6, 0); b.rect(22, 10, 4, 4, p.a);
    // capa y túnica
    b.poly([[8, 22], [40, 22], [48, 47], [0, 47]], '#5a1a8f'); b.poly([[30, 22], [40, 22], [48, 47], [34, 47]], '#3a0f66');
    b.poly([[14, 24], [34, 24], [38, 47], [10, 47]], p.m); b.poly([[26, 24], [34, 24], [38, 47], [28, 47]], p.s);
    b.rect(14, 24, 20, 3, p.l); b.rect(12, 38, 24, 3, p.a);
    b.ell(24, 19, 9, 9, '#ffe9c4'); b.rect(28, 14, 4, 10, '#e9c99a'); b.ell(24, 19, 8, 8, '#ffe9c4');
    eyesAngry(b, 17, 25, 16, p.eye || p.e, 4); b.rect(21, 25, 6, 1, INK);
    // corona
    b.poly([[14, 13], [14, 5], [19, 10], [24, 2], [29, 10], [34, 5], [34, 13]], p.m); b.rect(14, 12, 20, 3, p.s); b.rect(23, 6, 2, 3, '#ff3b6b');
    // cetro
    b.rect(41, 14, 2, 30, '#c98900'); b.ell(42, 12, 4, 4, p.a);
  };

  const villCache = {};
  function villainCanvas(v, hurt) {
    const k = v.id + (hurt ? '!' : '');
    if (villCache[k]) return villCache[k];
    let cv;
    if (hurt) {
      const base = villainCanvas(v), c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
      const x = c.getContext('2d'); x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(0, 0, c.width, c.height); cv = c;
    } else {
      const b = new Buf(56, 56), tmp = new Buf(56, 56);
      // dibujar centrado con margen de 4
      const off = new Buf(64, 64);
      const draw = VB[v.body] || VB.brute;
      // los dibujos usan coordenadas 0..48; trasladamos mediante proxy
      const proxy = new Proxy(off, { get(t, prop) { if (['rect', 'ell', 'ring', 'poly', 'line', 'px', 'bmp'].includes(prop)) return (...a) => wrap(t, prop, a); return t[prop]; } });
      function wrap(t, prop, a) {
        const ox = 8, oy = 8;
        if (prop === 'rect') return t.rect(a[0] + ox, a[1] + oy, a[2], a[3], a[4]);
        if (prop === 'ell') return t.ell(a[0] + ox, a[1] + oy, a[2], a[3], a[4]);
        if (prop === 'ring') return t.ring(a[0] + ox, a[1] + oy, a[2], a[3], a[4], a[5]);
        if (prop === 'poly') return t.poly(a[0].map(([x, y]) => [x + ox, y + oy]), a[1]);
        if (prop === 'line') return t.line(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4]);
        if (prop === 'px') return t.px(a[0] + ox, a[1] + oy, a[2]);
        return t.bmp(a[0] + ox, a[1] + oy, a[2], a[3]);
      }
      const pal = P(v);
      const palC = { m: col(pal.m), s: col(pal.s), l: col(pal.l), a: col(pal.a), e: col(pal.e) };
      // los dibujos pasan colores hex a las primitivas; usamos strings
      draw(proxy, pal);
      off.outline(INK);
      cv = off.toCanvas();
    }
    villCache[k] = cv; return cv;
  }

  /* ---------- íconos pixelados (HUD) ---------- */
  const ICONS = {
    heart: { rows: ['.aa.aa.', 'abbabba', 'abbbbba', 'abbbbba', '.abbba.', '..aba..', '...a...'], map: { a: '#1a1033', b: '#ff3b5c' } },
    heartEmpty: { rows: ['.aa.aa.', 'a..a..a', 'a.....a', 'a.....a', '.a...a.', '..a.a..', '...a...'], map: { a: '#6b5a8f' } },
    coin: { rows: ['..aaaa..', '.abbbba.', 'abbccbba', 'abbcbbba', 'abbcbbba', 'abbccbba', '.abbbba.', '..aaaa..'], map: { a: '#1a1033', b: '#ffc933', c: '#fff2a8' } },
    star: { rows: ['...a...', '..aba..', 'aabbbaa', '.abbba.', '.abbba.', 'ab.a.ba', 'a.....a'], map: { a: '#1a1033', b: '#ffd23f' } },
    starEmpty: { rows: ['...a...', '..a.a..', 'aa...aa', '.a...a.', '.a...a.', 'a.a.a.a', 'a.....a'], map: { a: '#6b5a8f' } },
    lock: { rows: ['..aaa..', '.a...a.', '.a...a.', 'aaaaaaa', 'abbbbba', 'abbcbba', 'abbcbba', 'aaaaaaa'], map: { a: '#1a1033', b: '#9fb3c8', c: '#1a1033' } },
    bolt: { rows: ['....aa.', '...abba', '..abba.', '.abbbba', '...abba', '..abba.', '.aba...', '.a.....'], map: { a: '#1a1033', b: '#ffe14a' } },
    chest: { rows: ['.aaaaaaa.', 'abbbbbbba', 'abbbbbbba', 'aaaacaaaa', 'abbbcbbba', 'abbbbbbba', 'aaaaaaaaa'], map: { a: '#1a1033', b: '#c98900', c: '#ffe14a' } },
    pause: { rows: ['aaa.aaa', 'aaa.aaa', 'aaa.aaa', 'aaa.aaa', 'aaa.aaa'], map: { a: '#ffffff' } },
    city: { rows: ['...aaa...', '.aabbbaa.', '.abcbcba.', '.abbbbba.', '.abcbcba.', '.abbbbba.', 'aaaaaaaaa'], map: { a: '#1a1033', b: '#9fb3c8', c: '#ffffff' } },
    shirt: { rows: ['.aa...aa.', 'aabaaabaa', 'abbbbbbba', '.abbbbba.', '..abbba..', '..abbba..', '..aaaaa..'], map: { a: '#1a1033', b: '#9fb3c8' } },
    trophy: { rows: ['aaaaaaaaa', 'abbbbbbba', 'abbbbbbba', '.abbbbba.', '..abbba..', '...aba...', '..abbba..', '.aaaaaaa.'], map: { a: '#1a1033', b: '#9fb3c8' } },
    gear: { rows: ['...aaa...', '.a.abba.a', '.abbbbba.', 'aabbcbbaa', 'abbcccbba', 'aabbcbbaa', '.abbbbba.', '.a.abba.a', '...aaa...'], map: { a: '#1a1033', b: '#9fb3c8', c: '#1a1033' } },
    book: { rows: ['.aaaaaaa.', 'abbbabbba', 'abcbabcba', 'abbbabbba', 'abcbabcba', 'abbbabbba', '.aaaaaaa.'], map: { a: '#1a1033', b: '#9fb3c8', c: '#ffffff' } },
    people: { rows: ['.aaa...aaa.', 'abbba.abbba', 'abbba.abbba', '.aaa...aaa.', 'abbba.abbba', 'abbba.abbba', 'aaaaa.aaaaa'], map: { a: '#1a1033', b: '#9fb3c8' } },
    play: { rows: ['aa.....', 'abaa...', 'abbbaa.', 'abbbbba', 'abbbaa.', 'abaa...', 'aa.....'], map: { a: '#1a1033', b: '#ffffff' } },
    bulb: { rows: ['..aaa..', '.abbba.', 'abbcbba', 'abbcbba', '.abbba.', '..aba..', '..aaa..', '...a...'], map: { a: '#1a1033', b: '#ffe14a', c: '#fff' } },
  };
  const iconCache = {};
  function icon(name, scale, tint) {
    scale = scale || 4; const k = name + scale + (tint || ''); if (iconCache[k]) return iconCache[k];
    const d = ICONS[name]; const w = d.rows[0].length + 2, h = d.rows.length + 2;
    const map = Object.assign({}, d.map); if (tint) map.b = tint;
    const b = new Buf(w, h); b.bmp(1, 1, d.rows, Object.fromEntries(Object.entries(map).map(([k2, v]) => [k2, col(v)])));
    const s = b.toCanvas(), c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, c.width, c.height);
    return (iconCache[k] = c.toDataURL());
  }

  /* ---------- fondos de ciudad ---------- */
  function rng(seed) { let s = 0; for (let i = 0; i < seed.length; i++) s = (Math.imul(s, 31) + seed.charCodeAt(i)) >>> 0; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return ((s ^ (s >>> 13)) >>> 0) / 4294967296; }; }
  const bgCache = {};
  function cityBg(v, w, h) {
    const k = v.id + w + 'x' + h; if (bgCache[k]) return bgCache[k];
    const R = rng(v.id), b = new Buf(w, h), c1 = hexToRgb(v.sky[0]), c2 = hexToRgb(v.sky[1]);
    for (let y = 0; y < h; y++) { const t = y / (h * 0.75), tt = Math.min(1, t); const r = Math.round(c1[0] + (c2[0] - c1[0]) * tt), g = Math.round(c1[1] + (c2[1] - c1[1]) * tt), bl = Math.round(c1[2] + (c2[2] - c1[2]) * tt); for (let x = 0; x < w; x++) b.d[y * w + x] = pack(r, g, bl); }
    // estrellas
    for (let i = 0; i < w * h * 0.004; i++) b.px(R() * w, R() * h * 0.5, R() < 0.3 ? '#ffffff' : lighten(v.sky[1], 0.5));
    // luna / sol
    const mx = w * (0.2 + R() * 0.6), my = h * 0.16; b.ell(mx, my, 7, 7, lighten(v.glow, 0.6)); b.ell(mx + 2, my - 1, 6, 6, lighten(v.glow, 0.8));
    // capas de edificios
    const layers = [{ base: 0.55, hmin: 0.10, hmax: 0.26, col: mix(v.sky[1], '#000000', 0.25), win: 0.06 }, { base: 0.72, hmin: 0.12, hmax: 0.3, col: mix(v.sky[1], '#000000', 0.5), win: 0.14 }, { base: 0.9, hmin: 0.12, hmax: 0.22, col: mix(v.sky[0], '#000000', 0.6), win: 0.2 }];
    layers.forEach((L) => {
      let x = -2; const baseY = Math.floor(h * L.base);
      while (x < w) {
        const bw = 8 + Math.floor(R() * 14), bh = Math.floor(h * (L.hmin + R() * (L.hmax - L.hmin)));
        b.rect(x, baseY - bh, bw, bh + h, L.col);
        if (R() < 0.35) b.rect(x + Math.floor(bw / 2) - 1, baseY - bh - 4, 2, 4, L.col);
        for (let wy = baseY - bh + 3; wy < baseY - 2; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (R() < L.win * 2.5) b.px(wx, wy, R() < 0.5 ? lighten(v.glow, 0.5) : '#ffe9a8');
        x += bw + Math.floor(R() * 3);
      }
    });
    // suelo
    b.rect(0, h - 5, w, 5, mix(v.sky[0], '#000000', 0.55)); for (let x = 0; x < w; x += 6) b.rect(x, h - 3, 3, 1, mix(v.glow, '#000000', 0.5));
    const cv = b.toCanvas(); bgCache[k] = cv; return cv;
  }

  function clearCaches() { if (API.clearHero) API.clearHero(); }

  const API = { Buf, villainCanvas, icon, cityBg, EMB, col, mix, lighten, darken, lum, hexToRgb, INK, clearCaches, rng };
  root.DuiXSprites = API;
})(typeof window !== 'undefined' ? window : globalThis);
