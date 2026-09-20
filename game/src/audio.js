/**
 * Every sound is synthesised here the moment it is needed, from the physics numbers that caused
 * it. Nothing is a file. A paddle hit is a short resonant "pok" whose pitch and noise rise with
 * impact speed over a plywood thud; a table bounce is lower and shorter; the net cord thrums at
 * 150 Hz; a thin brush hisses; the crowd is filtered noise that swells with the rally and goes
 * silent at game point. No two hits sound the same, and every one is exactly as hard as the hit.
 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rr = (a, b) => a + Math.random() * (b - a);

export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false;
    this.cheerLvl = 0; this.pulseT = 0; this.chargeNodes = null; this.lastChargeTick = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.003; this.comp.release.value = 0.12;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.dry = c.createGain(); this.dry.connect(this.master);
    this.noiseBuf = this.makeNoise(2.0);
    this.verb = c.createConvolver(); this.verb.buffer = this.makeIR(1.7, 2.4);
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.22;
    this.verbSend = c.createGain(); this.verbSend.connect(this.verb); this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0; this.amb.connect(this.master);
    this.startAmbience();
  }
  ok() { return !!this.ctx; }
  get t() { return this.ctx.currentTime; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.t, 0.05); }

  makeNoise(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  makeIR(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 300 ? i / 300 : 1); }
    }
    return b;
  }
  /** One oscillator with an attack/decay envelope, optionally gliding from f0 to f1. */
  tone(type, f0, t0, dur, gain, { f1 = null, send = 0.3, attack = 0.001 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    o.connect(g); g.connect(this.dry);
    if (send > 0) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verbSend); }
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  /** A burst of the noise buffer through optional band, high and low pass filters. */
  noise(t0, dur, gain, { bp = null, q = 1, hp = null, lp = null, sweep = null, send = 0.3, attack = 0.001 } = {}) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    let node = src;
    if (bp) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(bp, t0); f.Q.value = q; if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur); node.connect(f); node = f; }
    if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    node.connect(g); g.connect(this.dry);
    if (send > 0) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verbSend); }
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.03);
  }

  paddle(speed, o = {}) {
    if (!this.ok()) return;
    const t = this.t, a = Math.pow(clamp(speed / 26, 0.08, 1), 0.75);
    this.tone('sine', 1500 + speed * 35, t, 0.03, 0.8 * a, { f1: 900 });
    this.tone('triangle', 3000 + speed * 60, t, 0.012, 0.3 * a);
    this.noise(t, 0.008, 0.45 * a, { bp: 3800, q: 1.2 });
    this.tone('sine', 210, t, 0.05, 0.55 * a, { f1: 140 });
    if (o.quality === 'PERFECT') { this.tone('sine', 5200, t, 0.05, 0.22 * a); this.tone('sine', 260, t, 0.09, 0.5 * a, { f1: 170 }); }
    if (o.edge) { this.noise(t, 0.02, 0.8 * a, { bp: 1100, q: 2 }); this.tone('square', 880, t, 0.02, 0.25 * a, { f1: 500 }); }
    if (o.slip) this.noise(t, 0.05, 0.35 * a, { hp: 5000 });
    else if (o.brush > 3) this.noise(t, 0.03, 0.12 * a, { hp: 3000 });
  }
  table(speed, o = {}) {
    if (!this.ok()) return;
    const t = this.t, a = Math.pow(clamp(speed / 18, 0.06, 1), 0.8) * 0.8;
    this.tone('sine', 1050 + speed * 10, t, 0.028, 0.8 * a, { f1: 700 });
    this.noise(t, 0.006, 0.3 * a, { bp: 2200, q: 1.5 });
    this.tone('sine', 4800, t, 0.008, 0.12 * a);
    if (o.edge) { this.noise(t, 0.025, 0.6 * a, { bp: 900, q: 1.5 }); this.tone('square', 600, t, 0.02, 0.2 * a, { f1: 300 }); }
  }
  floor(speed) {
    if (!this.ok()) return;
    const t = this.t, a = clamp(speed / 8, 0.05, 1) * 0.5;
    this.tone('sine', 380, t, 0.06, 0.6 * a, { f1: 200 });
    this.noise(t, 0.015, 0.4 * a, { lp: 1200 });
  }
  net(kind, speed = 5) {
    if (!this.ok()) return;
    const t = this.t;
    if (kind === 'clip') { this.tone('sine', 150, t, 0.25, 0.6, { f1: 120 }); this.noise(t, 0.01, 0.35, { bp: 2500 }); this.tone('sine', 1000, t, 0.01, 0.2); }
    else if (kind === 'in') { this.noise(t, 0.09, 0.5, { lp: 900 }); this.tone('sine', 90, t, 0.2, 0.45, { f1: 60 }); }
    else if (kind === 'zip') this.noise(t, 0.06, 0.18 * clamp(speed / 15, 0.3, 1), { bp: 5000, q: 3, sweep: 9000 });
    else if (kind === 'post') { this.noise(t, 0.03, 0.6, { bp: 1200, q: 2 }); this.tone('square', 700, t, 0.03, 0.3, { f1: 400 }); }
  }
  whoosh(speed) { if (!this.ok()) return; const a = clamp(speed / 12, 0, 1) * 0.3; if (a > 0.02) this.noise(this.t, 0.13, a, { bp: 500, q: 0.8, sweep: 1800 }); }
  toss() { if (!this.ok()) return; this.noise(this.t, 0.02, 0.08, { bp: 3000 }); }
  ui() { if (!this.ok()) return; this.tone('sine', 880, this.t, 0.05, 0.08); }

  chargeStart() {
    if (!this.ok()) return;
    this.chargeEnd(0, true);
    // a drawn breath: filtered air that rises as the arm winds back, eight soft ratchet ticks
    // of a spring taking tension, and a low hum once it is fully wound
    const c = this.ctx, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    const hum = c.createOscillator(), hg = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true;
    bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 1.6; g.gain.value = 0;
    hum.type = 'sine'; hum.frequency.value = 62; hg.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(this.dry); hum.connect(hg); hg.connect(this.dry);
    src.start(0, Math.random()); hum.start();
    g.gain.linearRampToValueAtTime(0.02, this.t + 0.06);
    this.chargeNodes = { src, bp, g, hum, hg }; this.lastChargeTick = 0;
  }
  chargeLevel(l) {
    if (!this.chargeNodes) return;
    const { bp, g, hum, hg } = this.chargeNodes, t = this.t;
    bp.frequency.setTargetAtTime(300 + 2600 * l * l, t, 0.03);
    g.gain.setTargetAtTime(0.02 + 0.07 * l, t, 0.03);
    hg.gain.setTargetAtTime(l > 0.97 ? 0.05 : 0, t, 0.05);
    hum.frequency.setTargetAtTime(62 + 5 * Math.sin(t * 22), t, 0.02);
    const tick = Math.floor(l * 8 + 1e-6);
    if (tick > this.lastChargeTick && tick <= 8) {
      this.lastChargeTick = tick;
      this.noise(t, 0.012, 0.16, { bp: 1200 + 350 * tick, q: 6 });
      this.tone('triangle', 520 + 120 * tick, t, 0.03, 0.05);
      if (tick === 8) this.tone('sine', 1760, t, 0.12, 0.08);
    }
  }
  chargeEnd(power, silent = false) {
    if (!this.ok()) return;
    if (this.chargeNodes) {
      const { src, g, hum, hg } = this.chargeNodes;
      g.gain.setTargetAtTime(0, this.t, 0.015); hg.gain.setTargetAtTime(0, this.t, 0.02);
      src.stop(this.t + 0.12); hum.stop(this.t + 0.15); this.chargeNodes = null;
    }
    if (silent) return;
    // the crack of the wrist, the blade passing, the body behind it
    const t = this.t, a = 0.3 + 0.7 * power;
    this.noise(t, 0.012, 0.5 * a, { bp: 2400, q: 1.2 });
    this.noise(t + 0.01, 0.2, 0.32 * a, { bp: 2200, q: 0.7, sweep: 350 });
    this.tone('sine', 110, t, 0.08, 0.25 * a, { f1: 60 });
  }
  point(win, big) {
    if (!this.ok()) return;
    const t = this.t;
    if (win) { this.tone('sine', 659, t, 0.12, 0.18); this.tone('sine', 988, t + 0.09, 0.22, 0.18); this.tone('triangle', 1318, t + 0.09, 0.25, 0.06); }
    else { this.tone('sine', 392, t, 0.12, 0.14); this.tone('sine', 311, t + 0.1, 0.25, 0.14); }
    if (big) this.tone('sine', 130, t, 0.4, 0.2, { f1: 90 });
  }
  gameOver(win) {
    if (!this.ok()) return;
    const t = this.t;
    const notes = win ? [523, 659, 784, 1047] : [392, 349, 311, 262];
    notes.forEach((f, i) => { this.tone('triangle', f, t + i * 0.13, 0.5, 0.16); this.tone('sine', f / 2, t + i * 0.13, 0.7, 0.1); });
    this.tone('sawtooth', notes[0] / 2, t, 1.6, 0.05, { f1: notes[0] / 2 * 1.005 });
  }
  cheer(intensity) {
    if (!this.ok()) return;
    const t = this.t, i = clamp(intensity, 0, 1);
    this.cheerLvl = Math.max(this.cheerLvl, i);
    this.noise(t, 1.6, 0.3 * i, { bp: 900, q: 0.5, attack: 0.25 });
    const n = Math.floor(25 + 60 * i);
    for (let k = 0; k < n; k++) this.noise(t + Math.random() * 1.8 * (0.6 + Math.random() * 0.4), 0.012, rr(0.04, 0.11) * i, { bp: 2500, q: 1.5, send: 0.4 });
  }
  startAmbience() {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    src.connect(lp); lp.connect(bp); bp.connect(this.amb);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.13; const lg = c.createGain(); lg.gain.value = 140;
    lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    src.start();
  }
  /** Per frame: the crowd level, the silence at game point, the rally pulse. */
  update(dt, ctx) {
    if (!this.ok()) return;
    const rallyLvl = clamp((ctx.rally - 2) / 10, 0, 1);
    let target = ctx.running ? 0.05 + 0.10 * rallyLvl + 0.08 * this.cheerLvl : 0.02;
    if (ctx.tension) target *= 0.1;
    this.amb.gain.setTargetAtTime(target, this.t, 0.5);
    this.cheerLvl = Math.max(0, this.cheerLvl - dt * 0.4);
    if (ctx.running && ctx.live && ctx.rally >= 6 && !ctx.tension) {
      const bpm = 70 + Math.min(80, (ctx.rally - 6) * 8);
      this.pulseT += dt;
      if (this.pulseT >= 60 / bpm) {
        this.pulseT = 0;
        this.tone('sine', 55, this.t, 0.09, 0.28, { f1: 40, send: 0.1 });
        this.tone('sine', 50, this.t + 0.16, 0.07, 0.2, { f1: 38, send: 0.1 });
      }
    } else this.pulseT = 0;
  }
}
