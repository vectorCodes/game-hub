import { z } from "zod";
import { levelForXp, xpForLevel } from "./propHuntLevels";

// Bumper Arena progress: signed-in players earn XP and coins from every party match. Only the
// room reports a match (apps/realtime, BumperRoom, with the secret it shares with the API), so
// nobody can award themselves any. Levels use the same curve as Prop Hunt's; coins join the
// hub's balance that buys avatar items. See Bumper-arena-plan.md §12.

/** XP for finishing a match, and for the podium. */
export const BUMPER_XP = { finish: 50, places: [100, 50, 25] } as const;
/** Coins for each round won, each knockout, and finishing. */
export const BUMPER_COINS = { roundWin: 10, ko: 3, finish: 5 } as const;

/** Header carrying the room's secret on its results report. */
export const BUMPER_RESULTS_SECRET_HEADER = "x-bumper-secret";

/** A match's XP: its points, plus finishing, plus a podium place. Leaving early earns nothing. */
export function bumperMatchXp(score: number, place: number, dnf: boolean): number {
  if (dnf) return 0;
  return Math.max(0, Math.round(score)) + BUMPER_XP.finish + (BUMPER_XP.places[place - 1] ?? 0);
}

/** A match's coins: rounds won and knockouts, plus finishing. Leaving early earns nothing. */
export function bumperMatchCoins(roundWins: number, kos: number, dnf: boolean): number {
  if (dnf) return 0;
  return roundWins * BUMPER_COINS.roundWin + kos * BUMPER_COINS.ko + BUMPER_COINS.finish;
}

/** What the room reports when a match ends: its signed-in players only. */
export const BumperResultsBody = z.object({
  matchId: z.string().min(1).max(64),
  players: z
    .array(
      z.object({
        userId: z.uuid(),
        place: z.int().min(1).max(8),
        score: z.int().min(0).max(10_000),
        roundWins: z.int().min(0).max(20),
        kos: z.int().min(0).max(200),
        dnf: z.boolean(),
      }),
    )
    .max(8),
});
export type BumperResultsBody = z.infer<typeof BumperResultsBody>;

/** One player's take from a match, as the API answers the room (and the room tells the player). */
export interface BumperXpGain {
  userId: string;
  gained: number;
  coins: number;
  xp: number;
  levelBefore: number;
  level: number;
  /** XP where this level started, and where the next one starts. */
  levelXp: number;
  nextLevelXp: number;
}

/** A signed-in player's Bumper Arena progress, as the API returns it. */
export interface BumperProgress {
  xp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  matches: number;
  wins: number;
  roundsWon: number;
  kos: number;
  /** Coins earned in party matches (they're spent from the hub's one balance). */
  coins: number;
}

export function bumperProgress(row: { xp: number; matches: number; wins: number; roundsWon: number; kos: number; coins: number }): BumperProgress {
  const level = levelForXp(row.xp);
  return { ...row, level, levelXp: xpForLevel(level), nextLevelXp: xpForLevel(level + 1) };
}
