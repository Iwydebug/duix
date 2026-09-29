/* DuiX — guardado, perfiles, economía, logros y misiones */
(function (root) {
  'use strict';
  const D = root.DuiXData || (typeof require !== 'undefined' ? require('./data.js') : null);
  const KEY_P = 'duix.v1.profiles', KEY_S = 'duix.v1.settings';
  const MAX_PROFILES = 4;

  /* almacenamiento seguro (si localStorage falla, usa memoria) */
  const mem = {};
  const ls = {
    get(k) { try { const v = root.localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : null) : v; } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { mem[k] = v; try { root.localStorage.setItem(k, v); } catch (e) { /* sin persistencia */ } },
    del(k) { delete mem[k]; try { root.localStorage.removeItem(k); } catch (e) { /* nada */ } },
  };
  let persistent = true;
  try { root.localStorage.setItem('duix.t', '1'); root.localStorage.removeItem('duix.t'); } catch (e) { persistent = false; }

  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const xpNeed = (lv) => 80 + 40 * (lv - 1);
  const LEVEL_ITEMS = { 3: 'emb-inf', 5: 'suit-lima', 7: 'mask-gafas', 8: 'pet-slime', 10: 'cape-larga-azul', 12: 'am-lupa', 15: 'wing-hada', 20: 'wp-arcoiris' };
  const STARTERS = D.ITEMS.filter((i) => i.price === 0 && !i.unlock).map((i) => i.id);
  const DEFAULT_LOOK = { gender: 'm', skin: 1, hair: 'hair-corto', hairColor: 0, suit: 'suit-rojo', mask: 'mask-antifaz', wings: 'wing-none', cape: 'cape-corta', pet: 'pet-none', emblem: 'emb-star', weapon: 'wp-rayo', amulet: 'am-none' };

  const DEFAULT_SETTINGS = { sfx: true, music: true, musicStyle: 'arcade', moreTime: false, volume: 0.7, crt: false, reduceMotion: false, big: false };

  let db = { list: [], active: null };
  let settings = Object.assign({}, DEFAULT_SETTINGS);
  const listeners = [];
  const notify = (ev, data) => listeners.forEach((f) => { try { f(ev, data); } catch (e) { /* ignora */ } });

  function load() {
    try { const raw = ls.get(KEY_P); if (raw) { const p = JSON.parse(raw); if (p && Array.isArray(p.list)) db = p; } } catch (e) { /* datos dañados: empezar de cero */ }
    try { const raw = ls.get(KEY_S); if (raw) settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)); } catch (e) { /* ok */ }
    db.list.forEach(migrate);
    if (db.active && !db.list.find((p) => p.id === db.active)) db.active = null;
  }
  function migrate(p) {
    // compatibilidad con guardados anteriores
    const L = p.look = Object.assign({}, DEFAULT_LOOK, p.look || {});
    if (L.hairStyle) { if (D.ITEM_BY_ID['hair-' + L.hairStyle]) L.hair = 'hair-' + L.hairStyle; delete L.hairStyle; }
    if (L.cape === 'cape-alas') { L.cape = 'cape-corta'; L.wings = 'wing-murcielago'; if (p.owned && !p.owned.includes('wing-murcielago')) p.owned.push('wing-murcielago'); }
    if (p.owned) p.owned = p.owned.map((id) => (id === 'cape-alas' ? 'wing-murcielago' : id)).filter((id, i, a) => D.ITEM_BY_ID[id] && a.indexOf(id) === i);
    Object.keys(L).forEach((k) => { if (k !== 'skin' && k !== 'hairColor' && k !== 'gender' && typeof L[k] === 'string' && !D.ITEM_BY_ID[L[k]]) L[k] = DEFAULT_LOOK[k]; });
    p.stats = Object.assign({ correct: 0, answered: 0, bestStreak: 0, wins: 0, perfect: 0, hardWins: 0, purchases: 0, boss: 0, duinityBest: 0, battles: 0 }, p.stats || {});
    p.progress = p.progress || {}; p.owned = p.owned || STARTERS.slice(); p.achDone = p.achDone || {};
    p.mistakes = p.mistakes || []; p.daily = p.daily || { date: '', missions: [], prog: {}, done: {}, ids: [] };
    p.coins = p.coins || 0; p.xp = p.xp || 0; p.level = p.level || 1; p.sigma = p.sigma || 0;
    p.wheel = Object.assign({ day: '', freeUsed: false, extra: 0, qDay: '', qCount: 0 }, p.wheel || {});
    STARTERS.forEach((s) => { if (!p.owned.includes(s)) p.owned.push(s); });
  }
  function save() { ls.set(KEY_P, JSON.stringify(db)); }
  function saveSettings() { ls.set(KEY_S, JSON.stringify(settings)); }

  const profile = () => db.list.find((p) => p.id === db.active) || null;

  function newProfile(name, look) {
    if (db.list.length >= MAX_PROFILES) return null;
    const p = { v: 1, id: uid(), name: (name || 'Héroe').trim().slice(0, 12) || 'Héroe', created: Date.now(), look: Object.assign({}, DEFAULT_LOOK, look || {}) };
    migrate(p); p.coins = 30;
    db.list.push(p); db.active = p.id; save(); notify('profile');
    return p;
  }
  function switchTo(id) { if (db.list.find((p) => p.id === id)) { db.active = id; save(); notify('profile'); } }
  function removeProfile(id) { db.list = db.list.filter((p) => p.id !== id); if (db.active === id) db.active = null; save(); notify('profile'); }
  function logout() { db.active = null; save(); notify('profile'); }

  /* ---------- objetos ---------- */
  const has = (id) => { const p = profile(); return !!p && p.owned.includes(id); };
  function grantItem(id) { const p = profile(); if (p && !p.owned.includes(id)) { p.owned.push(id); return true; } return false; }
  function buy(id) {
    const p = profile(), it = D.ITEM_BY_ID[id];
    if (!p || !it) return { ok: false, err: 'no existe' };
    if (p.owned.includes(id)) return { ok: false, err: 'ya lo tienes' };
    if (it.unlock) return { ok: false, err: 'Se consigue con un logro' };
    if (p.coins < it.price) return { ok: false, err: 'Te faltan ' + (it.price - p.coins) + ' monedas' };
    p.coins -= it.price; p.owned.push(id); p.stats.purchases++; save(); notify('coins'); const ach = checkAch(); return { ok: true, ach };
  }
  function equip(id) {
    const p = profile(), it = D.ITEM_BY_ID[id];
    if (!p || !it || !p.owned.includes(id)) return false;
    p.look[it.cat] = id; save(); notify('look'); return true;
  }
  function setLook(patch) { const p = profile(); if (!p) return; Object.assign(p.look, patch); save(); notify('look'); }
  const CHEST_COST = 120;
  function openChest(free) {
    const p = profile(); if (!p) return null;
    if (!free) { if (p.coins < CHEST_COST) return { ok: false, err: 'Te faltan ' + (CHEST_COST - p.coins) + ' monedas' }; }
    const pool = D.ITEMS.filter((i) => !p.owned.includes(i.id) && !i.unlock && i.price > 0);
    if (!free) p.coins -= CHEST_COST;
    if (!pool.length) { p.coins += 90; save(); notify('coins'); return { ok: true, dup: true, coins: 90 }; }
    const W = { comun: 55, raro: 30, epico: 12, legendario: 3 };
    let tot = 0; pool.forEach((i) => { tot += W[i.rarity]; });
    let r = Math.random() * tot, pick = pool[0];
    for (const i of pool) { r -= W[i.rarity]; if (r <= 0) { pick = i; break; } }
    p.owned.push(pick.id); if (!free) p.stats.purchases++; save(); notify('coins');
    return { ok: true, item: pick, ach: checkAch() };
  }

  function perks() {
    const p = profile(); const out = { hearts: 0, hintCost: 1, coins: 0, slow: 0, shield: 0 };
    if (!p) return out;
    const am = D.ITEM_BY_ID[p.look.amulet];
    if (am) { out.hearts = am.hearts || 0; out.hintCost = am.hintCost || 1; out.coins = am.coins || 0; out.slow = am.slow || 0; out.shield = am.shield || 0; }
    return out;
  }

  /* ---------- economía / XP ---------- */
  function addCoins(n) { const p = profile(); if (!p) return; p.coins = Math.max(0, p.coins + Math.round(n)); notify('coins'); }
  function spend(n) { const p = profile(); if (!p || p.coins < n) return false; p.coins -= n; notify('coins'); return true; }
  /* ---------- Σ (símbolos matemáticos) y ruleta ---------- */
  function addSigma(n) { const p = profile(); if (!p || !n) return; p.sigma = Math.max(0, (p.sigma || 0) + Math.round(n)); notify('coins'); }
  function spendSigma(n) { const p = profile(); if (!p || (p.sigma || 0) < n) return false; p.sigma -= n; notify('coins'); return true; }
  function wheelState() { const p = profile(); if (!p) return { free: false, extra: 0, qLeft: 0 }; const t = today(); if (p.wheel.day !== t) { p.wheel.day = t; p.wheel.freeUsed = false; } if (p.wheel.qDay !== t) { p.wheel.qDay = t; p.wheel.qCount = 0; } return { free: !p.wheel.freeUsed, extra: p.wheel.extra || 0, qLeft: Math.max(0, 3 - p.wheel.qCount) }; }
  function spinsLeft() { const w = wheelState(); return (w.free ? 1 : 0) + w.extra; }
  function useSpin() { const p = profile(); if (!p) return false; const w = wheelState(); if (w.free) p.wheel.freeUsed = true; else if (w.extra > 0) p.wheel.extra--; else return false; save(); return true; }
  function grantSpin(n) { const p = profile(); if (!p) return; wheelState(); p.wheel.extra = (p.wheel.extra || 0) + (n || 1); save(); }
  function wheelQuestionDone() { const p = profile(); if (!p) return; wheelState(); p.wheel.qCount++; save(); }
  const WHEEL = [
    { id: 'c30', label: '30', icon: '🪙', col: '#ffb020', w: 22, coins: 30 }, { id: 's2', label: '+2 Σ', icon: 'Σ', col: '#c58bff', w: 20, sigma: 2 },
    { id: 'c80', label: '80', icon: '🪙', col: '#22d47e', w: 14, coins: 80 }, { id: 's5', label: '+5 Σ', icon: 'Σ', col: '#5ce1e6', w: 10, sigma: 5 },
    { id: 'chest', label: 'Cofre', icon: '🎁', col: '#ff3f9a', w: 6, chest: true }, { id: 'c150', label: '150', icon: '🪙', col: '#ff5a3c', w: 4, coins: 150 },
    { id: 'xp', label: '50 XP', icon: '⚡', col: '#4da3ff', w: 16, xp: 50 }, { id: 'spin', label: '+1 giro', icon: '🎡', col: '#ffd23f', w: 8, spin: 1 },
  ];
  function rollWheel() { let tot = 0; WHEEL.forEach((x) => { tot += x.w; }); let r = Math.random() * tot; for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r <= 0) return i; } return 0; }
  function applyPrize(i) {
    const pz = WHEEL[i]; const out = { prize: pz };
    if (pz.coins) addCoins(pz.coins); if (pz.sigma) addSigma(pz.sigma); if (pz.xp) out.ups = addXp(pz.xp); if (pz.spin) grantSpin(pz.spin);
    if (pz.chest) out.chest = openChest(true); save(); return out;
  }
  const EXCHANGE = [
    { id: 'coins', icon: '🪙', name: '60 monedas', cost: 8 }, { id: 'spin', icon: '🎡', name: '1 giro de ruleta', cost: 5 }, { id: 'chest', icon: '🎁', name: 'Cofre misterioso', cost: 25 },
  ];
  function exchange(id) {
    const e = EXCHANGE.find((x) => x.id === id); if (!e || !spendSigma(e.cost)) return { ok: false, err: 'Te faltan símbolos Σ' };
    let r = { ok: true, e }; if (id === 'coins') addCoins(60); else if (id === 'spin') grantSpin(1); else r.chest = openChest(true); save(); return r;
  }
  function addXp(n) {
    const p = profile(); const ups = [];
    if (!p) return ups;
    p.xp += Math.round(n);
    while (p.xp >= xpNeed(p.level)) {
      p.xp -= xpNeed(p.level); p.level++;
      const reward = { level: p.level, coins: 20 + 5 * p.level };
      p.coins += reward.coins;
      if (LEVEL_ITEMS[p.level] && grantItem(LEVEL_ITEMS[p.level])) reward.item = LEVEL_ITEMS[p.level];
      ups.push(reward);
    }
    return ups;
  }

  /* ---------- mapa / progreso ---------- */
  const FIRST14 = D.VILLAINS.slice(0, 14);
  function prog(id) { const p = profile(); return (p && p.progress[id]) || { stars: 0, tier: 0, plays: 0, wins: 0 }; }
  function isCleared(id) { return prog(id).tier >= 3; }
  function unlocked(v) {
    const i = D.VILLAINS.indexOf(v);
    if (i === 0) return true;
    if (v.id === 'indeterminado') return FIRST14.every((x) => isCleared(x.id));
    if (v.id === 'duinity') return isCleared('indeterminado');
    return isCleared(D.VILLAINS[i - 1].id);
  }
  function recordBattle(v, res) {
    const p = profile(); if (!p) return null;
    const pr = p.progress[v.id] || (p.progress[v.id] = { stars: 0, tier: 0, plays: 0, wins: 0 });
    pr.plays++;
    const st = p.stats;
    st.battles++;
    st.correct += res.correct; st.answered += res.answered;
    st.bestStreak = Math.max(st.bestStreak, res.bestStreak);
    { const seen = {}; p.mistakes = res.mistakes.concat(p.mistakes).filter((m) => (seen[m.text] ? false : (seen[m.text] = true))).slice(0, 40); }
    let firstClear = false;
    if (res.win) {
      pr.wins++; st.wins++;
      if (pr.tier < 1) firstClear = true;
      pr.tier = Math.max(pr.tier, res.tier);
      pr.stars = Math.max(pr.stars, res.stars);
      if (res.stars === 3) st.perfect++;
      if (res.tier === 3) st.hardWins++;
      if (v.id === 'indeterminado') st.boss++;
    }
    if (v.endless) st.duinityBest = Math.max(st.duinityBest, res.correct);
    save();
    // misiones
    trackDaily({ correct: res.correct, streak: res.bestStreak, wins: res.win ? 1 : 0, perfect: res.win && res.stars === 3 ? 1 : 0, district: v.id });
    return { firstClear };
  }
  /* ---------- salas multijugador ---------- */
  function recordRoom(res) {
    const p = profile(); if (!p) return null;
    const st = p.stats; st.correct += res.correct; st.answered += res.answered; st.rooms = (st.rooms || 0) + 1;
    st.bestStreak = Math.max(st.bestStreak, res.bestStreak || 0);
    if (res.rank === 1 && res.total >= 2) st.roomWins = (st.roomWins || 0) + 1;
    { const seen = {}; p.mistakes = (res.mistakes || []).concat(p.mistakes).filter((m) => (seen[m.text] ? false : (seen[m.text] = true))).slice(0, 40); }
    const bonus = res.total >= 2 ? ({ 1: 60, 2: 40, 3: 25 }[res.rank] || 0) : 0;
    const coins = 10 + 8 * res.correct + bonus, xp = 20 + 6 * res.correct;
    addCoins(coins); const ups = addXp(xp);
    trackDaily({ correct: res.correct, streak: res.bestStreak || 0 });
    save(); notify('coins');
    return { coins, xp, bonus, ups, ach: checkAch() };
  }
  function stats() {
    const p = profile(); if (!p) return {};
    const s = p.stats;
    return {
      correct: s.correct, bestStreak: s.bestStreak, wins: s.wins, perfect: s.perfect, hardWins: s.hardWins, purchases: s.purchases, boss: s.boss, duinityBest: s.duinityBest,
      level: p.level, owned: p.owned.length,
      districts: FIRST14.filter((v) => isCleared(v.id)).length,
      stars: FIRST14.reduce((a, v) => a + prog(v.id).stars, 0),
    };
  }

  /* ---------- logros ---------- */
  function checkAch() {
    const p = profile(); if (!p) return [];
    const s = stats(), out = [];
    D.ACH.forEach((a) => {
      if (!p.achDone[a.id] && a.prog(s) >= a.goal) {
        p.achDone[a.id] = Date.now();
        p.coins += a.coins || 0;
        if (a.item) grantItem(a.item);
        const it = D.ITEMS.find((i) => i.unlock && i.unlock.ach === a.id);
        if (it) grantItem(it.id);
        out.push(a);
      }
    });
    if (out.length) { save(); notify('ach', out); }
    return out;
  }

  /* ---------- misiones diarias ---------- */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function ensureDaily() {
    const p = profile(); if (!p) return null;
    const t = today();
    if (p.daily.date !== t) {
      let h = hashStr(p.id + t); const pool = D.MISSIONS.slice(), ids = [];
      while (ids.length < 3) { const i = h % pool.length; ids.push(pool.splice(i, 1)[0].id); h = Math.imul(h, 1103515245) + 12345 >>> 0; }
      p.daily = { date: t, ids, prog: { correct: 0, streak: 0, wins: 0, perfect: 0, districts: 0 }, seen: [], done: {} };
      save();
    }
    return p.daily;
  }
  function trackDaily(ev) {
    const p = profile(); if (!p) return [];
    const d = ensureDaily(); const done = [];
    d.prog.correct += ev.correct || 0; d.prog.streak = Math.max(d.prog.streak, ev.streak || 0);
    d.prog.wins += ev.wins || 0; d.prog.perfect += ev.perfect || 0;
    if (ev.district && !d.seen.includes(ev.district)) { d.seen.push(ev.district); d.prog.districts = d.seen.length; }
    d.ids.forEach((id) => {
      const m = D.MISSIONS.find((x) => x.id === id);
      if (m && !d.done[id] && d.prog[m.stat] >= m.goal) { d.done[id] = true; p.coins += m.reward; done.push(m); }
    });
    save(); if (done.length) notify('mission', done);
    return done;
  }

  /* ---------- copia de seguridad ---------- */
  function exportCode() { const p = profile(); if (!p) return ''; return 'DUIX1:' + btoa(unescape(encodeURIComponent(JSON.stringify(p)))); }
  function importCode(code) {
    try {
      code = String(code || '').trim();
      if (!code.startsWith('DUIX1:')) return { ok: false, err: 'El código no es válido.' };
      const p = JSON.parse(decodeURIComponent(escape(atob(code.slice(6)))));
      if (!p || !p.look || !p.name) return { ok: false, err: 'El código está dañado.' };
      p.id = uid(); migrate(p);
      if (db.list.length >= MAX_PROFILES) return { ok: false, err: 'Ya tienes 4 héroes. Borra uno primero.' };
      db.list.push(p); db.active = p.id; save(); notify('profile');
      return { ok: true };
    } catch (e) { return { ok: false, err: 'No se pudo leer el código.' }; }
  }
  function resetAll() { db = { list: [], active: null }; save(); notify('profile'); }

  load();
  const S = {
    persistent, MAX_PROFILES, DEFAULT_LOOK, xpNeed, CHEST_COST, today, settings: () => settings, setSetting(k, v) { settings[k] = v; saveSettings(); notify('settings'); },
    list: () => db.list, profile, newProfile, switchTo, removeProfile, logout, save,
    has, buy, equip, setLook, openChest, grantItem, perks, addCoins, spend, addXp, addSigma, spendSigma, wheelState, spinsLeft, useSpin, grantSpin, wheelQuestionDone, WHEEL, rollWheel, applyPrize, EXCHANGE, exchange,
    prog, isCleared, unlocked, recordBattle, recordRoom, stats, checkAch, ensureDaily, trackDaily, exportCode, importCode, resetAll,
    on(f) { listeners.push(f); },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.DuiXStore = S;
})(typeof window !== 'undefined' ? window : globalThis);
