import { z } from "zod";
import type { LightAngle } from "./angles";
import type { AvatarConfig } from "./avatar";

export const GameMode = z.enum(["daily", "free"]);
export type GameMode = z.infer<typeof GameMode>;

export type SessionStatus = "playing" | "won" | "lost";

export const StartSessionBody = z.object({
  mode: GameMode,
  /**
   * Free play: the round just finished. A solved one continues its run (and its objects
   * aren't served again); otherwise a new run starts.
   */
  previousSessionId: z.uuid().optional(),
});
export type StartSessionBody = z.infer<typeof StartSessionBody>;

export const GuessBody = z.object({ text: z.string().trim().min(1).max(80) });
export type GuessBody = z.infer<typeof GuessBody>;

export const SessionParams = z.object({ id: z.uuid() });

/** What the client may know about a session. The answer only appears once it's over. */
export interface SessionView {
  sessionId: string;
  mode: GameMode;
  puzzleNumber: number | null;
  modelUrl: string;
  step: number;
  maxSteps: number;
  /** Current light angle. */
  angle: LightAngle;
  /** Every angle revealed so far (steps 0..step), for the shadow history. */
  angles: LightAngle[];
  status: SessionStatus;
  /** Wrong guesses in order; a skip is an empty string. */
  wrongGuesses: string[];
  hintUsed: boolean;
  category: string | null;
  potentialScore: number;
  score: number | null;
  answer: string | null;
  /** Free play only: the run this round belongs to. */
  run: RunView | null;
  /** Daily only: the themed week this puzzle belongs to. */
  theme: ThemeView | null;
}

/** A themed stretch of dailies ("Space Week"): every puzzle in it fits the theme. */
export interface ThemeView {
  id: string;
  name: string;
  emoji: string;
  /** Inclusive UTC dates. */
  start: string;
  end: string;
}

/** Free play rounds solved in a row. A failed round ends the run. */
export interface RunView {
  id: string;
  /** Rounds solved in this run so far (including this one, once won). */
  solved: number;
  /** Sum of the run's round scores. */
  score: number;
  /** Most rounds solved in any earlier run; null for guests, who keep it in the browser. */
  best: number | null;
}

export type GuessResult = "correct" | "wrong" | "duplicate" | "over";

export interface GuessResponse {
  result: GuessResult;
  /** A wrong guess that was near the answer (shares a word, or almost spelled right). */
  close?: boolean;
  session: SessionView;
}

/** Dev-only angle picker. */
export interface DevCatalogEntry {
  id: string;
  name: string;
  category: string;
  modelUrl: string;
  angles: LightAngle[];
  customAngles: boolean;
}

export const LightAngleSchema = z.object({
  azimuth: z.number().min(-360).max(360),
  elevation: z.number().min(-90).max(90),
});

export const DevAnglesBody = z.object({
  angles: z.array(LightAngleSchema).length(6).nullable(),
});

export interface StatsView {
  played: number;
  won: number;
  /** Consecutive daily puzzles won, up to today or yesterday; 0 once a day is missed. */
  currentStreak: number;
  maxStreak: number;
  /** Wins by angle: distribution[i] = wins on angle i + 1. */
  distribution: number[];
}

export interface MeView {
  profile: { id: string; displayName: string | null; avatarUrl: string | null };
  stats: StatsView;
}

/** Guest sessions (ids from this browser) to move into the signed-in account. */
export const ClaimBody = z.object({ sessionIds: z.array(z.uuid()).max(20) });

export const LeaderboardPeriod = z.enum(["daily", "weekly", "all"]);
export type LeaderboardPeriod = z.infer<typeof LeaderboardPeriod>;

export const LeaderboardQuery = z.object({
  game: z.enum(["shadow-guess", "sky-climb", "putt-isles"]).default("shadow-guess"),
  period: LeaderboardPeriod.default("daily"),
});

export interface LeaderboardEntry {
  rank: number;
  /** Shortened for privacy: "Ada L." */
  name: string;
  avatarUrl: string | null;
  score: number;
  wins: number;
  played: number;
  /** Total time spent on won puzzles; the tie-breaker (lower is better). */
  seconds: number;
  /** Putt Isles: strokes against par over the rounds counted. */
  toPar?: number;
  isMe: boolean;
  /** The player's GameHub avatar, if they've made one. */
  avatar: AvatarConfig | null;
}

export interface LeaderboardView {
  period: LeaderboardPeriod;
  /** Inclusive UTC date range of daily puzzles counted. */
  from: string;
  to: string;
  totalPlayers: number;
  entries: LeaderboardEntry[];
  /** The signed-in player's row, even when outside the top entries. */
  me: LeaderboardEntry | null;
}

export type DailyStatus = "new" | "playing" | "won" | "lost";

export interface DailyInfo {
  puzzleNumber: number;
  date: string;
  status: DailyStatus;
  score: number | null;
  step: number | null;
  /** When the next daily puzzle unlocks (midnight UTC). */
  nextAt: string;
  theme: ThemeView | null;
}

/** Album: guest wins from this browser, merged with the signed-in player's own. */
export const AlbumBody = z.object({ sessionIds: z.array(z.uuid()).max(500).default([]) });

export interface AlbumEntry {
  id: string;
  name: string;
  modelUrl: string;
  /** Times this object was solved. */
  solves: number;
  /** Fewest angles it took (1-based). */
  bestAngle: number;
  firstSolvedAt: string;
}

export interface AlbumCategory {
  name: string;
  /** Objects in the category, found or not. */
  total: number;
  /** Only the solved ones: the rest stay secret. */
  found: AlbumEntry[];
}

export interface AlbumView {
  total: number;
  found: number;
  categories: AlbumCategory[];
}

/** A display name shortened for privacy: "Ada Lovelace" → "Ada L." */
export function shortName(displayName: string | null | undefined): string {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return "Anonymous";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
