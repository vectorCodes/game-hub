import { z } from "zod";
import type { AvatarConfig } from "./avatar";

// Sky Climb: a daily 3D tower. The tower is generated in the browser from the seed; the
// server keeps the runs, checks progress is plausible, and ranks the daily climbs.

/** Floors in a tower; the last one is the summit. */
export const CLIMB_FLOORS = 100;
/** The fastest a floor can honestly be climbed, in seconds. Faster progress is rejected. */
export const CLIMB_MIN_SECONDS_PER_FLOOR = 0.45;

export const ClimbMode = z.enum(["daily", "practice"]);
export type ClimbMode = z.infer<typeof ClimbMode>;

export type ClimbStatus = "climbing" | "finished" | "summit";

export const StartClimbBody = z.object({
  mode: ClimbMode,
  /** A challenge link's run: climb its tower (and race its ghost). */
  challenge: z.uuid().optional(),
});

export const ClimbProgressBody = z.object({
  floor: z.int().min(0).max(CLIMB_FLOORS),
  coins: z.int().min(0).max(10_000),
  falls: z.int().min(0).max(100_000),
});
export type ClimbProgressBody = z.infer<typeof ClimbProgressBody>;

export const ClimbFinishBody = ClimbProgressBody.extend({
  /** The climb's replay (`encodeGhost`), kept so others can race it. */
  ghost: z.string().max(400_000).optional(),
});
export type ClimbFinishBody = z.infer<typeof ClimbFinishBody>;

export interface ClimbRunView {
  runId: string;
  mode: ClimbMode;
  /** Seeds the tower generator: the date for the daily, random for practice. */
  seed: string;
  /** Daily only: the UTC date of the tower. */
  date: string | null;
  bestFloor: number;
  status: ClimbStatus;
}

export interface ClimbLeaderboardEntry {
  rank: number;
  /** Shortened for privacy: "Ada L." */
  name: string;
  avatarUrl: string | null;
  floor: number;
  /** Seconds to reach that floor (the tie-breaker). */
  seconds: number;
  isMe: boolean;
  avatar: AvatarConfig | null;
}

export interface ClimbDailyView {
  date: string;
  /** Today's tower number (#1 on launch day). */
  number: number;
  /** The signed-in player's best climb today, if any. */
  myBest: { floor: number; seconds: number } | null;
  climbers: number;
  top: ClimbLeaderboardEntry[];
  me: ClimbLeaderboardEntry | null;
  /** When the next tower opens (midnight UTC). */
  nextAt: string;
}

// ---------- Locker: coins, cosmetics, achievements ----------

export type ClimbItemKind = "character" | "trail" | "hat" | "eyewear";

/** An unlock earned in Shadow Guess (stats from its user_stats row). */
export interface ShadowGuessRule {
  stat: "maxStreak" | "won";
  target: number;
  label: string;
}

export interface ClimbItem {
  /** "character:male-a", "trail:ember"… */
  id: string;
  kind: ClimbItemKind;
  name: string;
  /** Coins to buy it; 0 = free from the start. */
  price: number;
  /** Earned by a Sky Climb achievement instead of bought. */
  achievement?: string;
  /** Earned in Shadow Guess instead of bought. */
  shadowGuess?: ShadowGuessRule;
}

const character = (key: string, name: string, price: number): ClimbItem => ({ id: `character:${key}`, kind: "character", name, price });
const trail = (key: string, name: string, price: number, achievement?: string): ClimbItem => ({
  id: `trail:${key}`,
  kind: "trail",
  name,
  price,
  achievement,
});

const hat = (key: string, name: string, price: number, extra: Partial<ClimbItem> = {}): ClimbItem => ({
  id: `hat:${key}`,
  kind: "hat",
  name,
  price,
  ...extra,
});
const eyewear = (key: string, name: string, price: number, extra: Partial<ClimbItem> = {}): ClimbItem => ({
  id: `eyewear:${key}`,
  kind: "eyewear",
  name,
  price,
  ...extra,
});

/**
 * Everything a player can own, across GameHub. Coins come from Sky Climb; some items are
 * earned instead, in Sky Climb (achievements) or in Shadow Guess. Cosmetics only.
 * A character is a style: owning it unlocks its hair style and its outfit for the avatar.
 */
export const CLIMB_ITEMS: ClimbItem[] = [
  character("male-a", "Leo", 0),
  character("female-a", "Mia", 0),
  character("male-b", "Sam", 0),
  character("female-b", "Ivy", 0),
  character("male-c", "Max", 30),
  character("female-c", "Zoe", 30),
  character("male-d", "Ben", 60),
  character("female-d", "Ada", 60),
  character("male-e", "Kai", 100),
  character("female-e", "Lea", 100),
  character("male-f", "Rex", 150),
  character("female-f", "Joy", 150),
  trail("none", "No trail", 0),
  trail("sparkle", "Sparkle", 50),
  trail("ember", "Ember", 120),
  trail("rainbow", "Rainbow", 250),
  trail("gold", "Summit gold", 0, "summit"),
  hat("none", "No hat", 0),
  hat("cap", "Cap", 0),
  hat("beanie", "Beanie", 40),
  hat("party", "Party hat", 60),
  hat("cowboy", "Cowboy hat", 90),
  hat("tophat", "Top hat", 120),
  hat("propeller", "Propeller cap", 0, { achievement: "storm-chaser" }),
  hat("crown", "Crown", 0, { shadowGuess: { stat: "maxStreak", target: 7, label: "7-day Shadow Guess streak" } }),
  hat("wizard", "Wizard hat", 0, { shadowGuess: { stat: "won", target: 25, label: "Solve 25 Shadow Guess puzzles" } }),
  eyewear("none", "None", 0),
  eyewear("glasses", "Glasses", 0),
  eyewear("sunglasses", "Sunglasses", 50),
  eyewear("goggles", "Ski goggles", 0, { achievement: "snowline" }),
];

export const DEFAULT_LOADOUT = { character: "character:male-a", trail: "trail:none" };

export const climbItem = (id: string) => CLIMB_ITEMS.find((i) => i.id === id);

/** Free from the start (bought and earned items aside). */
export const isFreeItem = (item: ClimbItem) => item.price === 0 && !item.achievement && !item.shadowGuess;

/** Everything achievements are measured against, over all of a player's climbs. */
export interface ClimbMetrics {
  bestFloor: number;
  summits: number;
  /** Highest floor reached in a climb without falling once. */
  cleanFloor: number;
  /** 1 if a summit came in under five minutes. */
  fastSummit: number;
  maxRunCoins: number;
  coinsTotal: number;
  maxFalls: number;
  maxStreak: number;
}

export const EMPTY_METRICS: ClimbMetrics = {
  bestFloor: 0,
  summits: 0,
  cleanFloor: 0,
  fastSummit: 0,
  maxRunCoins: 0,
  coinsTotal: 0,
  maxFalls: 0,
  maxStreak: 0,
};

export const FAST_SUMMIT_MS = 5 * 60_000;

export interface ClimbAchievementDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
  metric: keyof ClimbMetrics;
  target: number;
}

export const CLIMB_ACHIEVEMENTS: ClimbAchievementDef[] = [
  { id: "first-steps", emoji: "👣", name: "First steps", description: "Reach floor 10", metric: "bestFloor", target: 10 },
  { id: "treetops", emoji: "🌳", name: "Above the trees", description: "Reach the Cliffs (floor 26)", metric: "bestFloor", target: 26 },
  { id: "snowline", emoji: "❄️", name: "Snowline", description: "Reach Snow Peak (floor 46)", metric: "bestFloor", target: 46 },
  { id: "storm-chaser", emoji: "⛈️", name: "Storm chaser", description: "Reach the Storm (floor 71)", metric: "bestFloor", target: 71 },
  { id: "summit", emoji: "🏁", name: "Summit", description: "Reach the top of a tower. Unlocks the gold trail", metric: "summits", target: 1 },
  { id: "clean-climb", emoji: "🧼", name: "Clean climb", description: "Reach floor 25 without a single fall", metric: "cleanFloor", target: 25 },
  { id: "speed-climber", emoji: "⚡", name: "Speed climber", description: "Reach the summit in under 5 minutes", metric: "fastSummit", target: 1 },
  { id: "treasure-hunter", emoji: "💰", name: "Treasure hunter", description: "Collect 40 coins in one climb", metric: "maxRunCoins", target: 40 },
  { id: "coin-collector", emoji: "🪙", name: "Coin collector", description: "Collect 300 coins in total", metric: "coinsTotal", target: 300 },
  { id: "never-give-up", emoji: "💪", name: "Never give up", description: "Fall 20 times in one climb and keep going", metric: "maxFalls", target: 20 },
  { id: "regular", emoji: "📅", name: "Regular", description: "Climb the daily tower 3 days in a row", metric: "maxStreak", target: 3 },
  { id: "devoted", emoji: "🔥", name: "7-day climber", description: "Climb the daily tower 7 days in a row", metric: "maxStreak", target: 7 },
];

export interface ClimbAchievement {
  id: string;
  unlocked: boolean;
  /** Toward the target, capped at it. */
  progress: number;
  target: number;
}

export function evaluateAchievements(m: ClimbMetrics): ClimbAchievement[] {
  return CLIMB_ACHIEVEMENTS.map((a) => ({
    id: a.id,
    unlocked: m[a.metric] >= a.target,
    progress: Math.min(m[a.metric], a.target),
    target: a.target,
  }));
}

/** Shadow Guess stats that unlock items. */
export interface ShadowGuessProgress {
  maxStreak: number;
  won: number;
}

/** Items a player has: free, bought, and earned (Sky Climb achievements, Shadow Guess play). */
export function ownedItems(bought: string[], achievements: ClimbAchievement[], shadowGuess?: ShadowGuessProgress): string[] {
  const earned = new Set(achievements.filter((a) => a.unlocked).map((a) => a.id));
  return CLIMB_ITEMS.filter(
    (i) =>
      isFreeItem(i) ||
      bought.includes(i.id) ||
      (i.achievement && earned.has(i.achievement)) ||
      (i.shadowGuess && shadowGuess && shadowGuess[i.shadowGuess.stat] >= i.shadowGuess.target),
  ).map((i) => i.id);
}

export interface ClimbProfileView {
  coins: { earned: number; spent: number; balance: number };
  owned: string[];
  loadout: { character: string; trail: string };
  achievements: ClimbAchievement[];
  metrics: ClimbMetrics;
  currentStreak: number;
  /** Progress toward the Shadow Guess unlocks. */
  shadowGuess: ShadowGuessProgress;
}

export const BuyItemBody = z.object({ item: z.string() });
export const LoadoutBody = z.object({ character: z.string().optional(), trail: z.string().optional() });
export const ClaimClimbsBody = z.object({ runIds: z.array(z.uuid()).max(200) });

// ---------- Ghosts: replays of climbs, raced as translucent climbers ----------

/** Frames a second in a ghost. */
export const GHOST_HZ = 10;
/** Twenty minutes; a longer climb's ghost stops there. */
export const GHOST_MAX_FRAMES = 12_000;

export const GHOST_POSES = ["idle", "walk", "sprint", "jump", "fall", "die", "cheer"] as const;
export type GhostPose = (typeof GHOST_POSES)[number];

export interface GhostFrame {
  x: number;
  y: number;
  z: number;
  /** Radians. */
  facing: number;
  pose: GhostPose;
}

const GHOST_VERSION = 1;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, bytes.length - i + 1);
    for (let k = 0; k < chars; k++) out += B64[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

function fromBase64(text: string): number[] | null {
  const bytes: number[] = [];
  let n = 0;
  let bits = 0;
  for (const c of text) {
    const v = B64.indexOf(c);
    if (v < 0) return null;
    n = ((n << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((n >> bits) & 255);
    }
  }
  return bytes;
}

/**
 * Packs frames (taken GHOST_HZ times a second) into a URL-safe string: a version byte, then
 * per frame the change in x, y, z in centimetres as zigzag varints, the facing in 1/256ths
 * of a turn, and the pose. About 6 bytes a frame.
 */
export function encodeGhost(frames: GhostFrame[]): string {
  const bytes = [GHOST_VERSION];
  const varint = (v: number) => {
    let u = v < 0 ? -2 * v - 1 : 2 * v;
    while (u >= 128) {
      bytes.push((u & 127) | 128);
      u = Math.floor(u / 128);
    }
    bytes.push(u);
  };
  let px = 0;
  let py = 0;
  let pz = 0;
  for (const f of frames.slice(0, GHOST_MAX_FRAMES)) {
    const x = Math.round(f.x * 100);
    const y = Math.round(f.y * 100);
    const z = Math.round(f.z * 100);
    varint(x - px);
    varint(y - py);
    varint(z - pz);
    px = x;
    py = y;
    pz = z;
    const turn = f.facing / (Math.PI * 2);
    bytes.push(Math.round((turn - Math.floor(turn)) * 256) & 255);
    bytes.push(Math.max(0, GHOST_POSES.indexOf(f.pose)));
  }
  return toBase64(bytes);
}

/** The frames back, or null if the string isn't a ghost. */
export function decodeGhost(text: string): GhostFrame[] | null {
  const bytes = fromBase64(text);
  if (!bytes || bytes[0] !== GHOST_VERSION) return null;
  const frames: GhostFrame[] = [];
  let i = 1;
  const varint = () => {
    let u = 0;
    let scale = 1;
    for (;;) {
      if (i >= bytes.length || scale > 2 ** 28) return null;
      const b = bytes[i++];
      u += (b & 127) * scale;
      if (b < 128) break;
      scale *= 128;
    }
    return u % 2 ? -(u + 1) / 2 : u / 2;
  };
  let x = 0;
  let y = 0;
  let z = 0;
  while (i < bytes.length) {
    if (frames.length >= GHOST_MAX_FRAMES) return null;
    const dx = varint();
    const dy = varint();
    const dz = varint();
    if (dx === null || dy === null || dz === null || i + 2 > bytes.length) return null;
    x += dx;
    y += dy;
    z += dz;
    const pose = GHOST_POSES[bytes[i + 1]];
    if (!pose) return null;
    frames.push({ x: x / 100, y: y / 100, z: z / 100, facing: (bytes[i] / 256) * Math.PI * 2, pose });
    i += 2;
  }
  return frames;
}

/** A climb to race: who climbed it, how far, and the replay. */
export interface ClimbGhostView {
  runId: string;
  name: string;
  avatar: AvatarConfig | null;
  floor: number;
  seconds: number;
  isMe: boolean;
  /** `encodeGhost` frames. */
  ghost: string;
}

/** What a challenge link opens: the climb's tower and its ghost. */
export interface ClimbChallengeView extends ClimbGhostView {
  seed: string;
  /** "daily" while it's still today's tower (the climb then counts for today); else practice. */
  mode: ClimbMode;
  /** The tower's date, for a daily climb. */
  date: string | null;
}
