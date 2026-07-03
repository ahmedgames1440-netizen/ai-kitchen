/* ============================================================
   الموسيقى والأجواء الصوتية — WebAudio بالكامل (بدون ملفات)
   لحن مقام حجاز + إيقاع دربكة، يتسارع وقت الذروة
   ============================================================ */
"use strict";

window.GameAudio = (() => {
  let ctx = null, master = null, musicGain = null;
  let timer = null, step = 0, nextTime = 0, rushMode = false, enabled = true;
  let sizzleSrc = null, sizzleGain = null, noiseBuf = null;

  /* مقام حجاز على ري */
  const HIJAZ = [0, 1, 4, 5, 7, 8, 11];
  const BASE = 146.83; // D3
  const f = (d, oct = 0) => {
    const o = Math.floor(d / 7);
    const n = HIJAZ[((d % 7) + 7) % 7] + 12 * (o + oct);
    return BASE * Math.pow(2, n / 12);
  };

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.3;
      musicGain.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  /* ---------- الآلات ---------- */
  // عود/بزق: منشاري بفلتر يهبط بسرعة
  function pluck(freq, t, dur = 0.32, vol = 0.16) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.setValueAtTime(2400, t);
    flt.frequency.exponentialRampToValueAtTime(420, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(flt); flt.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // خط الباص
  function bass(freq, t, dur = 0.42, vol = 0.2) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // دربكة: دُم (عميق) وتِك (حاد)
  function dum(t, vol = 0.4) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.2);
  }
  function tek(t, vol = 0.14) {
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const flt = ctx.createBiquadFilter();
    flt.type = "highpass";
    flt.frequency.value = 4000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(flt); flt.connect(g); g.connect(musicGain);
    src.start(t); src.stop(t + 0.07);
  }

  /* ---------- اللحن (64 خطوة = جملتان) ---------- */
  const R = null;
  const MEL_A = [0,R,2,R, 1,R,0,R, 4,R,5,R, 4,2,1,R, 0,R,2,4, R,5,R,7, R,5,4,R, 2,R,1,R];
  const MEL_B = [7,R,5,R, 4,R,5,R, 7,R,8,R, 7,R,5,4, 2,R,4,R, 5,4,2,R, 1,R,0,R, 1,2,R,R];
  const BASS_SEQ = [0, 0, -3, 0, -2, -2, -3, -3]; // كل 4 خطوات
  const DUMS = [0, 10, 16, 22];
  const TEKS = [4, 12, 20, 26, 30];

  function playStep(s, t) {
    const bar = Math.floor(s / 32);
    const idx = s % 32;
    const deg = (bar === 0 ? MEL_A : MEL_B)[idx];
    if (deg !== null && deg !== undefined) pluck(f(deg, 1), t);
    if (idx % 4 === 0) bass(f(BASS_SEQ[(idx / 4) % 8], 0) / 2, t);
    if (DUMS.includes(idx)) dum(t);
    if (TEKS.includes(idx)) tek(t);
    if (idx % 2 === 1) tek(t, 0.05); // همس الهاي هات
  }

  function schedule() {
    const spb = 60 / (rushMode ? 128 : 96) / 4; // 16th notes
    while (nextTime < ctx.currentTime + 0.18) {
      if (enabled) playStep(step, nextTime);
      nextTime += spb;
      step = (step + 1) % 64;
    }
  }

  /* ---------- صوت أزيز الشواية ---------- */
  function setSizzle(on) {
    if (!ctx) { if (!on) return; ensure(); }
    if (on && !sizzleSrc) {
      sizzleSrc = ctx.createBufferSource();
      sizzleSrc.buffer = noise();
      sizzleSrc.loop = true;
      const flt = ctx.createBiquadFilter();
      flt.type = "bandpass";
      flt.frequency.value = 5200;
      flt.Q.value = 0.6;
      sizzleGain = ctx.createGain();
      sizzleGain.gain.value = 0;
      sizzleSrc.connect(flt); flt.connect(sizzleGain); sizzleGain.connect(master);
      sizzleSrc.start();
      sizzleGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.3);
    } else if (!on && sizzleSrc) {
      const src = sizzleSrc, g = sizzleGain;
      sizzleSrc = null; sizzleGain = null;
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      setTimeout(() => { try { src.stop(); } catch (e) {} }, 500);
    }
  }

  return {
    start() {
      ensure();
      if (timer) return;
      step = 0;
      nextTime = ctx.currentTime + 0.06;
      timer = setInterval(schedule, 45);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      setSizzle(false);
    },
    setRush(r) { rushMode = r; },
    setEnabled(on) { enabled = on; if (musicGain) musicGain.gain.value = on ? 0.3 : 0; },
    sizzle: setSizzle,
  };
})();
