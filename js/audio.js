// WebAudio sound: everything synthesized at runtime (no audio files). Voice-capped per graphics tier.
export class Sfx {
  constructor(tier, vol = 0.7) { this.max = tier === 'high' ? 24 : 8; this.vol = vol; this.ctx = null; this.live = 0; this.engine = null; }
  unlock() { if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; this.ctx = new C(); this.out = this.ctx.createGain(); this.out.gain.value = this.vol; this.out.connect(this.ctx.destination);
      const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, len); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
    if (this.ctx.state === 'suspended') this.ctx.resume(); }
  setVol(v) { this.vol = v; if (this.out) this.out.gain.value = v; }
  voice(gain, dur) { if (!this.ctx || this.ctx.state !== 'running' || this.live >= this.max || gain < 0.01) return null; this.live++; const g = this.ctx.createGain(); g.connect(this.out); const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); setTimeout(() => { this.live--; g.disconnect(); }, dur * 1000 + 50); return { g, t }; }
  nz(v, dur, type, f, q = 1, f2) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, v.t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, v.t + dur); fl.Q.value = q; s.connect(fl); fl.connect(v.g); s.start(v.t, Math.random() * 0.5); s.stop(v.t + dur); }
  osc(v, dur, type, f, f2) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, v.t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, v.t + dur); o.connect(v.g); o.start(v.t); o.stop(v.t + dur); }
  // name, optional world pos + listener pos for distance falloff
  play(name, pos, ear) {
    if (!this.ctx) return; let k = 1; if (pos && ear) { const d = Math.hypot(pos.x - ear.x, pos.y - ear.y, pos.z - ear.z); k = 1 / (1 + d * 0.06); if (d > 150) return; }
    const P = (g, dur) => this.voice(g * k, dur); let v;
    switch (name) {
      case 'pistol': if ((v = P(0.5, 0.15))) { this.nz(v, 0.15, 'bandpass', 2400, 0.8, 600); this.osc(v, 0.08, 'square', 220, 80); } break;
      case 'smg': if ((v = P(0.35, 0.09))) this.nz(v, 0.09, 'bandpass', 3000, 0.9, 900); break;
      case 'rifle': if ((v = P(0.5, 0.18))) { this.nz(v, 0.18, 'lowpass', 3500, 0.7, 500); this.osc(v, 0.1, 'sawtooth', 160, 50); } break;
      case 'shotgun': if ((v = P(0.7, 0.35))) { this.nz(v, 0.35, 'lowpass', 2200, 0.5, 200); this.osc(v, 0.2, 'sine', 90, 35); } break;
      case 'sniper': if ((v = P(0.8, 0.6))) { this.nz(v, 0.6, 'lowpass', 5000, 0.4, 150); this.osc(v, 0.3, 'sine', 120, 30); } break;
      case 'cannon': if ((v = P(0.9, 0.8))) { this.nz(v, 0.8, 'lowpass', 1200, 0.5, 80); this.osc(v, 0.5, 'sine', 70, 25); } break;
      case 'chain': if ((v = P(0.4, 0.07))) { this.nz(v, 0.07, 'bandpass', 1800, 1); this.osc(v, 0.05, 'square', 140, 60); } break;
      case 'explode': if ((v = P(1, 1.2))) { this.nz(v, 1.2, 'lowpass', 900, 0.3, 60); this.osc(v, 0.7, 'sine', 60, 20); } break;
      case 'reload': for (const [dt, f] of [[0, 1400], [0.35, 900], [0.7, 1800]]) setTimeout(() => { const w = P(0.25, 0.06); if (w) this.nz(w, 0.06, 'bandpass', f, 4); }, dt * 1000); break;
      case 'hit': if ((v = P(0.3, 0.07))) this.osc(v, 0.07, 'square', 1800, 1500); break;
      case 'head': if ((v = P(0.35, 0.12))) this.osc(v, 0.12, 'triangle', 2600, 2200); break;
      case 'shieldBreak': if ((v = P(0.5, 0.5))) { this.osc(v, 0.5, 'sawtooth', 900, 120); this.nz(v, 0.3, 'highpass', 3000, 1); } break;
      case 'shieldUp': if ((v = P(0.25, 0.8))) this.osc(v, 0.8, 'sine', 300, 1200); break;
      case 'step': if ((v = P(0.12, 0.08))) this.nz(v, 0.08, 'lowpass', 500 + Math.random() * 200, 1); break;
      case 'capture': [523, 659, 784].forEach((f, i) => setTimeout(() => { const w = P(0.3, 0.25); if (w) this.osc(w, 0.25, 'triangle', f); }, i * 120)); break;
      case 'lost': [523, 415, 330].forEach((f, i) => setTimeout(() => { const w = P(0.3, 0.25); if (w) this.osc(w, 0.25, 'triangle', f); }, i * 120)); break;
      case 'ui': if ((v = P(0.15, 0.05))) this.osc(v, 0.05, 'sine', 900, 1200); break;
      case 'melee': if ((v = P(0.4, 0.15))) { this.nz(v, 0.15, 'lowpass', 700, 1); } break;
      case 'nade': if ((v = P(0.2, 0.1))) this.nz(v, 0.1, 'bandpass', 1200, 3); break;
    }
  }
  // continuous engine hum for the player's own vehicle; kind null stops it
  setEngine(kind, throttle = 0) {
    if (!this.ctx) return;
    if (!kind) { if (this.engine) { this.engine.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); const e = this.engine; setTimeout(() => e.o.stop(), 400); this.engine = null; } return; }
    if (!this.engine || this.engine.kind !== kind) { this.setEngine(null); const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
      o.type = kind === 'jet' ? 'sawtooth' : kind === 'heli' ? 'square' : 'sawtooth'; f.type = 'lowpass'; f.frequency.value = kind === 'jet' ? 1500 : 400; o.connect(f); f.connect(g); g.connect(this.out); g.gain.value = 0; o.start(); this.engine = { o, g, kind }; }
    const base = { mech: 35, tank: 40, buggy: 60, boat: 50, heli: 18, jet: 90 }[kind] || 45;
    this.engine.o.frequency.setTargetAtTime(base * (1 + Math.abs(throttle) * 1.5), this.ctx.currentTime, 0.1); this.engine.g.gain.setTargetAtTime(0.08 + Math.abs(throttle) * 0.08, this.ctx.currentTime, 0.1);
  }
}
