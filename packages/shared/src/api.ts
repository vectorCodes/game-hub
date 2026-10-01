import { z } from "zod";
import type { LightAngle } from "./angles";

export const GameMode = z.enum(["daily", "free"]);
export type GameMode = z.infer<typeof GameMode>;

export type SessionStatus = "playing" | "won" | "lost";

export const StartSessionBody = z.object({
  mode: GameMode,
  /** Free play: avoid serving the same object twice in a row. */
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
  game: z.literal("shadow-guess").default("shadow-guess"),
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
  isMe: boolean;
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
}
