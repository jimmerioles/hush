/**
 * Tiny synthesized soundscape for the prototype.
 * No samples: a low ambient drone, a filtered air layer, soft absorption
 * chimes and a bloom chord. Everything starts on a user gesture.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private muted = false;

  async start(): Promise<void> {
    let ctx = this.ctx;
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!Ctor) return;

      ctx = new Ctor({ latencyHint: "interactive" });
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.16;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 8;
      comp.ratio.value = 4;
      comp.attack.value = 0.01;
      comp.release.value = 0.2;

      master.connect(comp).connect(ctx.destination);
      this.master = master;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 340;
      filter.Q.value = 0.6;

      const ambient = ctx.createGain();
      ambient.gain.value = 0.12;
      filter.connect(ambient).connect(master);
      this.filter = filter;
      this.ambientGain = ambient;

      for (const [freq, detune] of [
        [110, -4],
        [164.81, 3],
        [220, 6],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const gain = ctx.createGain();
        gain.gain.value = 0.3;
        osc.connect(gain).connect(filter);
        osc.start();
      }

      const length = Math.floor(ctx.sampleRate * 2);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 900;
      band.Q.value = 0.7;

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.02;
      noise.connect(band).connect(noiseGain).connect(master);
      noise.start();
      this.noiseGain = noiseGain;
    }

    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  setFocus(progress: number): void {
    const ctx = this.ctx;
    const filter = this.filter;
    const ambient = this.ambientGain;
    const noise = this.noiseGain;
    if (!ctx || !filter || !ambient || !noise) return;

    const t = ctx.currentTime;
    filter.frequency.setTargetAtTime(340 + progress * 900, t, 0.25);
    ambient.gain.setTargetAtTime(0.1 + progress * 0.08, t, 0.25);
    noise.gain.setTargetAtTime(0.025 * (1 - progress * 0.85), t, 0.25);
  }

  chime(pan: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;
    const notes = [523.25, 587.33, 659.25, 783.99, 880];
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = notes[Math.floor(Math.random() * notes.length)];

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.045, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.7, Math.min(0.7, pan * 1.4 - 0.7));

    osc.connect(gain).connect(panner).connect(master);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  bloom(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;
    [220, 277.18, 329.63, 440].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const start = t + index * 0.045;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.03, start + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 3);

      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + 3.1);
    });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const ctx = this.ctx;
    const master = this.master;
    if (ctx && master) {
      master.gain.setTargetAtTime(muted ? 0 : 0.16, ctx.currentTime, 0.05);
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }
}
