// Everything that tunes Sky Climb: movement physics, the zones, and how difficulty ramps
// with height. Balancing the game should only ever mean editing this file.
import { CLIMB_FLOORS } from "@shadow/shared";

export const FLOORS = CLIMB_FLOORS;
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

export type ZoneId = "meadow" | "treetops" | "cliffs" | "snow" | "storm" | "summit";
export type Special = "moving" | "lift" | "spring" | "conveyor" | "crumble" | "vanish";
export type Weather = "petals" | "leaves" | "dust" | "snow" | "rain" | "stars";

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
  hazards: { saw: number; spikes: number };
  ice: boolean;
  wind: boolean;
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
      top: "#5fb2f2",
      bottom: "#d8f0ff",
      fog: "#cde9fb",
      sun: "#fff4dc",
      sunIntensity: 2.4,
      hemiSky: "#cfe9ff",
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
      top: "#4aa3ea",
      bottom: "#c4ebff",
      fog: "#bfe4f7",
      sun: "#fff0c8",
      sunIntensity: 2.5,
      hemiSky: "#c6e6ff",
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
      top: "#e98d58",
      bottom: "#ffd9a4",
      fog: "#f2c99a",
      sun: "#ffc985",
      sunIntensity: 2.2,
      hemiSky: "#ffd7ac",
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
    tint: "#f1eaff",
    deco: ["tree-pine-snow", "tree-snow", "rocks"],
    specials: { moving: 2, lift: 2, crumble: 3, conveyor: 1, spring: 1 },
    hazards: { saw: 1, spikes: 0 },
    ice: true,
    wind: true,
    weather: "snow",
    sky: {
      top: "#5a4c9c",
      bottom: "#ff9f7d",
      fog: "#d9a3a0",
      sun: "#ffad85",
      sunIntensity: 1.7,
      hemiSky: "#ffc1b0",
      hemiGround: "#4a4670",
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
    tint: "#9aa6c4",
    deco: ["rocks"],
    specials: { vanish: 3, moving: 2, lift: 1, crumble: 2 },
    hazards: { saw: 2, spikes: 1 },
    ice: false,
    wind: true,
    weather: "rain",
    sky: {
      top: "#0f1528",
      bottom: "#2c3652",
      fog: "#283149",
      sun: "#a9bbff",
      sunIntensity: 0.9,
      hemiSky: "#5a6a92",
      hemiGround: "#121628",
      hemiIntensity: 0.85,
    },
  },
  {
    id: "summit",
    name: "Summit",
    emoji: "🏁",
    from: FLOORS,
    blurb: "Above the storm, under the stars. You made it.",
    pieces: { big: "block-snow-low-large", long: "block-snow-low-long", normal: "block-snow-low", narrow: "block-snow-low-narrow" },
    core: "block-snow-large-tall",
    tint: "#e6e8ff",
    deco: [],
    specials: {},
    hazards: { saw: 0, spikes: 0 },
    ice: false,
    wind: false,
    weather: "stars",
    sky: {
      top: "#070b24",
      bottom: "#3b2f70",
      fog: "#2b2860",
      sun: "#d5dcff",
      sunIntensity: 1.1,
      hemiSky: "#8d93d8",
      hemiGround: "#1a1838",
      hemiIntensity: 0.9,
    },
  },
];

export function zoneIndexOf(floor: number): number {
  let i = 0;
  while (i + 1 < ZONES.length && floor >= ZONES[i + 1].from) i++;
  return i;
}

export const zoneOf = (floor: number) => ZONES[zoneIndexOf(floor)];

/** Respawn points: every 5 floors low down, every 10 higher up. */
export const CHECKPOINTS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, FLOORS];

export const isCheckpoint = (floor: number) => CHECKPOINTS.includes(floor);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Difficulty at a floor. Everything ramps smoothly with height (not only at zone borders):
 * the meadow is a staircase, the storm asks for long, precise jumps.
 */
export function knobs(floor: number) {
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
