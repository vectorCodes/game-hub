import { create } from "zustand";

// Game sounds, synthesized with Web Audio: no files to load, and they stay quiet and short.

export type Sound =
  | "turn"
  | "miss"
  | "close"
  | "duplicate"
  | "hint"
  | "win"
  | "lose"
  // Sky Climb
  | "jump"
  | "coin"
  | "spring"
  | "checkpoint"
  | "fall"
  | "powerup"
  | "powerdown"
  | "shield"
  | "cannonLoad"
  | "boom"
  | "alarm"
  | "thunder"
  | "cleared"
  // Putt Isles
  | "putt"
  | "clack"
  | "plunk"
  | "splash";

const STORAGE_KEY = "sound:muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export const useSound = create<{ muted: boolean; toggle: () => void }>((set, get) => ({
  muted: readMuted(),
  toggle: () => {
    const muted = !get().muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // Storage unavailable: the choice lasts for this page view.
    }
    set({ muted });
  },
}));

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Tone {
  freq: number;
  /** Glide to this frequency over the note. */
  to?: number;
  at?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function tone(ac: AudioContext, out: AudioNode, { freq, to, at = 0, dur, type = "sine", gain = 0.2 }: Tone) {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** Low-passed noise with a sharp attack: a cannon shot, a thunderclap. */
function rumble(ac: AudioContext, out: AudioNode, { dur, cutoff, to, gain, attack = 0.005 }: { dur: number; cutoff: number; to: number; gain: number; attack?: number }) {
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const env = ac.createGain();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Filtered noise swept upward: the light swinging round. */
function whoosh(ac: AudioContext, out: AudioNode) {
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const env = ac.createGain();
  src.buffer = noiseBuffer(ac);
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(2400, t + 0.55);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.22, t + 0.18);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  src.connect(filter).connect(env).connect(out);
  src.start(t);
  src.stop(t + 0.75);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

const VIBRATION: Partial<Record<Sound, number | number[]>> = {
  miss: 35,
  close: [15, 40, 15],
  win: [20, 50, 20, 50, 40],
  lose: 120,
  spring: 20,
  fall: 80,
  boom: [60, 30, 30],
  thunder: 40,
  putt: 12,
  plunk: [20, 40, 30],
  splash: 60,
};

/** `level` (0–1) scales the sounds that have a strength: a soft putt, a light tap on a wall. */
export function play(sound: Sound, level = 1) {
  if (useSound.getState().muted) return;
  const pattern = VIBRATION[sound];
  try {
    if (pattern) navigator.vibrate?.(pattern);
  } catch {
    // Vibration blocked: sound still plays.
  }
  const ac = audio();
  if (!ac) return;
  const out = ac.destination;
  switch (sound) {
    case "turn":
      return whoosh(ac, out);
    case "miss":
      return tone(ac, out, { freq: 150, to: 70, dur: 0.28, type: "triangle", gain: 0.35 });
    case "close":
      tone(ac, out, { freq: E5, dur: 0.18, gain: 0.12 });
      return tone(ac, out, { freq: G5, at: 0.1, dur: 0.3, gain: 0.12 });
    case "duplicate":
      return tone(ac, out, { freq: 220, dur: 0.12, type: "square", gain: 0.05 });
    case "hint":
      return tone(ac, out, { freq: 1320, dur: 0.5, gain: 0.1 });
    case "win":
      [C5, E5, G5, C6].forEach((freq, i) => {
        tone(ac, out, { freq, at: i * 0.09, dur: 0.9, gain: 0.14 });
        tone(ac, out, { freq: freq * 2, at: i * 0.09, dur: 0.4, type: "triangle", gain: 0.03 });
      });
      return;
    case "lose":
      [392, 330, 262].forEach((freq, i) => tone(ac, out, { freq, at: i * 0.22, dur: 0.5, type: "triangle", gain: 0.16 }));
      return;
    case "jump":
      return tone(ac, out, { freq: 330, to: 620, dur: 0.12, type: "triangle", gain: 0.07 });
    case "coin":
      tone(ac, out, { freq: 988, dur: 0.08, type: "square", gain: 0.04 });
      return tone(ac, out, { freq: 1319, at: 0.07, dur: 0.22, type: "square", gain: 0.04 });
    case "spring":
      return tone(ac, out, { freq: 180, to: 900, dur: 0.35, type: "triangle", gain: 0.14 });
    case "checkpoint":
      [G5 / 2, C5, E5, G5].forEach((freq, i) => tone(ac, out, { freq, at: i * 0.07, dur: 0.35, type: "triangle", gain: 0.1 }));
      return;
    case "fall":
      return tone(ac, out, { freq: 520, to: 90, dur: 0.6, type: "triangle", gain: 0.14 });
    case "powerup":
      [E5, G5, C6].forEach((freq, i) => tone(ac, out, { freq, at: i * 0.06, dur: 0.3, type: "triangle", gain: 0.09 }));
      return tone(ac, out, { freq: C6 * 2, at: 0.18, dur: 0.35, gain: 0.04 });
    case "powerdown":
      return tone(ac, out, { freq: 620, to: 300, dur: 0.25, type: "triangle", gain: 0.06 });
    case "shield":
      tone(ac, out, { freq: 1000, to: 220, dur: 0.22, type: "square", gain: 0.06 });
      return tone(ac, out, { freq: 1500, at: 0.04, dur: 0.3, gain: 0.07 });
    case "cannonLoad":
      tone(ac, out, { freq: 140, to: 90, dur: 0.12, type: "square", gain: 0.06 });
      return tone(ac, out, { freq: 260, to: 520, at: 0.12, dur: 0.25, type: "triangle", gain: 0.07 });
    case "boom":
      rumble(ac, out, { dur: 0.9, cutoff: 1800, to: 80, gain: 0.5 });
      return tone(ac, out, { freq: 110, to: 38, dur: 0.6, gain: 0.35 });
    case "alarm":
      [0, 0.3, 0.6].forEach((at) => {
        tone(ac, out, { freq: 880, at, dur: 0.14, type: "square", gain: 0.05 });
        tone(ac, out, { freq: 660, at: at + 0.15, dur: 0.14, type: "square", gain: 0.05 });
      });
      return;
    case "thunder":
      return rumble(ac, out, { dur: 1.4, cutoff: 900, to: 60, gain: 0.3, attack: 0.02 });
    case "cleared":
      [C5, G5, C6].forEach((freq, i) => tone(ac, out, { freq, at: i * 0.08, dur: 0.45, type: "triangle", gain: 0.11 }));
      return tone(ac, out, { freq: E5 * 2, at: 0.24, dur: 0.5, gain: 0.05 });
    case "putt":
      tone(ac, out, { freq: 900 + level * 500, to: 380, dur: 0.07, type: "triangle", gain: 0.06 + level * 0.12 });
      return rumble(ac, out, { dur: 0.08, cutoff: 3200, to: 900, gain: 0.04 + level * 0.1, attack: 0.002 });
    case "clack":
      tone(ac, out, { freq: 620 + level * 260, to: 300, dur: 0.06, type: "square", gain: 0.015 + level * 0.05 });
      return rumble(ac, out, { dur: 0.06, cutoff: 2400, to: 600, gain: 0.03 + level * 0.12, attack: 0.002 });
    case "plunk":
      tone(ac, out, { freq: 420, to: 160, dur: 0.18, type: "triangle", gain: 0.2 });
      tone(ac, out, { freq: 260, to: 120, at: 0.09, dur: 0.16, type: "triangle", gain: 0.12 });
      [C5, E5, G5, C6].forEach((freq, i) => tone(ac, out, { freq, at: 0.22 + i * 0.07, dur: 0.6, gain: 0.08 }));
      return;
    case "splash":
      tone(ac, out, { freq: 700, to: 140, dur: 0.5, type: "triangle", gain: 0.1 });
      return rumble(ac, out, { dur: 0.7, cutoff: 1400, to: 200, gain: 0.18, attack: 0.03 });
  }
}
