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
  | "fall";

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

/** Filtered noise swept upward: the light swinging round. */
function whoosh(ac: AudioContext, out: AudioNode) {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const env = ac.createGain();
  src.buffer = noise;
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
};

export function play(sound: Sound) {
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
  }
}
