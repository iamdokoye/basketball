// Zero-asset retro arcade court audio synthesizer using Web Audio API.
// No MP3 or WAV files needed; synthesized on the fly. Works offline.

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) audioCtx = new AudioCtx();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("pickup_sfx_muted") === "1";
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("pickup_sfx_muted", muted ? "1" : "0");
}

function noiseBuffer(ctx: AudioContext, seconds = 0.3): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Swish / Net Snap on a made shot */
export function playSwish(): void {
  if (isAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 0.25);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1600, now);
  filter.frequency.exponentialRampToValueAtTime(700, now + 0.2);
  filter.Q.setValueAtTime(3, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.7, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + 0.25);
}

/** Metallic rim clank on a missed shot */
export function playClang(): void {
  if (isAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Two dissonant frequencies for metallic rim resonance
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(440, now);
  osc2.frequency.setValueAtTime(620, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.2);
  osc2.stop(now + 0.2);
}

/** Game final / buzzer sound */
export function playBuzzer(): void {
  if (isAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc2.type = "sawtooth";

  // Low authoritative buzzer chord
  osc1.frequency.setValueAtTime(116, now);
  osc2.frequency.setValueAtTime(174, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.setValueAtTime(0.4, now + 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.75);
  osc2.stop(now + 0.75);
}

/** Sizzle / Flame sound when a player catches fire */
export function playOnFireSound(): void {
  if (isAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Rising whoosh
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.1, now);
  oscGain.gain.exponentialRampToValueAtTime(0.5, now + 0.2);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  // Flame noise sizzle
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.4);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(1200, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  osc.start(now);
  noise.start(now);
  osc.stop(now + 0.4);
  noise.stop(now + 0.4);
}

/** Crowd cheer / Clutch celebration */
export function playCheer(): void {
  if (isAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const chord = [523.25, 659.25, 783.99, 1046.5]; // C major fanfare
  chord.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + idx * 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now + idx * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.05);
    osc.stop(now + 0.6);
  });
}

/** Referee two-tone whistle */
export function playWhistle(): void {
  if (isAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sine";
  osc2.type = "sine";

  osc1.frequency.setValueAtTime(2400, now);
  osc2.frequency.setValueAtTime(2850, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.setValueAtTime(0.3, now + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.35);
  osc2.stop(now + 0.35);
}
