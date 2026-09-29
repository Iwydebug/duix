/* DuiX — Motor de preguntas (14 temas de Cálculo Diferencial)
 * Cada generador crea una pregunta aleatoria, calcula la respuesta con código
 * y se auto-verifica (chk) con un método independiente cuando es posible.
 * Funciona en navegador y en Node (para las pruebas automáticas).
 */
(function (root) {
  'use strict';

  let R = Math.random;
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (a) => a[Math.floor(R() * a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  const nz = (a, b) => { let v; do { v = ri(a, b); } while (v === 0); return v; };
  const chk = (c, m) => { if (!c) throw new Error('chk: ' + m); };
  const close = (a, b) => Math.abs(a - b) < 1e-9;

  const MINUS = '−';
  const SUPD = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺', 'x': 'ˣ' };
  const SUBD = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const sup = (n) => String(n).split('').map((c) => SUPD[c] || c).join('');
  const sub = (n) => String(n).split('').map((c) => SUBD[c] || c).join('');
  const sgn = (n) => (n < 0 ? MINUS + Math.abs(n) : String(n));
  const xp = (n, v) => { v = v || 'x'; return n === 0 ? '1' : n === 1 ? v : v + sup(n); };
  const cx = (c, p) => (p === 0 ? String(c) : (c === 1 ? '' : c === -1 ? MINUS : sgn(c)) + xp(p));

  /* ---------- polinomios (coef. de menor a mayor grado) ---------- */
  function poly(cs, v) {
    v = v || 'x';
    let s = '';
    for (let p = cs.length - 1; p >= 0; p--) {
      const c = cs[p];
      if (c === 0) continue;
      const a = Math.abs(c);
      const body = p === 0 ? String(a) : (a === 1 ? '' : String(a)) + v + (p === 1 ? '' : sup(p));
      if (s === '') s = (c < 0 ? MINUS : '') + body;
      else s += (c < 0 ? ' ' + MINUS + ' ' : ' + ') + body;
    }
    return s || '0';
  }
  const padd = (a, b) => { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push((a[i] || 0) + (b[i] || 0)); return r; };
  const psub = (a, b) => padd(a, b.map((c) => -c));
  const pmul = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; };
  const peval = (cs, x) => cs.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
  const pdeg = (cs) => { let d = cs.length - 1; while (d > 0 && cs[d] === 0) d--; return d; };
  function pdivLin(cs, a) { // divide entre (x - a): {q, r}
    const n = cs.length - 1, q = new Array(n).fill(0);
    let carry = cs[n];
    for (let i = n - 1; i >= 0; i--) { q[i] = carry; carry = cs[i] + carry * a; }
    return { q, r: carry };
  }
  const rp = (deg, lo, hi) => { const cs = []; for (let i = 0; i < deg; i++) cs.push(ri(lo, hi)); cs.push(nz(lo, hi)); return cs; };
  const lin = (a, b) => poly([b, a]);
  const binom = (p, q) => (q === 0 ? `(${cx(p, 1)})` : `(${cx(p, 1)} ${q < 0 ? MINUS : '+'} ${Math.abs(q)})`);
  function polyVariants(cs) {
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      [1, -1].forEach((d) => { const c = cs.slice(); c[i] += d; out.push(poly(c)); });
      const c2 = cs.slice(); c2[i] = -c2[i]; out.push(poly(c2));
    }
    return shuffle(out);
  }

  /* ---------- fracciones ---------- */
  const F = (n, d) => { d = d === undefined ? 1 : d; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
  const fadd = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
  const fsub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
  const fmul = (a, b) => F(a.n * b.n, a.d * b.d);
  const fdiv = (a, b) => F(a.n * b.d, a.d * b.n);
  const fs = (f) => (f.d === 1 ? sgn(f.n) : (f.n < 0 ? MINUS : '') + Math.abs(f.n) + '/' + f.d);
  const fval = (f) => f.n / f.d;
  const rawf = (n, d) => (d === 1 ? sgn(n) : `${sgn(n)}/${d}`);
  function nearFrac(f) {
    const c = [F(-f.n, f.d), F(f.n + 1, f.d), F(f.n, f.d + 1), F(f.n - 1, f.d), F(f.n, f.d + 2), F(f.n + 2, f.d)];
    if (f.n !== 0) c.push(F(f.d, f.n));
    return c.map(fs);
  }

  /* ---------- intervalos ---------- */
  const I = (lo, hi, lc, hc) => ({ lo, hi, lc, hc });
  const ifmt = (i) => (i.lo === -Infinity ? '(−∞' : (i.lc ? '[' : '(') + sgn(i.lo)) + ', ' + (i.hi === Infinity ? '∞)' : sgn(i.hi) + (i.hc ? ']' : ')'));
  function ineqfmt(i) {
    if (i.lo === -Infinity) return 'x ' + (i.hc ? '≤' : '<') + ' ' + sgn(i.hi);
    if (i.hi === Infinity) return 'x ' + (i.lc ? '≥' : '>') + ' ' + sgn(i.lo);
    return sgn(i.lo) + ' ' + (i.lc ? '≤' : '<') + ' x ' + (i.hc ? '≤' : '<') + ' ' + sgn(i.hi);
  }
  const contains = (i, x) => (x > i.lo || (i.lc && x === i.lo)) && (x < i.hi || (i.hc && x === i.hi));

  /* ---------- constructor de preguntas ---------- */
  const BAD = /NaN|undefined|Infinity|null/;
  function mk(topic, level, text, correct, wrongs, explain, hint, extra) {
    correct = String(correct);
    if (BAD.test(correct)) return null;
    const set = [correct];
    for (const w0 of wrongs) {
      if (w0 === undefined || w0 === null) continue;
      const w = String(w0);
      if (BAD.test(w) || set.includes(w)) continue;
      set.push(w);
      if (set.length === 4) break;
    }
    if (set.length < 4) return null;
    const opts = shuffle(set);
    const q = { topic, level, text, options: opts, correct: opts.indexOf(correct), explain: explain || '', hint: hint || '' };
    if (extra) Object.assign(q, extra);
    return q;
  }
  // igual que mk, pero descarta distractores equivalentes numéricamente (f: x -> valor)
  function mkf(topic, level, text, correct, cfn, wrongs, explain, hint) {
    const xs = [3, 7, 11, 2.5];
    const ok = wrongs.filter(([, fn]) => !xs.every((x) => { const a = fn(x), b = cfn(x); return (isNaN(a) && isNaN(b)) || close(a, b); }));
    return mk(topic, level, text, correct, ok.map((w) => w[0]), explain, hint);
  }

  const G = {}; // tema -> generadores
  function def(topic, lvl, name, fn) { (G[topic] = G[topic] || []).push({ lvl, name, fn }); }

  /* ============================================================
   * 1. INTERVALOS
   * ============================================================ */
  def('intervalos', 1, 'desigualdad->intervalo', () => {
    const t = ri(0, 2), a = ri(-8, 4), b = a + ri(2, 8), lc = R() < 0.5, hc = R() < 0.5;
    let iv, c;
    if (t === 0) { iv = I(a, b, lc, hc); c = [I(a, b, !lc, hc), I(a, b, lc, !hc), I(a, b, !lc, !hc)]; }
    else if (t === 1) { iv = I(a, Infinity, lc, false); c = [I(a, Infinity, !lc, false), I(-Infinity, a, false, lc), I(-Infinity, a, false, !lc)]; }
    else { iv = I(-Infinity, b, false, hc); c = [I(-Infinity, b, false, !hc), I(b, Infinity, hc, false), I(b, Infinity, !hc, false)]; }
    return mk('intervalos', 1, `Escribe en notación de intervalo:  ${ineqfmt(iv)}`, ifmt(iv), c.map(ifmt),
      'El corchete [ ] incluye el extremo (≤ o ≥) y el paréntesis ( ) lo excluye (< o >). El infinito siempre lleva paréntesis.',
      '¿El extremo está incluido? ≤ y ≥ → corchete; < y > → paréntesis.');
  });
  def('intervalos', 1, 'intervalo->desigualdad', () => {
    const t = ri(0, 2), a = ri(-8, 4), b = a + ri(2, 8), lc = R() < 0.5, hc = R() < 0.5;
    let iv, c;
    if (t === 0) { iv = I(a, b, lc, hc); c = [I(a, b, !lc, hc), I(a, b, lc, !hc), I(a, b, !lc, !hc)]; }
    else if (t === 1) { iv = I(a, Infinity, lc, false); c = [I(a, Infinity, !lc, false), I(-Infinity, a, false, lc), I(-Infinity, a, false, !lc)]; }
    else { iv = I(-Infinity, b, false, hc); c = [I(-Infinity, b, false, !hc), I(b, Infinity, hc, false), I(b, Infinity, !hc, false)]; }
    return mk('intervalos', 1, `¿Qué desigualdad representa el intervalo ${ifmt(iv)}?`, ineqfmt(iv), c.map(ineqfmt),
      'Corchete → ≤ o ≥. Paréntesis → < o >.', 'Fíjate en los extremos: ¿corchete o paréntesis?');
  });
  def('intervalos', 1, 'pertenece', () => {
    const a = ri(-8, 2), b = a + ri(3, 9), lc = R() < 0.5, hc = R() < 0.5, iv = I(a, b, lc, hc);
    const cor = ri(a + 1, b - 1);
    const traps = []; if (!lc) traps.push(a); if (!hc) traps.push(b);
    const far = shuffle([a - 1, b + 1, a - 2, b + 2, a - 3]);
    const wr = traps.concat(far).filter((v) => !contains(iv, v));
    chk(contains(iv, cor), 'pertenece');
    return mk('intervalos', 1, `¿Cuál de estos números pertenece al intervalo ${ifmt(iv)}?`, sgn(cor), wr.map(sgn),
      `Solo ${sgn(cor)} cumple ${ineqfmt(iv)}. Cuidado con los extremos: solo entran si hay corchete.`,
      'Prueba cada número en la desigualdad.');
  });
  def('intervalos', 2, 'interseccion/union', () => {
    const a = ri(-9, 0), c = a + ri(1, 4), b = c + ri(1, 4), d = b + ri(1, 4);
    const l1 = R() < 0.5, h1 = R() < 0.5, l2 = R() < 0.5, h2 = R() < 0.5;
    const A = I(a, b, l1, h1), B = I(c, d, l2, h2);
    const inter = I(c, b, l2, h1), uni = I(a, d, l1, h2);
    for (let x = -20; x <= 20; x += 0.5) {
      chk(contains(inter, x) === (contains(A, x) && contains(B, x)), 'inter');
      chk(contains(uni, x) === (contains(A, x) || contains(B, x)), 'union');
    }
    const isInter = R() < 0.5, cor = isInter ? inter : uni, oth = isInter ? uni : inter;
    const w = [ifmt(oth), ifmt(I(cor.lo, cor.hi, !cor.lc, cor.hc)), ifmt(I(cor.lo, cor.hi, cor.lc, !cor.hc)), ifmt(I(cor.lo, cor.hi, !cor.lc, !cor.hc))];
    return mk('intervalos', 2, `Si A = ${ifmt(A)} y B = ${ifmt(B)}, ¿cuál es A ${isInter ? '∩' : '∪'} B?`, ifmt(cor), w,
      isInter ? `La intersección son los valores que están en A y en B a la vez: de ${c} a ${b}.` : `La unión junta todos los valores de A y de B: de ${a} a ${d}.`,
      isInter ? '∩ = lo que tienen en común.' : '∪ = todo lo que está en alguno de los dos.');
  });
  def('intervalos', 3, 'rayos', () => {
    const a = ri(-8, 2), b = a + ri(2, 8), lc = R() < 0.5, hc = R() < 0.5;
    const A = I(-Infinity, b, false, hc), B = I(a, Infinity, lc, false), cor = I(a, b, lc, hc);
    for (let x = -20; x <= 20; x += 0.5) chk(contains(cor, x) === (contains(A, x) && contains(B, x)), 'rayos');
    return mk('intervalos', 3, `Calcula A ∩ B si A = ${ifmt(A)} y B = ${ifmt(B)}`, ifmt(cor),
      ['(−∞, ∞)', ifmt(I(a, b, !lc, hc)), ifmt(I(a, b, lc, !hc)), ifmt(I(b, a, hc, lc)), '∅'],
      `Los valores que cumplen ${ineqfmt(A)} y ${ineqfmt(B)} a la vez están entre ${a} y ${b}.`, 'Dibuja ambos rayos en la recta y mira dónde se solapan.');
  });

  /* ============================================================
   * 2. FRACCIONES
   * ============================================================ */
  def('fracciones', 1, 'suma', () => {
    const a = F(ri(1, 5), ri(2, 6)), b = F(ri(1, 5), ri(2, 6)), r = fadd(a, b);
    chk(close(fval(r), fval(a) + fval(b)), 'suma');
    return mk('fracciones', 1, `Calcula:  ${fs(a)} + ${fs(b)}`, fs(r),
      [fs(F(a.n + b.n, a.d + b.d))].concat(nearFrac(r)),
      `Se busca un denominador común (${a.d * b.d / gcd(a.d, b.d)}) y se suman los numeradores. No se suman los denominadores.`, 'Usa el mínimo común múltiplo de los denominadores.');
  });
  def('fracciones', 1, 'resta', () => {
    const a = F(ri(1, 7), ri(2, 6)), b = F(ri(1, 7), ri(2, 6)), r = fsub(a, b);
    chk(close(fval(r), fval(a) - fval(b)), 'resta');
    return mk('fracciones', 1, `Calcula:  ${fs(a)} − ${fs(b)}`, fs(r),
      [fs(F(a.n - b.n, a.d - b.d || 1))].concat(nearFrac(r)),
      'Denominador común, resta de numeradores y simplifica.', 'Iguala los denominadores primero.');
  });
  def('fracciones', 1, 'producto', () => {
    const a = F(ri(1, 8), ri(2, 9)), b = F(ri(1, 8), ri(2, 9)), r = fmul(a, b);
    chk(close(fval(r), fval(a) * fval(b)), 'prod');
    return mk('fracciones', 1, `Calcula:  ${fs(a)} × ${fs(b)}`, fs(r),
      [fs(fadd(a, b)), fs(F(a.n * b.d, a.d * b.n))].concat(nearFrac(r)),
      'Multiplicar fracciones: numerador con numerador, denominador con denominador. Luego simplifica.', 'Puedes simplificar en cruz antes de multiplicar.');
  });
  def('fracciones', 2, 'division', () => {
    const a = F(ri(1, 8), ri(2, 9)), b = F(ri(1, 8), ri(2, 9)), r = fdiv(a, b);
    chk(close(fval(r), fval(a) / fval(b)), 'div');
    return mk('fracciones', 2, `Calcula:  ${fs(a)} ÷ ${fs(b)}`, fs(r),
      [fs(fmul(a, b)), fs(fdiv(b, a))].concat(nearFrac(r)),
      'Dividir es multiplicar por el inverso: (a/b) ÷ (c/d) = (a·d)/(b·c).', 'Invierte la segunda fracción y multiplica.');
  });
  def('fracciones', 1, 'simplificar', () => {
    const g = ri(2, 7), n = ri(1, 7), d = ri(2, 9);
    const f = F(n, d), N = f.n * g, D = f.d * g;
    if (f.d === 1) return null;
    return mk('fracciones', 1, `Simplifica:  ${N}/${D}`, fs(f),
      [fs(F(f.n + 1, f.d)), fs(F(f.n, f.d + 1)), fs(F(D - N, D)), fs(F(f.d, f.n))],
      `Se divide numerador y denominador entre su máximo común divisor, ${g}: ${N}/${D} = ${fs(f)}.`, 'Busca un número que divida a ambos.');
  });
  def('fracciones', 3, 'combinada', () => {
    const a = F(ri(1, 5), ri(2, 6)), b = F(ri(1, 5), ri(2, 6)), c = F(ri(1, 5), ri(2, 6));
    const r = fadd(fsub(a, b), c);
    chk(close(fval(r), fval(a) - fval(b) + fval(c)), 'comb');
    return mk('fracciones', 3, `Calcula:  ${fs(a)} − ${fs(b)} + ${fs(c)}`, fs(r),
      [fs(fsub(a, fadd(b, c)))].concat(nearFrac(r)),
      'Opera de izquierda a derecha con denominador común; cuida el signo de cada término.', 'Convierte las tres fracciones al mismo denominador.');
  });
  def('fracciones', 3, 'suma÷', () => {
    const a = F(ri(1, 4), ri(2, 5)), b = F(ri(1, 4), ri(2, 5)), c = F(ri(1, 6), ri(2, 6));
    const r = fdiv(fadd(a, b), c);
    chk(close(fval(r), (fval(a) + fval(b)) / fval(c)), 'suma÷');
    return mk('fracciones', 3, `Calcula:  (${fs(a)} + ${fs(b)}) ÷ ${fs(c)}`, fs(r),
      [fs(fmul(fadd(a, b), c)), fs(fadd(a, fdiv(b, c)))].concat(nearFrac(r)),
      'Primero se resuelve el paréntesis (suma) y después se divide multiplicando por el inverso.', 'Paréntesis primero.');
  });

  /* ============================================================
   * 3. FACTORIZACIÓN
   * ============================================================ */
  const expand2 = (p, q, r, s) => [q * s, p * s + q * r, p * r];
  const facStr = (p, q, r, s) => {
    let f1 = [p, q], f2 = [r, s];
    if (f1[0] > f2[0] || (f1[0] === f2[0] && f1[1] > f2[1])) { const t = f1; f1 = f2; f2 = t; }
    return binom(f1[0], f1[1]) + binom(f2[0], f2[1]);
  };
  const same3 = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  function facQ(level, text, tup, cands, explain, hint) {
    const [p, q, r, s] = tup, target = expand2(p, q, r, s);
    const bad = cands.filter((t) => !same3(expand2(t[0], t[1], t[2], t[3]), target));
    return mk('factorizacion', level, text, facStr(p, q, r, s), bad.map((t) => facStr(t[0], t[1], t[2], t[3])), explain, hint);
  }
  def('factorizacion', 1, 'factor comun', () => {
    const c = ri(2, 6), p = ri(1, 4), q = nz(-5, 5);
    if (gcd(p, q) !== 1) return null;
    const expr = poly([0, c * q, c * p]);
    const cor = `${cx(c, 0)}x(${lin(p, q)})`;
    return mk('factorizacion', 1, `Factoriza completamente:  ${expr}`, cor,
      [`${c}(${poly([0, q, p])})`, `x(${lin(c * p, c * q)})`, `${c}x(${lin(p, -q)})`, `${c}x(${lin(p, q)})`.replace('x(', 'x(') + '²'],
      `El factor común es ${c}x. Al sacarlo queda ${c}x(${lin(p, q)}).`, 'Saca el mayor factor común: número y variable.');
  });
  def('factorizacion', 1, 'trinomio monico', () => {
    const r = nz(-7, 7), s = nz(-7, 7);
    if (r === s) return null;
    const expr = poly([r * s, r + s, 1]);
    chk(same3(expand2(1, r, 1, s), [r * s, r + s, 1]), 'trin');
    return facQ(1, `Factoriza:  ${expr}`, [1, r, 1, s],
      [[1, -r, 1, -s], [1, r, 1, -s], [1, -r, 1, s], [1, r + s, 1, 0]],
      `Busco dos números que multipliquen ${r * s} y sumen ${r + s}: son ${r} y ${s}.`, `¿Qué dos números multiplican ${r * s} y suman ${r + s}?`);
  });
  def('factorizacion', 1, 'diferencia cuadrados', () => {
    const a = ri(1, 5), b = ri(2, 9);
    const expr = poly([-b * b, 0, a * a]);
    const cor = `${binom(a, -b)}${binom(a, b)}`.split(')(').sort().join(')(');
    const c1 = `${binom(a, -b)}${binom(a, b)}`;
    const cs = [`${binom(a, -b)}²`, `${binom(a, b)}²`, `${binom(a * a, -b)}${binom(a * a, b)}`, `${binom(a, -b * b)}${binom(a, b * b)}`];
    return mk('factorizacion', 1, `Factoriza:  ${expr}`, c1, cs,
      `Es una diferencia de cuadrados: a² − b² = (a − b)(a + b), con a = ${cx(a, 1)} y b = ${b}.`, 'a² − b² = (a − b)(a + b)');
  });
  def('factorizacion', 2, 'trinomio a>1', () => {
    const p = ri(2, 4), r = ri(1, 3), q = nz(-5, 5), s = nz(-5, 5);
    if (gcd(p, q) !== 1 || gcd(r, s) !== 1) return null;
    const t = expand2(p, q, r, s);
    if (t[1] === 0) return null;
    return facQ(2, `Factoriza:  ${poly(t)}`, [p, q, r, s],
      [[p, s, r, q], [p, -q, r, -s], [p, q, r, -s], [p, -s, r, -q], [r, q, p, s]],
      `Al expandir ${facStr(p, q, r, s)} se obtiene ${poly(t)}. Se prueban combinaciones de factores de ${t[2]} y de ${t[0]}.`,
      'Prueba expandiendo cada opción (método de tanteo o del "aspa").');
  });
  def('factorizacion', 2, 'cuadrado perfecto', () => {
    const p = ri(1, 4), q = nz(-6, 6);
    const t = expand2(p, q, p, q);
    return mk('factorizacion', 2, `Factoriza:  ${poly(t)}`, `${binom(p, q)}²`,
      [`${binom(p, -q)}²`, `${binom(p, q)}${binom(p, -q)}`, `${binom(p * p, q)}${binom(1, q)}`.replace(/^/, ''), `${binom(p, q * q)}²`],
      `Es un trinomio cuadrado perfecto: (a ${q < 0 ? '−' : '+'} b)² = a² ${q < 0 ? '−' : '+'} 2ab + b².`, 'Revisa si el primero y el último son cuadrados y el del medio es el doble producto.');
  });
  def('factorizacion', 3, 'suma/dif cubos', () => {
    const k = ri(1, 4), plus = R() < 0.5;
    const expr = poly([plus ? k ** 3 : -(k ** 3), 0, 0, 1]);
    const cor = plus ? `(x + ${k})(x² ${MINUS} ${k === 1 ? '' : k}x + ${k * k})` : `(x ${MINUS} ${k})(x² + ${k === 1 ? '' : k}x + ${k * k})`;
    const w = plus
      ? [`(x + ${k})(x² + ${k === 1 ? '' : k}x + ${k * k})`, `(x ${MINUS} ${k})(x² ${MINUS} ${k === 1 ? '' : k}x + ${k * k})`, `(x + ${k})(x² ${MINUS} ${k === 1 ? '' : k}x ${MINUS} ${k * k})`, `(x + ${k})³`]
      : [`(x ${MINUS} ${k})(x² ${MINUS} ${k === 1 ? '' : k}x + ${k * k})`, `(x + ${k})(x² + ${k === 1 ? '' : k}x + ${k * k})`, `(x ${MINUS} ${k})(x² + ${k === 1 ? '' : k}x ${MINUS} ${k * k})`, `(x ${MINUS} ${k})³`];
    return mk('factorizacion', 3, `Factoriza:  ${expr}`, cor, w,
      plus ? 'Suma de cubos: a³ + b³ = (a + b)(a² − ab + b²).' : 'Diferencia de cubos: a³ − b³ = (a − b)(a² + ab + b²).',
      plus ? 'a³ + b³ = (a + b)(a² − ab + b²)' : 'a³ − b³ = (a − b)(a² + ab + b²)');
  });
  def('factorizacion', 3, 'agrupacion', () => {
    const a = nz(-5, 5), b = nz(-5, 5);
    if (a === b || a === -b) return null;
    const expr = poly([a * b, b, a, 1]);
    const f = (u, v) => `(x ${u < 0 ? MINUS : '+'} ${Math.abs(u)})(x² ${v < 0 ? MINUS : '+'} ${Math.abs(v)})`;
    const prod = pmul([a, 1], [b, 0, 1]);
    chk(prod[0] === a * b && prod[1] === b && prod[2] === a && prod[3] === 1, 'agrup');
    return mk('factorizacion', 3, `Factoriza por agrupación:  ${expr}`, f(a, b),
      [f(b, a), f(-a, b), f(a, -b), f(-b, -a)],
      `Agrupa: x²(x ${a < 0 ? MINUS : '+'} ${Math.abs(a)}) ${b < 0 ? MINUS : '+'} ${Math.abs(b)}(x ${a < 0 ? MINUS : '+'} ${Math.abs(a)}) y saca el factor común (x ${a < 0 ? MINUS : '+'} ${Math.abs(a)}).`,
      'Agrupa los dos primeros y los dos últimos términos.');
  });
  def('factorizacion', 3, 'x⁴ - k⁴', () => {
    const k = ri(2, 3);
    return mk('factorizacion', 3, `Factoriza completamente:  x⁴ ${MINUS} ${k ** 4}`, `(x² + ${k * k})(x ${MINUS} ${k})(x + ${k})`,
      [`(x² ${MINUS} ${k * k})(x² + ${k * k})`, `(x ${MINUS} ${k})⁴`, `(x² + ${k * k})²`, `(x² ${MINUS} ${k * k})²`],
      `x⁴ − ${k ** 4} = (x² − ${k * k})(x² + ${k * k}) y además x² − ${k * k} = (x − ${k})(x + ${k}).`, 'Aplica diferencia de cuadrados dos veces.');
  });

  /* ============================================================
   * 4. OPERACIONES ENTRE POLINOMIOS
   * ============================================================ */
  def('polinomios', 1, 'suma', () => {
    const P = rp(2, -6, 6), Q = rp(2, -6, 6), S = padd(P, Q);
    if (pdeg(S) < 2) return null;
    return mk('polinomios', 1, `Suma:  (${poly(P)}) + (${poly(Q)})`, poly(S), [poly(psub(P, Q))].concat(polyVariants(S)),
      'Se suman los coeficientes de los términos semejantes (mismo grado).', 'Agrupa los términos del mismo grado.');
  });
  def('polinomios', 1, 'resta', () => {
    const P = rp(2, -6, 6), Q = rp(2, -6, 6), S = psub(P, Q);
    if (pdeg(S) < 2) return null;
    const wrongSign = padd(P, [-Q[0], Q[1], Q[2]]);
    return mk('polinomios', 1, `Resta:  (${poly(P)}) − (${poly(Q)})`, poly(S), [poly(padd(P, Q)), poly(wrongSign)].concat(polyVariants(S)),
      'El signo menos afecta a TODOS los términos del segundo polinomio.', 'Cambia el signo de cada término del segundo polinomio.');
  });
  def('polinomios', 1, 'binomios', () => {
    const a = nz(-3, 3), b = nz(-6, 6), c = nz(-3, 3), d = nz(-6, 6);
    const P = pmul([b, a], [d, c]);
    if (P[1] === 0) return null;
    chk(peval(P, 2) === (a * 2 + b) * (c * 2 + d), 'binom');
    return mk('polinomios', 1, `Multiplica:  ${binom(a, b)}${binom(c, d)}`, poly(P),
      [poly([b * d, 0, a * c]), poly([b * d, a * d - b * c, a * c]), poly([b * d, a * b + c * d, a * c]), poly([-b * d, P[1], a * c])].concat(polyVariants(P)),
      'Usa la propiedad distributiva (FOIL): primeros, externos, internos, últimos.', 'No olvides el término del medio.');
  });
  def('polinomios', 2, 'binomio x trinomio', () => {
    const a = nz(-4, 4), Q = rp(2, -4, 4), P = pmul([a, 1], Q);
    chk(peval(P, 3) === (3 + a) * peval(Q, 3), 'bt');
    return mk('polinomios', 2, `Multiplica:  ${binom(1, a)}(${poly(Q)})`, poly(P), polyVariants(P),
      'Multiplica cada término del binomio por cada término del trinomio y suma términos semejantes.', 'Distribuye término a término.');
  });
  def('polinomios', 2, 'grado', () => {
    const d1 = ri(2, 4), d2 = ri(2, 4), P = rp(d1, -3, 3), Q = rp(d2, -3, 3);
    const cor = d1 + d2;
    return mk('polinomios', 2, `¿Cuál es el grado de (${poly(P)})(${poly(Q)})?`, cor, [d1 * d2, cor + 1, cor - 1, Math.max(d1, d2)],
      `Al multiplicar polinomios los grados se suman: ${d1} + ${d2} = ${cor}.`, 'El grado del producto es la suma de los grados.');
  });
  def('polinomios', 2, 'residuo', () => {
    const P = rp(3, -5, 5), a = nz(-3, 3), r = peval(P, a);
    const d = pdivLin(P, a);
    chk(d.r === r, 'residuo');
    return mk('polinomios', 2, `¿Cuál es el residuo al dividir P(x) = ${poly(P)} entre (x ${a < 0 ? '+' : MINUS} ${Math.abs(a)})?`, sgn(r),
      [sgn(peval(P, -a)), sgn(r + 1), sgn(r - 1), sgn(-r), sgn(r + 2)],
      `Teorema del residuo: el residuo de dividir entre (x − a) es P(a). Aquí P(${a}) = ${r}.`, 'Evalúa el polinomio en x = a.');
  });
  def('polinomios', 3, 'division exacta', () => {
    const a = nz(-3, 3), Q = rp(2, -4, 4), P = pmul([-a, 1], Q);
    const d = pdivLin(P, a);
    chk(d.r === 0 && d.q.every((c, i) => c === Q[i]), 'div exacta');
    return mk('polinomios', 3, `Divide:  (${poly(P)}) ÷ (x ${a < 0 ? '+' : MINUS} ${Math.abs(a)})`, poly(Q), polyVariants(Q),
      'Con la división sintética (Ruffini) o la división larga el residuo es 0 y el cociente es el otro factor.', 'Usa división sintética con x = a.');
  });

  /* ============================================================
   * 5. PLANO CARTESIANO
   * ============================================================ */
  const pt = (x, y) => `(${sgn(x)}, ${sgn(y)})`;
  def('plano', 1, 'cuadrante', () => {
    const x = nz(-9, 9), y = nz(-9, 9);
    const c = x > 0 && y > 0 ? 0 : x < 0 && y > 0 ? 1 : x < 0 && y < 0 ? 2 : 3;
    const N = ['Cuadrante I', 'Cuadrante II', 'Cuadrante III', 'Cuadrante IV'];
    return mk('plano', 1, `¿En qué cuadrante está el punto ${pt(x, y)}?`, N[c], N.filter((_, i) => i !== c),
      'I: (+,+)   II: (−,+)   III: (−,−)   IV: (+,−).', 'Mira el signo de x y el de y.');
  });
  def('plano', 1, 'reflexion', () => {
    const x = nz(-8, 8), y = nz(-8, 8), t = ri(0, 2);
    const N = [['eje x', pt(x, -y)], ['eje y', pt(-x, y)], ['origen', pt(-x, -y)]];
    const all = [pt(x, -y), pt(-x, y), pt(-x, -y), pt(y, x), pt(x, y)];
    return mk('plano', 1, `¿Cuál es la reflexión del punto ${pt(x, y)} respecto al ${N[t][0]}?`, N[t][1], all.filter((s) => s !== N[t][1]),
      t === 0 ? 'Reflejar en el eje x cambia el signo de y.' : t === 1 ? 'Reflejar en el eje y cambia el signo de x.' : 'Reflejar en el origen cambia el signo de ambas coordenadas.', 'Piensa en qué coordenada cambia de signo.');
  });
  def('plano', 2, 'punto medio', () => {
    const x1 = ri(-8, 8), y1 = ri(-8, 8), x2 = x1 + 2 * ri(-5, 5), y2 = y1 + 2 * ri(-5, 5);
    if (x1 === x2 && y1 === y2) return null;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return mk('plano', 2, `¿Cuál es el punto medio entre ${pt(x1, y1)} y ${pt(x2, y2)}?`, pt(mx, my),
      [pt(x1 + x2, y1 + y2), pt(mx, -my), pt(-mx, my), pt(Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2), pt(mx + 1, my)],
      `Punto medio = ((x₁+x₂)/2, (y₁+y₂)/2) = ${pt(mx, my)}.`, 'Promedia las x y promedia las y.');
  });
  def('plano', 2, 'distancia', () => {
    const T = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [12, 5, 13], [9, 12, 15]];
    const [dx, dy, d] = pick(T);
    const x1 = ri(-6, 6), y1 = ri(-6, 6), x2 = x1 + dx * pick([-1, 1]), y2 = y1 + dy * pick([-1, 1]);
    chk(close(Math.hypot(x2 - x1, y2 - y1), d), 'dist');
    return mk('plano', 2, `Calcula la distancia entre ${pt(x1, y1)} y ${pt(x2, y2)}`, d, [dx + dy, d + 1, d - 1, dx * dy, d + 2],
      `d = √[(${x2 - x1})² + (${y2 - y1})²] = √${dx * dx + dy * dy} = ${d}.`, 'd = √[(x₂−x₁)² + (y₂−y₁)²]');
  });
  def('plano', 2, 'pendiente', () => {
    const x1 = ri(-6, 6), y1 = ri(-6, 6), dx = nz(-5, 5), dy = ri(-6, 6), x2 = x1 + dx, y2 = y1 + dy;
    const m = F(dy, dx);
    return mk('plano', 2, `¿Cuál es la pendiente de la recta que pasa por ${pt(x1, y1)} y ${pt(x2, y2)}?`, fs(m),
      [fs(F(-dy, dx)), dy === 0 ? null : fs(F(dx, dy)), fs(F(dy, -dx)) === fs(m) ? null : fs(F(dy, -dx)), fs(F(dy + 1, dx)), fs(F(dy, dx + 1))].concat(nearFrac(m)),
      `m = (y₂ − y₁)/(x₂ − x₁) = ${sgn(dy)}/${sgn(dx)} = ${fs(m)}.`, 'm = cambio en y / cambio en x.');
  });
  def('plano', 3, 'ecuacion recta', () => {
    const m = nz(-4, 4), b = nz(-6, 6), x1 = ri(-3, 3), x2 = x1 + nz(1, 3);
    const y1 = m * x1 + b, y2 = m * x2 + b;
    const eq = (mm, bb) => `y = ${poly([bb, mm])}`;
    const cor = eq(m, b);
    return mk('plano', 3, `¿Cuál es la ecuación de la recta que pasa por ${pt(x1, y1)} y ${pt(x2, y2)}?`, cor,
      [eq(-m, b), eq(m, -b), eq(b, m), eq(m, b + 1), eq(-m, -b)],
      `La pendiente es ${m} y al reemplazar un punto se obtiene b = ${b}. Entonces y = ${poly([b, m])}.`, 'Halla m y luego despeja b con un punto.');
  });

  /* ============================================================
   * 6. DESIGUALDADES
   * ============================================================ */
  const SY = ['<', '≤', '>', '≥'];
  const flipSy = (s) => ({ '<': '>', '≤': '≥', '>': '<', '≥': '≤' })[s];
  const negSy = (s) => ({ '<': '≥', '≤': '>', '>': '≤', '≥': '<' })[s];
  const strictOf = (s) => ({ '<': '≤', '≤': '<', '>': '≥', '≥': '>' })[s];
  def('desigualdades', 1, 'lineal', () => {
    const a = nz(-5, 5), k = ri(-6, 6), b = nz(-8, 8), s = pick(SY), c = a * k + b;
    const res = a > 0 ? s : flipSy(s);
    const cor = `x ${res} ${sgn(k)}`;
    const w = [`x ${flipSy(res)} ${sgn(k)}`, `x ${res} ${sgn(-k)}`, `x ${strictOf(res)} ${sgn(k)}`, `x ${flipSy(res)} ${sgn(-k)}`];
    // verificación numérica
    const t = k + (res === '<' || res === '≤' ? -1 : 1);
    const holds = (x) => { const v = a * x + b; return s === '<' ? v < c : s === '≤' ? v <= c : s === '>' ? v > c : v >= c; };
    chk(holds(t), 'lineal ok'); chk(!holds(k + (res === '<' || res === '≤' ? 1 : -1)), 'lineal ko');
    return mk('desigualdades', 1, `Resuelve:  ${lin(a, b)} ${s} ${sgn(c)}`, cor, w,
      `Se despeja x. ${a < 0 ? 'Como dividimos entre un número negativo, la desigualdad cambia de sentido. ' : ''}Solución: ${cor}.`,
      'Al multiplicar o dividir por un negativo, se invierte el signo de la desigualdad.');
  });
  def('desigualdades', 2, 'compuesta', () => {
    const m = pick([2, 3, 4]), c = nz(-7, 7), lo = ri(-5, 2), hi = lo + ri(2, 6), lc = R() < 0.5, hc = R() < 0.5;
    const L = m * lo + c, H = m * hi + c;
    const iv = I(lo, hi, lc, hc);
    const txt = `${sgn(L)} ${lc ? '≤' : '<'} ${lin(m, c)} ${hc ? '≤' : '<'} ${sgn(H)}`;
    return mk('desigualdades', 2, `Resuelve:  ${txt}`, ifmt(iv),
      [ifmt(I(lo, hi, !lc, hc)), ifmt(I(lo, hi, lc, !hc)), ifmt(I(L, H, lc, hc)), ifmt(I(lo + 1, hi, lc, hc)), ifmt(I(lo, hi + 1, lc, hc))],
      `Resta ${sgn(c)} en los tres miembros y divide entre ${m}: ${ineqfmt(iv)}.`, 'Aísla x en el centro operando en los tres miembros.');
  });
  def('desigualdades', 2, 'valor absoluto', () => {
    const a = ri(-5, 5), b = ri(2, 6), lt = R() < 0.5, eq = R() < 0.5;
    const inner = `x ${a === 0 ? '' : a > 0 ? MINUS + ' ' + a : '+ ' + Math.abs(a)}`.trim();
    const p = a - b, q = a + b;
    const inside = I(p, q, eq, eq);
    const U = (l, r) => `(−∞, ${sgn(p)}${l ? ']' : ')'} ∪ ${r ? '[' : '('}${sgn(q)}, ∞)`;
    const cor = lt ? ifmt(inside) : U(eq, eq);
    const wr = lt ? [U(eq, eq), ifmt(I(p, q, !eq, !eq)), ifmt(I(-b, b, eq, eq)), ifmt(I(a - b, a + b + 1, eq, eq))]
      : [ifmt(inside), U(!eq, !eq), `(−∞, ${sgn(-b)}${eq ? ']' : ')'} ∪ ${eq ? '[' : '('}${sgn(b)}, ∞)`, ifmt(I(p, q, !eq, !eq))];
    // verificación numérica
    for (let x = -14; x <= 14; x += 0.5) {
      const v = Math.abs(x - a), ok = lt ? (eq ? v <= b : v < b) : (eq ? v >= b : v > b);
      const inter = lt ? contains(inside, x) : (x < p || x > q || (eq && (x === p || x === q)));
      chk(ok === inter, 'abs');
    }
    return mk('desigualdades', 2, `Resuelve:  |${inner}| ${lt ? (eq ? '≤' : '<') : (eq ? '≥' : '>')} ${b}`, cor, wr,
      lt ? `|u| < b significa −b < u < b: ${p} ${eq ? '≤' : '<'} x ${eq ? '≤' : '<'} ${q}.` : `|u| > b significa u < −b  o  u > b: x < ${p} o x > ${q}.`,
      lt ? '|u| < b  ⇒  −b < u < b' : '|u| > b  ⇒  u < −b  o  u > b');
  });
  def('desigualdades', 3, 'cuadratica', () => {
    const r = ri(-6, 2), s = r + ri(2, 6), s2 = pick(['<', '>', '≤', '≥']);
    const expand = R() < 0.5;
    const P = pmul([-r, 1], [-s, 1]);
    const lhs = expand ? poly(P) : `(x ${r < 0 ? '+' : MINUS} ${Math.abs(r)})(x ${s < 0 ? '+' : MINUS} ${Math.abs(s)})`;
    const cl = s2 === '≤' || s2 === '≥';
    const between = s2 === '<' || s2 === '≤';
    const U = (l) => `(−∞, ${sgn(r)}${l ? ']' : ')'} ∪ ${l ? '[' : '('}${sgn(s)}, ∞)`;
    const cor = between ? ifmt(I(r, s, cl, cl)) : U(cl);
    const wr = between ? [U(cl), ifmt(I(r, s, !cl, !cl)), U(!cl)] : [ifmt(I(r, s, cl, cl)), U(!cl), ifmt(I(r, s, !cl, !cl))];
    for (let x = -14; x <= 14; x += 0.5) {
      const v = peval(P, x), ok = s2 === '<' ? v < 0 : s2 === '>' ? v > 0 : s2 === '≤' ? v <= 0 : v >= 0;
      const inSol = between ? contains(I(r, s, cl, cl), x) : (x < r || x > s || (cl && (x === r || x === s)));
      chk(ok === inSol, 'cuad');
    }
    return mk('desigualdades', 3, `Resuelve:  ${lhs} ${s2} 0`, cor, wr,
      `Las raíces son ${r} y ${s}. ${between ? 'La parábola abre hacia arriba y es negativa entre las raíces.' : 'La parábola abre hacia arriba y es positiva fuera de las raíces.'}`,
      'Halla las raíces y analiza el signo en cada zona de la recta.');
  });

  /* ============================================================
   * 7. FUNCIONES Y OPERACIONES ENTRE FUNCIONES
   * ============================================================ */
  const fnS = (n, cs) => `${n}(x) = ${poly(cs)}`;
  def('funciones', 1, 'evaluar', () => {
    const f = rp(2, -4, 4), a = nz(-4, 4), r = peval(f, a);
    return mk('funciones', 1, `Si ${fnS('f', f)}, ¿cuánto vale f(${sgn(a)})?`, sgn(r),
      [sgn(peval(f, -a)), sgn(r + 1), sgn(r - 1), sgn(f[0] + f[1] * a + f[2] * a), sgn(f[0] + f[1] * a + f[2] * 2 * a)],
      `Sustituye x = ${sgn(a)}: f(${sgn(a)}) = ${sgn(r)}. Cuidado con los paréntesis al elevar números negativos.`, 'Reemplaza x por el valor, con paréntesis.');
  });
  def('funciones', 1, 'es funcion', () => {
    const xs = shuffle([-3, -2, -1, 0, 1, 2, 3, 4]).slice(0, 4), ys = () => ri(-5, 5);
    const setS = (ps) => '{' + ps.map(([x, y]) => pt(x, y)).join(', ') + '}';
    const good = xs.map((x) => [x, ys()]);
    const bad = () => { const b = xs.map((x) => [x, ys()]); const i = ri(0, 3); const j = (i + 1 + ri(0, 2)) % 4; b[j] = [b[i][0], b[i][1] + nz(-3, 3)]; return b; };
    return mk('funciones', 1, '¿Cuál de estos conjuntos de pares ordenados es una función?', setS(good), [setS(bad()), setS(bad()), setS(bad())],
      'En una función cada x tiene UN solo valor de y. Los otros conjuntos repiten una x con dos y distintas.', 'Busca si alguna x se repite con distinta y.');
  });
  def('funciones', 2, 'dominio', () => {
    const a = nz(-7, 7), t = ri(0, 3);
    const A = sgn(a);
    const S = [
      [`f(x) = √(x ${a < 0 ? '+' : MINUS} ${Math.abs(a)})`, `[${A}, ∞)`],
      [`f(x) = 1 / (x ${a < 0 ? '+' : MINUS} ${Math.abs(a)})`, `ℝ ∖ {${A}}`],
      [`f(x) = √(${A} ${MINUS} x)`, `(−∞, ${A}]`],
      [`f(x) = 1 / √(x ${a < 0 ? '+' : MINUS} ${Math.abs(a)})`, `(${A}, ∞)`],
    ];
    const [fn, cor] = S[t];
    const wr = [`[${A}, ∞)`, `ℝ ∖ {${A}}`, `(−∞, ${A}]`, `(${A}, ∞)`, `(−∞, ${A})`, `ℝ ∖ {${sgn(-a)}}`, `[${sgn(-a)}, ∞)`].filter((s) => s !== cor);
    const ex = ['El radicando debe ser ≥ 0: x ≥ ' + A + '.', 'El denominador no puede ser 0: x ≠ ' + A + '.', 'El radicando debe ser ≥ 0: ' + A + ' − x ≥ 0 ⇒ x ≤ ' + A + '.', 'Radicando > 0 (está en el denominador): x > ' + A + '.'];
    return mk('funciones', 2, `¿Cuál es el dominio de ${fn}?`, cor, wr, ex[t], 'Una raíz pide radicando ≥ 0; un denominador no puede ser 0.');
  });
  def('funciones', 2, 'operacion numerica', () => {
    const f = rp(2, -3, 3), g = rp(1, -5, 5), a = nz(-3, 3), op = ri(0, 3);
    const fa = peval(f, a), ga = peval(g, a);
    if (op === 3 && (ga === 0 || fa % ga !== 0)) return null;
    const N = ['(f + g)', '(f − g)', '(f · g)', '(f / g)'];
    const val = [fa + ga, fa - ga, fa * ga, fa / ga][op];
    const wr = [fa + ga, fa - ga, fa * ga, ga === 0 ? null : Math.round(fa / ga), ga - fa, fa, ga, val + 1, val - 1, -val];
    return mk('funciones', 2, `Si ${fnS('f', f)} y ${fnS('g', g)}, calcula ${N[op]}(${sgn(a)})`, sgn(val), wr.filter((v) => v !== null && v !== val).map(sgn),
      `f(${sgn(a)}) = ${sgn(fa)} y g(${sgn(a)}) = ${sgn(ga)}. Entonces ${N[op]}(${sgn(a)}) = ${sgn(val)}.`, 'Calcula f(a) y g(a) por separado y luego opera.');
  });
  def('funciones', 3, 'operacion simbolica', () => {
    const f = rp(2, -4, 4), g = rp(2, -4, 4), op = ri(0, 1);
    const R2 = op === 0 ? padd(f, g) : psub(f, g);
    if (pdeg(R2) < 1) return null;
    chk(peval(R2, 2) === (op === 0 ? peval(f, 2) + peval(g, 2) : peval(f, 2) - peval(g, 2)), 'op sim');
    const alt = op === 0 ? psub(f, g) : padd(f, g);
    return mk('funciones', 3, `Si ${fnS('f', f)} y ${fnS('g', g)}, halla (f ${op === 0 ? '+' : MINUS} g)(x)`, poly(R2), [poly(alt)].concat(polyVariants(R2)),
      `(f ${op === 0 ? '+' : '−'} g)(x) = f(x) ${op === 0 ? '+' : '−'} g(x). Combina términos semejantes.`, 'Opera término a término.');
  });
  def('funciones', 3, 'rango', () => {
    const k = nz(-6, 6), t = ri(0, 3);
    const K = sgn(k);
    const S = [
      [`f(x) = x² ${k < 0 ? MINUS : '+'} ${Math.abs(k)}`, `[${K}, ∞)`, 'x² ≥ 0, así que f(x) ≥ ' + K + '.'],
      [`f(x) = ${MINUS}x² ${k < 0 ? MINUS : '+'} ${Math.abs(k)}`, `(−∞, ${K}]`, '−x² ≤ 0, así que f(x) ≤ ' + K + '.'],
      [`f(x) = |x| ${k < 0 ? MINUS : '+'} ${Math.abs(k)}`, `[${K}, ∞)`, '|x| ≥ 0, así que f(x) ≥ ' + K + '.'],
      [`f(x) = √x ${k < 0 ? MINUS : '+'} ${Math.abs(k)}`, `[${K}, ∞)`, '√x ≥ 0, así que f(x) ≥ ' + K + '.'],
    ];
    const [fn, cor, ex] = S[t];
    const wr = [`(−∞, ${K}]`, `[${K}, ∞)`, `(${K}, ∞)`, `[${sgn(-k)}, ∞)`, '(−∞, ∞)', `(−∞, ${sgn(-k)}]`].filter((s) => s !== cor);
    return mk('funciones', 3, `¿Cuál es el rango de ${fn}?`, cor, wr, ex, 'Piensa en el menor (o mayor) valor que puede tomar la parte variable.');
  });

  /* ============================================================
   * 8. DESPLAZAMIENTOS EN EL PLANO
   * ============================================================ */
  const un = (n) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
  def('desplazamientos', 1, 'f(x±h) ó f(x)±k', () => {
    const n = ri(1, 6), t = ri(0, 3);
    const F1 = [[`f(x ${MINUS} ${n})`, 'a la derecha'], [`f(x + ${n})`, 'a la izquierda'], [`f(x) + ${n}`, 'hacia arriba'], [`f(x) ${MINUS} ${n}`, 'hacia abajo']];
    const opts = ['a la derecha', 'a la izquierda', 'hacia arriba', 'hacia abajo'];
    const cor = `${n} ${n === 1 ? 'unidad' : 'unidades'} ${F1[t][1]}`;
    return mk('desplazamientos', 1, `La gráfica de y = ${F1[t][0]} se obtiene desplazando la de y = f(x)…`, cor,
      opts.filter((o) => o !== F1[t][1]).map((o) => `${n} ${n === 1 ? 'unidad' : 'unidades'} ${o}`),
      t < 2 ? 'Lo que se suma o resta DENTRO de la función mueve en horizontal, y al revés de lo que parece: x − h mueve a la derecha.' : 'Lo que se suma o resta FUERA de la función mueve en vertical: +k sube, −k baja.',
      'Dentro del paréntesis: horizontal (al revés). Fuera: vertical.');
  });
  def('desplazamientos', 2, 'vertice', () => {
    const h = nz(-6, 6), k = nz(-6, 6);
    const eq = `y = (x ${h < 0 ? '+' : MINUS} ${Math.abs(h)})² ${k < 0 ? MINUS : '+'} ${Math.abs(k)}`;
    return mk('desplazamientos', 2, `¿Cuál es el vértice de la parábola  ${eq}?`, pt(h, k), [pt(-h, k), pt(h, -k), pt(-h, -k), pt(k, h)],
      'Forma y = (x − h)² + k: el vértice es (h, k).', 'Compara con y = (x − h)² + k.');
  });
  def('desplazamientos', 1, 'mover punto', () => {
    const x = ri(-6, 6), y = ri(-6, 6), dx = nz(-5, 5), dy = nz(-5, 5);
    const txt = `${un(Math.abs(dx))} ${dx > 0 ? 'a la derecha' : 'a la izquierda'} y ${un(Math.abs(dy))} ${dy > 0 ? 'hacia arriba' : 'hacia abajo'}`;
    return mk('desplazamientos', 1, `Se desplaza el punto ${pt(x, y)} ${txt}. ¿Cuál es su nueva posición?`, pt(x + dx, y + dy),
      [pt(x - dx, y + dy), pt(x + dx, y - dy), pt(x - dx, y - dy), pt(x + dy, y + dx)],
      `Derecha suma a x, izquierda resta a x; arriba suma a y, abajo resta a y. Resultado: ${pt(x + dx, y + dy)}.`, 'Derecha/izquierda cambia x; arriba/abajo cambia y.');
  });
  def('desplazamientos', 2, 'reflexion y estiramiento', () => {
    const c = pick([2, 3, 4]), t = ri(0, 3);
    const S = [
      [`y = ${MINUS}f(x)`, 'Reflexión respecto al eje x'],
      [`y = f(${MINUS}x)`, 'Reflexión respecto al eje y'],
      [`y = ${c}f(x)`, `Estiramiento vertical (factor ${c})`],
      [`y = f(${c}x)`, `Compresión horizontal (factor 1/${c})`],
    ];
    const all = ['Reflexión respecto al eje x', 'Reflexión respecto al eje y', `Estiramiento vertical (factor ${c})`, `Compresión horizontal (factor 1/${c})`];
    return mk('desplazamientos', 2, `¿Qué transformación aplica ${S[t][0]} a la gráfica de y = f(x)?`, S[t][1], all.filter((s) => s !== S[t][1]),
      ['−f(x) cambia el signo de las y: gira sobre el eje x.', 'f(−x) cambia el signo de las x: gira sobre el eje y.', 'c·f(x) multiplica las alturas por c.', 'f(cx) con c > 1 comprime horizontalmente por 1/c.'][t],
      'Fuera de f: vertical. Dentro de f: horizontal.');
  });
  def('desplazamientos', 2, 'combinado', () => {
    const h = nz(-6, 6), k = nz(-6, 6);
    const expr = `y = f(x ${h < 0 ? '+' : MINUS} ${Math.abs(h)}) ${k < 0 ? MINUS : '+'} ${Math.abs(k)}`;
    const hd = (v) => `${un(Math.abs(v))} ${v > 0 ? 'a la derecha' : 'a la izquierda'}`;
    const vd = (v) => `${un(Math.abs(v))} ${v > 0 ? 'hacia arriba' : 'hacia abajo'}`;
    return mk('desplazamientos', 2, `¿Qué desplazamiento produce ${expr}?`, `${hd(h)} y ${vd(k)}`,
      [`${hd(-h)} y ${vd(k)}`, `${hd(h)} y ${vd(-k)}`, `${hd(-h)} y ${vd(-k)}`],
      `x − h desplaza h unidades ${h > 0 ? 'a la derecha' : 'a la izquierda'}; +k desplaza k unidades ${k > 0 ? 'hacia arriba' : 'hacia abajo'}.`, 'Dentro: al revés. Fuera: tal cual.');
  });
  def('desplazamientos', 3, 'ecuacion desplazada', () => {
    const h = nz(-5, 5), k = nz(-5, 5);
    const hd = `${un(Math.abs(h))} ${h > 0 ? 'a la derecha' : 'a la izquierda'}`;
    const vd = `${un(Math.abs(k))} ${k > 0 ? 'hacia arriba' : 'hacia abajo'}`;
    const eq = (hh, kk) => `y = (x ${hh < 0 ? '+' : MINUS} ${Math.abs(hh)})² ${kk < 0 ? MINUS : '+'} ${Math.abs(kk)}`;
    return mk('desplazamientos', 3, `Se desplaza la parábola  y = x²  ${hd} y ${vd}. ¿Cuál es su nueva ecuación?`, eq(h, k),
      [eq(-h, k), eq(h, -k), eq(-h, -k)],
      `Desplazar h a la derecha: x → x − h. Desplazar k hacia arriba: sumar k. Resultado: ${eq(h, k)}.`, 'Escribe y = (x − h)² + k.');
  });

  /* ============================================================
   * 9. TABULACIONES
   * ============================================================ */
  const tbl = (xs, ys) => ({ head: ['x'].concat(xs.map(sgn)), rows: [['y'].concat(ys.map((y) => (y === null ? '?' : sgn(y))))] });
  def('tabulaciones', 1, 'patron lineal', () => {
    const m = nz(-5, 5), b = ri(-6, 6), xs = [-2, -1, 0, 1, 2];
    const ys = xs.map((x) => m * x + b), hide = ri(2, 4);
    const shown = ys.map((y, i) => (i === hide ? null : y));
    const cor = ys[hide];
    return mk('tabulaciones', 1, `Completa la tabla: ¿qué valor va en lugar de “?” (f es lineal)?`, sgn(cor), [sgn(cor + m), sgn(cor - m), sgn(cor + 1), sgn(-cor), sgn(cor + 2 * m)],
      `Cada vez que x sube 1, y cambia ${sgn(m)}. Entonces el valor faltante es ${sgn(cor)}.`, 'Mira cuánto cambia y cuando x aumenta 1.', { table: tbl(xs, shown) });
  });
  def('tabulaciones', 1, 'tabular funcion', () => {
    const f = rp(1, -5, 5);
    if (f[0] === 0) return null;
    const xs = [-2, -1, 0, 1, 2], ys = xs.map((x) => peval(f, x));
    const fmtL = (a) => a.map(sgn).join(', ');
    const alt1 = xs.map((x) => peval([-f[0], f[1]], x)), alt2 = xs.map((x) => peval([f[0], -f[1]], x)), alt3 = xs.map((x) => peval(f, -x));
    return mk('tabulaciones', 1, `Tabula ${fnS('f', f)} para x = −2, −1, 0, 1, 2. ¿Cuáles son los valores de y?`, fmtL(ys),
      [fmtL(alt1), fmtL(alt2), fmtL(alt3), fmtL(ys.map((y) => y + 1))],
      `Evalúa f en cada valor: ${xs.map((x, i) => `f(${sgn(x)}) = ${sgn(ys[i])}`).join(';  ')}.`, 'Sustituye cada x en la fórmula.');
  });
  def('tabulaciones', 2, 'identificar lineal', () => {
    const m = nz(-4, 4), b = nz(-6, 6), xs = [0, 1, 2, 3], ys = xs.map((x) => m * x + b);
    const eq = (mm, bb) => `f(x) = ${poly([bb, mm])}`;
    return mk('tabulaciones', 2, '¿Qué función genera esta tabla?', eq(m, b), [eq(-m, b), eq(m, -b), eq(b, m), eq(m, b + m)],
      `Con x = 0, y = ${sgn(b)}, entonces b = ${sgn(b)}. La pendiente es el cambio de y: ${sgn(m)}.`, 'El valor en x = 0 es la ordenada al origen.', { table: tbl(xs, ys) });
  });
  def('tabulaciones', 2, 'identificar cuadratica', () => {
    const k = nz(-6, 6), s = R() < 0.5 ? 1 : -1, xs = [-2, -1, 0, 1, 2], ys = xs.map((x) => s * x * x + k);
    const eq = (ss, kk) => `f(x) = ${poly([kk, 0, ss])}`;
    return mk('tabulaciones', 2, '¿Qué función genera esta tabla?', eq(s, k), [eq(-s, k), eq(s, -k), eq(-s, -k), `f(x) = ${poly([k, s])}`],
      `f(0) = ${sgn(k)} y los valores son simétricos (f(−x) = f(x)): es de la forma ${s === 1 ? 'x²' : '−x²'} + k.`, 'Observa la simetría respecto a x = 0.', { table: tbl(xs, ys) });
  });
  def('tabulaciones', 2, 'buscar x', () => {
    const m = nz(-4, 4), b = nz(-7, 7), x0 = ri(-5, 5), y0 = m * x0 + b;
    return mk('tabulaciones', 2, `Si ${fnS('f', [b, m])}, ¿para qué valor de x se cumple f(x) = ${sgn(y0)}?`, sgn(x0), [sgn(-x0), sgn(x0 + 1), sgn(x0 - 1), sgn(y0), sgn(Math.round((y0 + b) / m))],
      `Resuelve ${lin(m, b)} = ${sgn(y0)} y obtienes x = ${sgn(x0)}.`, 'Iguala la fórmula al valor dado y despeja x.');
  });
  def('tabulaciones', 3, 'tabla cuadratica cambio', () => {
    const f = [nz(-5, 5), nz(-3, 3), 1], xs = [-2, -1, 0, 1, 2], ys = xs.map((x) => peval(f, x));
    const d1 = ys.slice(1).map((y, i) => y - ys[i]);
    const cor = ys[4], sh = ys.map((y, i) => (i === 4 ? null : y));
    return mk('tabulaciones', 3, `f es cuadrática, con f(x) = ${poly(f)}. ¿Qué valor va en “?” (x = 2)?`, sgn(cor), [sgn(cor + 2), sgn(cor - 2), sgn(ys[3] + d1[2]), sgn(f[0] + 2 * f[1]), sgn(cor + 1)],
      `f(2) = ${poly(f).replace(/x/g, '(2)')} = ${sgn(cor)}.`, 'Sustituye x = 2 en la fórmula.', { table: tbl(xs, sh) });
  });

  /* ============================================================
   * 10. POTENCIACIÓN
   * ============================================================ */
  def('potenciacion', 1, 'producto misma base', () => {
    const m = ri(2, 6), n = ri(2, 6);
    return mk('potenciacion', 1, `Simplifica:  x${sup(m)} · x${sup(n)}`, xp(m + n), [xp(m * n), xp(Math.abs(m - n) || 1), xp(m + n + 1), xp(m + n - 1)],
      `Misma base: se suman los exponentes. xᵐ · xⁿ = xᵐ⁺ⁿ = ${xp(m + n)}.`, 'Suma los exponentes.');
  });
  def('potenciacion', 1, 'potencia de potencia', () => {
    const m = ri(2, 5), n = ri(2, 4);
    return mk('potenciacion', 1, `Simplifica:  (x${sup(m)})${sup(n)}`, xp(m * n), [xp(m + n), xp(m ** n), xp(m * n + 1), xp(m * n - 1)],
      `Potencia de una potencia: se multiplican los exponentes. (xᵐ)ⁿ = xᵐⁿ = ${xp(m * n)}.`, 'Multiplica los exponentes.');
  });
  def('potenciacion', 1, 'cociente', () => {
    const n = ri(2, 4), m = n + ri(1, 5);
    return mk('potenciacion', 1, `Simplifica:  x${sup(m)} / x${sup(n)}`, xp(m - n), [xp(m + n), xp(n - m), xp(m - n + 1), xp(m - n - 1), xp(m / n === Math.round(m / n) ? m / n : m * n)],
      `Misma base: se restan los exponentes. xᵐ / xⁿ = xᵐ⁻ⁿ = ${xp(m - n)}.`, 'Resta el exponente del denominador al del numerador.');
  });
  def('potenciacion', 1, 'signos', () => {
    const a = ri(2, 5), e = pick([2, 3, 4]), t = ri(0, 1);
    if (t === 1 && e % 2 === 1) return null;
    const txt = t === 0 ? `(${MINUS}${a})${sup(e)}` : `${MINUS}${a}${sup(e)}`;
    const val = t === 0 ? (-a) ** e : -(a ** e);
    const cor = sgn(val);
    chk(val === (t === 0 ? Math.pow(-a, e) : -Math.pow(a, e)), 'signos');
    return mk('potenciacion', 1, `Calcula:  ${txt}`, cor, [sgn(-val), sgn(a * e), sgn(a ** (e - 1)), sgn(-a * e)],
      t === 0 ? `El paréntesis eleva TODO el −${a}: (−${a})^${e} = ${cor}.` : `Sin paréntesis, el exponente solo afecta a ${a}: −(${a}^${e}) = ${cor}.`, '¿El exponente afecta al signo menos?');
  });
  def('potenciacion', 2, 'exponente cero/negativo', () => {
    const t = ri(0, 3), a = ri(2, 5);
    if (t === 0) { const a2 = a; return mk('potenciacion', 2, `Calcula:  ${a2}${sup(-2)}`, `1/${a2 * a2}`, [`${MINUS}${a2 * a2}`, `${MINUS}${2 * a2}`, `${a2 * a2}`, `1/${2 * a2}`], `a⁻ⁿ = 1/aⁿ: ${a2}⁻² = 1/${a2 * a2}.`, 'Un exponente negativo invierte la base.'); }
    if (t === 1) { const n = ri(2, 3); return mk('potenciacion', 2, `Calcula:  ${a}${sup(-n)}`, `1/${a ** n}`, [`${MINUS}${a ** n}`, `${MINUS}${a * n}`, `${a ** n}`, `1/${a * n}`], `a⁻ⁿ = 1/aⁿ: ${a}⁻${n} = 1/${a ** n}.`, 'Un exponente negativo invierte la base.'); }
    if (t === 2) { const b = a + ri(1, 2); if (gcd(a, b) !== 1) return null; return mk('potenciacion', 2, `Calcula:  (${a}/${b})${sup(-2)}`, `${b * b}/${a * a}`, [`${a * a}/${b * b}`, `${MINUS}${a * a}/${b * b}`, `${b}/${a}`, `${MINUS}${b * b}/${a * a}`], `Para una fracción, el exponente negativo invierte la fracción: (a/b)⁻² = (b/a)² = ${b * b}/${a * a}.`, 'Invierte la fracción y elimina el signo del exponente.'); }
    const ex = [[`(${MINUS}${a})⁰`, '1'], [`${MINUS}${a}⁰`, `${MINUS}1`], [`${a}x⁰`, String(a)], [`(${a}x)⁰`, '1']][ri(0, 3)];
    return mk('potenciacion', 2, `Calcula (x ≠ 0):  ${ex[0]}`, ex[1], ['1', `${MINUS}1`, '0', String(a), `${MINUS}${a}`].filter((s) => s !== ex[1]),
      'Todo número (≠ 0) elevado a la 0 es 1, pero solo lo que está dentro del paréntesis: −a⁰ = −1 y a·x⁰ = a.', '¿Qué parte lleva el exponente 0?');
  });
  def('potenciacion', 2, '(ax^m)^n', () => {
    const a = ri(2, 4), m = ri(1, 3), n = ri(2, 3);
    return mk('potenciacion', 2, `Simplifica:  (${a}${xp(m)})${sup(n)}`, `${a ** n}${xp(m * n)}`, [`${a * n}${xp(m * n)}`, `${a ** n}${xp(m + n)}`, `${a}${xp(m * n)}`, `${a * n}${xp(m + n)}`],
      `El exponente afecta al coeficiente Y a la variable: (${a}${xp(m)})${sup(n)} = ${a}${sup(n)}·${xp(m * n)} = ${a ** n}${xp(m * n)}.`, 'Eleva el número y multiplica el exponente de x.');
  });
  def('potenciacion', 3, 'combinado', () => {
    const a = ri(2, 3), m = ri(1, 3), b = ri(2, 4), n = ri(1, 3);
    const cor = `${a * a * b}${xp(2 * m + n)}`;
    return mk('potenciacion', 3, `Simplifica:  (${a}${xp(m)})² · ${b}${xp(n)}`, cor, [`${a * 2 * b}${xp(2 * m + n)}`, `${a * a * b}${xp(2 * m * n)}`, `${a * a + b}${xp(2 * m + n)}`, `${a * a * b}${xp(m + n)}`],
      `(${a}${xp(m)})² = ${a * a}${xp(2 * m)}. Luego ${a * a}${xp(2 * m)} · ${b}${xp(n)} = ${cor}.`, 'Primero eleva al cuadrado; luego multiplica coeficientes y suma exponentes.');
  });
  def('potenciacion', 3, 'cociente compuesto', () => {
    const m = ri(3, 6), n = ri(2, 5), k = ri(1, m + n - 1);
    const e = m + n - k;
    return mk('potenciacion', 3, `Simplifica:  (x${sup(m)} · x${sup(n)}) / ${xp(k)}`, xp(e), [xp(m + n + k), xp(m * n - k), xp(m + n), xp(e + 1), xp(e - 1)],
      `Numerador: ${xp(m + n)}. Después ${xp(m + n)} / ${xp(k)} = ${xp(e)}.`, 'Primero el numerador (suma), luego el cociente (resta).');
  });

  /* ============================================================
   * 11. COMPOSICIÓN DE FUNCIONES
   * ============================================================ */
  def('composicion', 1, '(f∘g)(a)', () => {
    const f = rp(1, -4, 4), g = rp(2, -3, 3), a = ri(-3, 3);
    const ga = peval(g, a), r = peval(f, ga);
    chk(r === f[0] + f[1] * ga, 'comp');
    return mk('composicion', 1, `Si ${fnS('f', f)} y ${fnS('g', g)}, calcula (f ∘ g)(${sgn(a)})`, sgn(r),
      [sgn(peval(g, peval(f, a))), sgn(peval(f, a) * ga), sgn(peval(f, a) + ga), sgn(r + 1), sgn(-r)],
      `(f∘g)(${sgn(a)}) = f(g(${sgn(a)})) = f(${sgn(ga)}) = ${sgn(r)}.`, 'Primero g, luego f: f(g(a)).');
  });
  def('composicion', 1, '(g∘f)(a)', () => {
    const f = rp(1, -4, 4), g = rp(2, -3, 3), a = ri(-3, 3);
    const fa = peval(f, a), r = peval(g, fa);
    return mk('composicion', 1, `Si ${fnS('f', f)} y ${fnS('g', g)}, calcula (g ∘ f)(${sgn(a)})`, sgn(r),
      [sgn(peval(f, peval(g, a))), sgn(fa * peval(g, a)), sgn(fa + peval(g, a)), sgn(r + 1), sgn(-r)],
      `(g∘f)(${sgn(a)}) = g(f(${sgn(a)})) = g(${sgn(fa)}) = ${sgn(r)}.`, 'Primero f, luego g: g(f(a)).');
  });
  def('composicion', 2, '(f∘g)(x) lineal', () => {
    const a = nz(-4, 4), b = nz(-5, 5), c = nz(-3, 3), d = nz(-5, 5);
    const R2 = [a * d + b, a * c];
    chk(peval(R2, 2) === a * (c * 2 + d) + b, 'comp lin');
    return mk('composicion', 2, `Si f(x) = ${lin(a, b)} y g(x) = ${lin(c, d)}, halla (f ∘ g)(x)`, poly(R2),
      [poly([c * b + d, c * a]), poly([b + d, a * c]), poly([a * d + b, a + c]), poly([a * c + b * d, 0].slice(0, 1).concat([a * c])), poly([a * d - b, a * c])],
      `(f∘g)(x) = f(${lin(c, d)}) = ${a}(${lin(c, d)}) + ${sgn(b)} = ${poly(R2)}.`, 'Sustituye g(x) dentro de f.');
  });
  def('composicion', 2, '(f∘g)(x) cuadratica', () => {
    const k = nz(-5, 5), m = nz(-4, 4);
    const R2 = pmul([m, 1], [m, 1]); R2[0] += k;
    const cor = poly(R2);
    chk(peval(R2, 3) === (3 + m) ** 2 + k, 'comp cuad');
    return mk('composicion', 2, `Si f(x) = x² ${k < 0 ? MINUS : '+'} ${Math.abs(k)} y g(x) = x ${m < 0 ? MINUS : '+'} ${Math.abs(m)}, halla (f ∘ g)(x)`, cor,
      [poly([k + m, 0, 1]), poly([m * m + k, 0, 1]), poly([m + k * k, 0, 1]), poly([k, 2 * m, 1]).replace(/^/, ''), poly(padd(pmul([k, 0, 1], [1]), [m]))],
      `f(g(x)) = (${poly([m, 1])})² ${k < 0 ? '−' : '+'} ${Math.abs(k)} = ${cor}. No olvides el término del medio al elevar el binomio.`, 'Recuerda (x + m)² = x² + 2mx + m².');
  });
  def('composicion', 3, 'descomponer', () => {
    const k = ri(1, 6), a = ri(2, 4), b = nz(-5, 5), t = ri(0, 2);
    const ff = (o, i) => `f(x) = ${o},  g(x) = ${i}`;
    let h, cor, w;
    if (t === 0) { h = `h(x) = √(x² + ${k})`; cor = ff('√x', `x² + ${k}`); w = [ff(`x² + ${k}`, '√x'), ff('√x', 'x²'), ff('x + ' + k, '√(x²)'), ff('√(x + ' + k + ')', 'x²')]; }
    else if (t === 1) { h = `h(x) = (${lin(a, b)})³`; cor = ff('x³', lin(a, b)); w = [ff(lin(a, b), 'x³'), ff('x³', 'x'), ff(`${a}x³`, `x ${b < 0 ? MINUS : '+'} ${Math.abs(b)}`), ff('(x)³', lin(a, 0))]; }
    else { h = `h(x) = 1 / (x ${b < 0 ? MINUS : '+'} ${Math.abs(b)})`; cor = ff('1/x', `x ${b < 0 ? MINUS : '+'} ${Math.abs(b)}`); w = [ff(`x ${b < 0 ? MINUS : '+'} ${Math.abs(b)}`, '1/x'), ff('1', `x ${b < 0 ? MINUS : '+'} ${Math.abs(b)}`), ff('1/x', 'x'), ff(`1/(x ${b < 0 ? MINUS : '+'} ${Math.abs(b)})`, 'x')]; }
    return mk('composicion', 3, `Descompón ${h} como (f ∘ g)(x). ¿Cuál es la descomposición correcta?`, cor, w,
      'La función interior g es lo que se calcula primero (dentro del paréntesis o de la raíz); f es lo que se hace después.', 'Pregunta: ¿qué operación se hace primero con x?');
  });

  /* ============================================================
   * 12. EXPONENTES Y RADICALES
   * ============================================================ */
  const SF = [2, 3, 5, 6, 7, 10];
  def('radicales', 1, 'simplificar raiz', () => {
    const k = ri(2, 7), m = pick(SF);
    const cor = `${k}√${m}`;
    const val = k * Math.sqrt(m);
    chk(close(val, Math.sqrt(k * k * m)), 'rad');
    const cand = [[`${m}√${k}`, m * Math.sqrt(k)], [`${k * k}√${m}`, k * k * Math.sqrt(m)], [`${k + 1}√${m}`, (k + 1) * Math.sqrt(m)], [`${k}√${m + 1}`, k * Math.sqrt(m + 1)], [`${k * m}`, k * m]];
    return mk('radicales', 1, `Simplifica:  √${k * k * m}`, cor, cand.filter((c) => !close(c[1], val)).map((c) => c[0]),
      `√${k * k * m} = √(${k * k}·${m}) = ${k}√${m}, porque ${k * k} es un cuadrado perfecto.`, 'Busca el mayor cuadrado perfecto que divida al número.');
  });
  def('radicales', 2, 'exponente racional', () => {
    const T = [[8, 2, 3, 4], [27, 2, 3, 9], [16, 3, 4, 8], [4, 3, 2, 8], [25, 3, 2, 125], [64, 2, 3, 16], [9, 3, 2, 27], [81, 3, 4, 27], [32, 3, 5, 8]];
    const [b, p, q, r] = pick(T);
    chk(close(Math.pow(b, p / q), r), 'rac');
    return mk('radicales', 2, `Calcula:  ${b}^(${p}/${q})`, r, [b * p / q === Math.round(b * p / q) ? Math.round(b * p / q) : b * p, Math.round(Math.pow(b, 1 / q)), r * 2, r + 1, Math.pow(b, p) / q === Math.round(Math.pow(b, p) / q) ? Math.pow(b, p) / q : b + p],
      `b^(p/q) = (ⁿ√b)ᵖ: la raíz de índice ${q} de ${b} es ${Math.round(Math.pow(b, 1 / q))} y ${Math.round(Math.pow(b, 1 / q))}^${p} = ${r}.`, 'Primero saca la raíz (denominador) y luego eleva (numerador).');
  });
  def('radicales', 2, 'racionalizar', () => {
    const b = pick([2, 3, 5, 7]), c = pick([b, 2 * b, 3 * b, 4 * b]);
    const k = c / b, cor = k === 1 ? `√${b}` : `${k}√${b}`;
    const v = c / Math.sqrt(b);
    chk(close(k * Math.sqrt(b), v), 'racionalizar');
    const cand = [[`${c}√${b}`, c * Math.sqrt(b)], [`${c}/${b}`, c / b], [`${k}√${b}/${b}`.replace(/^1√/, '√'), k * Math.sqrt(b) / b], [`${c + b}√${b}`, (c + b) * Math.sqrt(b)], [`${k}`, k]];
    return mk('radicales', 2, `Racionaliza el denominador:  ${c}/√${b}`, cor, cand.filter((x) => !close(x[1], v)).map((x) => x[0]),
      `Multiplica arriba y abajo por √${b}: ${c}√${b}/${b} = ${cor}.`, 'Multiplica numerador y denominador por la raíz.');
  });
  def('radicales', 2, 'suma de radicales', () => {
    const a = ri(2, 6), b = ri(2, 6), m = pick([2, 3, 5, 7]), plus = R() < 0.5;
    if (!plus && a === b) return null;
    const v = plus ? a + b : a - b, rc = (c) => (c === 1 ? '' : c === -1 ? MINUS : sgn(c)), cor = `${rc(v)}√${m}`;
    const val = v * Math.sqrt(m);
    const cand = [[`${a + b}√${m + m}`, (a + b) * Math.sqrt(2 * m)], [`${a * b}√${m}`, a * b * Math.sqrt(m)], [`${a + b}√${m * m}`, (a + b) * m], [`${rc(-v)}√${m}`, -val], [`${rc(v)}√${m * 2}`, v * Math.sqrt(2 * m)]];
    return mk('radicales', 2, `Simplifica:  ${a}√${m} ${plus ? '+' : MINUS} ${b}√${m}`, cor, cand.filter((x) => !close(x[1], val)).map((x) => x[0]),
      `Son radicales semejantes (misma raíz): se suman o restan los coeficientes: ${sgn(v)}√${m}.`, 'Trátalo como términos semejantes: 3x + 2x.');
  });
  def('radicales', 2, 'producto de raices', () => {
    const P = [[2, 8, 4], [3, 12, 6], [6, 24, 12], [2, 18, 6], [5, 20, 10], [3, 27, 9], [12, 3, 6], [2, 50, 10]];
    const [a, b, r] = pick(P);
    chk(close(Math.sqrt(a) * Math.sqrt(b), r), 'prodraiz');
    return mk('radicales', 2, `Calcula:  √${a} · √${b}`, r, [a + b, a * b, r + 1, r * 2, Math.sqrt(a * b) === r ? r - 1 : r - 1],
      `√a · √b = √(ab): √${a * b} = ${r}.`, 'Multiplica lo de dentro de las raíces.');
  });
  def('radicales', 3, 'radical a potencia', () => {
    const t = ri(0, 2), p = ri(2, 5);
    if (t === 0) { const n = pick([2, 3, 4]); const k = ri(1, 3); const cor = xp(k); return mk('radicales', 3, `Simplifica (x > 0):  ${n === 2 ? '√' : n === 3 ? '∛' : '∜'}(x${sup(n * k)})`, cor, [xp(n * k), xp(n * k + n), xp(n + k), xp(k + 1), `x^(${n}/${k})`].filter((s) => s !== cor), `La raíz de índice ${n} divide el exponente entre ${n}: ${n * k}/${n} = ${k}.`, 'Divide el exponente entre el índice.'); }
    const n = pick([2, 3, 4]), rt = n === 2 ? '√' : n === 3 ? '∛' : '∜';
    const q = p === n ? p + 1 : p;
    const cor = `x^(${q}/${n})`;
    return mk('radicales', 3, `Escribe con exponente racional (x > 0):  ${rt}(x${sup(q)})`, cor, [`x^(${n}/${q})`, `x^(${q}/${n + 1})`, xp(q * n), xp(q + n), `x^(1/${q * n})`],
      `ⁿ√(xᵐ) = x^(m/n): el exponente queda arriba y el índice abajo → x^(${q}/${n}).`, 'La raíz es el denominador del exponente.');
  });

  /* ============================================================
   * 13. LOGARITMOS Y FUNCIONES INVERSAS
   * ============================================================ */
  const logTxt = (b, x) => `log${sub(b)} ${x}`;
  def('logaritmos', 1, 'log directo', () => {
    const b = pick([2, 3, 4, 5, 10]), k = ri(1, b === 10 ? 3 : 4), N = b ** k;
    return mk('logaritmos', 1, `Calcula:  ${logTxt(b, N)}`, k, [k + 1, k - 1, N / b === Math.round(N / b) ? N / b : k + 2, b, -k].filter((v) => v !== k),
      `log${sub(b)} ${N} = ${k} porque ${b}${sup(k)} = ${N}.`, `¿A qué exponente hay que elevar ${b} para obtener ${N}?`);
  });
  def('logaritmos', 1, 'forma exponencial', () => {
    const b = pick([2, 3, 5]), k = ri(2, 4), N = b ** k;
    const cor = `${b}${sup(k)} = ${N}`;
    return mk('logaritmos', 1, `¿A qué igualdad equivale  ${logTxt(b, N)} = ${k}?`, cor, [`${k}${sup(b)} = ${N}`, `${N}${sup(k)} = ${b}`, `${b}${sup(N)} = ${k}`],
      'log_b x = y equivale a b^y = x: la base sigue siendo la base y el resultado del log es el exponente.', 'La base del log es la base de la potencia.');
  });
  def('logaritmos', 2, 'leyes', () => {
    const b = pick([2, 3, 5]), u = ri(1, 4), v = ri(1, 3), t = ri(0, 2);
    let txt, val;
    if (t === 0) { txt = `${logTxt(b, b ** u)} + ${logTxt(b, b ** v)}`; val = u + v; }
    else if (t === 1) { txt = `${logTxt(b, b ** (u + v))} ${MINUS} ${logTxt(b, b ** v)}`; val = u; }
    else { txt = `${v + 1}·${logTxt(b, b ** u)}`; val = (v + 1) * u; }
    return mk('logaritmos', 2, `Calcula:  ${txt}`, val, [val + 1, val - 1, t === 0 ? u * v : t === 1 ? u + v : u + v + 1, val + 2, val * 2].filter((x) => x !== val),
      t === 0 ? `log a + log b = log(ab). Aquí log${sub(b)} ${b ** (u + v)} = ${val}.` : t === 1 ? `log a − log b = log(a/b). Aquí log${sub(b)} ${b ** u} = ${val}.` : `n·log a = log aⁿ. Aquí ${v + 1}·${u} = ${val}.`,
      'Leyes: log(ab) = log a + log b; log(a/b) = log a − log b; log aⁿ = n·log a.');
  });
  def('logaritmos', 2, 'ecuacion exponencial', () => {
    const b = pick([2, 3, 5]), k = ri(-3, 4), shift = ri(0, 3), N = k >= 0 ? String(b ** k) : `1/${b ** -k}`;
    const x = k - shift;
    const lhs = shift === 0 ? `${b}${sup('x')}` : `${b}${sup('x+' + shift)}`;
    return mk('logaritmos', 2, `Resuelve:  ${lhs} = ${N}`, sgn(x), [sgn(-x), sgn(x + 1), sgn(x - 1), sgn(k + shift), sgn(k)].filter((s) => s !== sgn(x)),
      `Se escribe ${N} como ${b}${sup(k)} y se igualan exponentes: ${shift === 0 ? 'x' : 'x + ' + shift} = ${k}, así x = ${sgn(x)}.`, 'Escribe ambos lados con la misma base.');
  });
  def('logaritmos', 1, 'ln y e', () => {
    const k = ri(2, 9), t = ri(0, 1);
    if (t === 0) return mk('logaritmos', 1, `Simplifica:  ln(e${sup(k)})`, k, [k + 1, k - 1, 'e' + sup(k), k * k, 1].filter((v) => v !== k), 'ln y e son inversas: ln(e^x) = x.', 'ln es el logaritmo de base e.');
    return mk('logaritmos', 1, `Simplifica:  e^(ln ${k})`, k, [k + 1, k - 1, `ln ${k}`, k * k, 1].filter((v) => v !== k), 'e^x y ln x son inversas: e^(ln x) = x.', 'Una función y su inversa se cancelan.');
  });
  def('logaritmos', 2, 'inversa lineal', () => {
    const a = ri(2, 5), b = nz(-8, 8);
    const s = (x, y) => `(x ${x < 0 ? MINUS : '+'} ${Math.abs(x)}) / ${y}`;
    const cor = s(-b, a);
    const cfn = (x) => (x - b) / a;
    chk(close(a * cfn(5) + b, 5), 'inv lin');
    return mkf('logaritmos', 2, `Halla la inversa de  f(x) = ${lin(a, b)}`, cor, cfn,
      [[s(b, a), (x) => (x + b) / a], [`x/${a} ${b < 0 ? '+' : MINUS} ${Math.abs(b)}`, (x) => x / a - b], [`${a}(x ${b < 0 ? '+' : MINUS} ${Math.abs(b)})`, (x) => a * (x - b)], [`(${sgn(b)} ${MINUS} x) / ${a}`, (x) => (b - x) / a], [`${a}x ${b < 0 ? '+' : MINUS} ${Math.abs(b)}`, (x) => a * x - b]],
      'Para hallar f⁻¹: escribe y = f(x), intercambia x e y, y despeja y.', 'Intercambia x por y y despeja.');
  });
  def('logaritmos', 3, 'inversa varios', () => {
    const T = [
      [`f(x) = x³ + ${ri(1, 6)}`, null], [`f(x) = 2ˣ`, null], [`f(x) = ln x`, null], [`f(x) = √x  (x ≥ 0)`, null],
    ];
    const t = ri(0, 3), k = ri(1, 6);
    if (t === 0) return mk('logaritmos', 3, `Halla la inversa de  f(x) = x³ + ${k}`, `∛(x ${MINUS} ${k})`, [`∛(x) + ${k}`, `∛(x + ${k})`, `(x ${MINUS} ${k})³`, `1/(x³ + ${k})`], 'Intercambia x e y: x = y³ + k ⇒ y = ∛(x − k).', 'Despeja y después de intercambiar.');
    if (t === 1) return mk('logaritmos', 3, 'La inversa de f(x) = 2ˣ es…', 'f⁻¹(x) = log₂ x', ['f⁻¹(x) = x²', 'f⁻¹(x) = 1/2ˣ', 'f⁻¹(x) = 2 log x', 'f⁻¹(x) = ln 2ˣ'].concat(['f⁻¹(x) = log x / 2']), 'La inversa de bˣ es log_b x.', 'La exponencial y el logaritmo son inversos.');
    if (t === 2) return mk('logaritmos', 3, 'La inversa de f(x) = ln x es…', 'f⁻¹(x) = eˣ', ['f⁻¹(x) = 1/ln x', 'f⁻¹(x) = x²', 'f⁻¹(x) = log x', 'f⁻¹(x) = ln(1/x)'], 'ln x y eˣ son inversas.', 'ln es log de base e.');
    return mk('logaritmos', 3, 'La inversa de f(x) = √x (x ≥ 0) es…', 'f⁻¹(x) = x²  (x ≥ 0)', ['f⁻¹(x) = √x', 'f⁻¹(x) = 1/√x', 'f⁻¹(x) = x²  (x ≤ 0)', 'f⁻¹(x) = ∛x'], 'Elevar al cuadrado deshace la raíz cuadrada (para x ≥ 0).', 'Deshaz la raíz elevando al cuadrado.');
  });
  def('logaritmos', 2, 'valor de inversa', () => {
    const a = nz(-4, 4), b = nz(-6, 6), x0 = ri(-4, 5), y0 = a * x0 + b;
    return mk('logaritmos', 2, `Si f(x) = ${lin(a, b)}, ¿cuánto vale f⁻¹(${sgn(y0)})?`, sgn(x0), [sgn(a * y0 + b), sgn(-x0), sgn(x0 + 1), sgn(Math.round(y0 / a)), sgn(x0 - 1)].filter((s) => s !== sgn(x0)),
      `f⁻¹(${sgn(y0)}) es el x tal que f(x) = ${sgn(y0)}. Como f(${sgn(x0)}) = ${sgn(y0)}, f⁻¹(${sgn(y0)}) = ${sgn(x0)}.`, 'Busca la x que produce ese valor.');
  });
  def('logaritmos', 3, 'uno a uno', () => {
    const k = ri(1, 5), a = ri(1, 4), inj = pick([[`f(x) = x³ + ${k}`], [`f(x) = ${a + 1}x ${MINUS} ${k}`], [`f(x) = ${MINUS}x³`]])[0];
    return mk('logaritmos', 3, '¿Cuál de estas funciones es uno a uno (tiene inversa en todo ℝ)?', inj, [`f(x) = x² + ${k}`, `f(x) = |x| ${MINUS} ${k}`, `f(x) = (x ${MINUS} ${a})²`],
      'Una función es uno a uno si cada valor de y viene de un único x. Las que tienen forma de “U” o “V” fallan la prueba de la recta horizontal.', 'Prueba de la recta horizontal.');
  });

  /* ============================================================
   * 14. FUNCIONES TRIGONOMÉTRICAS
   * ============================================================ */
  const EXV = [[0, '0'], [0.5, '1/2'], [Math.SQRT1_2, '√2/2'], [Math.sqrt(3) / 2, '√3/2'], [1, '1'], [Math.sqrt(3) / 3, '√3/3'], [Math.sqrt(3), '√3']];
  function exact(v) {
    if (!isFinite(v) || Math.abs(v) > 1e6) return null;
    const a = Math.abs(v);
    for (const [n, s] of EXV) if (Math.abs(a - n) < 1e-9) return v < -1e-12 ? MINUS + s : s;
    throw new Error('valor no exacto ' + v);
  }
  const POOL = ['0', '1/2', '√2/2', '√3/2', '1', '√3/3', '√3', `${MINUS}1/2`, `${MINUS}√2/2`, `${MINUS}√3/2`, `${MINUS}1`, `${MINUS}√3/3`, `${MINUS}√3`];
  const rad = (deg) => {
    if (deg === 0) return '0';
    const g = gcd(deg, 180), p = deg / g, q = 180 / g;
    return (p === 1 ? '' : String(p)) + 'π' + (q === 1 ? '' : '/' + q);
  };
  const DEGS_SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
  const TR = ['sen', 'cos', 'tan'], TF = [Math.sin, Math.cos, Math.tan];
  const refDeg = (d) => { const r = d % 360; return r <= 90 ? r : r <= 180 ? 180 - r : r <= 270 ? r - 180 : 360 - r; };
  function trigQ(level, degs, useRad) {
    const d = pick(degs), t = ri(0, 2);
    if (t === 2 && (d % 180 === 90)) return null;
    const v = TF[t](d * Math.PI / 180), cor = exact(v);
    if (cor === null) return null;
    const ang = useRad ? `(${rad(d)})` : ` ${d}°`;
    const wr = shuffle(POOL.filter((s) => s !== cor));
    // trampa: mismo valor pero signo opuesto y otra función
    const others = [0, 1, 2].filter((i) => i !== t).map((i) => exact(TF[i](d * Math.PI / 180))).filter((s) => s !== null && s !== cor);
    const cand = [cor.startsWith(MINUS) ? cor.slice(1) : MINUS + cor].concat(others, wr);
    return mk('trigonometria', level, `Calcula:  ${TR[t]}${ang}`, cor, cand.filter((s) => s !== cor && s !== '−0'),
      `El ángulo de referencia de ${d}° es ${refDeg(d)}° y el signo depende del cuadrante. ${TR[t]}(${d}°) = ${cor}.`,
      'Usa la circunferencia unitaria: (cos θ, sen θ).');
  }
  def('trigonometria', 1, 'valores basicos grados', () => trigQ(1, [0, 30, 45, 60, 90], false));
  def('trigonometria', 2, 'valores basicos radianes', () => trigQ(2, [0, 30, 45, 60, 90], true));
  def('trigonometria', 3, 'valores todos cuadrantes', () => trigQ(3, DEGS_SPECIAL, R() < 0.5));
  def('trigonometria', 1, 'triangulo rectangulo', () => {
    const T = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [7, 24, 25]];
    const [a, b, c] = pick(T), t = ri(0, 2);
    const cor = [F(a, c), F(b, c), F(a, b)][t];
    const N = ['sen θ', 'cos θ', 'tan θ'];
    const cand = [F(a, c), F(b, c), F(a, b), F(b, a), F(c, a), F(c, b)].map(fs).filter((s) => s !== fs(cor));
    return mk('trigonometria', 1, `En un triángulo rectángulo el cateto opuesto a θ mide ${a}, el adyacente mide ${b} y la hipotenusa ${c}. ¿Cuánto vale ${N[t]}?`, fs(cor), cand,
      ['sen θ = opuesto / hipotenusa', 'cos θ = adyacente / hipotenusa', 'tan θ = opuesto / adyacente'][t] + ` = ${fs(cor)}.`, 'SOH-CAH-TOA.');
  });
  def('trigonometria', 1, 'grados a radianes', () => {
    const d = pick([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]);
    const p = d / gcd(d, 180), q = 180 / gcd(d, 180);
    const mkr = (P, Q) => (P === 0 || gcd(P, Q) > 1 ? null :  (P === 1 ? '' : P) + 'π' + (Q === 1 ? '' : '/' + Q));
    const cor = rad(d);
    const cand = [mkr(p, q + 1), mkr(p + 1, q), mkr(q, p), mkr(p, q * 2), mkr(p * 2, q), mkr(p + 2, q), mkr(p, q + 2), mkr(p, Math.max(1, q - 1))];
    return mk('trigonometria', 1, `Convierte ${d}° a radianes`, cor, cand, `Multiplica por π/180: ${d}·π/180 = ${cor}.`, '180° = π radianes.');
  });
  def('trigonometria', 2, 'radianes a grados', () => {
    const d = pick([30, 45, 60, 90, 120, 135, 150, 210, 225, 240, 270, 300, 315, 330]);
    return mk('trigonometria', 2, `Convierte ${rad(d)} radianes a grados`, `${d}°`, [`${d + 30}°`, `${d - 30}°`, `${360 - d}°`, `${d * 2}°`, `${180 - d}°`, `${d + 15}°`].filter((s) => s !== `${d}°` && parseInt(s) > 0),
      `Multiplica por 180/π: ${rad(d)} = ${d}°.`, 'π radianes = 180°.');
  });
  def('trigonometria', 2, 'cuadrante por signos', () => {
    const Q = [['sen θ > 0 y cos θ > 0', 'Cuadrante I'], ['sen θ > 0 y cos θ < 0', 'Cuadrante II'], ['sen θ < 0 y cos θ < 0', 'Cuadrante III'], ['sen θ < 0 y cos θ > 0', 'Cuadrante IV'], ['tan θ > 0 y sen θ < 0', 'Cuadrante III'], ['tan θ < 0 y cos θ > 0', 'Cuadrante IV']];
    const [c, a] = pick(Q), N = ['Cuadrante I', 'Cuadrante II', 'Cuadrante III', 'Cuadrante IV'];
    return mk('trigonometria', 2, `¿En qué cuadrante está θ si ${c}?`, a, N.filter((s) => s !== a),
      'I: todas positivas. II: solo sen. III: solo tan. IV: solo cos (“Todos Sen Tan Cos”).', 'Recuerda: Todos, Seno, Tangente, Coseno.');
  });
  def('trigonometria', 2, 'angulo de referencia', () => {
    const d = pick([120, 135, 150, 210, 225, 240, 300, 315, 330]);
    const ref = d < 180 ? 180 - d : d < 270 ? d - 180 : 360 - d;
    return mk('trigonometria', 2, `¿Cuál es el ángulo de referencia de ${d}°?`, `${ref}°`, [`${d - ref}°`, `${90 - ref}°`, `${360 - d}°`, `${d - 90}°`, `${ref + 30}°`, `${ref + 15}°`].filter((s) => s !== `${ref}°` && parseInt(s) > 0),
      `El ángulo de referencia es el ángulo agudo con el eje x: ${ref}°.`, 'Es el ángulo agudo que forma con el eje horizontal.');
  });
  def('trigonometria', 3, 'identidad pitagorica', () => {
    const T = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];
    const [a, b, c] = pick(T), s = pick(['sen', 'cos']), quad = ri(0, 3);
    // s = a/c en cuadrante; se pide la otra
    const other = s === 'sen' ? 'cos' : 'sen';
    // signo de la otra función en el cuadrante
    const sinPos = quad === 0 || quad === 1, cosPos = quad === 0 || quad === 3;
    const sgnOther = other === 'cos' ? (cosPos ? 1 : -1) : (sinPos ? 1 : -1);
    const sgnGiven = s === 'sen' ? (sinPos ? 1 : -1) : (cosPos ? 1 : -1);
    const N = ['I', 'II', 'III', 'IV'];
    const given = F(sgnGiven * a, c), ans = F(sgnOther * b, c);
    chk(close(fval(given) ** 2 + fval(ans) ** 2, 1), 'pitagorica');
    return mk('trigonometria', 3, `Si ${s} θ = ${fs(given)} y θ está en el cuadrante ${N[quad]}, ¿cuánto vale ${other} θ?`, fs(ans),
      [fs(F(-ans.n, ans.d)), fs(F(b * b, c * c)), fs(F(a, b)), fs(F(c - a, c)), fs(F(b, a))].filter((x) => x !== fs(ans)),
      `Con sen²θ + cos²θ = 1: ${other}²θ = 1 − (${fs(given)})² = ${b * b}/${c * c}, entonces |${other} θ| = ${b}/${c}. El signo depende del cuadrante ${N[quad]}.`,
      'Usa sen²θ + cos²θ = 1 y revisa el signo por cuadrante.');
  });
  def('trigonometria', 3, 'amplitud y periodo', () => {
    const A = ri(2, 5), B = pick([1, 2, 3, 4]), fn = pick(['sen', 'cos']);
    const per = (b) => (b === 1 ? '2π' : b === 2 ? 'π' : `2π/${b}`);
    const perOf = (b) => per(b);
    const cor = `amplitud ${A}, período ${per(B)}`;
    const cand = [`amplitud ${B}, período ${per(A)}`, `amplitud ${A}, período ${B === 1 ? '2π' : '2π·' + B}`, `amplitud ${A}, período ${per(B + 1)}`, `amplitud ${A * B}, período ${per(B)}`, `amplitud ${A + 1}, período ${per(B)}`];
    return mk('trigonometria', 3, `¿Cuáles son la amplitud y el período de y = ${A} ${fn}(${B === 1 ? '' : B}x)?`, cor, cand.filter((s) => s !== cor),
      `En y = A·${fn}(Bx): amplitud |A| = ${A} y período 2π/|B| = ${per(B)}.`, 'Amplitud = |A| ; período = 2π / |B|.');
  });

  /* ============================================================
   * API pública
   * ============================================================ */
  const TOPICS = ['intervalos', 'fracciones', 'factorizacion', 'polinomios', 'plano', 'desigualdades', 'funciones', 'desplazamientos', 'tabulaciones', 'potenciacion', 'composicion', 'radicales', 'logaritmos', 'trigonometria'];
  const recent = [];

  function generate(topic, level, opts) {
    opts = opts || {};
    level = Math.max(1, Math.min(3, level || 1));
    const gens = G[topic];
    if (!gens) throw new Error('tema desconocido: ' + topic);
    let pool = gens.filter((g) => g.lvl <= level);
    const exact = pool.filter((g) => g.lvl === level);
    for (let attempt = 0; attempt < 300; attempt++) {
      const g = exact.length && R() < 0.6 ? pick(exact) : pick(pool);
      let q = null;
      try { q = g.fn(); } catch (e) { if (opts.strict) throw new Error(`[${topic}/${g.name}] ${e.message}`); q = null; }
      if (!q) continue;
      if (!opts.noRecent && recent.includes(q.text) && attempt < 40) continue;
      q.gen = g.name;
      recent.push(q.text); if (recent.length > 14) recent.shift();
      return q;
    }
    throw new Error('no se pudo generar pregunta para ' + topic);
  }
  function generateAny(level, opts) { return generate(pick(TOPICS), level, opts); }

  const API = { TOPICS, generate, generateAny, _gens: G, _setRandom: (fn) => { R = fn; }, _fmt: { poly, ifmt, fs, rad, exact } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.DuiXQ = API;
})(typeof window !== 'undefined' ? window : globalThis);
