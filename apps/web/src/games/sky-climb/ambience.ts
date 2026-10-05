// Sky Climb's soundscape, synthesized like the rest of the game's sounds: wind that grows
// with height (and howls in gusts), a soft chord pad for each zone, and footsteps that
// sound like what you're walking on. Follows the shared mute switch.
import { useSound } from "../../lib/sound";

export type Surface = "grass" | "wood" | "snow" | "metal";

/** A gentle chord per zone (Hz), from a bright meadow to an uneasy storm. */
const CHORDS: number[][] = [
  [261.63, 329.63, 392.0], // Meadow: C major
  [293.66, 369.99, 440.0], // Treetops: D major
  [220.0, 277.18, 329.63], // Cliffs: A major
  [246.94, 293.66, 369.99], // Snow Peak: B minor
  [207.65, 246.94, 311.13], // Storm: G# diminished-ish
  [261.63, 392.0, 523.25], // Summit: open C
];

interface Pad {
  oscs: OscillatorNode[];
  gain: GainNode;
}

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let windGain: GainNode | null = null;
let windFilter: BiquadFilterNode | null = null;
let windSource: AudioBufferSourceNode | null = null;
let padBus: GainNode | null = null;
let pad: Pad | null = null;
let zone = -1;
let noise: AudioBuffer | null = null;
let unsubscribe: (() => void) | null = null;

function noiseBuffer(ctx: AudioContext) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

export function startAmbience() {
  if (master) return;
  try {
    ac ??= new AudioContext();
  } catch {
    return;
  }
  if (ac.state === "suspended") void ac.resume();
  const ctx = ac;
  master = ctx.createGain();
  master.gain.value = useSound.getState().muted ? 0 : 1;
  master.connect(ctx.destination);
  unsubscribe = useSound.subscribe((s) => master?.gain.setTargetAtTime(s.muted ? 0 : 1, ctx.currentTime, 0.1));

  windSource = ctx.createBufferSource();
  windSource.buffer = noiseBuffer(ctx);
  windSource.loop = true;
  windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.Q.value = 0.8;
  windFilter.frequency.value = 400;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windSource.connect(windFilter).connect(windGain).connect(master);
  windSource.start();

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 1400;
  padBus = ctx.createGain();
  padBus.gain.value = 0.05;
  padBus.connect(lowpass).connect(master);
  zone = -1;
}

export function stopAmbience() {
  if (!ac || !master) return;
  const ctx = ac;
  const m = master;
  m.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  const ws = windSource;
  const p = pad;
  setTimeout(() => {
    ws?.stop();
    p?.oscs.forEach((o) => o.stop());
    m.disconnect();
  }, 600);
  unsubscribe?.();
  unsubscribe = null;
  master = windGain = windFilter = padBus = null;
  windSource = null;
  pad = null;
}

/** Swaps the pad to a zone's chord, crossfading over a couple of seconds. */
function playChord(index: number) {
  if (!ac || !padBus) return;
  const ctx = ac;
  const t = ctx.currentTime;
  if (pad) {
    const old = pad;
    old.gain.gain.setTargetAtTime(0, t, 0.8);
    setTimeout(() => old.oscs.forEach((o) => o.stop()), 4000);
  }
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(1, t, 1.2);
  gain.connect(padBus);
  const oscs = CHORDS[index].flatMap((freq, i) => {
    // Two slightly detuned voices per note for a soft chorus.
    return [-4, 4].map((cents) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = freq / (i === 0 ? 2 : 1);
      o.detune.value = cents;
      o.connect(gain);
      o.start();
      return o;
    });
  });
  pad = { oscs, gain };
}

/** Called every few frames with the climber's height (fractional floor), gust and zone. */
export function updateAmbience(height: number, gust: number, zoneIndex: number) {
  if (!ac || !windGain || !windFilter) return;
  const t = ac.currentTime;
  const level = 0.015 + Math.min(1, height / 100) * 0.09 + gust * 0.14;
  windGain.gain.setTargetAtTime(level, t, 0.4);
  windFilter.frequency.setTargetAtTime(320 + height * 7 + gust * 700, t, 0.4);
  if (zoneIndex !== zone) {
    zone = zoneIndex;
    playChord(zoneIndex);
  }
}

/** One footstep (or a landing, louder). */
export function footstep(surface: Surface, loud = false) {
  if (!ac || !master) return;
  const ctx = ac;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  const settings = {
    grass: { type: "lowpass", freq: 900, dur: 0.07, gain: 0.08 },
    wood: { type: "bandpass", freq: 1500, dur: 0.05, gain: 0.12 },
    snow: { type: "highpass", freq: 2500, dur: 0.09, gain: 0.07 },
    metal: { type: "bandpass", freq: 3200, dur: 0.04, gain: 0.08 },
  }[surface];
  filter.type = settings.type as BiquadFilterType;
  filter.frequency.value = settings.freq;
  const peak = settings.gain * (loud ? 2 : 1);
  env.gain.setValueAtTime(peak, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + settings.dur * (loud ? 1.8 : 1));
  src.connect(filter).connect(env).connect(master);
  src.start(t, Math.random());
  src.stop(t + 0.25);
}

/** What a kit piece sounds like underfoot. */
export function surfaceOf(piece: string | undefined): Surface {
  if (!piece) return "grass";
  if (piece.includes("snow")) return "snow";
  if (piece === "platform") return "wood";
  if (piece.includes("grass")) return "grass";
  return "metal";
}
