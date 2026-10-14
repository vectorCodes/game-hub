import { z } from "zod";

// Pair Pop: a 3D memory game. The board is dealt in the browser from two seeds (which pals,
// and where they land); the server hands out the seeds, replays the flips to score a game,
// and ranks the first daily finish of each player each day.

export const PAIR_POP = "pair-pop";

export const PAIR_POP_DECKS = {
  animals: ["fish", "rabbit", "cat", "dog", "cow", "elephant", "giraffe", "penguin", "pig", "crab", "chick", "parrot", "lion", "monkey", "bee", "panda", "fox", "reindeer"],
  treats: ["apple", "banana", "burger", "carrot", "pineapple", "strawberry", "donut", "ice-cream", "cupcake", "cherries", "taco", "sushi", "lollipop", "birthday-cake"],
  odd: ["alien", "astronaut", "spaceship", "teddy-bear", "race-car", "fire-truck"],
} as const;

export const PAIR_POP_PALS: string[] = Object.values(PAIR_POP_DECKS).flat();

export interface PairPopLevel {
  cols: number;
  rows: number;
  /** Seconds every tile is shown face up before play starts. */
  peek: number;
  /** Which decks the pals come from. */
  decks: (keyof typeof PAIR_POP_DECKS)[];
}

export const PAIR_POP_LEVELS: PairPopLevel[] = [
  { cols: 3, rows: 2, peek: 1.6, decks: ["animals"] },
  { cols: 4, rows: 3, peek: 1.8, decks: ["animals"] },
  { cols: 4, rows: 4, peek: 2, decks: ["animals", "treats"] },
  { cols: 5, rows: 4, peek: 2.2, decks: ["treats"] },
  { cols: 6, rows: 4, peek: 2.4, decks: ["animals", "treats"] },
  { cols: 6, rows: 5, peek: 2.6, decks: ["animals", "treats", "odd"] },
  { cols: 6, rows: 6, peek: 2.8, decks: ["animals", "treats", "odd"] },
];

/** Today's board: one size for everyone, every deck mixed. */
export const PAIR_POP_DAILY_LEVEL: PairPopLevel = { cols: 5, rows: 4, peek: 2, decks: ["animals", "treats", "odd"] };

/** Daily #1. */
export const PAIR_POP_LAUNCH_DATE = "2026-10-14";

/** Face colours, one per pair: bright candy tones that the pals pop against. */
export const PAIR_POP_COLORS = [
  "#ff7a8a", "#ffb340", "#ffd84d", "#7ddc6f", "#4fd1c5", "#55a8ff", "#8e7cff", "#e07bff",
  "#ff8fc8", "#ff9d5c", "#b6e35a", "#3ec7a0", "#6fc3ff", "#a68bff", "#ff6b6b", "#f9c74f",
  "#90be6d", "#43aa8b",
];

/** The quickest a pair of flips can honestly be made (ms); faster games are clamped up to it. */
export const PAIR_POP_MIN_MS_PER_MOVE = 350;

export const pairPopLevelOf = (mode: PairPopMode, level?: number | null): PairPopLevel =>
  mode === "daily" ? PAIR_POP_DAILY_LEVEL : PAIR_POP_LEVELS[level ?? 0];

export const pairsOf = (level: PairPopLevel) => Math.floor((level.cols * level.rows) / 2);

/** Daily #1 is launch day. Dates are UTC (YYYY-MM-DD). */
export const pairPopDailyNumber = (date: string) => Math.floor((Date.parse(date) - Date.parse(PAIR_POP_LAUNCH_DATE)) / 86_400_000) + 1;

export const pairPopDailySeed = (date: string) => `pair-pop:${date}`;

// ---------- Dealing ----------

/** Small, fast, seedable: mulberry32 over a string hash. */
export function pairPopRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface PairPopCard {
  /** The pal's model id; two tiles share it. */
  pal: string;
  color: string;
}

/** `seed` picks the pals and colours; `layoutSeed` places them on the board. */
export function dealPairPop(level: PairPopLevel, seed: string, layoutSeed: string): PairPopCard[] {
  const rand = pairPopRng(seed);
  const pool = level.decks.flatMap((d) => PAIR_POP_DECKS[d]);
  const pals = shuffle(pool, rand).slice(0, pairsOf(level));
  const colors = shuffle(PAIR_POP_COLORS, rand);
  const cards = pals.flatMap((pal, i) => {
    const card = { pal, color: colors[i % colors.length] };
    return [card, { ...card }];
  });
  return shuffle(cards, pairPopRng(layoutSeed));
}

// ---------- Scoring ----------

/** Moves (pairs turned) per pair for each star, at most. */
const STAR_MOVES = [1.5, 2.2];

export function pairPopStars(moves: number, pairs: number): number {
  if (moves <= Math.ceil(pairs * STAR_MOVES[0])) return 3;
  if (moves <= Math.ceil(pairs * STAR_MOVES[1])) return 2;
  return 1;
}

/** Points for a match in a streak of `combo` matches in a row. */
export const pairPopMatchPoints = (combo: number) => 100 * combo;

/** A quick clear earns up to 150 points a pair on top of the matches. */
export const pairPopTimeBonus = (pairs: number, seconds: number) => Math.max(0, Math.round((pairs * 6 - seconds) * 25));

export interface PairPopReplay {
  moves: number;
  matches: number;
  bestCombo: number;
  /** Match points, before the time bonus. */
  points: number;
  /** Every pair found. */
  complete: boolean;
}

/**
 * Plays a game's flips (tile indices, in the order they were turned) over its board. Flips
 * pair up in twos; a pair that matches stays. Returns null for flips that couldn't happen
 * (a tile off the board, already matched, or the same tile twice).
 */
export function replayPairPop(cards: PairPopCard[], flips: number[]): PairPopReplay | null {
  const matched = new Array<boolean>(cards.length).fill(false);
  let moves = 0, matches = 0, combo = 0, bestCombo = 0, points = 0;
  for (let i = 0; i + 1 < flips.length; i += 2) {
    const a = flips[i], b = flips[i + 1];
    if (a === b || !cards[a] || !cards[b] || matched[a] || matched[b]) return null;
    moves++;
    if (cards[a].pal === cards[b].pal) {
      matched[a] = matched[b] = true;
      matches++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      points += pairPopMatchPoints(combo);
    } else {
      combo = 0;
    }
  }
  if (flips.length % 2 && (!cards[flips[flips.length - 1]] || matched[flips[flips.length - 1]])) return null;
  return { moves, matches, bestCombo, points, complete: matches === cards.length / 2 };
}

/** The final score of a finished game. */
export function pairPopResult(replay: PairPopReplay, pairs: number, timeMs: number) {
  const seconds = timeMs / 1000;
  return {
    moves: replay.moves,
    bestCombo: replay.bestCombo,
    seconds,
    score: replay.points + pairPopTimeBonus(pairs, seconds),
    stars: pairPopStars(replay.moves, pairs),
  };
}

// ---------- API ----------

export const PairPopMode = z.enum(["daily", "level"]);
export type PairPopMode = z.infer<typeof PairPopMode>;

export type PairPopStatus = "playing" | "finished";

export const StartPairPopBody = z.object({
  mode: PairPopMode,
  /** Level mode: which level (0-based). */
  level: z.int().min(0).max(PAIR_POP_LEVELS.length - 1).optional(),
});
export type StartPairPopBody = z.infer<typeof StartPairPopBody>;

export const FinishPairPopBody = z.object({
  /** Tile indices in the order they were turned. */
  flips: z.array(z.int().min(0).max(63)).max(4000),
  /** First flip to last match, by the browser's clock (ms). Capped by the server's. */
  timeMs: z.int().min(0).max(24 * 3_600_000),
});
export type FinishPairPopBody = z.infer<typeof FinishPairPopBody>;

export const ClaimPairPopBody = z.object({ gameIds: z.array(z.uuid()).max(200) });

export interface PairPopGameView {
  gameId: string;
  mode: PairPopMode;
  level: number | null;
  /** Picks the pals: the date for the daily, random for a level. */
  seed: string;
  /** Places them: random every game. */
  layoutSeed: string;
  /** Daily only: the UTC date of the board. */
  date: string | null;
  /** Daily only: today's daily was already finished, so this game won't count. */
  replay: boolean;
}

export interface PairPopResultView {
  moves: number;
  seconds: number;
  score: number;
  stars: number;
  bestCombo: number;
  /** Daily only: whether this game is the one on the leaderboard (the first finish). */
  counted: boolean;
  /** Daily only: today's rank and the number of players (signed-in players only). */
  rank: number | null;
  players: number;
}

export interface PairPopDailyView {
  date: string;
  number: number;
  /** Signed-in players who've finished today's board. */
  players: number;
  /** The signed-in player's counted daily result, if they've played. */
  mine: { moves: number; seconds: number; score: number; stars: number; rank: number } | null;
}

/** A signed-in player's progress: best stars on each level (index), 0 for not cleared. */
export interface PairPopProgressView {
  stars: number[];
}
