/** Soft AV — oscillator beds, quiet looping music, short blips. No FOMO stingers. */

import musicUrl from '../../assets/audio/rain-on-glass.mp3';

export type SkillCue = 'clamp' | 'shutoff' | 'pulse' | 'sleeve' | 'coffee';

type Tone = {
  freq: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  slide?: number;
  /** Extra partial an octave up. */
  harmonic?: number;
  /** Short noise click under the tone. */
  click?: number;
  /** Optional voice filter. */
  filter?: { type: BiquadFilterType; freq: number; q?: number };
};

export type AmbientMood = 'warm' | 'plant' | 'cold' | 'night' | 'default';

/** Soft / Full / Off presets for the HUD cycle. */
export type SoundPreset = 'off' | 'soft' | 'full';

/** Quiet bed under the oscillator drones — fills space without competing with SFX. */
const MUSIC_BED_GAIN = 0.16;

export function moodForMap(mapId: string): AmbientMood {
  switch (mapId) {
    case 'crawlspace':
    case 'attic':
      return 'warm';
    case 'boilerRoom':
    case 'mechanicalRoom':
    case 'heatPlant':
      return 'plant';
    case 'snowmelt':
      return 'cold';
    case 'serviceCall':
      return 'night';
    default:
      return 'default';
  }
}

const MOOD_FREQ: Record<AmbientMood, [number, number]> = {
  warm: [88, 132],
  plant: [72, 108],
  cold: [110, 164],
  night: [64, 96],
  default: [80, 120],
};

export class AudioBus {
  muted: boolean;
  sfxGain: number;
  ambientGain: number;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambientMood: AmbientMood | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicLoad: Promise<AudioBuffer | null> | null = null;
  private lastKillAt = 0;
  private killsThisBurst = 0;
  private lastHitAt = 0;
  private lastShotAt = 0;
  private lastDripAt = 0;

  constructor(opts: { muted?: boolean; sfxGain?: number; ambientGain?: number } = {}) {
    this.muted = opts.muted ?? false;
    this.sfxGain = clamp01(opts.sfxGain ?? 0.85);
    this.ambientGain = clamp01(opts.ambientGain ?? 0.55);
  }

  unlock(): void {
    const ctx = this.ensure();
    if (ctx?.state === 'suspended') void ctx.resume();
    this.applyGains();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGains();
  }

  setVolumes(sfx: number, ambient: number): void {
    this.sfxGain = clamp01(sfx);
    this.ambientGain = clamp01(ambient);
    this.applyGains();
  }

  /** Apply Soft / Full / Off preset. */
  applyPreset(preset: SoundPreset): void {
    switch (preset) {
      case 'off':
        this.muted = true;
        break;
      case 'soft':
        this.muted = false;
        this.sfxGain = 0.85;
        this.ambientGain = 0.18;
        break;
      case 'full':
        this.muted = false;
        this.sfxGain = 0.85;
        this.ambientGain = 0.55;
        break;
      default: {
        const _exhaustive: never = preset;
        return _exhaustive;
      }
    }
    this.applyGains();
  }

  /** Infer preset from current mute/volumes (for HUD label). */
  preset(): SoundPreset {
    if (this.muted) return 'off';
    if (this.ambientGain <= 0.28) return 'soft';
    return 'full';
  }

  cyclePreset(): SoundPreset {
    const order: SoundPreset[] = ['off', 'soft', 'full'];
    const next = order[(order.indexOf(this.preset()) + 1) % order.length]!;
    this.applyPreset(next);
    return next;
  }

  place(): void {
    this.play({ freq: 390, dur: 0.09, type: 'triangle', gain: 0.055, click: 0.034, filter: { type: 'lowpass', freq: 1800 } });
    this.play({ freq: 520, dur: 0.08, type: 'sine', gain: 0.03, slide: 680, harmonic: 0.014 });
    this.play({ freq: 180, dur: 0.07, type: 'square', gain: 0.012, filter: { type: 'lowpass', freq: 420 } });
  }
  upgrade(): void {
    this.play({ freq: 480, dur: 0.1, type: 'triangle', gain: 0.055, slide: 760, click: 0.028 });
    this.play({ freq: 720, dur: 0.13, type: 'sine', gain: 0.032, slide: 920, harmonic: 0.016 });
    this.play({ freq: 240, dur: 0.08, type: 'sine', gain: 0.018, slide: 360 });
  }
  sell(): void {
    this.play({ freq: 340, dur: 0.11, type: 'sine', gain: 0.04, slide: 160, click: 0.022 });
    this.play({ freq: 210, dur: 0.09, type: 'triangle', gain: 0.02, slide: 120 });
  }
  wave(): void {
    this.play({ freq: 196, dur: 0.22, type: 'triangle', gain: 0.06, slide: 262, click: 0.024 });
    this.play({ freq: 330, dur: 0.16, type: 'sine', gain: 0.034, slide: 392, harmonic: 0.012 });
    this.play({ freq: 98, dur: 0.2, type: 'sine', gain: 0.022, slide: 130, filter: { type: 'lowpass', freq: 280 } });
  }

  /** Soft layered pop — rate-limited when many leaks die in one frame. */
  kill(): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    if (now - this.lastKillAt > 0.12) this.killsThisBurst = 0;
    if (this.killsThisBurst >= 3) return;
    this.killsThisBurst++;
    this.lastKillAt = now;
    const bump = this.killsThisBurst * 28;
    this.play({ freq: 640 + bump, dur: 0.06, type: 'sine', gain: 0.032, click: 0.032 });
    this.play({ freq: 190 + bump * 0.3, dur: 0.11, type: 'triangle', gain: 0.026, slide: 130 });
    this.play({ freq: 110 + bump * 0.15, dur: 0.08, type: 'sine', gain: 0.016, filter: { type: 'lowpass', freq: 240 } });
  }

  /** Low moan when a leak escapes. */
  leak(): void {
    this.play({ freq: 150, dur: 0.28, type: 'sine', gain: 0.055, slide: 64, click: 0.02 });
    this.play({ freq: 88, dur: 0.24, type: 'triangle', gain: 0.03, slide: 46 });
    this.play({ freq: 52, dur: 0.2, type: 'sine', gain: 0.02, filter: { type: 'lowpass', freq: 160 } });
  }

  /** Metal tick — rate-limited. */
  hit(): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    if (ctx.currentTime - this.lastHitAt < 0.034) return;
    this.lastHitAt = ctx.currentTime;
    this.play({ freq: 860, dur: 0.036, type: 'triangle', gain: 0.022, click: 0.018, filter: { type: 'highpass', freq: 380 } });
    this.play({ freq: 250, dur: 0.045, type: 'sine', gain: 0.014, slide: 150 });
  }

  /** Jeff’s wrench — brass clang with body. */
  wrench(): void {
    this.play({ freq: 196, dur: 0.09, type: 'triangle', gain: 0.052, slide: 128, click: 0.048, filter: { type: 'lowpass', freq: 1400 } });
    this.play({ freq: 920, dur: 0.055, type: 'sine', gain: 0.032, slide: 480, harmonic: 0.016 });
    this.play({ freq: 78, dur: 0.08, type: 'sine', gain: 0.028, filter: { type: 'lowpass', freq: 220 } });
    this.play({ freq: 1480, dur: 0.03, type: 'square', gain: 0.01, slide: 720, filter: { type: 'highpass', freq: 900, q: 0.7 } });
  }

  /** Tower shot / aura pulse. */
  shot(): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    if (ctx.currentTime - this.lastShotAt < 0.055) return;
    this.lastShotAt = ctx.currentTime;
    this.play({ freq: 310, dur: 0.045, type: 'triangle', gain: 0.028, slide: 190, click: 0.022, filter: { type: 'lowpass', freq: 1200 } });
    this.play({ freq: 640, dur: 0.03, type: 'sine', gain: 0.016, slide: 420 });
  }

  skill(cue: SkillCue): void {
    switch (cue) {
      case 'clamp':
        this.play({ freq: 160, dur: 0.18, type: 'triangle', gain: 0.06, slide: 90, click: 0.04, filter: { type: 'lowpass', freq: 700 } });
        this.play({ freq: 420, dur: 0.12, type: 'sine', gain: 0.03, slide: 220 });
        this.play({ freq: 70, dur: 0.16, type: 'sine', gain: 0.028, filter: { type: 'lowpass', freq: 180 } });
        break;
      case 'shutoff':
        this.play({ freq: 220, dur: 0.28, type: 'sine', gain: 0.055, slide: 90, click: 0.03, filter: { type: 'lowpass', freq: 500 } });
        this.play({ freq: 440, dur: 0.2, type: 'triangle', gain: 0.03, slide: 180 });
        this.play({ freq: 88, dur: 0.24, type: 'sine', gain: 0.03, slide: 48 });
        break;
      case 'pulse':
        this.play({ freq: 340, dur: 0.14, type: 'triangle', gain: 0.058, slide: 620, click: 0.036 });
        this.play({ freq: 680, dur: 0.12, type: 'sine', gain: 0.03, slide: 980, harmonic: 0.018 });
        this.play({ freq: 110, dur: 0.12, type: 'sine', gain: 0.024, filter: { type: 'lowpass', freq: 240 } });
        break;
      case 'sleeve':
        this.play({ freq: 180, dur: 0.16, type: 'triangle', gain: 0.045, slide: 260, click: 0.028, filter: { type: 'bandpass', freq: 420, q: 0.8 } });
        this.play({ freq: 300, dur: 0.12, type: 'sine', gain: 0.024, slide: 180 });
        break;
      case 'coffee':
        this.play({ freq: 240, dur: 0.16, type: 'sine', gain: 0.045, slide: 360, click: 0.022 });
        this.play({ freq: 480, dur: 0.14, type: 'triangle', gain: 0.028, slide: 620, harmonic: 0.012 });
        this.play({ freq: 140, dur: 0.12, type: 'sine', gain: 0.02, filter: { type: 'lowpass', freq: 280 } });
        break;
      default: {
        const _exhaustive: never = cue;
        return _exhaustive;
      }
    }
  }

  ability(): void {
    this.skill('pulse');
  }

  /** Distinct, restrained cues follow the actual contact/release event. */
  heroImpact(kind: string): void {
    if (kind === 'laser') {
      this.play({ freq: 1250, slide: 180, dur: .15, type: 'sawtooth', gain: .027, filter: { type: 'lowpass', freq: 1800 } });
    } else if (kind === 'saw') {
      this.play({ freq: 95, slide: 155, dur: .16, type: 'sawtooth', gain: .03, click: .015, filter: { type: 'bandpass', freq: 650, q: .6 } });
    } else if (kind === 'punch' || kind === 'slam') {
      this.play({ freq: kind === 'slam' ? 68 : 130, slide: 38, dur: kind === 'slam' ? .25 : .11, type: 'triangle', gain: .055, click: .035, filter: { type: 'lowpass', freq: 600 } });
    } else if (kind === 'horn') {
      this.play({ freq: 220, dur: .36, type: 'square', gain: .022, filter: { type: 'lowpass', freq: 800 } });
      this.play({ freq: 277, dur: .36, type: 'triangle', gain: .028 });
    } else if (kind === 'golf') {
      this.play({ freq: 1450, slide: 610, dur: .08, type: 'triangle', gain: .035, click: .035 });
    } else if (kind === 'plunger') {
      this.play({ freq: 310, slide: 100, dur: .12, type: 'sine', gain: .04, click: .014 });
    } else if (kind === 'summon') {
      this.play({ freq: 300, slide: 710, dur: .2, type: 'triangle', gain: .035, harmonic: .01 });
    } else if (kind === 'emp') this.skill('pulse');
    else this.skill('sleeve');
  }

  /** Soft confirm when Jeff gets a move or attack order. */
  order(): void {
    this.play({ freq: 460, dur: 0.08, type: 'triangle', gain: 0.042, slide: 700, click: 0.02 });
    this.play({ freq: 220, dur: 0.06, type: 'sine', gain: 0.016, slide: 300 });
  }
  win(): void {
    this.play({ freq: 392, dur: 0.2, type: 'triangle', gain: 0.058, slide: 523, click: 0.022 });
    this.play({ freq: 659, dur: 0.22, type: 'sine', gain: 0.032, slide: 784, harmonic: 0.014 });
    this.play({ freq: 196, dur: 0.18, type: 'sine', gain: 0.02, slide: 262 });
  }
  lose(): void {
    this.play({ freq: 196, dur: 0.32, type: 'sine', gain: 0.055, slide: 98, click: 0.022 });
    this.play({ freq: 98, dur: 0.28, type: 'triangle', gain: 0.03, slide: 64 });
  }
  clock(): void {
    this.play({ freq: 330, dur: 0.16, type: 'sine', gain: 0.048, slide: 494, click: 0.02 });
    this.play({ freq: 196, dur: 0.12, type: 'triangle', gain: 0.02, slide: 262 });
  }

  /** Occasional pipe drip in the yard. */
  dripTick(): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    if (ctx.currentTime - this.lastDripAt < 1.8) return;
    this.lastDripAt = ctx.currentTime;
    this.play({ freq: 980, dur: 0.04, type: 'sine', gain: 0.016, slide: 620, click: 0.012, filter: { type: 'highpass', freq: 500 } });
    this.play({ freq: 420, dur: 0.06, type: 'triangle', gain: 0.01, slide: 260 });
  }

  startAmbient(mood: AmbientMood): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (this.ambientMood === mood && this.ambientNodes.length > 0) {
      this.applyGains();
      void this.ensureMusicBed();
      return;
    }
    this.stopAmbient();
    this.ambientMood = mood;
    const [f1, f2] = MOOD_FREQ[mood];
    const bus = this.ambientBus!;
    const now = ctx.currentTime;

    const makeDrone = (freq: number, type: OscillatorType, gain: number): void => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.08, now);
      lfoGain.gain.setValueAtTime(freq * 0.012, now);
      g.gain.setValueAtTime(0.0001, now);
      // Quieter drones so Rain on Glass can fill the bed.
      g.gain.exponentialRampToValueAtTime(gain * 0.45, now + 1.4);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(g);
      g.connect(bus);
      osc.start();
      lfo.start();
      this.ambientNodes.push(osc, lfo, g, lfoGain);
    };

    makeDrone(f1, 'sine', 0.028);
    makeDrone(f2, 'triangle', 0.016);

    // soft filtered noise bed (pipe hiss / snow)
    const noise = this.makeNoiseBuffer(ctx);
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(mood === 'cold' ? 900 : mood === 'plant' ? 280 : 420, now);
      filter.Q.setValueAtTime(0.7, now);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime((mood === 'night' ? 0.012 : 0.018) * 0.55, now + 1.6);
      src.connect(filter);
      filter.connect(ng);
      ng.connect(bus);
      src.start();
      this.ambientNodes.push(src, filter, ng);
    }

    this.applyGains();
    void this.ensureMusicBed();
  }

  stopAmbient(): void {
    this.stopMusicBed();
    for (const node of this.ambientNodes) {
      try {
        if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
          node.stop();
        }
      } catch {
        // already stopped
      }
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    }
    this.ambientNodes = [];
    this.ambientMood = null;
  }

  /** Decode and start the looping music bed if ambient is active. */
  private async ensureMusicBed(): Promise<void> {
    const ctx = this.ensure();
    if (!ctx || !this.ambientBus || this.ambientMood === null) return;
    if (this.musicSource) {
      this.applyGains();
      return;
    }
    const buffer = await this.loadMusic();
    if (!buffer || this.ambientMood === null || !this.ambientBus) return;
    if (this.musicSource) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(MUSIC_BED_GAIN, now + 2.2);
    src.connect(g);
    g.connect(this.ambientBus);
    src.start();
    this.musicSource = src;
    this.musicGain = g;
    this.ambientNodes.push(src, g);
  }

  private stopMusicBed(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // already stopped
      }
      try {
        this.musicSource.disconnect();
      } catch {
        // ignore
      }
      this.musicSource = null;
    }
    if (this.musicGain) {
      try {
        this.musicGain.disconnect();
      } catch {
        // ignore
      }
      this.musicGain = null;
    }
  }

  private loadMusic(): Promise<AudioBuffer | null> {
    if (this.musicBuffer) return Promise.resolve(this.musicBuffer);
    if (!this.musicLoad) {
      this.musicLoad = (async () => {
        const ctx = this.ensure();
        if (!ctx) return null;
        try {
          const res = await fetch(musicUrl);
          if (!res.ok) return null;
          const raw = await res.arrayBuffer();
          this.musicBuffer = await ctx.decodeAudioData(raw.slice(0));
          return this.musicBuffer;
        } catch {
          return null;
        }
      })();
    }
    return this.musicLoad;
  }

  private makeNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
    try {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
      return buf;
    } catch {
      return null;
    }
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.ambientBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.ambientBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyGains();
    }
    return this.ctx;
  }

  private applyGains(): void {
    if (!this.master || !this.sfxBus || !this.ambientBus) return;
    const t = this.ctx?.currentTime ?? 0;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.sfxGain, t, 0.03);
    this.ambientBus.gain.setTargetAtTime(this.muted ? 0 : this.ambientGain, t, 0.05);
  }

  private play(t: Tone): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running' || !this.sfxBus) return;
    const now = ctx.currentTime;
    const peak = Math.max(0.0001, t.gain);
    const voice = (freq: number, type: OscillatorType, gainAmt: number, dur: number, slide?: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide !== undefined) osc.frequency.linearRampToValueAtTime(slide, now + dur);
      gain.gain.setValueAtTime(gainAmt, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      if (t.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = t.filter.type;
        filter.frequency.setValueAtTime(t.filter.freq, now);
        filter.Q.setValueAtTime(t.filter.q ?? 0.8, now);
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }
      gain.connect(this.sfxBus!);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    };
    voice(t.freq, t.type, peak, t.dur, t.slide);
    if (t.harmonic) voice(t.freq * 2, 'sine', t.harmonic, t.dur * 0.7, t.slide ? t.slide * 2 : undefined);
    if (t.click && t.click > 0) this.playClick(now, t.click, Math.min(0.05, t.dur));
  }

  private playClick(at: number, gainAmt: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const noise = this.makeNoiseBuffer(ctx);
    if (!noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainAmt, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(at);
    src.stop(at + dur + 0.02);
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
