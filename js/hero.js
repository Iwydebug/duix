/* DuiX — héroe por capas (hombre / mujer), peinados, alas, armas en mano y mascotas.
 * Se dibuja pixel a pixel sobre un búfer con desplazamiento (OX, OY) para dejar sitio a
 * alas, armas largas y sombreros. Las coordenadas del código son las del cuerpo (centro x = 20).
 */
(function (root) {
  'use strict';
  const S = root.DuiXSprites, D = root.DuiXData;
  const { Buf, col, lighten, darken, lum, INK, EMB } = S;
  const W = 64, H = 58, OX = 16, OY = 12, CX = 20;
  const HEAD_CROP = { x: 18, y: 2, w: 36, h: 34 };
  const cache = {}, petCache = {};
  const RB = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4da3ff', '#c58bff'];

  const it = (id, fb) => D.ITEM_BY_ID[id] || D.ITEM_BY_ID[fb];

  /* ---------- pelo ---------- */
  // rellena una "gorra" que sigue el contorno de la cabeza entre las filas y0 e y1
  function cap(b, y0, y1, c, ext) {
    ext = ext || 0;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - 10) / 9.5, t = 1 - dy * dy; if (t <= 0) continue;
      const hw = Math.sqrt(t) * 9.5 + ext; b.rect(Math.round(CX - hw), y, Math.round(hw * 2), 1, c);
    }
  }
  function hairBack(b, hs, c, fr, acc) {
    const d = darken(c, 0.28), sway = [0, 1, 2, 1][fr % 4];
    if (hs === 'largo') { b.ell(CX, 12, 10.5, 11, c); b.rect(CX - 10, 12, 21, 15, c); b.rect(CX + 4, 12, 7, 15, d); b.ell(CX, 27, 10.5, 2.5, d); b.rect(CX - 8, 14, 1, 10, lighten(c, 0.25)); }
    else if (hs === 'coleta') { b.poly([[CX + 6, 4], [CX + 13, 5], [CX + 16 + sway, 13], [CX + 15 + sway, 25], [CX + 12, 19], [CX + 10, 11]], c); b.poly([[CX + 13, 9], [CX + 16 + sway, 13], [CX + 15 + sway, 25], [CX + 13, 20]], d); }
    else if (hs === 'bob') { b.ell(CX, 12, 10.5, 9.5, c); b.rect(CX - 10, 10, 21, 7, c); b.rect(CX + 5, 10, 6, 7, d); }
    else if (hs === 'dobles') { [-1, 1].forEach((s) => { const X = (x) => CX + s * x; b.poly([[X(7), 4], [X(14), 6], [X(17), 16], [X(15), 28], [X(11), 21], [X(9), 10]], c); b.poly([[X(13), 9], [X(17), 16], [X(15), 28], [X(13), 22]], d); }); }
    else if (hs === 'afro') { b.ell(CX, 5, 13.5, 12.5, c); b.ell(CX + 9, 8, 4.5, 7, d); b.ell(CX - 6, 0, 5, 3, lighten(c, 0.25)); }
    else if (hs === 'trenzas') { b.ell(CX, 11, 10, 9, c); }
  }
  function hairFront(b, hs, c, fr, acc, skin) {
    const d = darken(c, 0.28), l = lighten(c, 0.32);
    switch (hs) {
      case 'corto': cap(b, 1, 8, c); b.rect(CX - 9, 8, 2, 5, c); b.rect(CX + 7, 8, 2, 5, c); b.poly([[CX - 8, 8], [CX + 3, 8], [CX - 2, 12], [CX - 8, 11]], c); b.rect(CX + 4, 7, 5, 1, d); b.rect(CX - 5, 3, 6, 1, l); b.rect(CX - 7, 4, 3, 1, l); b.rect(CX + 7, 10, 2, 2, d); break;
      case 'pinchos': cap(b, 2, 8, c); [[-8, 4], [-4, 8], [0, 10], [4, 8], [8, 4]].forEach(([dx, h]) => { const lean = dx < 0 ? -1 : dx > 0 ? 1 : 0; b.poly([[CX + dx - 2.6, 6], [CX + dx + lean, 6 - h], [CX + dx + 2.6, 6]], c); b.px(CX + dx - 1, 6 - h + 3, l); }); b.rect(CX - 9, 8, 2, 3, c); b.rect(CX + 7, 8, 2, 3, c); b.rect(CX + 4, 7, 5, 1, d); break;
      case 'calvo': { const hi = lighten(skin, 0.35); b.rect(CX - 4, 3, 4, 1, hi); b.px(CX - 5, 4, hi); b.px(CX + 1, 3, hi); break; }
      case 'largo': cap(b, 1, 8, c); b.rect(CX - 10, 7, 3, 14, c); b.rect(CX + 7, 7, 3, 14, c); b.rect(CX + 8, 10, 2, 11, d); b.poly([[CX - 9, 8], [CX, 4], [CX + 9, 8], [CX + 9, 10], [CX, 7], [CX - 9, 10]], c); b.px(CX, 2, d); b.rect(CX - 5, 3, 5, 1, l); b.rect(CX + 1, 2, 4, 1, l); break;
      case 'coleta': cap(b, 1, 8, c); b.rect(CX - 9, 8, 2, 4, c); b.rect(CX + 7, 8, 2, 4, c); b.poly([[CX - 8, 8], [CX + 2, 7], [CX - 4, 11], [CX - 8, 11]], c); b.rect(CX + 8, 5, 3, 3, acc); b.rect(CX - 5, 3, 6, 1, l); break;
      case 'bob': cap(b, 1, 8, c); b.rect(CX - 10, 7, 4, 10, c); b.rect(CX + 6, 7, 4, 10, c); b.rect(CX - 7, 8, 15, 2, c); b.px(CX - 3, 10, c); b.px(CX + 2, 10, c); b.px(CX + 5, 10, c); b.rect(CX + 7, 9, 3, 7, d); b.rect(CX - 5, 3, 6, 1, l); b.rect(CX - 9, 10, 1, 5, l); break;
      case 'mono': cap(b, 2, 7, c); b.ell(CX, -1, 4.5, 4, c); b.rect(CX - 4, 2, 9, 2, acc); b.rect(CX - 2, -3, 3, 1, l); b.rect(CX - 9, 7, 2, 4, c); b.rect(CX + 7, 7, 2, 4, c); b.rect(CX + 3, 4, 5, 1, d); b.rect(CX - 4, 3, 1, 1, l); break;
      case 'dobles': cap(b, 1, 8, c); b.rect(CX - 8, 8, 17, 2, c); b.rect(CX - 9, 8, 2, 4, c); b.rect(CX + 7, 8, 2, 4, c); b.rect(CX - 10, 5, 3, 3, acc); b.rect(CX + 8, 5, 3, 3, acc); b.rect(CX - 5, 3, 6, 1, l); break;
      case 'afro': cap(b, 1, 8, c, 3); b.ell(CX - 5, 2, 5, 3.5, l); b.rect(CX - 11, 7, 3, 6, c); b.rect(CX + 8, 7, 3, 6, c); b.rect(CX + 5, 7, 5, 1, d); break;
      case 'cresta': b.rect(CX - 8, 5, 16, 1, d); b.poly([[CX - 3, 9], [CX - 4, 1], [CX - 2, -5], [CX, -9], [CX + 2, -5], [CX + 4, 1], [CX + 3, 9]], c); b.rect(CX - 1, -6, 2, 13, l); b.rect(CX + 2, 0, 2, 8, d); break;
      case 'trenzas':
        cap(b, 1, 8, c); b.rect(CX - 9, 8, 2, 5, c); b.rect(CX + 7, 8, 2, 5, c); b.poly([[CX - 8, 8], [CX, 4], [CX + 8, 8], [CX + 8, 10], [CX, 7], [CX - 8, 10]], c); b.rect(CX - 5, 3, 5, 1, l);
        [-1, 1].forEach((s) => { for (let i = 0; i < 6; i++) b.ell(CX + s * 8, 19 + i * 3, 2.7, 2.1, i % 2 ? c : d); b.rect(CX + s * 8 - 1, 36, 3, 2, acc); }); break;
      case 'cristal': { cap(b, 1, 8, c); b.rect(CX - 9, 8, 2, 4, c); b.rect(CX + 7, 8, 2, 4, c); const cl = lighten(c, 0.3);
        [[-8, -2, 7], [-4, -1, 10], [0, 0, 13], [4, 1, 10], [8, 2, 7]].forEach(([dx, ang, h]) => { b.poly([[CX + dx - 2.4, 5], [CX + dx + ang, 5 - h], [CX + dx + 2.4, 5]], cl); b.line(CX + dx, 4, CX + dx + ang, 5 - h + 2, '#ffffff'); b.px(CX + dx + 1, 3, darken(c, 0.15)); }); break; }
      case 'llamas': { const o = '#ff8a1f'; cap(b, 1, 8, o); b.rect(CX - 9, 8, 2, 5, '#ff5a1f'); b.rect(CX + 7, 8, 2, 5, '#ff5a1f'); b.rect(CX - 5, 3, 6, 1, '#ffe066');
        for (let i = 0; i < 7; i++) { const x = CX - 8 + i * 2.7, h = 5 + ((i * 5 + fr * 3) % 4) * 2; b.poly([[x - 2.2, 6], [x + 0.4, 6 - h], [x + 2.2, 6]], '#ff5a1f'); b.poly([[x - 1.2, 6], [x + 0.4, 6 - h * 0.6], [x + 1.4, 6]], '#ffd23f'); } break; }
      default: cap(b, 1, 8, c);
    }
  }

  /* ---------- alas ---------- */
  function drawWings(b, wk, f, fr) {
    [-1, 1].forEach((s) => {
      const X = (x) => CX + s * x, P = (pts) => pts.map(([x, y]) => [X(x), y]);
      if (wk === 'angel') {
        b.poly(P([[5, 22], [9, 13 - f], [15, 5 - f], [22, 2 - f], [21, 9 - f], [25, 13 - f], [22, 19], [24, 25], [18, 26], [16, 33], [10, 28], [6, 31]]), '#f6f8ff');
        b.poly(P([[6, 24], [14, 20], [21, 22], [18, 28], [12, 27]]), '#d3dcf3');
        [[22, 2 - f], [25, 13 - f], [24, 25], [16, 33]].forEach(([x, y]) => b.px(X(x), y, '#ffd23f'));
        b.line(X(6), 22, X(21), 4 - f, '#bcc8e6');
      } else if (wk === 'bat') {
        b.poly(P([[5, 22], [10, 10 - f], [18, 3 - f], [24, 10 - f], [21, 16], [25, 22], [19, 24], [19, 31], [13, 25], [9, 31]]), '#4a3a6b');
        b.poly(P([[7, 23], [14, 20], [19, 24], [13, 25]]), '#2c2145');
        b.line(X(5), 21, X(18), 3 - f, '#9a86cf'); b.line(X(6), 22, X(24), 10 - f, '#9a86cf'); b.line(X(6), 23, X(25), 22, '#9a86cf'); b.px(X(18), 2 - f, '#e6ddff');
      } else if (wk === 'dragon') {
        b.poly(P([[5, 21], [8, 11 - f], [13, 1 - f], [16, 10 - f], [22, 4 - f], [22, 13 - f], [29, 11 - f], [25, 20], [27, 27], [20, 23], [15, 29], [10, 24]]), '#c1272d');
        b.poly(P([[7, 22], [15, 18], [22, 21], [15, 25]]), '#8f1a20');
        b.line(X(5), 21, X(13), 1 - f, '#ffb01f'); b.line(X(6), 21, X(22), 4 - f, '#ffb01f'); b.line(X(6), 22, X(29), 11 - f, '#ffb01f');
        [[13, 0 - f], [22, 3 - f], [29, 10 - f]].forEach(([x, y]) => b.px(X(x), y, '#fff3d0'));
      } else if (wk === 'hada') {
        b.poly(P([[5, 21], [10, 8 - f], [18, 2 - f], [24, 7 - f], [21, 15], [11, 22]]), '#c9f7ff');
        b.poly(P([[5, 23], [16, 23], [20, 30], [15, 35], [9, 30]]), '#a6ecfa');
        b.line(X(6), 21, X(19), 4 - f, '#ffffff'); b.line(X(7), 24, X(16), 33, '#ffffff');
        b.px(X(14), 12 - f, '#ffffff'); b.px(X(17), 27, '#ffffff'); b.px(X(22), 5 - f, '#fff3a0');
        if (fr % 2) { b.px(X(11), 5, '#fff3a0'); b.px(X(20), 20, '#ffffff'); } else { b.px(X(24), 12, '#fff3a0'); }
      } else if (wk === 'fenix') {
        const fl = fr % 2;
        b.poly(P([[5, 22], [9, 12 - f], [14, 4 - f - fl], [19, 9 - f], [24, 3 - f + fl], [24, 12 - f], [29, 10 - f - fl], [24, 19], [27, 25 + fl], [20, 23], [17, 31 - fl], [12, 25], [8, 30]]), '#ff3b1f');
        b.poly(P([[6, 22], [10, 14 - f], [15, 8 - f], [19, 13], [23, 10 - f], [22, 19], [25, 24], [18, 23], [14, 28], [10, 24]]), '#ff8a1f');
        b.poly(P([[7, 22], [12, 17], [18, 17], [21, 22], [15, 24]]), '#ffd23f');
      } else if (wk === 'mech') {
        b.poly(P([[5, 21], [25, 6 - f], [27, 10 - f], [8, 24]]), '#8a97ad');
        b.poly(P([[5, 23], [27, 14 - f], [28, 18 - f], [8, 27]]), '#a6b3c8');
        b.poly(P([[5, 25], [23, 23], [24, 27], [8, 29]]), '#8a97ad');
        b.line(X(8), 24, X(25), 8 - f, '#5ce1e6'); b.line(X(8), 27, X(26), 16 - f, '#5ce1e6'); b.line(X(8), 29, X(22), 25, '#5ce1e6');
        b.rect(X(5), 21, 3, 3, '#5a667d');
      }
    });
  }

  /* ---------- armas en mano (agarre en gx,gy; apuntan hacia arriba) ---------- */
  function drawHeld(b, wp, gx, gy, fr) {
    const k = wp.held, gold = '#e0a800';
    if (k === 'sword') {
      for (let i = 0; i < 14; i++) { const y = gy - 3 - i; b.rect(gx - 1, y, 3, 1, wp.rainbow ? RB[i % 5] : wp.gold ? (i % 2 ? '#ffd23f' : '#fff0a0') : (i % 2 ? wp.c1 : lighten(wp.c1, 0.3))); if (!wp.rainbow) b.px(gx + 1, y, wp.c2); }
      b.poly([[gx - 1, gy - 17], [gx + 2, gy - 17], [gx + 0.5, gy - 21]], wp.rainbow ? RB[4] : wp.gold ? '#fff0a0' : lighten(wp.c1, 0.3));
      b.rect(gx - 3, gy - 3, 7, 2, wp.gold ? '#e63946' : gold); b.rect(gx - 1, gy - 1, 3, 3, '#6b3f1d'); b.rect(gx - 1, gy + 2, 3, 1, gold);
    } else if (k === 'staff') {
      b.rect(gx, gy - 14, 1, 20, '#7a4a1f'); b.px(gx, gy - 8, '#a8692d'); b.px(gx, gy - 2, '#a8692d');
      if (wp.fx === 'fire') { b.poly([[gx - 3, gy - 14], [gx + 4, gy - 14], [gx + 3.5, gy - 18], [gx + 0.5, gy - 22], [gx - 1, gy - 18]], wp.c2); b.poly([[gx - 1.5, gy - 14], [gx + 2.5, gy - 14], [gx + 0.5, gy - 19]], wp.c1); b.px(gx, gy - 15, '#fff3c0'); if (wp.dragon) { b.poly([[gx - 3, gy - 15], [gx - 6, gy - 20], [gx - 2, gy - 17]], '#f2e6b1'); b.poly([[gx + 4, gy - 15], [gx + 7, gy - 20], [gx + 3, gy - 17]], '#f2e6b1'); } }
      else if (wp.fx === 'ice') { b.poly([[gx + 0.5, gy - 22], [gx + 4, gy - 17], [gx + 0.5, gy - 12], [gx - 3, gy - 17]], wp.c2); b.poly([[gx + 0.5, gy - 20], [gx + 2, gy - 17], [gx + 0.5, gy - 14], [gx - 1, gy - 17]], wp.c1); b.px(gx, gy - 19, '#ffffff'); }
      else { b.ell(gx + 0.5, gy - 17, 3.6, 3.6, wp.c2); b.ell(gx + 0.5, gy - 17, 2.4, 2.4, wp.c1); b.px(gx - 0.5, gy - 18, '#ffffff'); b.rect(gx - 3, gy - 14, 7, 1, gold); }
    } else if (k === 'bow') {
      const pts = [[gx + 2, gy - 14], [gx + 4, gy - 10], [gx + 5, gy - 5], [gx + 4, gy], [gx + 2, gy + 4]];
      for (let i = 0; i < pts.length - 1; i++) { b.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#8a5a2b'); b.line(pts[i][0] - 1, pts[i][1], pts[i + 1][0] - 1, pts[i + 1][1], wp.c2); }
      b.line(gx + 2, gy - 14, gx + 2, gy + 4, '#f2f2f2'); b.rect(gx + 2, gy - 6, 7, 1, wp.c1); b.poly([[gx + 9, gy - 8], [gx + 9, gy - 5], [gx + 12, gy - 6.5]], wp.c1);
    } else if (k === 'blaster') {
      b.rect(gx - 1, gy - 5, 9, 5, '#4a5570'); b.rect(gx - 1, gy - 5, 9, 1, '#8291b0'); b.rect(gx + 8, gy - 4, 4, 3, '#2b3350'); b.rect(gx + 12, gy - 4, 2, 3, wp.c1); b.rect(gx + 1, gy - 3, 5, 1, wp.c2); b.rect(gx - 1, gy, 3, 3, '#2b3350'); b.px(gx + 3, gy - 6, wp.c1);
    } else if (k === 'twin') {
      [[0, 1], [-7, 0.85]].forEach(([dy]) => { const y = gy + dy; b.rect(gx - 1, y - 4, 8, 3, '#4a5570'); b.rect(gx + 7, y - 4, 3, 2, '#2b3350'); b.rect(gx + 10, y - 4, 2, 2, wp.c1); b.rect(gx + 1, y - 3, 4, 1, wp.c2); });
      b.rect(gx - 1, gy - 1, 3, 3, '#2b3350');
    } else { // wand
      b.rect(gx, gy - 10, 1, 12, '#6b4a2b'); b.px(gx, gy - 5, '#a8692d');
      const rows = ['..##', '.##.', '####', '.##.', '##..']; b.bmp(gx - 1, gy - 16, rows, { '#': wp.c2 }); b.bmp(gx - 2, gy - 17, rows, { '#': wp.c1 });
      if (fr % 2) b.px(gx + 3, gy - 17, '#ffffff'); else b.px(gx - 3, gy - 14, '#ffffff');
    }
  }

  /* ---------- héroe ---------- */
  function drawHero(look, pose, frame) {
    let b = new Buf(W, H); b.ox = OX; b.oy = OY; const bodyBuf = b;
    const g = look.gender === 'f' ? 'f' : 'm', fem = g === 'f';
    const su = it(look.suit, 'suit-rojo'), style = su.style || 'hero';
    const skin = D.SKINS[look.skin] || D.SKINS[1], skinSh = darken(skin, 0.14);
    const hair = D.HAIR_COLORS[look.hairColor] || D.HAIR_COLORS[0];
    const hairItem = it(look.hair, 'hair-corto'), hs = hairItem.hs;
    const cape = it(look.cape, 'cape-none'), mask = look.mask || 'mask-none', emb = it(look.emblem, 'emb-star');
    const wing = it(look.wings, 'wing-none'), wp = it(look.weapon, 'wp-rayo');
    const fr = frame || 0, sway = [0, 1, 2, 1][fr % 4], main = su.main, shade = su.shade, acc = su.accent;
    const glove = style === 'robe' ? skin : (acc === '#ffffff' ? '#e6ecff' : acc);
    const boots = darken(acc === '#ffffff' ? shade : acc, acc === '#ffffff' ? 0.2 : 0.15);
    const hi = lighten(main, 0.22);
    const helm = mask === 'mask-caballero';
    const ad = [0, 1, 0, -1][fr % 4], al = pose === 'shoot' ? 0 : ad, ar = pose === 'shoot' ? 0 : -ad, bl = fr % 4 === 1 ? -1 : 0, br2 = fr % 4 === 3 ? -1 : 0;   // brazos y pies se mueven

    // ---- alas (detrás de todo)
    if (wing.wk) drawWings(b, wing.wk, [0, 1, 2, 1][fr % 4], fr);
    // ---- capa
    if (cape && cape.style) {
      const c1 = cape.c1, c2 = cape.c2;
      if (cape.style === 'short') { b.poly([[12, 19], [28, 19], [32 + sway, 32], [8 - sway, 32]], c1); b.poly([[24, 19], [28, 19], [32 + sway, 32], [26, 32]], c2); }
      else if (cape.style === 'long') { b.poly([[12, 19], [28, 19], [33 + sway, 42], [7 - sway, 42]], c1); b.poly([[24, 19], [28, 19], [33 + sway, 42], [26, 42]], c2); }
      else if (cape.style === 'flame') { const flick = fr % 2; b.poly([[12, 19], [28, 19], [33 + sway, 32], [30, 38 + flick], [26, 33], [22, 41 - flick], [18, 34], [14, 40 + flick], [10, 33], [7 - sway, 37]], c1); b.poly([[15, 21], [25, 21], [29, 32], [24, 36], [20, 30], [16, 37], [12, 31]], '#ffd23f'); }
    }
    // ---- pelo (parte de atrás)
    if (!helm) hairBack(b, hs, hair, fr, acc);

    // ---- piernas / falda / túnica / armadura
    if (style === 'robe') {
      b.rect(13, 42, 6, 3, boots); b.rect(21, 42, 6, 3, boots);
      b.poly([[13, 19], [27, 19], [28, 30], [31, 43], [9, 43], [12, 30]], main); b.poly([[23, 19], [27, 19], [28, 30], [31, 43], [23, 43]], shade);
      b.rect(15, 21, 2, 8, hi); b.rect(9, 41, 22, 2, acc); b.rect(12, 28, 16, 2, acc); b.rect(22, 30, 3, 8, acc);
      b.poly([[16, 19], [24, 19], [20, 25]], darken(main, 0.4)); b.line(16, 19, 20, 25, acc); b.line(24, 19, 20, 25, acc);
    } else if (style === 'armor') {
      b.rect(13, 31, 6, 10, shade); b.rect(21, 31, 6, 10, shade); b.rect(13, 35, 6, 3, main); b.rect(21, 35, 6, 3, main); b.rect(15, 36, 2, 1, acc); b.rect(23, 36, 2, 1, acc);
      b.rect(12, 39, 7, 5, darken(shade, 0.2)); b.rect(21, 39, 7, 5, darken(shade, 0.2)); b.rect(12, 39, 7, 1, hi); b.rect(21, 39, 7, 1, hi);
      if (fem) { b.poly([[13, 19], [27, 19], [26, 25], [27, 30], [13, 30], [14, 25]], main); b.poly([[24, 19], [27, 19], [26, 25], [27, 30], [24, 30]], shade); b.poly([[12, 30], [28, 30], [31, 37], [9, 37]], main); [15, 20, 25].forEach((x) => b.rect(x, 31, 1, 6, shade)); b.rect(9, 36, 22, 1, acc); }
      else { b.rect(12, 19, 16, 13, main); b.rect(25, 19, 3, 13, shade); b.rect(12, 19, 16, 2, hi); b.rect(19, 21, 2, 9, shade); b.rect(12, 26, 16, 1, shade); }
      b.rect(12, 28, 16, 2, acc); b.rect(19, 28, 2, 2, lighten(acc, 0.45));
    } else if (fem) {
      b.rect(14, 34, 4, 6, main); b.rect(22, 34, 4, 6, main); b.rect(17, 34, 1, 6, shade); b.rect(25, 34, 1, 6, shade);
      b.rect(13, 39 + bl, 6, 5, boots); b.rect(21, 39 + br2, 6, 5, boots); b.rect(13, 39 + bl, 6, 1, lighten(boots, 0.25)); b.rect(21, 39 + br2, 6, 1, lighten(boots, 0.25));
      b.poly([[13, 19], [27, 19], [26, 25], [27, 30], [13, 30], [14, 25]], main); b.poly([[24, 19], [27, 19], [26, 25], [27, 30], [24, 30]], shade); b.rect(13, 19, 14, 2, hi); b.rect(15, 21, 1, 6, hi);
      b.rect(13, 28, 14, 2, acc); b.rect(19, 28, 2, 2, lighten(acc, 0.45));
      b.poly([[13, 30], [27, 30], [30, 36], [10, 36]], main); b.poly([[23, 30], [27, 30], [30, 36], [23, 36]], shade); b.rect(10, 35, 20, 1, acc);
    } else {
      b.rect(13, 31, 6, 9, main); b.rect(21, 31, 6, 9, main); b.rect(17, 31, 2, 9, shade); b.rect(25, 31, 2, 9, shade);
      b.rect(12, 39 + bl, 7, 5, boots); b.rect(21, 39 + br2, 7, 5, boots); b.rect(12, 39 + bl, 7, 1, lighten(boots, 0.25)); b.rect(21, 39 + br2, 7, 1, lighten(boots, 0.25));
      b.rect(12, 19, 16, 13, main); b.rect(25, 19, 3, 13, shade); b.rect(12, 19, 16, 2, hi); b.rect(14, 21, 1, 7, hi);
      b.rect(12, 29, 16, 2, acc); b.rect(19, 29, 2, 2, lighten(acc, 0.4));
    }
    // ---- brazos
    const aw = fem && style !== 'robe' ? 3 : 4, ax = fem && style !== 'robe' ? 9 : 8, rx = 28;
    const gy = pose === 'shoot' ? 10 : 30 + ar, gx = rx + (aw === 3 ? 1 : 2);
    if (style === 'robe') {
      b.poly([[8, 20], [12, 20], [12, 29], [5, 32]], main); b.rect(8, 20, 1, 8, hi); b.poly([[5, 32], [12, 29], [12, 31], [6, 33]], acc); b.rect(7, 31, 3, 3, skin);
      if (pose === 'shoot') { b.rect(28, 11, 4, 11, main); b.rect(27, 20, 6, 2, acc); b.rect(28, 7, 4, 4, skin); }
      else { b.poly([[28, 20], [32, 20], [35, 32], [28, 29]], main); b.poly([[28, 29], [35, 32], [34, 34], [28, 31]], acc); b.rect(30, 31, 3, 3, skin); }
    } else if (style === 'armor') {
      b.rect(ax, 22 + al, aw, 8, shade); b.rect(ax - 1, 28 + al, aw + 2, 4, main); b.rect(ax - 1, 28 + al, aw + 2, 1, hi);
      if (pose === 'shoot') { b.rect(rx, 11, aw, 11, shade); b.rect(rx - 1, 7, aw + 2, 5, main); b.rect(rx - 1, 7, aw + 2, 1, hi); }
      else { b.rect(rx, 22 + ar, aw, 8, shade); b.rect(rx - 1, 28 + ar, aw + 2, 4, main); b.rect(rx - 1, 28 + ar, aw + 2, 1, hi); }
      [[10, 21], [30, 21]].forEach(([x, y]) => { b.ell(x, y, 4.6, 3.6, main); b.ell(x, y - 1, 3.4, 1.6, hi); b.rect(x - 4, y + 2, 9, 1, acc); });
    } else {
      b.rect(ax, 20 + al, aw, 9, main); b.rect(ax, 20 + al, 1, 9, hi); b.rect(ax, 28 + al, aw, 4, glove);
      if (pose === 'shoot') { b.rect(rx, 10, aw, 12, main); b.rect(rx, 7, aw, 4, glove); b.rect(rx + aw - 1, 20, 1, 2, shade); }
      else { b.rect(rx, 20 + ar, aw, 9, main); b.rect(rx + aw - 1, 20 + ar, 1, 9, shade); b.rect(rx, 28 + ar, aw, 4, glove); }
    }
    // ---- emblema
    if (emb && EMB[emb.shape]) {
      const rows = EMB[emb.shape], w = rows[0].length, ex = CX - Math.floor(w / 2), ey = style === 'robe' ? 31 : (fem && style !== 'armor') ? 20 : 21;
      if (!(style === 'armor' && !fem && false)) { b.bmp(ex + 1, ey + 1, rows, { '#': darken(main, 0.45) }); b.bmp(ex, ey, rows, { '#': acc === '#ffffff' ? '#ffffff' : lighten(acc, 0.25) }); }
    }
    // ---- cabeza
    b.rect(18, 17, 4, 3, skinSh);
    { const hb = new Buf(W, H); hb.ox = OX; hb.oy = OY; b = hb; }   // la cabeza va en su propia capa para poder moverla
    const hr = fem ? 8.1 : 8.5;
    b.ell(CX, 10.5, hr, hr, skin); b.ell(CX + 2.5, 12, 6, 6.5, skin); b.rect(CX + 4, 9, 4, 6, skin);
    for (let y = 6; y < 18; y++) for (let x = CX + 5; x < CX + 9; x++) if (b.get(x, y) === col(skin) && x > CX + 6 + (y > 14 ? -1 : 0)) b.px(x, y, skinSh);
    if (mask === 'mask-elfo') { [-1, 1].forEach((s) => { b.poly([[CX + s * 7, 9], [CX + s * 15, 5], [CX + s * 7, 14]], skin); b.poly([[CX + s * 8, 10], [CX + s * 13, 7], [CX + s * 8, 13]], skinSh); }); }
    // ---- pelo (frente)
    if (!helm) hairFront(b, hs, hair, fr, acc, skin);
    // ---- ojos y boca
    const eyeY = 11, maskColor = lum(acc) > 0.8 ? main : acc;
    const hasEyeMask = ['mask-antifaz', 'mask-gato', 'mask-visor', 'mask-gafas', 'mask-robot', 'mask-caballero'].includes(mask);
    if (!hasEyeMask) {
      b.rect(CX - 5, eyeY, 3, 3, '#ffffff'); b.rect(CX + 2, eyeY, 3, 3, '#ffffff'); b.rect(CX - 4, eyeY + 1, 2, 2, INK); b.rect(CX + 3, eyeY + 1, 2, 2, INK);
      if (fem) { b.rect(CX - 6, eyeY - 1, 4, 1, INK); b.px(CX - 6, eyeY, INK); b.rect(CX + 2, eyeY - 1, 4, 1, INK); b.px(CX + 5, eyeY, INK); b.px(CX - 5, 15, '#ff9db5'); b.px(CX + 4, 15, '#ff9db5'); b.rect(CX - 1, 16, 3, 1, '#c2455f'); b.px(CX - 2, 15, '#c2455f'); b.px(CX + 2, 15, '#c2455f'); }
      else { const br = darken(hair, 0.1); b.rect(CX - 5, eyeY - 2, 3, 1, br); b.rect(CX + 2, eyeY - 2, 3, 1, br); b.rect(CX - 2, 16, 5, 1, '#8a2b3a'); b.px(CX - 3, 15, '#8a2b3a'); b.px(CX + 3, 15, '#8a2b3a'); }
      if (fr % 4 === 2) { b.rect(CX - 5, eyeY, 3, 3, skin); b.rect(CX + 2, eyeY, 3, 3, skin); b.rect(CX - 5, eyeY + 1, 3, 1, INK); b.rect(CX + 2, eyeY + 1, 3, 1, INK); }   // parpadeo
    } else { b.rect(CX - 2, 16, 5, 1, fem ? '#c2455f' : '#8a2b3a'); }
    // ---- máscaras y cascos
    if (mask === 'mask-antifaz') { b.rect(CX - 9, 9, 18, 5, maskColor); b.poly([[CX - 9, 9], [CX - 7, 8], [CX + 7, 8], [CX + 9, 9]], maskColor); b.rect(CX - 6, 10, 4, 2, '#fff'); b.rect(CX + 2, 10, 4, 2, '#fff'); b.rect(CX - 5, 10, 2, 2, INK); b.rect(CX + 3, 10, 2, 2, INK); }
    if (mask === 'mask-gafas') { b.ring(CX - 4, 11.5, 4.2, 3.6, 1.2, '#ffffff'); b.ring(CX + 4, 11.5, 4.2, 3.6, 1.2, '#ffffff'); b.ell(CX - 4, 11.5, 3, 2.5, '#9fe8ff'); b.ell(CX + 4, 11.5, 3, 2.5, '#9fe8ff'); b.rect(CX - 1, 11, 2, 1, '#fff'); b.rect(CX - 5, 11, 2, 2, INK); b.rect(CX + 3, 11, 2, 2, INK); b.px(CX - 6, 10, '#fff'); b.px(CX + 2, 10, '#fff'); }
    if (mask === 'mask-visor') { b.rect(CX - 10, 8, 20, 6, '#232a45'); b.rect(CX - 9, 9, 18, 4, '#5ce1e6'); b.rect(CX - 9, 9, 18, 1, '#b8fbff'); b.rect(CX - 10, 8, 20, 1, '#3a4470'); b.rect(CX - 1, 9, 2, 4, '#232a45'); }
    if (mask === 'mask-gato') {
      b.rect(CX - 9, 9, 18, 5, maskColor); b.rect(CX - 6, 10, 4, 3, '#ffe14a'); b.rect(CX + 2, 10, 4, 3, '#ffe14a'); b.rect(CX - 5, 10, 2, 3, INK); b.rect(CX + 3, 10, 2, 3, INK);
      b.poly([[CX - 9, 8], [CX - 8, -1], [CX - 3, 3]], maskColor); b.poly([[CX + 9, 8], [CX + 8, -1], [CX + 3, 3]], maskColor);
      b.poly([[CX - 8, 6], [CX - 8, 2], [CX - 5, 4]], '#ff9db5'); b.poly([[CX + 8, 6], [CX + 8, 2], [CX + 5, 4]], '#ff9db5');
      b.line(CX - 9, 15, CX - 14, 14, '#fff'); b.line(CX - 9, 16, CX - 14, 17, '#fff'); b.line(CX + 9, 15, CX + 14, 14, '#fff'); b.line(CX + 9, 16, CX + 14, 17, '#fff');
    }
    if (mask === 'mask-ninja') {
      const nc = darken(shade, 0.25);
      b.ell(CX, 9, 9.5, 9.5, nc); b.rect(CX - 9, 10, 18, 9, nc); b.rect(CX - 8, 9, 16, 5, skin);
      b.rect(CX - 6, 10, 4, 2, '#fff'); b.rect(CX + 2, 10, 4, 2, '#fff'); b.rect(CX - 5, 10, 2, 2, INK); b.rect(CX + 3, 10, 2, 2, INK);
      b.rect(CX - 9, 8, 18, 1, acc); b.rect(CX + 8, 8, 5, 2, acc); b.rect(CX + 12, 10, 3, 4, acc);
    }
    if (mask === 'mask-robot') {
      b.ell(CX, 10, 10, 10, '#b8c4d6'); b.rect(CX - 10, 10, 20, 8, '#b8c4d6'); b.rect(CX + 5, 6, 5, 12, '#8a97ad');
      b.rect(CX - 8, 8, 16, 6, '#1d2438'); b.rect(CX - 7, 9, 14, 4, '#ff3b3b'); b.rect(CX - 7, 9, 14, 1, '#ff9a9a'); b.rect(CX - 8, 16, 16, 1, '#6f7f99');
      b.rect(CX - 1, -3, 2, 5, '#8a97ad'); b.rect(CX - 2, -4, 4, 2, '#ff3b3b'); b.rect(CX - 6, 17, 12, 2, '#8a97ad'); [-4, 0, 3].forEach((dx) => b.rect(CX + dx, 17, 1, 2, '#1d2438'));
    }
    if (mask === 'mask-corona') {
      b.poly([[CX - 9, 6], [CX - 9, -1], [CX - 5, 3], [CX - 2, -3], [CX + 2, -3], [CX + 5, 3], [CX + 9, -1], [CX + 9, 6]], '#ffc933');
      b.rect(CX - 9, 5, 18, 2, '#c98900'); b.px(CX - 9, -1, '#fff'); b.px(CX + 8, -1, '#fff'); b.rect(CX - 1, -1, 2, 2, '#ff3b6b'); b.rect(CX - 7, 4, 2, 2, '#4da3ff'); b.rect(CX + 5, 4, 2, 2, '#4da3ff');
    }
    if (mask === 'mask-mago') {
      b.ell(CX, 4, 13, 3.2, '#3a2591'); b.poly([[CX - 8, 4], [CX + 8, 4], [CX + 3, -7], [CX + 10, -12], [CX + 1, -10]], '#5b3fd1'); b.poly([[CX + 2, 4], [CX + 8, 4], [CX + 3, -7], [CX + 1, -4]], '#3a2591');
      b.rect(CX - 8, 2, 16, 2, '#ffd23f'); b.px(CX - 2, -2, '#ffd23f'); b.px(CX - 3, -3, '#fff3a0'); b.px(CX + 1, 0, '#ffd23f');
    }
    if (mask === 'mask-caballero') {
      b.ell(CX, 9.5, 10, 10, '#b9c4d6'); b.rect(CX - 10, 9, 20, 10, '#b9c4d6'); b.rect(CX + 4, 3, 6, 15, '#8a97ad'); b.rect(CX - 1, 0, 2, 10, '#7d8aa3'); b.rect(CX - 10, 9, 20, 1, '#dfe7f5');
      b.rect(CX - 8, 10, 16, 3, INK); b.px(CX - 5, 11, '#fff'); b.px(CX + 3, 11, '#fff'); b.px(CX - 4, 11, '#fff'); b.px(CX + 4, 11, '#fff');
      [-6, -3, 0, 3, 6].forEach((dx) => b.rect(CX + dx, 15, 1, 3, '#7d8aa3')); b.rect(CX - 8, 14, 16, 1, '#7d8aa3');
      b.poly([[CX - 2, 0], [CX - 5, -6], [CX + 2, -9], [CX + 7, -4], [CX + 4, 0]], '#d62839'); b.poly([[CX + 2, -9], [CX + 7, -4], [CX + 4, 0], [CX + 3, -4]], '#8c1a26');
    }
    if (mask === 'mask-cuernos') {
      [-1, 1].forEach((s) => { const X = (x) => CX + s * x; b.poly([[X(7), 6], [X(10), -3], [X(16), -9], [X(13), -2], [X(11), 7]], '#f2e6b1'); b.poly([[X(10), 4], [X(13), -3], [X(16), -9], [X(14), 0]], '#c9b877'); b.rect(X(7) - (s > 0 ? 0 : 3), 5, 3, 2, '#c9b877'); });
    }
    if (mask === 'mask-halo') {
      const y = -4 - (fr % 2); b.ring(CX, y, 7.5, 2.6, 1.3, '#ffe066'); b.ring(CX, y, 7.5, 2.6, 0.6, '#fff6b0'); b.px(CX + 8, y - 1, '#fff'); b.px(CX - 8, y + 1, '#fff');
    }
    { const hb = b, dy = (fr % 4 === 1 || fr % 4 === 3) ? -1 : 0; b = bodyBuf; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = hb.d[y * W + x]; if (v) { const yy = y + dy; if (yy >= 0 && yy < H) b.d[yy * W + x] = v; } } }
    // ---- arma en la mano
    drawHeld(b, wp, gx, gy, fr);
    b.outline(INK);
    return b;
  }

  /* ---------- mascotas ---------- */
  function drawPet(pk, fr) {
    const b = new Buf(24, 20), bob = [0, 1, 0, -1][fr % 4];
    if (pk === 'slime') {
      const sq = [0, 1, 0, -1][fr % 4];
      b.ell(12, 13 + sq * 0.5, 9 + sq * 0.6, 6 - sq * 0.5, '#6be675'); b.ell(12, 14 + sq * 0.5, 8 + sq * 0.6, 4, '#48c455'); b.ell(8, 10, 3, 2, '#bff5c4');
      b.rect(8, 11, 3, 3, '#fff'); b.rect(14, 11, 3, 3, '#fff'); b.rect(9, 12, 2, 2, INK); b.rect(15, 12, 2, 2, INK); b.rect(11, 15, 3, 1, '#2b8f37');
    } else if (pk === 'gato') {
      const t = [0, 1, 2, 1][fr % 4];
      b.poly([[5, 14], [1, 12 - t], [2, 8 - t], [5, 11]], '#3a3f5c'); b.ell(10, 14, 6, 4.5, '#3a3f5c'); b.ell(10, 15, 3.5, 3, '#e8e8f5');
      b.ell(14, 8 + bob * 0, 5.2, 4.6, '#3a3f5c'); b.poly([[10, 5], [10, 0], [13, 3]], '#3a3f5c'); b.poly([[15, 3], [18, 0], [18, 6]], '#3a3f5c');
      b.rect(9, 6, 11, 2, '#e63946'); b.rect(19, 6, 3, 1, '#e63946'); b.rect(12, 8, 2, 2, '#ffe14a'); b.rect(16, 8, 2, 2, '#ffe14a'); b.px(13, 9, INK); b.px(17, 9, INK); b.px(15, 11, '#ff9db5');
      b.rect(7, 17, 3, 2, '#3a3f5c'); b.rect(12, 17, 3, 2, '#3a3f5c');
    } else if (pk === 'dron') {
      const y = 6 + bob, pw = fr % 2 ? 8 : 5;
      b.ell(12, y + 4, 7, 4, '#8a97ad'); b.ell(12, y + 4, 3.4, 2.4, '#5ce1e6'); b.px(11, y + 3, '#ffffff'); b.rect(11, y - 2, 2, 3, '#5a667d'); b.px(11, y - 3, '#ff3b3b'); b.rect(12 - pw, y - 4, pw * 2, 1, '#cfd8e6');
      b.rect(8, y + 8, 1, 3, '#5a667d'); b.rect(15, y + 8, 1, 3, '#5a667d'); b.rect(6, y + 10, 4, 1, '#5a667d'); b.rect(14, y + 10, 4, 1, '#5a667d'); b.rect(9, y + 8, 6, 1, '#3f4a63');
    } else if (pk === 'dragon') {
      const w = [0, 2, 0, -2][fr % 4];
      b.poly([[5, 14], [1, 17], [0, 12], [3, 9]], '#2a8f45'); b.poly([[3, 15], [0, 12], [1, 17]], '#3fbf5a');
      b.poly([[9, 11], [12, 4 + w], [16, 8], [13, 12]], '#2a8f45'); b.poly([[10, 11], [12, 6 + w], [14, 9], [12, 12]], '#4fd06d');
      b.ell(11, 14, 6.5, 4.8, '#3fbf5a'); b.ell(11, 15.5, 4, 3, '#d3f5b0'); [7, 10, 13].forEach((x) => b.poly([[x - 1, 10], [x, 8], [x + 1, 10]], '#ffd23f'));
      b.ell(16, 9, 5, 4.4, '#3fbf5a'); b.rect(18, 9, 5, 4, '#3fbf5a'); b.rect(18, 12, 5, 1, '#2a8f45'); b.px(21, 10, INK); b.px(22, 10, INK);
      b.rect(14, 7, 3, 3, '#ffe14a'); b.px(15, 8, INK); b.poly([[13, 5], [12, 1], [15, 4]], '#f2e6b1'); b.poly([[17, 4], [19, 1], [19, 6]], '#f2e6b1');
      b.rect(8, 17, 3, 2, '#2a8f45'); b.rect(13, 17, 3, 2, '#2a8f45');
      if (fr === 3) { b.px(23, 11, '#ff8a1f'); b.px(22, 12, '#ffd23f'); }
    } else if (pk === 'fenix') {
      const fl = fr % 2;
      b.poly([[4, 15], [0, 12 - fl], [2, 17], [0, 18]], '#ff3b1f'); b.poly([[5, 14], [2, 10 + fl], [4, 16]], '#ffb01f');
      b.ell(11, 14, 6, 4.8, '#ff8a1f'); b.ell(11, 15, 3.6, 3, '#ffd23f'); b.ell(8, 13, 3, 2.5, '#ff5a1f');
      b.ell(15, 8, 4.6, 4.2, '#ffb01f'); b.poly([[12, 4], [13, 0 - fl], [15, 3]], '#ff3b1f'); b.poly([[14, 4], [16, -1], [17, 4]], '#ff8a1f');
      b.poly([[18, 8], [23, 9.5], [18, 11]], '#fff0a0'); b.rect(14, 7, 2, 2, '#fff'); b.px(15, 8, INK); b.rect(8, 17, 2, 2, '#c98900'); b.rect(13, 17, 2, 2, '#c98900');
    }
    b.outline(INK);
    return b.toCanvas();
  }
  function petCanvas(pk, frame) { const k = pk + '|' + ((frame || 0) % 4); return petCache[k] || (petCache[k] = drawPet(pk, (frame || 0) % 4)); }

  /* ---------- API ---------- */
  function key(look, pose, frame, nopet) {
    return [look.gender, look.skin, look.hair, look.hairColor, look.suit, look.mask, look.wings, look.cape, look.pet, look.emblem, look.weapon, pose || 'idle', (frame || 0) % 4, nopet ? 1 : 0].join('|');
  }
  function heroCanvas(look, pose, frame, opts) {
    const nopet = !!(opts && opts.nopet), k = key(look, pose, frame, nopet);
    if (cache[k]) return cache[k];
    const hero = drawHero(look, pose || 'idle', (frame || 0) % 4).toCanvas(), pet = it(look.pet, 'pet-none');
    let out = hero;
    if (pet && pet.pk && !nopet) {
      out = document.createElement('canvas'); out.width = W; out.height = H; const ctx = out.getContext('2d');
      const pc = petCanvas(pet.pk, frame || 0); ctx.drawImage(pc, 0, H - pc.height - 1); ctx.drawImage(hero, 0, 0);
    }
    return (cache[k] = out);
  }
  // solo la cabeza, para avatares pequeños
  function avatarCanvas(look) {
    const c = HEAD_CROP, cv = document.createElement('canvas'); cv.width = c.w; cv.height = c.h;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(heroCanvas(look, 'idle', 0, { nopet: true }), c.x, c.y, c.w, c.h, 0, 0, c.w, c.h); return cv;
  }
  function clearHero() { Object.keys(cache).forEach((k) => delete cache[k]); }

  Object.assign(S, { HERO_W: W, HERO_H: H, HEAD_CROP, heroCanvas, avatarCanvas, petCanvas, clearHero });
})(typeof window !== 'undefined' ? window : globalThis);
