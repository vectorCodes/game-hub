import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AvatarConfig, BumperModifier, BumperRunStatus, ClimbMode, ClimbStatus, GameMode, LightAngle, PairPopMode, PairPopStatus, SessionStatus } from "@shadow/shared";

// Every table has RLS enabled and no policies: the public Supabase REST API can't read
// anything (answers included). The API connects as a privileged role and bypasses RLS.

/**
 * One row per Supabase auth user, upserted by the API from the token's claims (no FK or
 * trigger on auth.users, so the same schema runs on embedded PGlite).
 */
export const profiles = pgTable("profiles", {
  id: uuid().primaryKey(),
  username: text().unique(),
  /** From the Google account (user_metadata.full_name), refreshed on sign-in. */
  displayName: text(),
  avatarUrl: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const gameObjects = pgTable("game_objects", {
  id: text().primaryKey(),
  name: text().notNull(),
  aliases: text().array().notNull().default(sql`'{}'::text[]`),
  category: text().notNull(),
  difficulty: integer().notNull().default(2),
  modelKey: text().notNull().unique(),
  /** Null → DEFAULT_ANGLES. */
  angles: jsonb().$type<LightAngle[]>(),
  active: boolean().notNull().default(true),
}).enableRLS();

export const dailyPuzzles = pgTable(
  "daily_puzzles",
  {
    gameType: text().notNull(),
    date: date().notNull(),
    number: integer().notNull(),
    objectId: text()
      .notNull()
      .references(() => gameObjects.id),
  },
  (t) => [primaryKey({ columns: [t.gameType, t.date] })],
).enableRLS();

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid(),
    gameType: text().notNull(),
    mode: text().$type<GameMode>().notNull(),
    puzzleDate: date(),
    objectId: text()
      .notNull()
      .references(() => gameObjects.id),
    step: integer().notNull().default(0),
    status: text().$type<SessionStatus>().notNull().default("playing"),
    score: integer(),
    hintUsed: boolean().notNull().default(false),
    /** Free play: rounds in a row share a run, which goes on while each one is solved. */
    runId: uuid(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.userId, t.gameType), index().on(t.runId)],
).enableRLS();

export const guesses = pgTable(
  "guesses",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid()
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    text: text().notNull(),
    correct: boolean().notNull(),
    step: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.sessionId)],
).enableRLS();

export const userStats = pgTable(
  "user_stats",
  {
    userId: uuid().notNull(),
    gameType: text().notNull(),
    played: integer().notNull().default(0),
    won: integer().notNull().default(0),
    currentStreak: integer().notNull().default(0),
    maxStreak: integer().notNull().default(0),
    /** Date of the last finished daily puzzle; the streak continues only from yesterday. */
    lastDailyDate: date(),
    /** Wins by number of angles used: distribution[i] = wins on angle i + 1. */
    distribution: jsonb().$type<number[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameType] })],
).enableRLS();

/**
 * Sky Climb runs. The tower itself is generated in the browser from `seed`; a run records
 * how high the player got. Progress arrives checkpoint by checkpoint and is checked against
 * the server's clock, so `time_ms` can't be faked shorter than the climb really took.
 */
export const climbRuns = pgTable(
  "climb_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid(),
    mode: text().$type<ClimbMode>().notNull(),
    seed: text().notNull(),
    /** Daily only: the UTC date of the tower. */
    puzzleDate: date(),
    bestFloor: integer().notNull().default(0),
    /** Milliseconds from the start of the run to reaching bestFloor. */
    timeMs: integer().notNull().default(0),
    coins: integer().notNull().default(0),
    falls: integer().notNull().default(0),
    /** Highest floor reached before the first fall (for the "clean climb" achievement). */
    cleanFloor: integer().notNull().default(0),
    status: text().$type<ClimbStatus>().notNull().default("climbing"),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.puzzleDate, t.mode), index().on(t.userId)],
).enableRLS();

/** Sky Climb cosmetics bought with coins. Free and achievement items aren't stored. */
export const climbUnlocks = pgTable(
  "climb_unlocks",
  {
    userId: uuid().notNull(),
    itemId: text().notNull(),
    cost: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
).enableRLS();

/** What each signed-in climber wears. */
export const climbLoadouts = pgTable("climb_loadouts", {
  userId: uuid().primaryKey(),
  character: text().notNull(),
  trail: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Each player's GameHub avatar, worn in every game. Validated against what they own. */
export const avatars = pgTable("avatars", {
  userId: uuid().primaryKey(),
  config: jsonb().$type<AvatarConfig>().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/**
 * A finished climb's replay (`encodeGhost`), raced by others as a translucent climber: the
 * player's own best, today's leaders, and challenge links.
 */
export const climbGhosts = pgTable("climb_ghosts", {
  runId: uuid()
    .primaryKey()
    .references(() => climbRuns.id, { onDelete: "cascade" }),
  frames: integer().notNull(),
  data: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/**
 * Pair Pop games. The board is dealt from `seed` and `layoutSeed`; a finished game's flips
 * are replayed against it to score it, and its time is capped by the server's clock.
 */
export const pairPopGames = pgTable(
  "pair_pop_games",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid(),
    mode: text().$type<PairPopMode>().notNull(),
    /** Level mode: which level (0-based). */
    level: integer(),
    /** Daily only: the UTC date of the board. */
    puzzleDate: date(),
    seed: text().notNull(),
    layoutSeed: text().notNull(),
    moves: integer().notNull().default(0),
    bestCombo: integer().notNull().default(0),
    score: integer().notNull().default(0),
    stars: integer().notNull().default(0),
    /** First flip to last match (ms). */
    timeMs: integer().notNull().default(0),
    status: text().$type<PairPopStatus>().notNull().default("playing"),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.puzzleDate, t.mode), index().on(t.userId)],
).enableRLS();

/**
 * Bumper Arena Daily Gauntlet runs. The date picks the arena and twist; the run reports how
 * many waves it cleared, checked against the server's clock (a wave can't take under a few
 * seconds). Each player's first finished run of a day is the one that counts.
 */
export const bumperRuns = pgTable(
  "bumper_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid(),
    runDate: date().notNull(),
    map: text().notNull(),
    modifier: text().$type<BumperModifier>().notNull(),
    waves: integer().notNull().default(0),
    kos: integer().notNull().default(0),
    peakWobble: integer().notNull().default(0),
    score: integer().notNull().default(0),
    /** First countdown to going out (ms). */
    timeMs: integer().notNull().default(0),
    status: text().$type<BumperRunStatus>().notNull().default("playing"),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.runDate), index().on(t.userId)],
).enableRLS();

/** Each signed-in player's Bumper Arena party record: XP (levels follow from it) and the coins it has paid. */
export const bumperProgress = pgTable("bumper_progress", {
  userId: uuid().primaryKey(),
  xp: integer().notNull().default(0),
  matches: integer().notNull().default(0),
  wins: integer().notNull().default(0),
  roundsWon: integer().notNull().default(0),
  kos: integer().notNull().default(0),
  /** Coins earned in party matches; spent from the hub balance with Sky Climb's. */
  coins: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Every party match a player was credited for, as the room reported it: a retried report counts once. */
export const bumperResults = pgTable(
  "bumper_results",
  {
    matchId: text().notNull(),
    userId: uuid().notNull(),
    place: integer().notNull(),
    score: integer().notNull(),
    xp: integer().notNull(),
    coins: integer().notNull(),
    /** Their XP before this match. */
    xpBefore: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId] })],
).enableRLS();

/** Each signed-in player's Prop Hunt XP (levels follow from it) and the taunts they've picked. */
export const huntProgress = pgTable("hunt_progress", {
  userId: uuid().primaryKey(),
  xp: integer().notNull().default(0),
  matches: integer().notNull().default(0),
  wins: integer().notNull().default(0),
  /** Picked taunt ids (null: the starter set). */
  taunts: jsonb().$type<string[]>(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Every match a player was credited for, as the room reported it: a retried report counts once. */
export const huntResults = pgTable(
  "hunt_results",
  {
    matchId: text().notNull(),
    userId: uuid().notNull(),
    score: integer().notNull(),
    place: integer().notNull(),
    xp: integer().notNull(),
    /** Their XP before this match. */
    xpBefore: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId] })],
).enableRLS();
