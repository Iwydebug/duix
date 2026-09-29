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
    p.coins = p.coins || 0; p.xp = p.xp || 0; p.level = p.level || 1;
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
  function isCleared(id) { return prog(id).tier >= 1; }
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
    has, buy, equip, setLook, openChest, grantItem, perks, addCoins, spend, addXp,
    prog, isCleared, unlocked, recordBattle, stats, checkAch, ensureDaily, trackDaily, exportCode, importCode, resetAll,
    on(f) { listeners.push(f); },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.DuiXStore = S;
})(typeof window !== 'undefined' ? window : globalThis);
