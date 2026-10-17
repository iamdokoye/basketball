// Music for the recap slideshows, synthesised with the Web Audio API so there are no audio files to
// host or license. The month plays a bright, bouncy groove in C major. The year plays a slower
// anthem in D major (strings, brass, timpani, a snare roll before each reveal, a big reverb).
//
// `scheduleBar` and `playAccent` only need a BaseAudioContext, so they can also render offline.

export type MusicTier = "month" | "year";
/** One-off moments over the loop: the opening, the build-up to a reveal, the reveal, the finale. */
export type Accent = "title" | "build" | "reveal" | "finale";

export type Bus = { input: GainNode; master: GainNode };

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

type Mel = [step: number, midi: number, len: number];
type BarDef = { bass: number; chord: number[]; mel: Mel[] };

// 8 eighth-note steps per bar, 4/4.
const MONTH: { bpm: number; bars: BarDef[] } = {
  bpm: 104,
  bars: [
    { bass: 36, chord: [60, 64, 67], mel: [[0, 76, 2], [2, 79, 2], [4, 84, 2], [6, 79, 2]] }, // C
    { bass: 43, chord: [59, 62, 67], mel: [[0, 74, 2], [2, 79, 2], [4, 83, 2], [6, 79, 2]] }, // G
    { bass: 45, chord: [60, 64, 69], mel: [[0, 72, 2], [2, 76, 2], [4, 81, 2], [6, 76, 2]] }, // Am
    { bass: 41, chord: [60, 65, 69], mel: [[0, 72, 2], [2, 77, 2], [4, 81, 2], [6, 84, 2]] }, // F
  ],
};

const YEAR: { bpm: number; bars: BarDef[] } = {
  bpm: 88,
  bars: [
    { bass: 38, chord: [62, 66, 69], mel: [[0, 74, 3], [3, 78, 1], [4, 81, 4]] }, // D
    { bass: 45, chord: [61, 64, 69], mel: [[0, 81, 2], [2, 85, 2], [4, 83, 2], [6, 81, 2]] }, // A
    { bass: 47, chord: [62, 66, 71], mel: [[0, 83, 3], [3, 81, 1], [4, 78, 4]] }, // Bm
    { bass: 43, chord: [62, 67, 71], mel: [[0, 79, 2], [2, 83, 2], [4, 81, 2], [6, 79, 2]] }, // G
    { bass: 38, chord: [62, 66, 69], mel: [[0, 74, 2], [2, 78, 2], [4, 81, 2], [6, 86, 2]] }, // D
    { bass: 45, chord: [61, 64, 69], mel: [[0, 85, 3], [3, 83, 1], [4, 81, 4]] }, // A
    { bass: 43, chord: [62, 67, 71], mel: [[0, 79, 2], [2, 81, 2], [4, 83, 2], [6, 86, 2]] }, // G
    { bass: 45, chord: [61, 64, 69], mel: [[0, 85, 6], [6, 81, 2]] }, // A, back round to D
  ],
};

const SONG = { month: MONTH, year: YEAR } as const;

export const barSeconds = (tier: MusicTier) => (60 / SONG[tier].bpm) * 4;

// ---- building blocks ---------------------------------------------------------------------------------

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

/** Master gain, a compressor and a limiter so stacked hits never clip, and a reverb tail. */
export function makeBus(ctx: BaseAudioContext, tier: MusicTier): Bus {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.knee.value = 8;
  comp.ratio.value = 6;
  comp.attack.value = 0.004;
  comp.release.value = 0.25;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  master.connect(comp).connect(limiter).connect(ctx.destination);

  const input = ctx.createGain();
  input.gain.value = tier === "year" ? 0.6 : 1; // the year stacks far more voices
  input.connect(master);
  const verb = ctx.createConvolver();
  verb.buffer = tier === "year" ? impulse(ctx, 3.2, 2.2) : impulse(ctx, 1.4, 2.6);
  const send = ctx.createGain();
  send.gain.value = tier === "year" ? 0.4 : 0.2;
  input.connect(send).connect(verb).connect(master);
  return { input, master };
}

type VoiceOpts = {
  type: OscillatorType;
  freq: number;
  t: number;
  dur: number;
  gain: number;
  /** "pluck" decays straight away; "hold" swells in, sustains, then releases. */
  shape?: "pluck" | "hold";
  attack?: number;
  release?: number;
  detune?: number;
  /** Low-pass sweep [from, to, seconds to get there]. */
  lp?: [number, number, number];
  vibrato?: boolean;
};

function voice(ctx: BaseAudioContext, bus: Bus, o: VoiceOpts) {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.value = o.freq;
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  const a = o.attack ?? 0.01;
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.linearRampToValueAtTime(o.gain, o.t + a);
  if ((o.shape ?? "hold") === "pluck") {
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  } else {
    const r = Math.min(o.release ?? 0.2, o.dur - a);
    g.gain.setValueAtTime(o.gain, o.t + o.dur - r);
    g.gain.linearRampToValueAtTime(0.0001, o.t + o.dur);
  }
  let tail: AudioNode = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(o.lp[0], o.t);
    f.frequency.exponentialRampToValueAtTime(o.lp[1], o.t + o.lp[2]);
    osc.connect(f);
    tail = f;
  }
  tail.connect(g).connect(bus.input);
  if (o.vibrato && o.dur > 0.5) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, o.t);
    depth.gain.linearRampToValueAtTime(9, o.t + o.dur * 0.6);
    lfo.connect(depth).connect(osc.detune);
    lfo.start(o.t);
    lfo.stop(o.t + o.dur + 0.05);
  }
  osc.start(o.t);
  osc.stop(o.t + o.dur + 0.05);
}

type NoiseOpts = {
  t: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  /** Sweep the filter to this frequency over the duration. */
  sweepTo?: number;
  /** Fade in over the whole duration instead of decaying (for risers). */
  rise?: boolean;
};

function noise(ctx: BaseAudioContext, bus: Bus, o: NoiseOpts) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.filter;
  f.Q.value = o.q ?? 0.8;
  f.frequency.setValueAtTime(o.freq, o.t);
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, o.t + o.dur);
  const g = ctx.createGain();
  if (o.rise) {
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.exponentialRampToValueAtTime(o.gain, o.t + o.dur * 0.95);
    g.gain.linearRampToValueAtTime(0.0001, o.t + o.dur);
  } else {
    g.gain.setValueAtTime(o.gain, o.t);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  }
  src.connect(f).connect(g).connect(bus.input);
  src.start(o.t, Math.random());
  src.stop(o.t + o.dur + 0.05);
}

const kick = (c: BaseAudioContext, b: Bus, t: number, gain = 0.5) => {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(g).connect(b.input);
  osc.start(t);
  osc.stop(t + 0.3);
};

const snare = (c: BaseAudioContext, b: Bus, t: number, gain = 0.18) =>
  noise(c, b, { t, dur: 0.16, gain, filter: "bandpass", freq: 1900, q: 0.6 });

const hat = (c: BaseAudioContext, b: Bus, t: number, gain = 0.05) =>
  noise(c, b, { t, dur: 0.05, gain, filter: "highpass", freq: 7500 });

const crash = (c: BaseAudioContext, b: Bus, t: number, gain = 0.28, dur = 2.4) =>
  noise(c, b, { t, dur, gain, filter: "highpass", freq: 4500, q: 0.4 });

/** A tuned drum: pitch falls fast, with a thump of noise on top. */
function timpani(c: BaseAudioContext, b: Bus, t: number, midi = 38, gain = 0.6) {
  const f = mtof(midi);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.setValueAtTime(f * 1.9, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.09);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  osc.connect(g).connect(b.input);
  osc.start(t);
  osc.stop(t + 1.15);
  noise(c, b, { t, dur: 0.08, gain: gain * 0.35, filter: "lowpass", freq: 500 });
}

/** A bell: a sine and a bright partial, ringing out. */
function bell(c: BaseAudioContext, b: Bus, t: number, midi: number, gain = 0.1, dur = 1.6) {
  voice(c, b, { type: "sine", freq: mtof(midi), t, dur, gain, shape: "pluck", attack: 0.004 });
  voice(c, b, { type: "triangle", freq: mtof(midi) * 2.01, t, dur: dur * 0.6, gain: gain * 0.4, shape: "pluck" });
}

/** A brass chord: stacked sawtooths whose filter opens as the note speaks. */
function brass(c: BaseAudioContext, b: Bus, t: number, notes: number[], dur: number, gain = 0.045) {
  for (const m of notes)
    for (const d of [-7, 7])
      voice(c, b, {
        type: "sawtooth",
        freq: mtof(m),
        t,
        dur,
        gain,
        attack: 0.04,
        release: Math.min(0.9, dur * 0.5),
        detune: d,
        lp: [500, 3000, 0.18],
      });
}

// ---- the loop ----------------------------------------------------------------------------------------

/** Schedules one bar of the loop starting at time `t`. `bar` counts up forever and wraps by itself. */
export function scheduleBar(ctx: BaseAudioContext, bus: Bus, tier: MusicTier, bar: number, t: number) {
  const song = SONG[tier];
  const def = song.bars[bar % song.bars.length];
  const step = 60 / song.bpm / 2;
  const barLen = step * 8;

  if (tier === "month") {
    for (const m of def.chord)
      voice(ctx, bus, { type: "triangle", freq: mtof(m), t, dur: barLen, gain: 0.03, attack: 0.08, release: 0.3 });
    for (const [s, len] of [[0, 3], [4, 2], [7, 1]] as const)
      voice(ctx, bus, { type: "sine", freq: mtof(def.bass), t: t + s * step, dur: len * step, gain: 0.17, attack: 0.01, release: 0.05 });
    const arp = [0, 1, 2, 1, 0, 1, 2, 1];
    arp.forEach((n, i) =>
      voice(ctx, bus, { type: "triangle", freq: mtof(def.chord[n] + 12), t: t + i * step, dur: step * 1.6, gain: 0.032, shape: "pluck" }),
    );
    for (const s of [0, 4]) kick(ctx, bus, t + s * step, 0.42);
    for (const s of [2, 6]) snare(ctx, bus, t + s * step, 0.1);
    for (const s of [1, 3, 5, 7]) hat(ctx, bus, t + s * step, 0.035);
    for (const [s, m, len] of def.mel) {
      voice(ctx, bus, { type: "triangle", freq: mtof(m), t: t + s * step, dur: len * step * 0.95, gain: 0.06, attack: 0.012, release: 0.08 });
      voice(ctx, bus, { type: "sine", freq: mtof(m + 12), t: t + s * step, dur: len * step * 0.8, gain: 0.015, shape: "pluck" });
    }
    return;
  }

  // Year: strings and a sub-bass under everything, timpani on the downbeats, brass on the tune.
  for (const m of def.chord)
    for (const d of [-9, 0, 9])
      voice(ctx, bus, { type: "sawtooth", freq: mtof(m), t, dur: barLen, gain: 0.016, attack: 0.4, release: 0.5, detune: d, lp: [900, 1500, barLen] });
  voice(ctx, bus, { type: "sawtooth", freq: mtof(def.bass), t, dur: barLen, gain: 0.07, attack: 0.05, release: 0.3, lp: [320, 320, 1] });
  voice(ctx, bus, { type: "sine", freq: mtof(def.bass), t, dur: barLen, gain: 0.2, attack: 0.03, release: 0.3 });
  timpani(ctx, bus, t, def.bass, 0.55);
  if (bar % 2 === 1) timpani(ctx, bus, t + 4 * step, def.bass, 0.4);
  const last = bar % song.bars.length === song.bars.length - 1;
  if (last) {
    // A snare roll into the top of the loop.
    for (let i = 0; i < 16; i++) snare(ctx, bus, t + i * (step / 2), 0.04 + (i / 16) * 0.16);
  } else if (bar % song.bars.length >= 2) {
    for (const s of [2, 6]) snare(ctx, bus, t + s * step, 0.09);
  }
  if (bar > 0 && bar % song.bars.length === 0) crash(ctx, bus, t, 0.14, 1.8);
  for (const [s, m, len] of def.mel) {
    const dur = len * step * 0.97;
    voice(ctx, bus, { type: "sawtooth", freq: mtof(m), t: t + s * step, dur, gain: 0.04, attack: 0.05, release: 0.15, detune: -6, lp: [700, 2600, 0.2], vibrato: true });
    voice(ctx, bus, { type: "sawtooth", freq: mtof(m), t: t + s * step, dur, gain: 0.04, attack: 0.05, release: 0.15, detune: 6, lp: [700, 2600, 0.2], vibrato: true });
    voice(ctx, bus, { type: "sine", freq: mtof(m - 12), t: t + s * step, dur, gain: 0.04, attack: 0.05, release: 0.15 });
  }
}

// ---- accents -----------------------------------------------------------------------------------------

/**
 * One-off moments played over the loop. `build` should be scheduled `lead` seconds before the reveal it
 * leads into (the year's snare roll takes longer than the month's swoosh).
 */
export function playAccent(ctx: BaseAudioContext, bus: Bus, tier: MusicTier, kind: Accent, t: number) {
  if (tier === "month") {
    switch (kind) {
      case "title":
        noise(ctx, bus, { t, dur: 1.1, gain: 0.08, filter: "bandpass", freq: 300, sweepTo: 3200, rise: true });
        [72, 76, 79, 84].forEach((m, i) => bell(ctx, bus, t + 0.9 + i * 0.08, m, 0.08, 2));
        break;
      case "build":
        noise(ctx, bus, { t, dur: 1.2, gain: 0.1, filter: "bandpass", freq: 500, sweepTo: 4200, rise: true });
        break;
      case "reveal":
        kick(ctx, bus, t, 0.5);
        [84, 88, 91, 96].forEach((m, i) => bell(ctx, bus, t + i * 0.07, m, 0.1, 1.8));
        break;
      case "finale":
        kick(ctx, bus, t, 0.55);
        crash(ctx, bus, t, 0.2, 1.8);
        [72, 76, 79, 84, 88, 91, 96, 100].forEach((m, i) => bell(ctx, bus, t + i * 0.09, m, 0.09, 2.2));
        for (const m of [60, 64, 67, 72])
          voice(ctx, bus, { type: "triangle", freq: mtof(m), t, dur: 3, gain: 0.05, attack: 0.05, release: 1.4 });
        break;
    }
    return;
  }
  switch (kind) {
    case "title":
      crash(ctx, bus, t, 0.34, 3);
      timpani(ctx, bus, t, 38, 0.85);
      timpani(ctx, bus, t + 0.01, 26, 0.6);
      brass(ctx, bus, t, [50, 62, 66, 69, 74], 3.4, 0.04);
      break;
    case "build": {
      // A snare roll that gets louder, a rumble underneath and a riser, all landing on the reveal.
      const len = 2.5;
      for (let i = 0; i < 36; i++) snare(ctx, bus, t + (i / 36) * len, 0.03 + (i / 36) ** 2 * 0.22);
      for (let i = 0; i < 14; i++) timpani(ctx, bus, t + 0.6 + (i / 14) * (len - 0.6), 38, 0.12 + (i / 14) * 0.3);
      noise(ctx, bus, { t, dur: len, gain: 0.13, filter: "bandpass", freq: 400, sweepTo: 6000, rise: true });
      break;
    }
    case "reveal":
      timpani(ctx, bus, t, 38, 0.9);
      crash(ctx, bus, t, 0.3, 2.6);
      brass(ctx, bus, t, [50, 62, 66, 69, 74, 78], 2.2, 0.042);
      [86, 90, 93, 98].forEach((m, i) => bell(ctx, bus, t + 0.05 + i * 0.07, m, 0.06, 2.6));
      break;
    case "finale": {
      // G, A, then a long D: the "ta-da".
      brass(ctx, bus, t, [43, 55, 62, 67, 71], 0.55, 0.04);
      brass(ctx, bus, t + 0.45, [45, 57, 64, 69, 73], 0.55, 0.042);
      brass(ctx, bus, t + 0.9, [38, 50, 62, 66, 69, 74, 78, 81], 4.2, 0.044);
      timpani(ctx, bus, t, 43, 0.7);
      timpani(ctx, bus, t + 0.45, 45, 0.75);
      timpani(ctx, bus, t + 0.9, 38, 1);
      crash(ctx, bus, t + 0.9, 0.38, 4);
      [86, 90, 93, 98, 102, 105].forEach((m, i) => bell(ctx, bus, t + 1 + i * 0.1, m, 0.06, 3));
      break;
    }
  }
}

// ---- the player --------------------------------------------------------------------------------------

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Starts the loop. `start` must be called from a tap (browsers keep the sound off until then). */
export function createShowMusic(tier: MusicTier) {
  let ctx: AudioContext | null = null;
  let bus: Bus | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextBar = 0;
  let nextAt = 0;
  let muted = false;

  const pump = () => {
    if (!ctx || !bus) return;
    while (nextAt < ctx.currentTime + 0.8) {
      scheduleBar(ctx, bus, tier, nextBar++, nextAt);
      nextAt += barSeconds(tier);
    }
  };

  return {
    start() {
      if (ctx) return;
      const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      bus = makeBus(ctx, tier);
      bus.master.gain.setValueAtTime(0.0001, ctx.currentTime);
      bus.master.gain.linearRampToValueAtTime(muted ? 0.0001 : 0.9, ctx.currentTime + 1.5);
      void ctx.resume();
      nextAt = ctx.currentTime + 0.1;
      pump();
      timer = setInterval(pump, 200);
    },
    accent(kind: Accent) {
      if (ctx && bus) playAccent(ctx, bus, tier, kind, ctx.currentTime + 0.03);
    },
    setMuted(m: boolean) {
      muted = m;
      if (ctx && bus) bus.master.gain.setTargetAtTime(m ? 0.0001 : 0.9, ctx.currentTime, 0.06);
    },
    pause() {
      void ctx?.suspend();
    },
    resume() {
      void ctx?.resume();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      const c = ctx;
      if (c && bus) {
        bus.master.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
        setTimeout(() => void c.close(), 600);
      }
      ctx = null;
      bus = null;
    },
  };
}
