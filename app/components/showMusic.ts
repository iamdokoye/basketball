// Music for the recap slideshows, synthesised with the Web Audio API so there are no audio files to
// host or license.
//
// The month plays a punchy, atmospheric groove in D minor (prelude & mystery):
// tight modern sub-kick, syncopated bass, dark analog pads, mysterious prelude motifs,
// and dedicated suspense cues (heartbeat pulses, cinematic risers, heavy reveal impacts, name stings).
//
// The year plays a grand orchestral anthem in D major (strings, brass, timpani, suspense drumroll, big reverb).

export type MusicTier = "month" | "year";
/** One-off moments over the loop: title intro, slide transition, suspense heartbeat/riser, reveal impact, name drop, numbers tick, finale. */
export type Accent =
  | "title"
  | "transition"
  | "suspense"
  | "build"
  | "reveal"
  | "name"
  | "statTick"
  | "finale";

export type Bus = {
  input: GainNode;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
};

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

type Mel = [step: number, midi: number, len: number];
type BarDef = { bass: number; chord: number[]; mel: Mel[] };

// 8 eighth-note steps per bar (4/4).
// Month in D minor: punchy, mysterious, atmospheric prelude (BPM 98).
const MONTH: { bpm: number; bars: BarDef[] } = {
  bpm: 98,
  bars: [
    // Bar 1: Dm9 (Deep prelude mystery)
    {
      bass: 38, // D2
      chord: [62, 65, 69, 72], // D4, F4, A4, C5
      mel: [
        [0, 74, 2], // D5
        [2, 72, 1], // C5
        [3, 69, 2], // A4
        [5, 65, 1], // F4
        [6, 64, 2], // E4
      ],
    },
    // Bar 2: Bbmaj7 (Expansive cinematic anticipation)
    {
      bass: 34, // Bb1
      chord: [58, 65, 69, 72], // Bb3, F4, A4, C5
      mel: [
        [0, 69, 2], // A4
        [2, 70, 2], // Bb4
        [4, 74, 2], // D5
        [6, 72, 2], // C5
      ],
    },
    // Bar 3: Gm9 (Driving, focused suspense)
    {
      bass: 31, // G1
      chord: [58, 62, 65, 70], // Bb3, D4, F4, Bb4
      mel: [
        [0, 70, 2], // Bb4
        [2, 69, 2], // A4
        [4, 65, 2], // F4
        [6, 67, 2], // G4
      ],
    },
    // Bar 4: Asus4(b9) -> A7 (Dark suspense turnaround building back to Dm)
    {
      bass: 33, // A1
      chord: [57, 62, 64, 69], // A3, D4, E4, A4
      mel: [
        [0, 69, 3], // A4
        [3, 70, 1], // Bb4
        [4, 69, 2], // A4
        [6, 67, 2], // G4
      ],
    },
  ],
};

// Year in D major: grand orchestral anthem (BPM 88).
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
  comp.threshold.value = -20;
  comp.knee.value = 6;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.06;

  master.connect(comp).connect(limiter).connect(ctx.destination);

  const music = ctx.createGain();
  music.gain.value = tier === "year" ? 0.65 : 0.85;

  const sfx = ctx.createGain();
  sfx.gain.value = 1.0;

  const input = ctx.createGain();
  input.connect(master);
  music.connect(master);
  sfx.connect(master);

  const verb = ctx.createConvolver();
  verb.buffer = tier === "year" ? impulse(ctx, 3.2, 2.2) : impulse(ctx, 1.8, 2.4);

  const send = ctx.createGain();
  send.gain.value = tier === "year" ? 0.35 : 0.22;
  music.connect(send);
  sfx.connect(send);
  send.connect(verb).connect(master);

  return { input, master, music, sfx };
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
  dest?: "music" | "sfx" | "input";
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
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(o.lp[0], o.t);
    f.frequency.exponentialRampToValueAtTime(o.lp[1], o.t + o.lp[2]);
    osc.connect(f);
    tail = f;
  }

  const targetNode =
    o.dest === "music" ? bus.music : o.dest === "sfx" ? bus.sfx : bus.input;
  tail.connect(g).connect(targetNode);

  if (o.vibrato && o.dur > 0.5) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, o.t);
    depth.gain.linearRampToValueAtTime(8, o.t + o.dur * 0.5);
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
  sweepTo?: number;
  rise?: boolean;
  dest?: "music" | "sfx" | "input";
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
  const targetNode =
    o.dest === "music" ? bus.music : o.dest === "sfx" ? bus.sfx : bus.input;
  src.connect(f).connect(g).connect(targetNode);
  src.start(o.t, Math.random());
  src.stop(o.t + o.dur + 0.05);
}

/** Punchy modern kick: transient click + deep sub-bass drop */
const punchyKick = (
  c: BaseAudioContext,
  b: Bus,
  t: number,
  gain = 0.6,
  startFreq = 160,
  dest: "music" | "sfx" = "music",
) => {
  const target = dest === "music" ? b.music : b.sfx;

  // Layer 1: Sub dive
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(g).connect(target);
  osc.start(t);
  osc.stop(t + 0.32);

  // Layer 2: Click transient for modern punch
  const click = c.createOscillator();
  const cg = c.createGain();
  click.type = "triangle";
  click.frequency.setValueAtTime(400, t);
  click.frequency.exponentialRampToValueAtTime(70, t + 0.03);
  cg.gain.setValueAtTime(gain * 0.45, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  click.connect(cg).connect(target);
  click.start(t);
  click.stop(t + 0.04);
};

/** Crisp punchy snare/clap */
const punchySnare = (c: BaseAudioContext, b: Bus, t: number, gain = 0.22) => {
  noise(c, b, { t, dur: 0.18, gain, filter: "bandpass", freq: 1750, q: 0.9, dest: "music" });
  noise(c, b, { t, dur: 0.08, gain: gain * 0.7, filter: "highpass", freq: 4200, dest: "music" });
  // Tonal body
  voice(c, b, { type: "triangle", freq: 195, t, dur: 0.1, gain: gain * 0.5, shape: "pluck", attack: 0.002, dest: "music" });
};

/** Hi-hat / shaker tick */
const hat = (c: BaseAudioContext, b: Bus, t: number, gain = 0.04) =>
  noise(c, b, { t, dur: 0.04, gain, filter: "highpass", freq: 7200, dest: "music" });

/** Shimmering crash */
const crash = (c: BaseAudioContext, b: Bus, t: number, gain = 0.25, dur = 2.2, dest: "music" | "sfx" = "sfx") =>
  noise(c, b, { t, dur, gain, filter: "highpass", freq: 4000, q: 0.35, dest });

/** Timpani for orchestral hits */
function timpani(c: BaseAudioContext, b: Bus, t: number, midi = 38, gain = 0.6) {
  const f = mtof(midi);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.setValueAtTime(f * 1.9, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.09);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  osc.connect(g).connect(b.music);
  osc.start(t);
  osc.stop(t + 1.15);
  noise(c, b, { t, dur: 0.08, gain: gain * 0.35, filter: "lowpass", freq: 500, dest: "music" });
}

/** Resonant chime/bell */
function bell(c: BaseAudioContext, b: Bus, t: number, midi: number, gain = 0.09, dur = 1.8, dest: "music" | "sfx" = "sfx") {
  voice(c, b, { type: "sine", freq: mtof(midi), t, dur, gain, shape: "pluck", attack: 0.003, dest });
  voice(c, b, { type: "triangle", freq: mtof(midi) * 2.005, t, dur: dur * 0.65, gain: gain * 0.35, shape: "pluck", dest });
}

/** Brass chord */
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
        dest: "music",
      });
}

// ---- loop scheduling ---------------------------------------------------------------------------------

/** Schedules one bar of the background music starting at time `t`. */
export function scheduleBar(ctx: BaseAudioContext, bus: Bus, tier: MusicTier, bar: number, t: number) {
  const song = SONG[tier];
  const def = song.bars[bar % song.bars.length];
  const step = 60 / song.bpm / 2;
  const barLen = step * 8;

  if (tier === "month") {
    // 1. Dark Analog Pad (Mysterious & atmospheric prelude chords)
    for (const m of def.chord) {
      for (const d of [-6, 6]) {
        voice(ctx, bus, {
          type: "sawtooth",
          freq: mtof(m),
          t,
          dur: barLen,
          gain: 0.022,
          attack: 0.35,
          release: 0.45,
          detune: d,
          lp: [450, 1600, barLen * 0.6],
          dest: "music",
        });
      }
      voice(ctx, bus, {
        type: "triangle",
        freq: mtof(m),
        t,
        dur: barLen,
        gain: 0.028,
        attack: 0.2,
        release: 0.3,
        dest: "music",
      });
    }

    // 2. Punchy Synth Bassline (Driving syncopated groove with low-pass sweep on each hit)
    // Steps: 0 (downbeat), 3 (& of 2), 4 (beat 3), 6 (beat 4)
    const bassRhythm: [number, number][] = [
      [0, 2.5],
      [3, 1],
      [4, 1.8],
      [6, 1.8],
    ];
    for (const [s, len] of bassRhythm) {
      const bt = t + s * step;
      const dur = len * step;
      // Sub Sine Layer
      voice(ctx, bus, {
        type: "sine",
        freq: mtof(def.bass),
        t: bt,
        dur,
        gain: 0.18,
        attack: 0.015,
        release: 0.08,
        dest: "music",
      });
      // Punchy Sawtooth Low-Pass Decay Layer
      voice(ctx, bus, {
        type: "sawtooth",
        freq: mtof(def.bass),
        t: bt,
        dur,
        gain: 0.065,
        attack: 0.012,
        release: 0.06,
        lp: [1400, 260, 0.15],
        dest: "music",
      });
    }

    // 3. Punchy Drums: Modern sub-kick, crisp snare, rhythmic hats
    punchyKick(ctx, bus, t, 0.52);
    punchyKick(ctx, bus, t + 3 * step, 0.38); // Syncopated kick
    punchyKick(ctx, bus, t + 4 * step, 0.48);
    if (bar % 2 === 1) punchyKick(ctx, bus, t + 7 * step, 0.32);

    punchySnare(ctx, bus, t + 2 * step, 0.18);
    punchySnare(ctx, bus, t + 6 * step, 0.2);

    for (const s of [0, 1, 2, 3, 4, 5, 6, 7]) {
      hat(ctx, bus, t + s * step, s % 2 === 1 ? 0.038 : 0.022);
    }

    // 4. Mysterious Prelude Melody / Arpeggio (Echoing notes in D minor)
    for (const [s, m, len] of def.mel) {
      const mt = t + s * step;
      const mdur = len * step * 0.95;
      // Primary note
      voice(ctx, bus, {
        type: "triangle",
        freq: mtof(m),
        t: mt,
        dur: mdur,
        gain: 0.055,
        attack: 0.015,
        release: 0.12,
        shape: "pluck",
        dest: "music",
      });
      voice(ctx, bus, {
        type: "sine",
        freq: mtof(m + 12),
        t: mt,
        dur: mdur * 0.7,
        gain: 0.022,
        attack: 0.008,
        release: 0.1,
        shape: "pluck",
        dest: "music",
      });
      // Simulated delay echo (subtle rhythmic reflection)
      voice(ctx, bus, {
        type: "sine",
        freq: mtof(m),
        t: mt + step * 1.5,
        dur: mdur * 0.6,
        gain: 0.016,
        attack: 0.02,
        release: 0.15,
        shape: "pluck",
        dest: "music",
      });
    }
    return;
  }

  // Year: strings and sub-bass under everything, timpani on downbeats, brass on the tune.
  for (const m of def.chord)
    for (const d of [-9, 0, 9])
      voice(ctx, bus, {
        type: "sawtooth",
        freq: mtof(m),
        t,
        dur: barLen,
        gain: 0.016,
        attack: 0.4,
        release: 0.5,
        detune: d,
        lp: [900, 1500, barLen],
        dest: "music",
      });

  voice(ctx, bus, {
    type: "sawtooth",
    freq: mtof(def.bass),
    t,
    dur: barLen,
    gain: 0.07,
    attack: 0.05,
    release: 0.3,
    lp: [320, 320, 1],
    dest: "music",
  });
  voice(ctx, bus, {
    type: "sine",
    freq: mtof(def.bass),
    t,
    dur: barLen,
    gain: 0.2,
    attack: 0.03,
    release: 0.3,
    dest: "music",
  });

  timpani(ctx, bus, t, def.bass, 0.55);
  if (bar % 2 === 1) timpani(ctx, bus, t + 4 * step, def.bass, 0.4);

  const last = bar % song.bars.length === song.bars.length - 1;
  if (last) {
    for (let i = 0; i < 16; i++)
      punchySnare(ctx, bus, t + i * (step / 2), 0.04 + (i / 16) * 0.16);
  } else if (bar % song.bars.length >= 2) {
    for (const s of [2, 6]) punchySnare(ctx, bus, t + s * step, 0.09);
  }
  if (bar > 0 && bar % song.bars.length === 0) crash(ctx, bus, t, 0.14, 1.8, "music");

  for (const [s, m, len] of def.mel) {
    const dur = len * step * 0.97;
    voice(ctx, bus, {
      type: "sawtooth",
      freq: mtof(m),
      t: t + s * step,
      dur,
      gain: 0.04,
      attack: 0.05,
      release: 0.15,
      detune: -6,
      lp: [700, 2600, 0.2],
      vibrato: true,
      dest: "music",
    });
    voice(ctx, bus, {
      type: "sawtooth",
      freq: mtof(m),
      t: t + s * step,
      dur,
      gain: 0.04,
      attack: 0.05,
      release: 0.15,
      detune: 6,
      lp: [700, 2600, 0.2],
      vibrato: true,
      dest: "music",
    });
    voice(ctx, bus, {
      type: "sine",
      freq: mtof(m - 12),
      t: t + s * step,
      dur,
      gain: 0.04,
      attack: 0.05,
      release: 0.15,
      dest: "music",
    });
  }
}

// ---- accents & suspense cues -------------------------------------------------------------------------

/** Sub-bass drop impact */
function subDrop(c: BaseAudioContext, b: Bus, t: number, gain = 0.8, dur = 0.9) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(b.sfx);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Heartbeat suspense cue: realistic lub-dub pulse */
function heartbeat(c: BaseAudioContext, b: Bus, t: number, gain = 0.5) {
  // Lub
  punchyKick(c, b, t, gain, 85, "sfx");
  // Dub
  punchyKick(c, b, t + 0.16, gain * 0.75, 72, "sfx");
}

/** Tension riser / sweep */
function tensionRiser(c: BaseAudioContext, b: Bus, t: number, dur = 1.2, gain = 0.16) {
  noise(c, b, { t, dur, gain, filter: "bandpass", freq: 280, sweepTo: 5200, q: 2.2, rise: true, dest: "sfx" });

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(540, t + dur);

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(250, t);
  filter.frequency.exponentialRampToValueAtTime(3600, t + dur);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain * 0.35, t + dur * 0.92);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);

  osc.connect(filter).connect(g).connect(b.sfx);
  osc.start(t);
  osc.stop(t + dur + 0.04);
}

/**
 * One-off moments played over the loop.
 * Accents are dynamically leveled and timed to match the slide flow.
 */
export function playAccent(
  ctx: BaseAudioContext,
  bus: Bus,
  tier: MusicTier,
  kind: Accent,
  t: number,
) {
  if (tier === "month") {
    switch (kind) {
      case "title": {
        // Dramatic opening: Deep sub boom + mysterious dark chime chord + air swell
        subDrop(ctx, bus, t, 0.75, 1.4);
        punchyKick(ctx, bus, t, 0.8, 140, "sfx");
        noise(ctx, bus, { t, dur: 1.2, gain: 0.1, filter: "bandpass", freq: 300, sweepTo: 2800, rise: true, dest: "sfx" });
        crash(ctx, bus, t + 0.3, 0.18, 2.5);
        [62, 65, 69, 74].forEach((m, i) => bell(ctx, bus, t + 0.4 + i * 0.08, m, 0.08, 2.2));
        break;
      }

      case "transition": {
        // Sleek aerodynamic whoosh between slides
        noise(ctx, bus, { t, dur: 0.28, gain: 0.1, filter: "bandpass", freq: 350, sweepTo: 2200, rise: true, dest: "sfx" });
        noise(ctx, bus, { t: t + 0.1, dur: 0.3, gain: 0.07, filter: "lowpass", freq: 1600, sweepTo: 250, dest: "sfx" });
        break;
      }

      case "suspense":
      case "build": {
        // Suspense build: Heartbeats + rising tension sweep leading into the reveal
        // Lub-dub 1
        heartbeat(ctx, bus, t, 0.55);
        // Lub-dub 2 at t + 0.6s
        heartbeat(ctx, bus, t + 0.6, 0.65);
        // Rising tension tone
        tensionRiser(ctx, bus, t + 0.15, 1.05, 0.18);
        break;
      }

      case "reveal": {
        // The Big Reveal Drop: Heavy punchy sub dive + punchy kick + crash + resonant chord
        subDrop(ctx, bus, t, 0.9, 1.5);
        punchyKick(ctx, bus, t, 0.95, 170, "sfx");
        crash(ctx, bus, t, 0.26, 2.2);
        // Resonant D minor chord impact: D5, F5, A5, D6
        [74, 77, 81, 86].forEach((m, i) => bell(ctx, bus, t + i * 0.03, m, 0.09, 2.0));
        break;
      }

      case "name": {
        // Winner Name Pop Sting: A punchy bass accent + bright resonant arpeggio
        punchyKick(ctx, bus, t, 0.55, 120, "sfx");
        [69, 74, 77, 81].forEach((m, i) => bell(ctx, bus, t + 0.02 + i * 0.04, m, 0.08, 1.6));
        break;
      }

      case "statTick": {
        // High-tech tick when numbers count up
        noise(ctx, bus, { t, dur: 0.025, gain: 0.04, filter: "highpass", freq: 5200, dest: "sfx" });
        voice(ctx, bus, { type: "triangle", freq: 880, t, dur: 0.03, gain: 0.03, shape: "pluck", dest: "sfx" });
        break;
      }

      case "finale": {
        // Grand resolution
        subDrop(ctx, bus, t, 0.95, 2.0);
        punchyKick(ctx, bus, t, 0.95, 180, "sfx");
        crash(ctx, bus, t, 0.32, 2.8);
        [62, 65, 69, 74, 77, 81, 86].forEach((m, i) => bell(ctx, bus, t + i * 0.07, m, 0.09, 2.6));
        for (const m of [50, 62, 65, 69]) {
          voice(ctx, bus, {
            type: "sawtooth",
            freq: mtof(m),
            t,
            dur: 3.5,
            gain: 0.04,
            attack: 0.04,
            release: 1.5,
            lp: [600, 2200, 0.3],
            dest: "sfx",
          });
        }
        break;
      }
    }
    return;
  }

  // Year accents (D major orchestral)
  switch (kind) {
    case "title": {
      crash(ctx, bus, t, 0.34, 3);
      timpani(ctx, bus, t, 38, 0.85);
      timpani(ctx, bus, t + 0.01, 26, 0.6);
      brass(ctx, bus, t, [50, 62, 66, 69, 74], 3.4, 0.04);
      break;
    }
    case "transition": {
      noise(ctx, bus, { t, dur: 0.35, gain: 0.12, filter: "bandpass", freq: 400, sweepTo: 2600, rise: true, dest: "sfx" });
      timpani(ctx, bus, t, 38, 0.35);
      break;
    }
    case "suspense":
    case "build": {
      const len = 2.4;
      for (let i = 0; i < 36; i++)
        punchySnare(ctx, bus, t + (i / 36) * len, 0.03 + (i / 36) ** 2 * 0.22);
      for (let i = 0; i < 14; i++)
        timpani(ctx, bus, t + 0.5 + (i / 14) * (len - 0.5), 38, 0.12 + (i / 14) * 0.3);
      noise(ctx, bus, { t, dur: len, gain: 0.14, filter: "bandpass", freq: 400, sweepTo: 6000, rise: true, dest: "sfx" });
      break;
    }
    case "reveal": {
      timpani(ctx, bus, t, 38, 0.9);
      subDrop(ctx, bus, t, 0.85, 1.5);
      crash(ctx, bus, t, 0.3, 2.6);
      brass(ctx, bus, t, [50, 62, 66, 69, 74, 78], 2.2, 0.042);
      [86, 90, 93, 98].forEach((m, i) => bell(ctx, bus, t + 0.05 + i * 0.07, m, 0.06, 2.6));
      break;
    }
    case "name": {
      timpani(ctx, bus, t, 45, 0.6);
      brass(ctx, bus, t, [62, 66, 69, 74], 1.5, 0.038);
      [86, 90, 93, 98].forEach((m, i) => bell(ctx, bus, t + i * 0.04, m, 0.05, 1.8));
      break;
    }
    case "statTick": {
      noise(ctx, bus, { t, dur: 0.03, gain: 0.04, filter: "highpass", freq: 4800, dest: "sfx" });
      break;
    }
    case "finale": {
      brass(ctx, bus, t, [43, 55, 62, 67, 71], 0.55, 0.04);
      brass(ctx, bus, t + 0.45, [45, 57, 64, 69, 73], 0.55, 0.042);
      brass(ctx, bus, t + 0.9, [38, 50, 62, 66, 69, 74, 78, 81], 4.2, 0.044);
      timpani(ctx, bus, t, 43, 0.7);
      timpani(ctx, bus, t + 0.45, 45, 0.75);
      timpani(ctx, bus, t + 0.9, 38, 1);
      subDrop(ctx, bus, t + 0.9, 0.9, 2.0);
      crash(ctx, bus, t + 0.9, 0.38, 4);
      [86, 90, 93, 98, 102, 105].forEach((m, i) => bell(ctx, bus, t + 1 + i * 0.1, m, 0.06, 3));
      break;
    }
  }
}

// ---- player controller -------------------------------------------------------------------------------

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Starts the loop. `start` must be called from a tap. */
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
      bus.master.gain.linearRampToValueAtTime(muted ? 0.0001 : 0.9, ctx.currentTime + 1.2);
      void ctx.resume();
      nextAt = ctx.currentTime + 0.08;
      pump();
      timer = setInterval(pump, 180);
    },
    accent(kind: Accent) {
      if (!ctx || !bus) return;
      const now = ctx.currentTime;
      // Slight dynamic ducking of background music during suspense for maximum impact
      if (kind === "suspense" || kind === "build") {
        bus.music.gain.setTargetAtTime(0.45, now, 0.08);
      } else if (kind === "reveal" || kind === "finale") {
        bus.music.gain.setTargetAtTime(tier === "year" ? 0.65 : 0.85, now + 0.02, 0.06);
      }
      playAccent(ctx, bus, tier, kind, now + 0.02);
    },
    setMuted(m: boolean) {
      muted = m;
      if (ctx && bus) bus.master.gain.setTargetAtTime(m ? 0.0001 : 0.9, ctx.currentTime, 0.05);
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
        bus.master.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
        setTimeout(() => void c.close(), 500);
      }
      ctx = null;
      bus = null;
    },
  };
}
