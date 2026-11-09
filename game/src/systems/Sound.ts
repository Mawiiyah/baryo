import { SOUND, type SpawnSound } from '../config';
import type { Side, World, WorldEvent } from '../sim/World';

/** Synthesized na sound effects (Web Audio). Nakikinig lang sa `WorldEvent`s. */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastAt: Partial<Record<Side, number>> = {};
  muted = !SOUND.enabled;

  constructor(world: World) {
    world.on((e) => this.onWorld(e));
    // Autoplay policy ng browser: kailangan ng gesture bago tumunog (sa OBS, kusa na).
    const unlock = () => void this.ensure()?.resume();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = SOUND.masterGain;
    this.master.connect(this.ctx.destination);
    // 1 segundong white noise, inuulit-ulit
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return this.ctx;
  }

  private onWorld(e: WorldEvent) {
    if (e.type !== 'spawn' || this.muted) return;
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') return;
    const now = performance.now();
    const last = this.lastAt[e.unit.side] ?? -Infinity;
    if (now - last < SOUND.minGapMs) return;
    this.lastAt[e.unit.side] = now;
    this.play(ctx, SOUND.spawn[e.unit.kind]);
  }

  private play(ctx: AudioContext, s: SpawnSound) {
    const out = this.master!;
    const t0 = ctx.currentTime;
    const dur = s.noteMs / 1000;
    const atk = SOUND.attackMs / 1000;
    const rel = SOUND.releaseMs / 1000;
    s.notes.forEach((hz, i) => {
      const start = t0 + i * dur;
      const end = start + dur;
      const osc = ctx.createOscillator();
      osc.type = s.wave;
      osc.frequency.setValueAtTime(hz, start);
      if (s.slide !== 1) osc.frequency.exponentialRampToValueAtTime(hz * s.slide, end);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(s.gain, start + atk);
      g.gain.setValueAtTime(s.gain, end);
      g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(end + rel);
    });
    if (s.noise > 0 && this.noiseBuf) {
      const total = s.notes.length * dur;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = SOUND.noiseLowpassHz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(s.gain * s.noise, t0 + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + total + rel);
      src.connect(lp).connect(g).connect(out);
      src.start(t0);
      src.stop(t0 + total + rel);
    }
  }
}
