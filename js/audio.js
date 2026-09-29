/* DuiX — sonido chiptune con WebAudio (sin archivos de audio: funciona sin internet) */
(function (root) {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  let cfg = { sfx: true, music: true, volume: 0.7 };
  let cur = null, timer = null, nextT = 0, step = 0, trackName = null, unlocked = false;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try {
      ctx = new AC(); master = ctx.createGain(); sfxBus = ctx.createGain(); musBus = ctx.createGain();
      const comp = ctx.createDynamicsCompressor(); sfxBus.connect(master); musBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      apply();
    } catch (e) { ctx = null; }
    return ctx;
  }
  function apply() { if (!ctx) return; master.gain.value = cfg.volume * 0.8; sfxBus.gain.value = cfg.sfx ? 1 : 0; musBus.gain.value = cfg.music ? 0.32 : 0; }
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!unlocked) { unlocked = true; const o = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 0.0001; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.02); if (trackName && !timer) play(trackName); }
  }

  function tone(f, dur, type, vol, slide, when, bus) {
    if (!ensure() || !cfg.sfx && bus !== musBus) return;
    const t = when || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, hp, when, bus) {
    if (!ensure()) return;
    const t = when || ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp || 800;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t); s.stop(t + dur + 0.02);
  }
  const arp = (notes, gap, type, vol, dur) => notes.forEach((m, i) => tone(mtof(m), dur || 0.12, type || 'square', vol || 0.18, 0, (ctx ? ctx.currentTime : 0) + i * gap));

  const SFX = {
    click: () => tone(880, 0.05, 'square', 0.12),
    back: () => tone(440, 0.07, 'square', 0.12, 330),
    select: () => { tone(660, 0.05, 'square', 0.12); tone(990, 0.07, 'square', 0.12, 0, ctx.currentTime + 0.05); },
    shoot: () => { tone(1100, 0.13, 'square', 0.16, 240); },
    hit: () => { noise(0.14, 0.25, 600); tone(220, 0.14, 'square', 0.18, 70); },
    correct: () => arp([72, 76, 79, 84], 0.055, 'square', 0.16, 0.1),
    wrong: () => { tone(220, 0.32, 'sawtooth', 0.2, 80); noise(0.2, 0.15, 300); },
    hurt: () => { noise(0.28, 0.3, 200); tone(140, 0.3, 'sawtooth', 0.22, 50); },
    coin: () => { tone(988, 0.07, 'square', 0.14); tone(1319, 0.16, 'square', 0.14, 0, ctx.currentTime + 0.07); },
    combo: (n) => arp([76 + Math.min(n, 12), 80 + Math.min(n, 12), 83 + Math.min(n, 12)], 0.05, 'triangle', 0.22, 0.12),
    power: () => { tone(220, 0.5, 'sawtooth', 0.2, 1760); noise(0.4, 0.1, 2000); },
    hint: () => arp([79, 74], 0.08, 'triangle', 0.2, 0.12),
    buy: () => arp([72, 79, 84, 91], 0.06, 'square', 0.15, 0.12),
    deny: () => { tone(160, 0.14, 'square', 0.16); tone(130, 0.18, 'square', 0.16, 0, ctx.currentTime + 0.12); },
    levelup: () => arp([67, 72, 76, 79, 84, 88, 91], 0.09, 'square', 0.17, 0.2),
    win: () => arp([72, 72, 72, 76, 79, 76, 79, 84], 0.11, 'square', 0.17, 0.2),
    lose: () => arp([67, 64, 60, 55], 0.22, 'triangle', 0.25, 0.4),
    boom: () => { noise(0.6, 0.35, 120); tone(110, 0.6, 'sawtooth', 0.25, 30); },
    warn: () => tone(330, 0.08, 'square', 0.1),
    star: (i) => tone(mtof(76 + i * 4), 0.25, 'square', 0.18),
    pause: () => tone(523, 0.08, 'triangle', 0.15),
  };
  function sfx(name, arg) { if (!cfg.sfx || !ensure()) return; if (ctx.state === 'suspended') ctx.resume(); try { SFX[name] && SFX[name](arg); } catch (e) { /* ignora */ } }

  /* ---------- música ---------- */
  // acordes en MIDI [raíz, tercera, quinta]; 8 pasos (corcheas) por acorde
  const TR = {
    menu: { bpm: 96, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], arp: [0, 1, 2, 1, 2, 1, 0, 1], bass: [1, 0, 0, 0, 1, 0, 0, 0], lead: [81, 0, 79, 0, 76, 0, 79, 0, 77, 0, 76, 0, 72, 0, 0, 0, 76, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0, 74, 0, 0, 0], wave: 'triangle', hat: false },
    map: { bpm: 108, chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], arp: [0, 2, 1, 2, 0, 2, 1, 2], bass: [1, 0, 1, 0, 1, 0, 1, 0], lead: [79, 0, 0, 76, 0, 0, 72, 0, 77, 0, 0, 74, 0, 0, 69, 0, 79, 0, 83, 0, 81, 0, 79, 0, 76, 0, 0, 0, 72, 0, 0, 0], wave: 'square', hat: false },
    battle: { bpm: 142, chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]], arp: [0, 1, 2, 1, 0, 1, 2, 1], bass: [1, 1, 1, 1, 1, 1, 1, 1], lead: [76, 0, 76, 79, 0, 76, 0, 74, 72, 0, 72, 76, 0, 72, 0, 71, 69, 0, 72, 0, 77, 0, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0], wave: 'square', hat: true },
    boss: { bpm: 158, chords: [[57, 60, 64], [56, 59, 62], [57, 60, 64], [53, 56, 60]], arp: [0, 2, 1, 2, 0, 2, 1, 2], bass: [1, 1, 1, 1, 1, 1, 1, 1], lead: [81, 0, 80, 0, 81, 0, 84, 0, 83, 0, 80, 0, 83, 0, 0, 0, 81, 0, 80, 0, 79, 0, 76, 0, 77, 0, 76, 0, 80, 0, 0, 0], wave: 'sawtooth', hat: true },
  };
  function scheduler() {
    if (!ctx || !cur) return;
    while (nextT < ctx.currentTime + 0.14) {
      const T = cur, st = 60 / T.bpm / 2, bar = Math.floor(step / 8) % T.chords.length, i8 = step % 8, ch = T.chords[bar];
      if (T.bass[i8]) tone(mtof(ch[0] - 12), st * 0.9, 'triangle', 0.5, 0, nextT, musBus);
      tone(mtof(ch[T.arp[i8]] + 12), st * 0.7, 'square', 0.16, 0, nextT, musBus);
      const l = T.lead[step % 32]; if (l) tone(mtof(l), st * 1.6, T.wave, 0.22, 0, nextT, musBus);
      if (T.hat && i8 % 2 === 1) noise(0.04, 0.16, 6000, nextT, musBus);
      if (T.hat && i8 % 4 === 0) noise(0.07, 0.2, 200, nextT, musBus);
      nextT += st; step++;
    }
  }
  function play(name) {
    trackName = name;
    if (!ensure() || !unlocked) return;
    if (cur === TR[name] && timer) return;
    stop(true); cur = TR[name]; step = 0; nextT = ctx.currentTime + 0.05; timer = setInterval(scheduler, 30);
  }
  function stop(keepName) { if (timer) { clearInterval(timer); timer = null; } cur = null; if (!keepName) trackName = null; }
  function configure(c) { cfg = Object.assign(cfg, c); apply(); }
  function suspend(v) { if (!ctx) return; if (v) { if (ctx.state === 'running') ctx.suspend(); } else if (unlocked && ctx.state === 'suspended') ctx.resume(); }

  root.DuiXAudio = { unlock, sfx, play, stop, configure, suspend };
})(typeof window !== 'undefined' ? window : globalThis);
