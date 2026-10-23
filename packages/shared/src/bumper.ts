// Bumper Arena: sumo in bumper rings. Players (and bots) drive round rings on a floating
// arena and shove each other off the edge; the last ring on it wins the round. See
// Bumper-arena-plan.md. This file holds the tuning and the maps; the physics is
// bumperSim.ts, the bots bumperBots.ts.

/** Everything that decides how a ring feels. One object, so the prototype can tune it live. */
export interface BumperTuning {
  /** Ring radius (m). */
  radius: number;
  /** Top driving speed (m/s). */
  maxSpeed: number;
  /** Driving acceleration (m/s²). */
  accel: number;
  /** Always-on drag (per second). */
  drag: number;
  /** Extra drag while the stick is let go, so you coast to a stop (per second). */
  brakeDrag: number;
  /** How fast a ring going over top speed (a knock, the end of a dash) slows back to it (m/s²). */
  overspeedDecel: number;
  dashSpeed: number;
  dashSeconds: number;
  dashCooldown: number;
  /** Mass while braced (a ring's mass is 1). */
  braceMass: number;
  /** Driving speed while braced, as a share of top speed. */
  braceSpeed: number;
  braceMaxSeconds: number;
  braceCooldown: number;
  /** Bounciness of ring-on-ring hits, 0–1. */
  restitution: number;
  /** Extra shove a hit gives on top of the bounce (m/s at full closing speed and 100% wobble). */
  knockBase: number;
  /** Share of that shove a ring still takes at 0% wobble. */
  knockFloor: number;
  /** A dashing ring's shove is this many times stronger. */
  dashKnock: number;
  /** Wobble (%) added by a dash hit, and by a plain bump at full closing speed. */
  wobbleDash: number;
  wobbleBump: number;
  wobbleMax: number;
  /** Wobble drained per second once nobody has touched you for `wobbleRestSeconds`. */
  wobbleDrain: number;
  wobbleRestSeconds: number;
  /** A ring that falls this soon after a hit is the hitter's knockout. */
  koWindow: number;
  gravity: number;
}

export const BUMPER_TUNING: BumperTuning = {
  radius: 0.6,
  maxSpeed: 5.5,
  accel: 18,
  drag: 0.6,
  brakeDrag: 2.6,
  overspeedDecel: 16,
  dashSpeed: 9.5,
  dashSeconds: 0.22,
  dashCooldown: 2.5,
  braceMass: 2,
  braceSpeed: 0.4,
  braceMaxSeconds: 1.5,
  braceCooldown: 2,
  restitution: 0.5,
  knockBase: 3,
  knockFloor: 0.2,
  dashKnock: 1.6,
  wobbleDash: 20,
  wobbleBump: 8,
  wobbleMax: 150,
  wobbleDrain: 3,
  wobbleRestSeconds: 1.5,
  koWindow: 3,
  gravity: 22,
};

export const BUMPER_COUNTDOWN_SECONDS = 3;
export const BUMPER_MAX_RINGS = 10;

// ---------- Maps ----------

/**
 * plate: a round arena whose rim breaks off in sudden death. spinner: the same, with a bar
 * sweeping round a post in the middle. hex: a floor of hexagonal tiles that drop a moment
 * after a ring drives over them.
 */
export type BumperMapKind = "plate" | "spinner" | "hex";

export interface BumperMap {
  id: string;
  name: string;
  /** One line for menus. */
  blurb: string;
  kind: BumperMapKind;
  /** Arena radius (m) from 4 rings up; 2 or 3 rings get a slightly smaller arena (see arenaRadius). */
  radius: number;
  /** Grip, as a share of normal: under 1 is slippery (acceleration, drag and braking all scale). */
  grip: number;
  /**
   * The outline: the edge's distance from the middle, as a share of `radius`, is 1 plus the
   * sum of these waves (amplitude, how many times round, phase). Empty: a circle.
   */
  outline: [number, number, number][];
  /** Sudden death: from `at` seconds into the round, the edge drops `step` metres every `every` seconds, down to `minRadius`. */
  suddenDeath: { at: number; every: number; step: number; minRadius: number; warnSeconds: number };
}

const SUDDEN_DEATH = { at: 60, every: 4, step: 1.25, minRadius: 3, warnSeconds: 1.5 };

export const BUMPER_MAPS: Record<string, BumperMap> = {
  "picnic-plate": {
    id: "picnic-plate",
    name: "Picnic Plate",
    blurb: "A giant plate in the sky. No tricks, just you and the edge.",
    kind: "plate",
    radius: 16,
    grip: 1,
    // A fluted plate rim.
    outline: [[0.018, 28, 0]],
    suddenDeath: SUDDEN_DEATH,
  },
  "ice-floe": {
    id: "ice-floe",
    name: "Ice Floe",
    blurb: "Hardly any grip: you glide, and every bump carries.",
    kind: "plate",
    radius: 15,
    grip: 0.42,
    // A floe that cracked off something bigger: lumpy, never round.
    outline: [
      [0.06, 3, 0.4],
      [0.045, 5, 2.1],
      [0.03, 8, 4.4],
      [0.018, 13, 1.3],
    ],
    suddenDeath: SUDDEN_DEATH,
  },
  spinner: {
    id: "spinner",
    name: "Spinner",
    blurb: "A long bar sweeps round the middle, faster and faster.",
    kind: "spinner",
    radius: 14,
    grip: 1,
    // A carousel's petals.
    outline: [[0.05, 10, 0]],
    suddenDeath: SUDDEN_DEATH,
  },
  "hex-hive": {
    id: "hex-hive",
    name: "Hex Hive",
    blurb: "Tiles crack under the rings on them, then drop. Keep moving.",
    kind: "hex",
    radius: 13,
    grip: 1,
    outline: [],
    suddenDeath: { ...SUDDEN_DEATH, at: 50 },
  },
};

/** The edge's distance at heading `a` (radians, 0 = +z, as atan2(x, z)), as a share of the radius. */
export function outlineAt(map: BumperMap, a: number): number {
  let f = 1;
  for (const [amp, n, phase] of map.outline) f += amp * Math.sin(n * a + phase);
  return f;
}

/** The ring tuning on a map: slippery maps scale down everything that grips. */
export function withGrip(base: BumperTuning, grip: number): BumperTuning {
  if (grip === 1) return base;
  return { ...base, accel: base.accel * grip, drag: base.drag * grip, brakeDrag: base.brakeDrag * grip, overspeedDecel: base.overspeedDecel * grip };
}

// ---------- Spinner ----------

export const SPINNER = {
  /** The post in the middle (m). */
  hubRadius: 1.3,
  /** Half the bar's thickness (m). */
  halfWidth: 0.3,
  /** Turns a second at the start, and by `rampSeconds`. */
  startTurns: 1 / 9,
  endTurns: 1 / 4,
  rampSeconds: 90,
  /** How hard the bar shoves: a share of its own speed where it hits. */
  push: 1.25,
  wobble: 8,
};

/** The bar's angular speed (rad/s) at round time t. */
export const spinnerSpeed = (t: number) => {
  const k = Math.min(1, Math.max(0, t) / SPINNER.rampSeconds);
  return Math.PI * 2 * (SPINNER.startTurns + (SPINNER.endTurns - SPINNER.startTurns) * k);
};

// ---------- Hex Hive ----------

export const HEX = {
  /** Centre to corner (m). */
  size: 1.3,
  /** Ring-seconds on a tile before it cracks. */
  wearSeconds: 2.5,
  /** A ring skims over a hole this long (s) before it drops in, so a quick one can cross. */
  skimSeconds: 0.3,
  /** From cracking to dropping (s). */
  crackSeconds: 2,
};

/** Tiles of a hex floor reaching `radius`: axial coordinates (pointy-top) and centres. */
export function hexTiles(radius: number): { q: number; r: number; x: number; z: number }[] {
  const out: { q: number; r: number; x: number; z: number }[] = [];
  const n = Math.ceil(radius / (HEX.size * 1.5)) + 1;
  for (let q = -n; q <= n; q++) {
    for (let r = -n; r <= n; r++) {
      const x = HEX.size * Math.sqrt(3) * (q + r / 2);
      const z = HEX.size * 1.5 * r;
      if (Math.hypot(x, z) <= radius - HEX.size * 0.5) out.push({ q, r, x, z });
    }
  }
  return out;
}

/** The axial coordinates of the tile under (x, z). */
export function hexAt(x: number, z: number): { q: number; r: number } {
  const fq = ((Math.sqrt(3) / 3) * x - z / 3) / HEX.size;
  const fr = ((2 / 3) * z) / HEX.size;
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

/** Full size from 4 rings (a full party room); a little smaller for 2 or 3, so they don't spend a round looking for each other. */
export function arenaRadius(map: BumperMap, rings: number): number {
  const share = Math.min(1, Math.max(0, (rings - 2) / 2));
  return map.radius * (0.85 + 0.15 * share);
}

// ---------- Pickups ----------

/**
 * heavy: a bigger, heavier, slower ring · turbo: dashes come back fast · shock: the next dash
 * blasts everyone close away · bubble: the next hit is shrugged off · banana: a slick patch
 * dropped behind you.
 */
export type PickupKind = "heavy" | "turbo" | "shock" | "bubble" | "banana";
export const PICKUP_KINDS: PickupKind[] = ["heavy", "turbo", "shock", "bubble", "banana"];
export const PICKUP_NAMES: Record<PickupKind, string> = { heavy: "Heavyweight", turbo: "Turbo", shock: "Shockwave", bubble: "Bubble", banana: "Banana" };

export const PICKUPS = {
  /** The first one appears this far into a round (s), then one every `every` s, at most `max` at a time. */
  first: 6,
  every: 12,
  max: 2,
  /** It pulses this long (s) before it can be taken, so nobody gets one by pure luck. */
  warn: 1,
  /** Taken by a ring whose edge comes this close (m). */
  reach: 0.45,
  heavy: { seconds: 6, scale: 1.4, mass: 2.5, speed: 0.85 },
  turbo: { seconds: 5, cooldown: 0.6 },
  /** Kept until the next dash (or this long). */
  shock: { seconds: 15, radius: 3, push: 7, wobble: 15 },
  bubble: { seconds: 8 },
  /** The patch: how long it lies, its size, how long a ring on it slides, the grip it has meanwhile, and how far behind the ring it's dropped. Its owner is safe from it for a moment. */
  banana: { patchSeconds: 10, radius: 1, slip: 1.5, grip: 0.08, behind: 1.4, ownerSafe: 1.5 },
};
