// Synthesizes the promo soundtrack: 45 s at 120 BPM, Am–F–C–G, written to public/music.wav.
// Deterministic (seeded noise), no samples or third-party audio. Hits line up with the edit:
// cuts on bar lines, misses/solve in the round, reveals in the speed round, the final card.
//
//   node scripts/make-music.mjs
import { writeFileSync } from "node:fs";

const SR = 44100;
const LENGTH = 45;
const N = SR * LENGTH;
const BEAT = 0.5;
const BAR = 2;
const L = new Float32Array(N);
const R = new Float32Array(N);

// Seeded noise so every run produces the same file.
let seed = 1234567;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};

const add = (i, v, pan = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += v * Math.min(1, 1 - pan);
  R[i] += v * Math.min(1, 1 + pan);
};
const lp = (fc) => 1 - Math.exp((-2 * Math.PI * fc) / SR);
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------- Instruments ----------

const kickTimes = [];
function kick(t0, gain = 0.9) {
  kickTimes.push(t0);
  const s = Math.round(t0 * SR);
  let phase = 0;
  for (let n = 0; n < SR * 0.45; n++) {
    const t = n / SR;
    const f = 44 + 90 * Math.exp(-t * 32);
    phase += (2 * Math.PI * f) / SR;
    const click = n < SR * 0.004 ? noise() * 0.25 * (1 - n / (SR * 0.004)) : 0;
    add(s + n, (Math.sin(phase) * Math.exp(-t * 7) + click) * gain);
  }
}

function clap(t0, gain = 0.32) {
  const s = Math.round(t0 * SR);
  let low = 0;
  for (let n = 0; n < SR * 0.25; n++) {
    const t = n / SR;
    const bursts = [0, 0.011, 0.022].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) * 90) : 0), 0);
    const env = bursts * 0.5 + Math.exp(-t * 16) * 0.6;
    const x = noise();
    low += lp(1100) * (x - low);
    add(s + n, (x - low) * env * gain, 0.05);
  }
}

let hatFlip = false;
function hat(t0, gain = 0.09, decay = 70) {
  const s = Math.round(t0 * SR);
  let low = 0;
  hatFlip = !hatFlip;
  for (let n = 0; n < SR * 0.08; n++) {
    const x = noise();
    low += lp(7000) * (x - low);
    add(s + n, (x - low) * Math.exp((-n / SR) * decay) * gain, hatFlip ? 0.3 : -0.3);
  }
}

/** Sidechain: duck sustained parts under each kick, for the pumping feel. */
function duck(t) {
  let last = -10;
  for (const k of kickTimes) if (k <= t && k > last) last = k;
  return 1 - 0.65 * Math.exp(-(t - last) * 11);
}

function bass(f, t0, dur, gain = 0.26) {
  const s = Math.round(t0 * SR);
  let y = 0;
  for (let n = 0; n < SR * dur; n++) {
    const t = n / SR;
    let saw = 0;
    for (let h = 1; h <= 7; h++) saw += Math.sin(2 * Math.PI * f * h * t) / h;
    const sub = Math.sin(2 * Math.PI * (f / 2) * t);
    y += lp(420 + 900 * Math.exp(-t * 14)) * (saw - y);
    const env = Math.min(1, t / 0.006) * Math.min(1, (dur - t) / 0.03);
    add(s + n, (y * 0.55 + sub * 0.45) * env * gain * duck(t0 + t));
  }
}

const delayL = new Float32Array(N);
const delayR = new Float32Array(N);
function pluck(f, t0, gain = 0.1, pan = 0) {
  const s = Math.round(t0 * SR);
  for (let n = 0; n < SR * 0.6; n++) {
    const t = n / SR;
    const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));
    const v = (tri * 0.7 + Math.sin(4 * Math.PI * f * t) * 0.2) * Math.exp(-t * 9) * Math.min(1, t / 0.003) * gain;
    const i = s + n;
    if (i >= N) break;
    add(i, v, pan);
    delayL[i] += v * 0.5;
    delayR[i] += v * 0.5;
  }
}

function pad(freqs, t0, dur, gain = 0.045) {
  const s = Math.round(t0 * SR);
  const filt = freqs.map(() => 0);
  for (let n = 0; n < SR * dur; n++) {
    const t = n / SR;
    const env = Math.min(1, t / 0.5) * Math.min(1, (dur - t) / 0.8);
    let l = 0;
    let r = 0;
    freqs.forEach((f, k) => {
      let saw = 0;
      for (let h = 1; h <= 6; h++) saw += (Math.sin(2 * Math.PI * f * 1.003 * h * t) + Math.sin(2 * Math.PI * f * 0.997 * h * t)) / h;
      filt[k] += lp(1400) * (saw - filt[k]);
      l += filt[k] * (k % 2 ? 0.7 : 1);
      r += filt[k] * (k % 2 ? 1 : 0.7);
    });
    const d = duck(t0 + t);
    if (s + n < N) {
      L[s + n] += l * env * gain * d;
      R[s + n] += r * env * gain * d;
    }
  }
}

function riser(t0, dur, gain = 0.22) {
  const s = Math.round(t0 * SR);
  let y = 0;
  let phase = 0;
  for (let n = 0; n < SR * dur; n++) {
    const p = n / (SR * dur);
    y += lp(200 * 40 ** p) * (noise() - y);
    phase += (2 * Math.PI * (180 + 900 * p * p)) / SR;
    add(s + n, (y * 0.8 + Math.sin(phase) * 0.12) * p * p * gain);
  }
}

function impact(t0, gain = 0.85) {
  const s = Math.round(t0 * SR);
  let phase = 0;
  let y = 0;
  let hp = 0;
  for (let n = 0; n < SR * 2; n++) {
    const t = n / SR;
    phase += (2 * Math.PI * (38 + 30 * Math.exp(-t * 6))) / SR;
    const x = noise();
    y += lp(900) * (x - y);
    hp += lp(4000) * (x - hp);
    const v = Math.sin(phase) * Math.exp(-t * 2.2) * 0.9 + y * Math.exp(-t * 6) * 0.35 + (x - hp) * Math.exp(-t * 2.4) * 0.12;
    add(s + n, v * gain);
  }
}

function whoosh(t0, dur, gain = 0.2) {
  const s = Math.round(t0 * SR);
  let y = 0;
  for (let n = 0; n < SR * dur; n++) {
    const p = n / (SR * dur);
    y += lp(400 + 3000 * Math.sin(Math.PI * p)) * (noise() - y);
    add(s + n, y * Math.sin(Math.PI * p) * gain, -0.6 + 1.2 * p);
  }
}

/** A dull "nope" for a wrong guess. */
function miss(t0, gain = 0.28) {
  const s = Math.round(t0 * SR);
  let phase = 0;
  for (let n = 0; n < SR * 0.3; n++) {
    const t = n / SR;
    phase += (2 * Math.PI * (210 - 90 * Math.min(1, t / 0.2))) / SR;
    add(s + n, (Math.sin(phase) + 0.35 * Math.sin(2 * phase)) * Math.exp(-t * 9) * gain);
  }
}

/** A bright rising arpeggio for a correct answer. */
function chime(t0, root = 76, gain = 0.16) {
  [0, 7, 12, 16].forEach((st, k) => pluck(midi(root + st), t0 + k * 0.055, gain, k % 2 ? 0.25 : -0.25));
}

// ---------- Arrangement ----------

// Am, F, C, G: bass roots and chord tones (MIDI).
const CHORDS = [
  { bass: 45, tones: [57, 60, 64] },
  { bass: 41, tones: [53, 57, 60] },
  { bass: 48, tones: [55, 60, 64] },
  { bass: 43, tones: [55, 59, 62] },
];
const ARP = [0, 1, 2, 3, 4, 3, 2, 1];

for (let bar = 0; bar < 22; bar++) {
  const t = bar * BAR;
  const chord = CHORDS[bar % 4];
  const tones = [...chord.tones, ...chord.tones.map((m) => m + 12)];
  const groove = bar >= 2 && bar < 20;
  const fillBar = bar === 13 || bar === 17; // builds into 28 s and 36 s

  for (let b = 0; b < 4; b++) {
    const bt = t + b * BEAT;
    const dropLastBeats = fillBar && b >= 2;
    if (bar < 20 && !dropLastBeats) kick(bt, bar < 2 ? 0.75 : 0.9);
    if (groove && (b === 1 || b === 3) && !dropLastBeats) clap(bt);
    if (bar < 20) {
      hat(bt + BEAT / 2, 0.1);
      if (groove) hat(bt + BEAT / 4, 0.035, 110);
    }
  }
  // Clap roll into the drops.
  if (fillBar) for (let k = 0; k < 8; k++) clap(t + 1 + k * 0.125, 0.12 + k * 0.025);

  // Bass: eighth notes, octave bounce on the offbeats.
  if (groove) {
    for (let e = 0; e < 8; e++) {
      if (fillBar && e >= 4) break;
      bass(midi(chord.bass + (e % 2 ? 12 : 0)), t + e * 0.25, 0.22);
    }
  }

  // Arpeggio: quiet in the hook, full from 8 s, softer under the round's sound effects.
  const arpGain = bar < 2 ? 0.05 : bar < 4 ? 0 : bar < 8 ? 0.06 : bar < 20 ? 0.09 : 0.07;
  if (arpGain > 0 && !(fillBar)) {
    for (let k = 0; k < 16; k++) pluck(midi(tones[ARP[k % 8]] + 12), t + k * 0.125, arpGain, k % 2 ? 0.35 : -0.35);
  }

  // Pad under the finale.
  if (bar >= 18) pad(chord.tones.map(midi), t, bar === 21 ? 3 : 2.05);
}

// Final chord rings out after the last hit.
pad(CHORDS[0].tones.map(midi), 44, 1);

// Transitions and impacts.
riser(2, 2);
whoosh(3.6, 0.6);
impact(4); // Title
miss(8 + 1.5); // Round: "Potato"
miss(8 + 3.5); // "Rock"
chime(8 + 5.5, 76); // "Reindeer"
whoosh(15.75, 0.4); // into the line-up
riser(26, 2);
impact(28); // Speed round
for (let i = 0; i < 7; i++) chime(29 + i + 0.5, 79, 0.11); // each reveal
riser(34, 2);
impact(36); // Finale
impact(40, 0.7); // End card

// ---------- Mix ----------

// Dotted-eighth ping-pong delay on the plucks.
const D = Math.round(0.375 * SR);
for (let i = D; i < N; i++) {
  delayL[i] += delayR[i - D] * 0.35;
  delayR[i] += delayL[i - D] * 0.35;
}
for (let i = 0; i < N; i++) {
  L[i] += delayL[i] * 0.45;
  R[i] += delayR[i] * 0.45;
}

// Fade the last second to silence (the picture fades to black too), soft-clip, normalize.
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = t > 44 ? Math.max(0, 45 - t) : 1;
  L[i] = Math.tanh(L[i] * 1.1) * fade;
  R[i] = Math.tanh(R[i] * 1.1) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;

const buffer = Buffer.alloc(44 + N * 4);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + N * 4, 4);
buffer.write("WAVEfmt ", 8);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(2, 22);
buffer.writeUInt32LE(SR, 24);
buffer.writeUInt32LE(SR * 4, 28);
buffer.writeUInt16LE(4, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buffer.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4);
  buffer.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4);
}
writeFileSync(new URL("../public/music.wav", import.meta.url), buffer);

// Loudness per section, as a sanity check on the mix.
const rms = (a, b) => {
  let s = 0;
  for (let i = a * SR; i < b * SR; i++) s += (L[i] * norm) ** 2;
  return (20 * Math.log10(Math.sqrt(s / ((b - a) * SR)))).toFixed(1);
};
console.log(`peak before normalize ${peak.toFixed(2)}; RMS dBFS:`, {
  hook: rms(0, 4), title: rms(4, 8), round: rms(8, 16), middle: rms(16, 28), speed: rms(28, 36), finale: rms(36, 44), tail: rms(44, 45),
});
