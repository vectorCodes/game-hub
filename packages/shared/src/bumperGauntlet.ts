import { z } from "zod";
import { BUMPER_MAPS, type BumperTuning } from "./bumper";
import type { BotLevel } from "./bumperBots";
import { makeRng } from "./skyClimb";

// Bumper Arena's Daily Gauntlet: one arena and one twist for everyone each day, and waves of
// bots that get bigger and smarter. One life: the run ends when you go over the edge. The
// date picks the arena and the twist, so every player's run is comparable.

export const BUMPER = "bumper-arena";

/** Gauntlet #1. */
export const BUMPER_LAUNCH_DATE = "2026-10-23";

/** Gauntlet number for a UTC date (YYYY-MM-DD). */
export const bumperDailyNumber = (date: string) => Math.floor((Date.parse(date) - Date.parse(BUMPER_LAUNCH_DATE)) / 86_400_000) + 1;

export const bumperDailySeed = (date: string) => `bumper:${date}`;

// ---------- Twists ----------

export const BUMPER_MODIFIERS = {
  classic: { name: "Classic", blurb: "Just you, the bots and the edge." },
  slippery: { name: "Slippery", blurb: "Half the grip. Momentum is everything." },
  "big-rings": { name: "Big Rings", blurb: "Every ring is 30% bigger. Nowhere to hide." },
  "heavy-hitters": { name: "Heavy Hitters", blurb: "Every hit knocks 30% further." },
  "low-gravity": { name: "Low Gravity", blurb: "Knocks slide further, and falls are slow." },
  "no-brakes": { name: "No Brakes", blurb: "Nobody can brace today." },
  "pickup-party": { name: "Pickup Party", blurb: "Pickups keep coming: grab them before the bots do." },
} as const;

export type BumperModifier = keyof typeof BUMPER_MODIFIERS;
export const BUMPER_MODIFIER_IDS = Object.keys(BUMPER_MODIFIERS) as BumperModifier[];
/** Pickup Party joins the draw from this date, so earlier days keep the twist they had. */
export const PICKUP_PARTY_FROM = "2026-10-26";
const modifiersOn = (date: string) => (date >= PICKUP_PARTY_FROM ? BUMPER_MODIFIER_IDS : BUMPER_MODIFIER_IDS.filter((m) => m !== "pickup-party"));

/** `base` with a twist applied (a new object). */
export function withModifier(base: BumperTuning, modifier: BumperModifier): BumperTuning {
  const t = { ...base };
  switch (modifier) {
    case "slippery":
      t.drag *= 0.5;
      t.brakeDrag *= 0.35;
      t.accel *= 0.6;
      t.overspeedDecel *= 0.45;
      break;
    case "big-rings":
      t.radius *= 1.3;
      break;
    case "heavy-hitters":
      t.knockBase *= 1.3;
      break;
    case "low-gravity":
      t.overspeedDecel *= 0.6;
      t.gravity *= 0.35;
      break;
    case "no-brakes":
      t.braceMaxSeconds = 0;
      break;
  }
  return t;
}

// ---------- The day's run ----------

/** The arenas a Gauntlet can be on. */
export const BUMPER_GAUNTLET_MAPS = Object.keys(BUMPER_MAPS);

export interface BumperDay {
  date: string;
  number: number;
  map: string;
  modifier: BumperModifier;
}

/** What a date's Gauntlet is: its arena and twist. The first one is Classic. */
export function bumperDay(date: string): BumperDay {
  const rng = makeRng(bumperDailySeed(date));
  const map = BUMPER_GAUNTLET_MAPS[Math.floor(rng() * BUMPER_GAUNTLET_MAPS.length)];
  const number = bumperDailyNumber(date);
  const ids = modifiersOn(date);
  const modifier = number <= 1 ? "classic" : ids[Math.floor(rng() * ids.length)];
  return { date, number, map, modifier };
}

/** The bots in wave `n` (1-based): one easy bot first, a crowd of hard ones later. */
export function bumperWave(n: number): BotLevel[] {
  const early: BotLevel[][] = [
    ["easy"],
    ["easy", "easy"],
    ["easy", "normal"],
    ["normal", "normal"],
    ["easy", "normal", "normal"],
    ["normal", "normal", "hard"],
    ["normal", "hard", "hard"],
    ["normal", "normal", "hard", "hard"],
  ];
  return early[n - 1] ?? Array.from({ length: Math.min(6, n - 5) }, () => "hard");
}

/** Wobble you carry into the next wave, as a share of what you had. */
export const BUMPER_WAVE_WOBBLE_CARRY = 0.5;

/** Points for clearing waves 1..n (wave k is worth 100·k), plus 25 a knockout. */
export const bumperScore = (waves: number, kos: number) => (100 * waves * (waves + 1)) / 2 + 25 * kos;

/** The fewest seconds a wave can honestly take (countdown included). */
export const BUMPER_MIN_SECONDS_PER_WAVE = 5;

/** Waves a run can't plausibly go past. */
export const BUMPER_MAX_WAVES = 60;

// ---------- API ----------

export type BumperRunStatus = "playing" | "finished";

export const FinishBumperRunBody = z.object({
  /** Waves cleared before the player went out. */
  waves: z.int().min(0).max(BUMPER_MAX_WAVES),
  kos: z.int().min(0).max(BUMPER_MAX_WAVES * 6),
  /** Highest Wobble survived, %. */
  peakWobble: z.int().min(0).max(1000),
  /** First countdown to going out (ms), by the browser's clock. Capped by the server's. */
  timeMs: z.int().min(0).max(6 * 3_600_000),
});
export type FinishBumperRunBody = z.infer<typeof FinishBumperRunBody>;

export const ClaimBumperBody = z.object({ runIds: z.array(z.uuid()).max(200) });

export interface BumperRunView {
  runId: string;
  day: BumperDay;
  /** Today's Gauntlet was already finished, so this run won't count. */
  replay: boolean;
}

export interface BumperResultView {
  waves: number;
  kos: number;
  score: number;
  seconds: number;
  /** Whether this run is the one on the leaderboard (the day's first finish). */
  counted: boolean;
  /** Today's rank and the number of players (signed-in players only). */
  rank: number | null;
  players: number;
}

export interface BumperDailyView {
  day: BumperDay;
  /** Signed-in players who've run today's Gauntlet. */
  players: number;
  /** The most waves anyone has cleared today. */
  best: number;
  /** The signed-in player's counted run, if they've played. */
  mine: { waves: number; kos: number; score: number; rank: number } | null;
}
