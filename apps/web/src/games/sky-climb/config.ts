// Everything that tunes Sky Climb: movement physics, the zones, and how difficulty ramps
// with height. Balancing the game should only ever mean editing this file.
import { CLIMB_FLOORS, CLIMB_MOON_FLOOR } from "@shadow/shared";

/** The summit. Version 3 towers go on past it to the Moon (`MOON`). */
export const FLOORS = CLIMB_FLOORS;
export const MOON = CLIMB_MOON_FLOOR;
export const SKY_CLIMB_HOME = "/games/sky-climb";
export const SKY_CLIMB_PATH = `${SKY_CLIMB_HOME}/play`;

export const PHYS = {
  gravity: 26,
  /** Apex ≈ jumpSpeed² / 2g ≈ 1.8 units: the highest step a floor may ask for is 1.25. */
  jumpSpeed: 9.6,
  /** Releasing jump early cuts the rise to this fraction, for short hops. */
  jumpCut: 0.45,
  runSpeed: 5.2,
  groundAccel: 48,
  iceAccel: 9,
  airAccel: 20,
  /** Jumping is still allowed this long after walking off an edge. */
  coyote: 0.11,
  /** A jump pressed this long before landing still happens on landing. */
  jumpBuffer: 0.13,
  springSpeed: 15.5,
  maxFall: 24,
  /** Player collision: a cylinder this wide (radius) and tall. */
  radius: 0.22,
  height: 0.9,
  /** Falling this far below the last checkpoint counts as a fall. */
  fallDepth: 7,
} as const;

/** The tower: platforms spiral around a central column. */
export const TOWER = {
  pathRadius: 5.2,
  coreRadius: 2.1,
  /** Kit pieces are scaled up by this so platforms feel generous. */
  pieceScale: 1.3,
} as const;

export type ZoneId = "meadow" | "treetops" | "cliffs" | "snow" | "storm" | "summit" | "orbit" | "nebula" | "moon";
/** `orbit`: an asteroid that circles round its spot, along the path and up and down. */
export type Special = "moving" | "lift" | "spring" | "conveyor" | "crumble" | "vanish" | "orbit";
export type Weather = "petals" | "leaves" | "dust" | "snow" | "rain" | "stars" | "stardust";
export type HazardType = "saw" | "spikes" | "meteor";

export interface SkyLook {
  top: string;
  bottom: string;
  fog: string;
  sun: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
}

export interface Zone {
  id: ZoneId;
  name: string;
  emoji: string;
  /** First floor of the zone. */
  from: number;
  blurb: string;
  /** Platform pieces by size. */
  pieces: { big: string; long: string; normal: string; narrow: string };
  /** The column's building block. */
  core: string;
  /** Multiplies the kit's colours: evening light, storm gloom. */
  tint: string;
  deco: string[];
  /** Special platforms that can appear, with relative weights. */
  specials: Partial<Record<Special, number>>;
  hazards: Partial<Record<HazardType, number>>;
  ice: boolean;
  wind: boolean;
  /** Multiplies gravity: jumps go higher and hang longer in thin air and space. */
  gravity?: number;
  weather: Weather;
  sky: SkyLook;
}

export const ZONES: Zone[] = [
  {
    id: "meadow",
    name: "Meadow",
    emoji: "🌱",
    from: 0,
    blurb: "Wide platforms and short hops. Find your feet.",
    pieces: { big: "block-grass-low-large", long: "block-grass-low-long", normal: "block-grass-low", narrow: "block-grass-low-narrow" },
    core: "block-grass-large-tall",
    tint: "#ffffff",
    deco: ["flowers", "flowers-tall", "grass", "mushrooms", "plant"],
    specials: {},
    hazards: { saw: 0, spikes: 0 },
    ice: false,
    wind: false,
    weather: "petals",
    sky: {
      top: "#d3e2da",
      bottom: "#f6eedf",
      fog: "#efe5d1",
      sun: "#fff4e2",
      sunIntensity: 2.4,
      hemiSky: "#f4ecdc",
      hemiGround: "#6f8f4e",
      hemiIntensity: 1.1,
    },
  },
  {
    id: "treetops",
    name: "Treetops",
    emoji: "🌳",
    from: 11,
    blurb: "Smaller platforms, longer jumps, and the first moving ones.",
    pieces: { big: "block-grass-low-large", long: "block-grass-low-long", normal: "platform", narrow: "block-grass-low-narrow" },
    core: "block-grass-large-tall",
    tint: "#f4fff0",
    deco: ["tree", "tree-pine", "grass", "mushrooms", "flowers"],
    specials: { moving: 3, spring: 1, lift: 1 },
    hazards: { saw: 0, spikes: 0 },
    ice: false,
    wind: false,
    weather: "leaves",
    sky: {
      top: "#bcd3c8",
      bottom: "#f1e7d3",
      fog: "#e6dcc6",
      sun: "#fff0d4",
      sunIntensity: 2.5,
      hemiSky: "#ece4d0",
      hemiGround: "#5d7d40",
      hemiIntensity: 1.05,
    },
  },
  {
    id: "cliffs",
    name: "Cliffs",
    emoji: "🪨",
    from: 26,
    blurb: "Narrow beams, conveyor belts and spike traps in the golden hour.",
    pieces: { big: "block-grass-low-large", long: "block-grass-low-long", normal: "platform-fortified", narrow: "block-grass-low-narrow" },
    core: "block-grass-large-tall",
    tint: "#f3dcc0",
    deco: ["rocks", "stones", "fence-straight", "sign"],
    specials: { moving: 3, lift: 2, spring: 1, conveyor: 2, crumble: 2 },
    hazards: { saw: 0, spikes: 1 },
    ice: false,
    wind: false,
    weather: "dust",
    sky: {
      top: "#d89a3a",
      bottom: "#f6deb0",
      fog: "#efd2a0",
      sun: "#ffd196",
      sunIntensity: 2.2,
      hemiSky: "#f8dcb4",
      hemiGround: "#6e5640",
      hemiIntensity: 0.95,
    },
  },
  {
    id: "snow",
    name: "Snow Peak",
    emoji: "❄️",
    from: 46,
    blurb: "Slippery ice, crumbling ledges and gusts of wind at sunset.",
    pieces: { big: "block-snow-low-large", long: "block-snow-low-long", normal: "block-snow-low", narrow: "block-snow-low-narrow" },
    core: "block-snow-large-tall",
    tint: "#fbeadc",
    deco: ["tree-pine-snow", "tree-snow", "rocks"],
    specials: { moving: 2, lift: 2, crumble: 3, conveyor: 1, spring: 1 },
    hazards: { saw: 1, spikes: 0 },
    ice: true,
    wind: true,
    weather: "snow",
    sky: {
      top: "#a8492a",
      bottom: "#f0b08a",
      fog: "#dfa287",
      sun: "#ffb48c",
      sunIntensity: 1.7,
      hemiSky: "#f6c4ab",
      hemiGround: "#5a3f36",
      hemiIntensity: 0.9,
    },
  },
  {
    id: "storm",
    name: "Storm",
    emoji: "⛈️",
    from: 71,
    blurb: "Spinning saws, vanishing platforms and lightning in the dark.",
    pieces: { big: "block-snow-low-large", long: "block-snow-low-long", normal: "block-moving-blue", narrow: "block-snow-low-narrow" },
    core: "block-snow-large-tall",
    tint: "#a9bdb6",
    deco: ["rocks"],
    specials: { vanish: 3, moving: 2, lift: 1, crumble: 2 },
    hazards: { saw: 2, spikes: 1 },
    ice: false,
    wind: true,
    weather: "rain",
    sky: {
      top: "#0c1f1e",
      bottom: "#2c4743",
      fog: "#26403b",
      sun: "#b9d6cc",
      sunIntensity: 0.9,
      hemiSky: "#5f8a80",
      hemiGround: "#0f2321",
      hemiIntensity: 0.85,
    },
  },
  {
    id: "summit",
    name: "Summit",
    emoji: "🏁",
    from: FLOORS,
    blurb: "Above the storm, under the stars. The air thins: jumps carry further.",
    pieces: { big: "block-snow-low-large", long: "block-snow-low-long", normal: "block-snow-low", narrow: "block-snow-low-narrow" },
    core: "block-snow-large-tall",
    tint: "#f2ead8",
    deco: ["rocks"],
    specials: { moving: 1, lift: 1 },
    hazards: {},
    ice: false,
    wind: false,
    gravity: 0.85,
    weather: "stars",
    sky: {
      top: "#061615",
      bottom: "#1f3c37",
      fog: "#1b3532",
      sun: "#f5e2b8",
      sunIntensity: 1.1,
      hemiSky: "#8fb5aa",
      hemiGround: "#0c1f1e",
      hemiIntensity: 0.9,
    },
  },
  // Past the summit (version 3 towers only): space.
  {
    id: "orbit",
    name: "Low Orbit",
    emoji: "🛰️",
    from: 105,
    blurb: "Low gravity, drifting asteroids and falling meteors.",
    pieces: { big: "block-snow-low-large", long: "block-snow-low-long", normal: "block-snow-low", narrow: "block-snow-low-narrow" },
    core: "block-snow-large-tall",
    tint: "#b9b4e8",
    deco: ["rocks", "stones"],
    specials: { orbit: 3, moving: 1, lift: 1, spring: 1 },
    hazards: { meteor: 2 },
    ice: false,
    wind: false,
    gravity: 0.8,
    weather: "stardust",
    sky: {
      top: "#03040f",
      bottom: "#1b1f4a",
      fog: "#141838",
      sun: "#fff1d6",
      sunIntensity: 2.1,
      hemiSky: "#7d86d8",
      hemiGround: "#10122a",
      hemiIntensity: 0.75,
    },
  },
  {
    id: "nebula",
    name: "Nebula",
    emoji: "🌌",
    from: 128,
    blurb: "Fading stars, meteor storms and the longest leaps of all.",
    pieces: { big: "block-snow-low-large", long: "block-snow-low-long", normal: "block-moving-blue", narrow: "block-snow-low-narrow" },
    core: "block-snow-large-tall",
    tint: "#e3b3ec",
    deco: ["rocks"],
    specials: { orbit: 2, vanish: 3, crumble: 1, lift: 1 },
    hazards: { saw: 1, meteor: 3 },
    ice: false,
    wind: false,
    gravity: 0.72,
    weather: "stardust",
    sky: {
      top: "#12041f",
      bottom: "#5a1f62",
      fog: "#3a1745",
      sun: "#ffd8f4",
      sunIntensity: 1.7,
      hemiSky: "#d78be0",
      hemiGround: "#1b0a24",
      hemiIntensity: 0.85,
    },
  },
  {
    id: "moon",
    name: "The Moon",
    emoji: "🌕",
    from: MOON,
    blurb: "The very top of the sky. Plant your flag.",
    pieces: { big: "block-snow-low-large", long: "block-snow-low-long", normal: "block-snow-low", narrow: "block-snow-low-narrow" },
    core: "block-snow-large-tall",
    tint: "#ecebe4",
    deco: [],
    specials: {},
    hazards: {},
    ice: false,
    wind: false,
    gravity: 0.6,
    weather: "stars",
    sky: {
      top: "#000000",
      bottom: "#10131f",
      fog: "#0d1019",
      sun: "#ffffff",
      sunIntensity: 2.2,
      hemiSky: "#9aa3c0",
      hemiGround: "#2a2a2a",
      hemiIntensity: 0.85,
    },
  },
];

/** The zones a tower climbs through, up to its top floor. */
export const zonesUpTo = (top: number) => ZONES.filter((z) => z.from <= top);

export function zoneIndexOf(floor: number): number {
  let i = 0;
  while (i + 1 < ZONES.length && floor >= ZONES[i + 1].from) i++;
  return i;
}

export const zoneOf = (floor: number) => ZONES[zoneIndexOf(floor)];

export type PowerupKind = "feather" | "doubleJump" | "shield" | "magnet";

export const POWERUP_KINDS: PowerupKind[] = ["feather", "doubleJump", "shield", "magnet"];

/** The pickups: touch an orb and the effect starts. `duration` is in seconds. */
export const POWERUPS: Record<PowerupKind, { name: string; emoji: string; color: string; duration: number; blurb: string }> = {
  feather: { name: "Feather", emoji: "🪶", color: "#8ef0d0", duration: 8, blurb: "Hold jump while falling to float" },
  doubleJump: { name: "Double Jump", emoji: "🌀", color: "#c78bff", duration: 12, blurb: "Press jump again in mid-air" },
  shield: { name: "Shield", emoji: "🛡️", color: "#4da3ff", duration: 25, blurb: "Absorbs one saw or spike hit" },
  magnet: { name: "Magnet", emoji: "🧲", color: "#ff6b6b", duration: 10, blurb: "Coins fly to you" },
};

/** Tuning for the effects themselves. */
export const POWER = {
  /** Distance at which an orb is picked up. */
  pickupRadius: 0.8,
  /** Feather: falling gravity multiplier and top fall speed while floating. */
  featherGravity: 0.45,
  featherMaxFall: 6,
  /** Double jump: the mid-air jump's strength relative to a normal one. */
  airJump: 0.92,
  /** Shield: invulnerable for this long after it absorbs a hit. */
  shieldGrace: 1,
  /** Magnet: coins this close fly to the climber at this speed. */
  magnetRadius: 3.5,
  magnetSpeed: 10,
} as const;

/** Which power-ups each zone's orbs can be, with relative weights. The meadow has none: learn the basics first. */
export const ZONE_POWERUPS: Record<ZoneId, Partial<Record<PowerupKind, number>>> = {
  meadow: {},
  treetops: { feather: 1, magnet: 1 },
  cliffs: { doubleJump: 1 },
  snow: { shield: 1, feather: 1 },
  storm: { shield: 2, doubleJump: 1, feather: 1 },
  summit: {},
  orbit: { doubleJump: 2, feather: 1, shield: 1, magnet: 1 },
  nebula: { shield: 2, doubleJump: 1, feather: 1 },
  moon: {},
};

/** Orbs never appear below this floor, and are at least this many floors apart. */
export const POWERUP_MIN_FLOOR = 5;
export const POWERUP_SPACING = 6;

export type CannonGrade = "weak" | "good" | "perfect";

/**
 * Launch cannons (version 2 towers). Each range holds one cannon's floor, picked by the seed;
 * the shot lands 2, 5 or 8 floors up depending on the power meter. The ranges keep every
 * shot clear of the set-pieces, so nobody flies over one.
 */
export const CANNON = {
  ranges: [
    [11, 12],
    [27, 32],
    [47, 56],
    [73, 84],
    // Version 3 towers only: a shot through Low Orbit.
    [106, 111],
  ] as [number, number][],
  lift: { weak: 2, good: 5, perfect: 8 } as Record<CannonGrade, number>,
  /** The meter sweeps 0 → 1 → 0 in this many seconds (divided by tempo). */
  period: 1.3,
  /** Meter readings from which a shot is perfect, or good. */
  perfect: 0.8,
  good: 0.45,
  /** Fires by itself after this long. Jump doesn't fire before `arm` (a jump pressed while landing on the pad). */
  autoFire: 3.2,
  arm: 0.35,
  /** Walk within this distance of the cannon to climb in. */
  padRadius: 0.6,
  /** Seconds in the air for each grade. */
  flight: { weak: 1.1, good: 1.5, perfect: 1.9 } as Record<CannonGrade, number>,
  /** Slows the flight at the top of the arc (0 = none, under 1). */
  hang: 0.55,
  /** The arc swings out from the tower this far, clear of the platforms on the way. */
  swing: 3,
  /** Coins strung along the perfect shot's arc. */
  coins: 7,
} as const;

export type SetPieceId = "bridge" | "saws" | "canyon" | "lightning" | "asteroids" | "meteors";

/**
 * Hand-built finales between two checkpoints (version 2 towers; the space ones on version 3).
 * `prize` is what clearing one says.
 */
export const SET_PIECES: { id: SetPieceId; name: string; emoji: string; call: string; from: number; to: number; prize: string }[] = [
  { id: "bridge", name: "Collapsing Bridge", emoji: "🌉", call: "It's falling apart. RUN!", from: 21, to: 24, prize: "Bonus coins on the checkpoint" },
  { id: "saws", name: "Saw Gauntlet", emoji: "🪚", call: "Find the rhythm, jump the blades", from: 41, to: 44, prize: "Bonus coins on the checkpoint" },
  { id: "canyon", name: "Updraft Canyon", emoji: "🌪️", call: "Too far to jump: ride the wind", from: 66, to: 70, prize: "Bonus coins on the checkpoint" },
  { id: "lightning", name: "Lightning Sprint", emoji: "⚡", call: "Chase the strikes to the summit", from: 94, to: 99, prize: "The summit is yours" },
  { id: "asteroids", name: "Asteroid Belt", emoji: "🪐", call: "Ride the circling rocks across", from: 123, to: 127, prize: "Bonus coins on the checkpoint" },
  { id: "meteors", name: "Meteor Shower", emoji: "☄️", call: "Watch for the red rings. Keep moving!", from: 144, to: 149, prize: "The Moon is yours" },
];

export const setPieceAt = (floor: number) => SET_PIECES.find((sp) => floor >= sp.from && floor <= sp.to);

/** Updraft columns: how hard they push up, and the top speed they lift to. */
export const UPDRAFT = { accel: 45, maxRise: 9, radius: 1.4 } as const;

/**
 * Orbiting asteroids circle with this radius along the path (times a random 0.55…0.8 ×
 * pieceScale); the up-and-down part of the circle is squashed to `rise` of it.
 */
export const ORBIT = { rise: 0.45, period: [3.6, 4.6] as [number, number] } as const;

/**
 * Meteors: a red ring warns `warn` seconds before one lands, the rock itself is seen for the
 * last `fall` seconds of its drop, and the impact burns `radius` round the ring for `blast`.
 */
export const METEOR = { period: [3.4, 4.4] as [number, number], warn: 1.2, fall: 0.7, drop: 10, blast: 0.3, radius: 0.85, rock: 0.42 } as const;

/** Respawn points: every 5 floors low down, every 7 or 8 higher up (where floors are harder). */
export const CHECKPOINTS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 58, 65, 72, 79, 86, 93, FLOORS, 107, 114, 121, 128, 135, 142, MOON];

export const isCheckpoint = (floor: number) => CHECKPOINTS.includes(floor);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Difficulty at a floor. Everything ramps smoothly with height (not only at zone borders):
 * the meadow is a staircase, the storm asks for long, precise jumps.
 */
export function knobs(floor: number) {
  if (floor > FLOORS) return spaceKnobs(floor);
  const d = Math.min(1, floor / (FLOORS - 1));
  const e = ease(d);
  return {
    /** Height between consecutive platforms. */
    rise: lerp(0.45, 1.2, e),
    /** Horizontal gap, edge to edge. */
    gap: lerp(0.45, 2.0, e),
    /** Relative odds of each platform size. */
    sizes: { big: lerp(0.55, 0.06, d), long: lerp(0.35, 0.24, d), normal: lerp(0.1, 0.45, d), narrow: lerp(0, 0.25, e) },
    /** Chance a platform is special (moving, crumbling…), if the zone has any. */
    special: lerp(0.15, 0.6, d),
    /** Chance a big or long platform carries a hazard, if the zone has any. */
    hazard: lerp(0.2, 0.55, d),
    /** Speeds up movers, saws and vanishing cycles. */
    tempo: lerp(0.75, 1.45, e),
    /** How far platforms stray in and out from the path. */
    wander: lerp(0.1, 0.45, d),
  };
}

/**
 * Past the summit gravity is lower (see the zones), so the jumps can be longer and higher
 * for the same effort. A short breather after the summit, then it ramps again.
 */
function spaceKnobs(floor: number) {
  const e = ease(Math.min(1, (floor - FLOORS) / (MOON - FLOORS)));
  return {
    rise: lerp(1.15, 1.45, e),
    gap: lerp(2.05, 2.6, e),
    sizes: { big: 0.06, long: 0.26, normal: 0.43, narrow: 0.25 },
    special: lerp(0.55, 0.72, e),
    hazard: lerp(0.5, 0.68, e),
    tempo: lerp(1.25, 1.6, e),
    wander: 0.45,
  };
}

export const CHARACTERS = [
  "male-a",
  "female-a",
  "male-b",
  "female-b",
  "male-c",
  "female-c",
  "male-d",
  "female-d",
  "male-e",
  "female-e",
  "male-f",
  "female-f",
] as const;
export type CharacterId = (typeof CHARACTERS)[number];

export const characterUrl = (id: CharacterId) => `/sky-climb/characters/character-${id}.glb`;
export const kitUrl = (piece: string) => `/sky-climb/kit/${piece}.glb`;

/** Native size of each kit piece (width x, height y, depth z) before pieceScale. */
export const PIECE_SIZE: Record<string, [number, number, number]> = {
  "block-grass-low": [1.08, 0.5, 1.08],
  "block-grass-low-large": [2.08, 0.5, 2.08],
  "block-grass-low-long": [2.08, 0.5, 1.08],
  "block-grass-low-narrow": [0.78, 0.5, 0.78],
  "block-snow-low": [1.08, 0.5, 1.08],
  "block-snow-low-large": [2.08, 0.5, 2.08],
  "block-snow-low-long": [2.08, 0.5, 1.08],
  "block-snow-low-narrow": [0.78, 0.5, 0.78],
  platform: [1, 0.2, 1],
  "platform-fortified": [1, 0.21, 1],
  "block-moving": [1, 0.3, 1],
  "block-moving-blue": [1, 0.3, 1],
  "conveyor-belt": [1, 0.3, 1],
};
