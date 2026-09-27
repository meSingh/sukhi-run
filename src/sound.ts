/**
 * Every sound in the run, synthesised: no audio files to download or license,
 * and it works with no connection. The same friendly scale as the other apps,
 * a little beat that quickens as he speeds up, and a noise for each chaser.
 *
 * Nothing plays until the first press, because a browser will not start audio
 * before a gesture.
 */
import type { Power, Voice } from './world';

const KEY = 'sukhi-run-sound';
/** C major pentatonic, for anything with a note in it. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

/** The beat under the run: a bass line, one bar of eight, in each world. */
const BASS: Record<'day' | 'night', number[]> = {
  day: [130.81, 0, 196, 0, 164.81, 0, 196, 146.83],
  night: [110, 0, 164.81, 0, 130.81, 0, 155.56, 146.83]
};

export class Sound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private out: GainNode | null = null;
  muted = false;

  private beatOn = false;
  private beatStep = 0;
  private beatNext = 0;
  private beatTimer = 0;
  tempo = 1;
  night = false;
  /** 0 to 1: the heartbeat under the beat as the chaser closes in. */
  danger = 0;

  constructor () {
    try { this.muted = localStorage.getItem(KEY) === 'off'; } catch { /* private mode */ }
  }

  setMuted (muted: boolean): void {
    this.muted = muted;
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch { /* fine */ }
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** Called on the first press, which is when a browser allows it. */
  wake (): void {
    if (!this.ctx) {
      const AC = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate / 2, this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
      this.out = this.ctx.createGain();
      this.out.gain.value = this.muted ? 0 : 1;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private get ready (): AudioContext | null {
    return this.muted || !this.ctx ? null : this.ctx;
  }

  private tone (freq: number, when: number, gain: number, dur: number, type: OscillatorType = 'sine', slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp).connect(this.out!);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private hiss (when: number, gain: number, dur: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', slideTo?: number): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = dur > 0.45;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, when);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter).connect(amp).connect(this.out!);
    src.start(when, Math.random() * 0.2);
    src.stop(when + dur + 0.05);
  }

  /** A note with a wobble in it, for moans and hoots. */
  private wobble (freq: number, when: number, gain: number, dur: number, rate: number, depth: number, type: OscillatorType = 'sine', slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    lfo.frequency.value = rate;
    lfoGain.gain.value = depth;
    lfo.connect(lfoGain).connect(osc.frequency);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.05);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp).connect(this.out!);
    osc.start(when); lfo.start(when);
    osc.stop(when + dur + 0.05); lfo.stop(when + dur + 0.05);
  }

  // ---- the beat ------------------------------------------------------------

  startBeat (): void {
    if (this.beatOn || !this.ctx) return;
    this.beatOn = true;
    this.beatStep = 0;
    this.beatNext = this.ctx.currentTime + 0.1;
    this.beatTimer = window.setInterval(() => this.schedule(), 40);
  }

  stopBeat (): void {
    this.beatOn = false;
    window.clearInterval(this.beatTimer);
  }

  private schedule (): void {
    const ctx = this.ctx;
    if (!ctx || !this.beatOn) return;
    // Eighth notes, from 100 beats a minute up to about 150 at full speed.
    const step = 60 / (100 * this.tempo) / 2;
    while (this.beatNext < ctx.currentTime + 0.12) {
      const when = this.beatNext;
      const i = this.beatStep % 8;
      if (!this.muted) {
        const bass = BASS[this.night ? 'night' : 'day'][i];
        if (bass) this.tone(bass, when, 0.07, step * 1.6, 'triangle');
        this.hiss(when, i % 2 ? 0.02 : 0.035, 0.04, 7000, 1, 'highpass');
        if (i === 0 || i === 4) this.tone(90, when, 0.12, 0.12, 'sine', 45);
        if (this.danger > 0.3 && (i === 0 || i === 1)) this.tone(60, when + (i ? 0.02 : 0), 0.18 * this.danger, 0.14, 'sine', 40);
      }
      this.beatStep += 1;
      this.beatNext += step;
    }
  }

  // ---- things happening ----------------------------------------------------

  /** A coin, a little higher up the scale for each one in a row. */
  coin (streak: number): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    const n = SCALE[Math.min(streak, SCALE.length - 2)];
    this.tone(n, now, 0.06, 0.1, 'square');
    this.tone(n * 1.5, now + 0.05, 0.05, 0.16, 'sine');
  }

  jump (): void {
    const ctx = this.ready; if (!ctx) return;
    this.tone(330, ctx.currentTime, 0.08, 0.25, 'sine', 880);
  }

  duck (): void {
    const ctx = this.ready; if (!ctx) return;
    this.hiss(ctx.currentTime, 0.1, 0.3, 1800, 0.7, 'bandpass', 600);
  }

  steer (): void {
    const ctx = this.ready; if (!ctx) return;
    this.hiss(ctx.currentTime, 0.05, 0.12, 2500, 1.2);
  }

  /** A bump: a soft thud and a wobble. */
  bump (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(150, now, 0.25, 0.25, 'sine', 60);
    this.hiss(now, 0.15, 0.15, 400, 0.8);
    this.wobble(440, now + 0.1, 0.05, 0.4, 12, 40, 'triangle', 330);
  }

  /** The bubble taking a bump for him. */
  pop (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(900, now, 0.12, 0.08, 'sine', 300);
    this.hiss(now, 0.1, 0.06, 3000, 2);
  }

  power (p: Power): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    const notes = p === 'bubble' ? [0, 2, 4, 5] : p === 'springs' ? [0, 4, 2, 5] : p === 'magnet' ? [1, 3, 5, 7] : [2, 4, 6, 7];
    notes.forEach((n, i) => this.tone(SCALE[n], now + i * 0.07, 0.07, 0.25, 'triangle'));
  }

  /** Each chaser's call, for when it gets close and when it catches him. */
  voice (v: Voice, big = false): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    const g = big ? 1.4 : 1;
    switch (v) {
      case 'roar':
        this.tone(220, now, 0.14 * g, 0.9, 'sawtooth', 70);
        this.hiss(now, 0.2 * g, 0.9, 500, 0.6, 'lowpass', 150);
        break;
      case 'growl':
        this.wobble(110, now, 0.16 * g, 0.8, 22, 18, 'sawtooth', 90);
        break;
      case 'hoot':
        for (let i = 0; i < 3; i++) this.tone(300 + i * 60, now + i * 0.18, 0.12 * g, 0.16, 'sine', 420 + i * 60);
        break;
      case 'gloop':
        for (let i = 0; i < 5; i++) this.tone(200 + i * 70, now + i * 0.09, 0.12 * g, 0.1, 'sine', 500 + i * 90);
        break;
      case 'snap':
        this.hiss(now, 0.3 * g, 0.05, 1500, 2);
        this.hiss(now + 0.18, 0.3 * g, 0.05, 1500, 2);
        this.tone(140, now, 0.1, 0.3, 'square', 90);
        break;
      case 'screech':
        this.tone(1200, now, 0.06 * g, 0.4, 'sawtooth', 2200);
        this.tone(1250, now + 0.02, 0.04 * g, 0.4, 'square', 2000);
        break;
      case 'moan':
        this.wobble(196, now, 0.12 * g, 1.2, 5, 12, 'triangle', 150);
        break;
      case 'cackle':
        for (let i = 0; i < 6; i++) this.tone(600 - i * 25, now + i * 0.1, 0.07 * g, 0.08, 'square', 500 - i * 25);
        break;
      case 'creak':
        this.wobble(80, now, 0.14 * g, 1.1, 30, 30, 'sawtooth', 160);
        this.tone(900, now + 0.3, 0.03 * g, 0.8, 'sine', 400);
        break;
    }
  }

  /** Caught: a silly slide down and a giggle of notes back up. */
  caught (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime + 0.5;
    this.wobble(523.25, now, 0.08, 0.7, 7, 25, 'triangle', 196);
    [0, 2, 4, 2, 4, 5].forEach((n, i) => this.tone(SCALE[n], now + 0.9 + i * 0.11, 0.07, 0.16, 'square'));
    this.tone(SCALE[7], now + 1.6, 0.08, 0.5, 'triangle');
  }

  /** Go: three rising notes. */
  go (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    [0, 2, 4].forEach((n, i) => this.tone(SCALE[n], now + i * 0.12, 0.08, 0.18, 'triangle'));
    this.tone(SCALE[5], now + 0.36, 0.09, 0.4, 'triangle');
  }

  tap (): void {
    const ctx = this.ready; if (!ctx) return;
    this.tone(SCALE[3], ctx.currentTime, 0.06, 0.1, 'triangle');
  }
}
