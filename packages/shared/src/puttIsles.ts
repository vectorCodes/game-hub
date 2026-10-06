import { z } from "zod";
import type { AvatarConfig } from "./avatar";
import { makeRng } from "./skyClimb";

// Putt Isles: daily mini-golf on floating islands. The course is generated from the seed
// (in the browser to play it, on the server to score it); each hole is scored in strokes
// against its par.

/** Most strokes on a hole: still not in after this many, it's picked up and scores this. */
export const PUTT_MAX_STROKES = 7;
export const PUTT_HOLES_PER_ROUND = 9;
/** The quickest a stroke can honestly be played (aim, putt, roll), in seconds. */
export const PUTT_MIN_SECONDS_PER_STROKE = 0.8;

// ---------- Holes ----------

/**
 * A hand-made hole, drawn from above: columns run along +x, rows along +z, the first row is
 * the far end. Any non-space cell is green; walls go where it has no neighbour. `T` is the
 * tee, `C` the cup (a dead end, or out in the open).
 *
 * On a straight run (walls both sides):  H hill · S square hill · B bump · D dip · X crest
 *   O centre wall · N/Q narrows · G gap (falls through) · K castle · U tunnel · R speed ramp
 * Out in the open (neighbours all round):  o diamond block · b bump · d dip
 */
export interface PuttHoleTemplate {
  id: string;
  name: string;
  par: number;
  /** 1 (gentle) to 5 (brutal): the course fits holes to their slot. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  map: string[];
}

export const PUTT_HOLES: PuttHoleTemplate[] = [
  // ---- 1: gentle ----
  { id: "first-bend", name: "First Bend", par: 3, difficulty: 1, map: ["   C", "   #", "####", "#   ", "T   "] },
  { id: "straight-start", name: "Straight Start", par: 2, difficulty: 1, map: ["C", "#", "B", "#", "T"] },
  { id: "dogleg", name: "Dogleg", par: 3, difficulty: 1, map: ["C###", "   #", "   #", "   T"] },
  { id: "little-green", name: "Little Green", par: 2, difficulty: 1, map: ["###", "#C#", "###", " # ", " T "] },
  { id: "tee-time", name: "Tee Time", par: 2, difficulty: 1, map: ["###", "#C#", "###", " # ", " # ", " T "] },
  // ---- 2 ----
  { id: "hill-hop", name: "Hill Hop", par: 2, difficulty: 2, map: ["C", "#", "H", "#", "#", "T"] },
  { id: "zigzag", name: "Zigzag", par: 4, difficulty: 2, map: ["T##  ", "  #  ", "  ###", "    #", "  C##"] },
  { id: "twin-lanes", name: "Twin Lanes", par: 2, difficulty: 2, map: ["C", "#", "O", "O", "#", "T"] },
  { id: "diamond-green", name: "Diamond Green", par: 3, difficulty: 2, map: ["#####", "##C##", "#####", "#o#o#", "#####", "  #  ", "  H  ", "  #  ", "  T  "] },
  { id: "corner-pocket", name: "Corner Pocket", par: 3, difficulty: 2, map: ["####C", "#    ", "#    ", "T    "] },
  // ---- 3 ----
  { id: "castle-gate", name: "Castle Gate", par: 4, difficulty: 3, map: ["  C", "  #", "  K", "  #", "###", "#  ", "#  ", "T  "] },
  { id: "gap-jump", name: "Mind the Gap", par: 3, difficulty: 3, map: ["C", "#", "G", "#", "G", "#", "T"] },
  { id: "crest-run", name: "Crest Run", par: 4, difficulty: 3, map: ["   C", "   #", "####", "X   ", "#   ", "D   ", "#   ", "T   "] },
  { id: "wide-bowl", name: "Wide Bowl", par: 2, difficulty: 3, map: ["#####", "#b#d#", "##C##", "#d#b#", "#####", "  #  ", "  T  "] },
  { id: "narrows", name: "The Narrows", par: 4, difficulty: 3, map: ["C  ", "#  ", "N  ", "Q  ", "N  ", "###", "  #", "  T"] },
  // ---- 4 ----
  { id: "switchback", name: "Switchback", par: 5, difficulty: 4, map: ["C###", "   #", "####", "#   ", "#B##", "   #", "   T"] },
  { id: "gauntlet", name: "The Gauntlet", par: 3, difficulty: 4, map: ["C", "#", "G", "O", "#", "H", "G", "#", "T"] },
  { id: "island-green", name: "Island Green", par: 3, difficulty: 4, map: ["###", "#C#", "###", " G ", " # ", " G ", " # ", " T "] },
  { id: "long-bend", name: "Long Bend", par: 3, difficulty: 4, map: ["   C ", "   # ", "#####", "#####", "##   ", "##   ", "##   ", "T#   "] },
  // ---- 5: brutal ----
  { id: "hilltop", name: "Hilltop", par: 3, difficulty: 5, map: ["C", "#", "S", "H", "S", "#", "T"] },
  { id: "storm-spiral", name: "Storm Spiral", par: 5, difficulty: 5, map: ["#####", "#   #", "# C #", "# # #", "# X #", "# ###", "#    ", "T    "] },
  { id: "final-gate", name: "Final Gate", par: 4, difficulty: 5, map: ["C", "#", "K", "G", "#", "O", "G", "#", "N", "T"] },
];

/** Difficulty of each hole of a round: easy at the start, hardest last. */
const SLOT_DIFFICULTY = [1, 1, 2, 2, 3, 3, 4, 4, 5] as const;

export interface PuttIsland {
  id: "meadow" | "grove" | "dunes" | "glacier" | "storm";
  name: string;
  emoji: string;
}

/** The island each hole of a round sits on. */
export const PUTT_ISLANDS: PuttIsland[] = [
  { id: "meadow", name: "Meadow", emoji: "🌱" },
  { id: "grove", name: "Grove", emoji: "🌳" },
  { id: "dunes", name: "Dunes", emoji: "🏜️" },
  { id: "glacier", name: "Glacier", emoji: "❄️" },
  { id: "storm", name: "Storm", emoji: "⛈️" },
];

export const puttIslandOf = (holeIndex: number): PuttIsland => PUTT_ISLANDS[Math.min(PUTT_ISLANDS.length - 1, Math.floor(holeIndex / 2))];

/** A hole as played: its template, turned and mirrored by the seed. */
export interface PuttCourseHole extends PuttHoleTemplate {
  /** The template it came from. */
  template: string;
  island: PuttIsland;
}

/** Turns a map: `mirror` flips left-right, `flip` far-near, `swap` exchanges rows and columns. */
function orient(map: string[], mirror: boolean, flip: boolean, swap: boolean): string[] {
  const width = Math.max(...map.map((r) => r.length));
  let grid = map.map((r) => r.padEnd(width, " ").split(""));
  if (swap) grid = grid[0].map((_, c) => grid.map((row) => row[c]));
  if (mirror) grid = grid.map((row) => [...row].reverse());
  if (flip) grid = [...grid].reverse();
  return grid.map((row) => row.join("").replace(/\s+$/, ""));
}

/** The holes of the round on `seed`: one per slot, fitted to its difficulty, no repeats. */
export function generatePuttCourse(seed: string): PuttCourseHole[] {
  const rng = makeRng(`putt:${seed}`);
  const used = new Set<string>();
  return SLOT_DIFFICULTY.map((difficulty, i) => {
    // The nearest difficulty with a template left, preferring easier on a tie.
    let pool: PuttHoleTemplate[] = [];
    for (let d = 0; pool.length === 0 && d < 5; d++) {
      pool = PUTT_HOLES.filter((h) => !used.has(h.id) && (h.difficulty === difficulty - d || h.difficulty === difficulty + d));
    }
    const t = pool[Math.floor(rng() * pool.length)];
    used.add(t.id);
    const k = Math.floor(rng() * 8);
    return {
      ...t,
      id: `${t.id}~${k}`,
      template: t.id,
      map: orient(t.map, (k & 1) === 1, (k & 2) === 2, (k & 4) === 4),
      island: puttIslandOf(i),
    };
  });
}

export const puttDailySeed = (date: string) => `putt-daily-${date}`;
/** Course #1 was the first day. */
const PUTT_LAUNCH_DATE = Date.UTC(2026, 9, 6);
export const puttCourseNumber = (date: string) => Math.round((Date.parse(date) - PUTT_LAUNCH_DATE) / 86_400_000) + 1;
export const puttPracticeSeed = (id: string) => `putt-${id}`;

// ---------- Scoring ----------

/** What a score on one hole is called: "Hole in one!", "Birdie", "Bogey"… */
export function puttScoreName(strokes: number, par: number): string {
  if (strokes === 1) return "Hole in one!";
  const d = strokes - par;
  if (d <= -3) return "Albatross";
  if (d === -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  if (d === 2) return "Double bogey";
  if (d === 3) return "Triple bogey";
  return `${d} over par`;
}

/** One emoji per hole for the share card. */
export function puttScoreEmoji(strokes: number, par: number): string {
  if (strokes === 1) return "⭐";
  const d = strokes - par;
  if (d <= -2) return "🦅";
  if (d === -1) return "🐦";
  if (d === 0) return "⚪";
  if (d === 1) return "🟧";
  return "🟥";
}

/** "−2", "Even", "+3": a total against par. */
export function formatToPar(d: number): string {
  if (d === 0) return "Even";
  return d < 0 ? `−${-d}` : `+${d}`;
}

/** Stableford points for a hole: 2 for par, one more per stroke under, one fewer per over (never below 0). */
export const puttPoints = (strokes: number, par: number) => Math.max(0, 2 + par - strokes);

export interface PuttTotals {
  strokes: number;
  par: number;
  toPar: number;
  points: number;
  aces: number;
}

/** Totals for the holes played so far. */
export function puttTotals(strokes: number[], pars: number[]): PuttTotals {
  let total = 0;
  let par = 0;
  let points = 0;
  let aces = 0;
  strokes.forEach((s, i) => {
    total += s;
    par += pars[i];
    points += puttPoints(s, pars[i]);
    if (s === 1) aces++;
  });
  return { strokes: total, par, toPar: total - par, points, aces };
}

/** The text to share a round: "Putt Isles #12 ⛳ −2" and an emoji per hole. */
export function puttShareText(opts: { number: number | null; strokes: number[]; pars: number[]; url: string }): string {
  const t = puttTotals(opts.strokes, opts.pars);
  const title = opts.number ? `Putt Isles #${opts.number}` : "Putt Isles";
  const row = opts.strokes.map((s, i) => puttScoreEmoji(s, opts.pars[i])).join("");
  return `${title} ⛳ ${formatToPar(t.toPar)} (${t.strokes})\n${row}\n${opts.url}`;
}

// ---------- API ----------

export const PuttMode = z.enum(["daily", "practice"]);
export type PuttMode = z.infer<typeof PuttMode>;

export const StartPuttBody = z.object({
  mode: PuttMode,
  /** A daily round this browser already started (a guest's), to pick up where it left off. */
  resume: z.uuid().optional(),
});

export const PuttHoleBody = z.object({
  hole: z.int().min(0).max(PUTT_HOLES_PER_ROUND - 1),
  strokes: z.int().min(1).max(PUTT_MAX_STROKES),
});

export const ClaimPuttBody = z.object({ roundIds: z.array(z.uuid()).max(200) });

export type PuttStatus = "playing" | "finished";

export interface PuttRoundView {
  roundId: string;
  mode: PuttMode;
  seed: string;
  /** Daily only: the UTC date of the course. */
  date: string | null;
  /** Strokes on each hole played so far. */
  strokes: number[];
  status: PuttStatus;
}

export interface PuttLeaderboardEntry {
  rank: number;
  name: string;
  avatarUrl: string | null;
  avatar: AvatarConfig | null;
  points: number;
  toPar: number;
  seconds: number;
  isMe: boolean;
}

export interface PuttDailyView {
  date: string;
  /** Course #1 is launch day. */
  number: number;
  /** Signed-in players who finished today's course. */
  players: number;
  /** My daily round today (finished or not), so the page can resume or show it. */
  myRound: PuttRoundView | null;
  top: PuttLeaderboardEntry[];
  me: PuttLeaderboardEntry | null;
  /** When tomorrow's course opens (ISO). */
  nextAt: string;
}
