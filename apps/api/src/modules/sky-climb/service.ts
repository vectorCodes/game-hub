import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  CLIMB_FLOORS,
  CLIMB_MIN_SECONDS_PER_FLOOR,
  DEFAULT_LOADOUT,
  FAST_SUMMIT_MS,
  TWISTED_FLOOR,
  climbItem,
  decodeGhost,
  evaluateAchievements,
  ownedItems,
  practiceSeed,
  twistOf,
  type AvatarConfig,
  type ClimbChallengeView,
  type ClimbDailyView,
  type ClimbFinishBody,
  type ClimbGhostView,
  type ClimbLeaderboardEntry,
  type ClimbMetrics,
  type ClimbMode,
  type ClimbProfileView,
  type ClimbRunView,
  type LeaderboardPeriod,
  type LeaderboardView,
} from "@shadow/shared";
import type { Db, Executor } from "../../db/client";
import { queryRows } from "../../db/rows";
import { climbGhosts, climbLoadouts, climbRuns, climbUnlocks, userStats } from "../../db/schema";
import { shortName } from "../leaderboard/service";
import { NotFoundError } from "../shadow-guess/service";
import { getStats } from "../stats/service";

export const SKY_CLIMB = "sky-climb";
/** Tower #1. */
const LAUNCH_DATE = Date.UTC(2026, 9, 5);
const TOP = 20;
const BOARD_TOP = 50;

type RunRow = typeof climbRuns.$inferSelect;

export class TooFastError extends Error {}

/** A request that can't be honoured (not enough coins, item not owned…): 422 with a code. */
function refuse(code: string): Error {
  return Object.assign(new Error(code), { statusCode: 422 });
}

function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

const todayUtc = () => isoDay();

function dayBefore(date: string): string {
  return new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);
}

function towerNumber(date: string): number {
  return Math.round((Date.parse(date) - LAUNCH_DATE) / 86_400_000) + 1;
}

function view(run: RunRow): ClimbRunView {
  return {
    runId: run.id,
    mode: run.mode,
    seed: run.seed,
    date: run.puzzleDate,
    bestFloor: run.bestFloor,
    status: run.status,
  };
}

/** Postgres dates come back as strings or Dates depending on the driver. */
function dateString(d: string | Date | null): string | null {
  if (d === null) return null;
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

function ghostView(r: GhostRow, userId: string | null): ClimbGhostView {
  return {
    runId: r.id,
    name: shortName(r.display_name),
    avatar: r.avatar,
    floor: r.best_floor,
    seconds: Math.round(r.time_ms / 100) / 10,
    isMe: r.user_id !== null && r.user_id === userId,
    ghost: r.data,
  };
}

/**
 * Sky Climb's row in user_stats: `played` counts finished climbs, `won` summits, and the
 * streak counts consecutive days on which the daily tower was climbed (at least one floor).
 */
async function statsRow(tx: Executor, userId: string) {
  const [row] = await tx
    .select()
    .from(userStats)
    .where(and(eq(userStats.userId, userId), eq(userStats.gameType, SKY_CLIMB)))
    .for("update");
  return row;
}

async function saveStats(tx: Executor, userId: string, values: Partial<typeof userStats.$inferInsert>) {
  await tx
    .insert(userStats)
    .values({ userId, gameType: SKY_CLIMB, ...values })
    .onConflictDoUpdate({ target: [userStats.userId, userStats.gameType], set: values });
}

async function recordClimbDay(tx: Executor, userId: string, date: string) {
  const row = await statsRow(tx, userId);
  if (row?.lastDailyDate && date <= row.lastDailyDate) return;
  const continues = row?.lastDailyDate === dayBefore(date) && (row?.currentStreak ?? 0) > 0;
  const currentStreak = continues ? row!.currentStreak + 1 : 1;
  await saveStats(tx, userId, {
    currentStreak,
    maxStreak: Math.max(row?.maxStreak ?? 0, currentStreak),
    lastDailyDate: date,
  });
}

async function recordClimbFinish(tx: Executor, userId: string, summit: boolean) {
  const row = await statsRow(tx, userId);
  await saveStats(tx, userId, { played: (row?.played ?? 0) + 1, won: (row?.won ?? 0) + (summit ? 1 : 0) });
}

interface BoardRow {
  user_id: string;
  rank: number;
  floor: number;
  time_ms: number;
  total: number;
  display_name: string | null;
  avatar_url: string | null;
  avatar: AvatarConfig | null;
}

interface TotalsRow {
  user_id: string;
  rank: number;
  score: number;
  wins: number;
  played: number;
  seconds: number;
  total: number;
  display_name: string | null;
  avatar_url: string | null;
  avatar: AvatarConfig | null;
}

interface GhostRow {
  id: string;
  user_id: string | null;
  mode: ClimbMode;
  seed: string;
  puzzle_date: string | Date | null;
  best_floor: number;
  time_ms: number;
  data: string;
  display_name: string | null;
  avatar: AvatarConfig | null;
}

/** Rivals raced besides the player's own best. */
const GHOST_RIVALS = 3;

interface MetricsRow {
  best_floor: number;
  summits: number;
  clean_floor: number;
  fast: number;
  max_run_coins: number;
  coins_total: number;
  max_falls: number;
}

export class SkyClimbService {
  constructor(private db: Db) {}

  /**
   * Starts a run: today's tower for the daily (as many attempts as you like), or a random one.
   * A challenge climbs the challenger's tower instead: as today's daily while it still is,
   * otherwise as practice.
   */
  async start(mode: ClimbMode, userId: string | null, challenge?: string): Promise<ClimbRunView> {
    let values: typeof climbRuns.$inferInsert;
    if (challenge) {
      const [from] = await this.db.select().from(climbRuns).where(eq(climbRuns.id, challenge));
      if (!from) throw new NotFoundError("Challenge not found");
      const daily = from.mode === "daily" && from.puzzleDate === todayUtc();
      values = { userId, mode: daily ? "daily" : "practice", seed: from.seed, puzzleDate: daily ? from.puzzleDate : null };
    } else {
      const date = mode === "daily" ? todayUtc() : null;
      values = { userId, mode, seed: date ? `daily-${date}` : practiceSeed(randomUUID()), puzzleDate: date };
    }
    const [run] = await this.db.insert(climbRuns).values(values).returning();
    return view(run);
  }

  /**
   * Records how far a run has got. A new best floor is timed by the server's clock and
   * rejected if it came faster than anyone could climb. `finish` also ends the run and keeps
   * its ghost.
   */
  async progress(id: string, userId: string | null, body: ClimbFinishBody, finish = false): Promise<ClimbRunView> {
    return this.db.transaction(async (tx) => {
      const [run] = await tx.select().from(climbRuns).where(eq(climbRuns.id, id)).for("update");
      // Runs owned by a user are invisible to everyone else; guest runs are protected only
      // by their unguessable id.
      if (!run || (run.userId && run.userId !== userId)) throw new NotFoundError("Run not found");
      if (run.status !== "climbing") return view(run);

      const elapsedMs = Date.now() - run.startedAt.getTime();
      const update: Partial<RunRow> = {
        coins: Math.max(run.coins, body.coins),
        falls: Math.max(run.falls, body.falls),
      };
      if (body.floor > run.bestFloor) {
        if (elapsedMs < body.floor * CLIMB_MIN_SECONDS_PER_FLOOR * 1000) throw new TooFastError("Climbed too fast");
        update.bestFloor = body.floor;
        update.timeMs = elapsedMs;
        if (body.falls === 0) update.cleanFloor = Math.max(run.cleanFloor, body.floor);
        // The first floor of a daily climb keeps the streak alive.
        if (run.userId && run.mode === "daily" && run.puzzleDate && run.bestFloor === 0) {
          await recordClimbDay(tx, run.userId, run.puzzleDate);
        }
      }
      if (finish) {
        const summit = (update.bestFloor ?? run.bestFloor) >= CLIMB_FLOORS;
        update.status = summit ? "summit" : "finished";
        update.endedAt = new Date();
        if (run.userId) await recordClimbFinish(tx, run.userId, summit);
      }
      const [updated] = await tx.update(climbRuns).set(update).where(eq(climbRuns.id, id)).returning();
      if (finish && body.ghost && updated.bestFloor > 0) {
        const frames = decodeGhost(body.ghost);
        if (frames?.length) await tx.insert(climbGhosts).values({ runId: id, frames: frames.length, data: body.ghost }).onConflictDoNothing();
      }
      return view(updated);
    });
  }

  /**
   * Moves guest runs from this browser into the signed-in account, oldest first, counting
   * them toward stats, the streak, coins and achievements.
   */
  async claim(userId: string, runIds: string[]): Promise<number> {
    if (!runIds.length) return 0;
    return this.db.transaction(async (tx) => {
      const runs = await tx
        .update(climbRuns)
        .set({ userId })
        .where(and(inArray(climbRuns.id, runIds), isNull(climbRuns.userId)))
        .returning();
      runs.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      for (const run of runs) {
        if (run.mode === "daily" && run.puzzleDate && run.bestFloor > 0) await recordClimbDay(tx, userId, run.puzzleDate);
        if (run.status !== "climbing") await recordClimbFinish(tx, userId, run.status === "summit");
      }
      return runs.length;
    });
  }

  /**
   * Ghosts to race on a tower: my best climb of it, and the best climbs of the top few other
   * players (each player's best, highest first). Guests keep their own ghost in the browser.
   */
  async ghosts(seed: string, userId: string | null): Promise<ClimbGhostView[]> {
    const rows = await queryRows<GhostRow>(
      this.db,
      sql`
        with best as (
          select distinct on (r.user_id) r.id, r.user_id, r.mode, r.seed, r.puzzle_date, r.best_floor, r.time_ms
          from climb_runs r
          join climb_ghosts g on g.run_id = r.id
          where r.seed = ${seed} and r.user_id is not null
          order by r.user_id, r.best_floor desc, r.time_ms asc
        ),
        picked as (
          (select * from best where user_id = ${userId})
          union all
          (select * from best where user_id is distinct from ${userId} order by best_floor desc, time_ms asc limit ${GHOST_RIVALS})
        )
        select picked.*, g.data, p.display_name, a.config as avatar
        from picked
        join climb_ghosts g on g.run_id = picked.id
        left join profiles p on p.id = picked.user_id
        left join avatars a on a.user_id = picked.user_id
        order by picked.best_floor desc, picked.time_ms asc
      `,
    );
    return rows.map((r) => ghostView(r, userId));
  }

  /** A challenge link: someone's finished climb, with its tower and ghost. */
  async challenge(runId: string, userId: string | null): Promise<ClimbChallengeView> {
    const [r] = await queryRows<GhostRow>(
      this.db,
      sql`
        select r.id, r.user_id, r.mode, r.seed, r.puzzle_date, r.best_floor, r.time_ms, g.data, p.display_name, a.config as avatar
        from climb_runs r
        join climb_ghosts g on g.run_id = r.id
        left join profiles p on p.id = r.user_id
        left join avatars a on a.user_id = r.user_id
        where r.id = ${runId}
      `,
    );
    if (!r) throw new NotFoundError("Challenge not found");
    const daily = r.mode === "daily" && dateString(r.puzzle_date) === todayUtc();
    return { ...ghostView(r, userId), seed: r.seed, mode: daily ? "daily" : "practice", date: dateString(r.puzzle_date) };
  }

  /** Today's tower: the leaderboard (each signed-in player's best daily climb) and my place on it. */
  async daily(userId: string | null): Promise<ClimbDailyView> {
    const date = todayUtc();
    const rows = await queryRows<BoardRow>(
      this.db,
      sql`
        with best as (
          select distinct on (r.user_id) r.user_id, r.best_floor as floor, r.time_ms
          from climb_runs r
          where r.user_id is not null and r.mode = 'daily' and r.puzzle_date = ${date} and r.best_floor > 0
          order by r.user_id, r.best_floor desc, r.time_ms asc
        ),
        ranked as (
          select b.*, (rank() over (order by b.floor desc, b.time_ms asc))::int as rank, (count(*) over ())::int as total
          from best b
        )
        select ranked.*, p.display_name, p.avatar_url, a.config as avatar
        from ranked
        left join profiles p on p.id = ranked.user_id
        left join avatars a on a.user_id = ranked.user_id
        where ranked.rank <= ${TOP} or ranked.user_id = ${userId}
        order by ranked.rank
      `,
    );
    const entry = (r: BoardRow): ClimbLeaderboardEntry => ({
      rank: r.rank,
      name: shortName(r.display_name),
      avatarUrl: r.avatar_url,
      floor: r.floor,
      seconds: Math.round(r.time_ms / 100) / 10,
      isMe: r.user_id === userId,
      avatar: r.avatar,
    });
    const mine = rows.find((r) => r.user_id === userId);
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      date,
      number: towerNumber(date),
      myBest: mine ? { floor: mine.floor, seconds: Math.round(mine.time_ms / 100) / 10 } : null,
      climbers: rows[0]?.total ?? 0,
      top: rows.filter((r) => r.rank <= TOP).map(entry),
      me: mine ? entry(mine) : null,
      nextAt: next.toISOString(),
    };
  }

  /**
   * The /leaderboard view for Sky Climb. Each day counts a player's best daily climb; the
   * score is the floors reached (summed over the week or all time), ties to the faster.
   */
  async leaderboard(period: LeaderboardPeriod, userId: string | null): Promise<LeaderboardView> {
    const to = isoDay();
    const from = period === "daily" ? to : period === "weekly" ? isoDay(-6) : "2000-01-01";
    const rows = await queryRows<TotalsRow>(
      this.db,
      sql`
        with days as (
          select distinct on (r.user_id, r.puzzle_date) r.user_id, r.best_floor, r.time_ms
          from climb_runs r
          where r.user_id is not null and r.mode = 'daily' and r.best_floor > 0
            and r.puzzle_date >= ${from} and r.puzzle_date <= ${to}
          order by r.user_id, r.puzzle_date, r.best_floor desc, r.time_ms asc
        ),
        totals as (
          select user_id,
            sum(best_floor)::int as score,
            (count(*) filter (where best_floor >= ${CLIMB_FLOORS}))::int as wins,
            count(*)::int as played,
            (sum(time_ms) / 1000.0)::float8 as seconds
          from days group by user_id
        ),
        ranked as (
          select t.*, (rank() over (order by t.score desc, t.seconds asc))::int as rank, (count(*) over ())::int as total
          from totals t
        )
        select ranked.*, p.display_name, p.avatar_url, a.config as avatar
        from ranked
        left join profiles p on p.id = ranked.user_id
        left join avatars a on a.user_id = ranked.user_id
        where ranked.rank <= ${BOARD_TOP} or ranked.user_id = ${userId}
        order by ranked.rank
      `,
    );
    const entry = (r: TotalsRow) => ({
      rank: r.rank,
      name: shortName(r.display_name),
      avatarUrl: r.avatar_url,
      score: r.score,
      wins: r.wins,
      played: r.played,
      seconds: Math.round(r.seconds),
      isMe: r.user_id === userId,
      avatar: r.avatar,
    });
    const mine = rows.find((r) => r.user_id === userId);
    return {
      period,
      from,
      to,
      totalPlayers: rows[0]?.total ?? 0,
      entries: rows.filter((r) => r.rank <= BOARD_TOP).map(entry),
      me: mine ? entry(mine) : null,
    };
  }

  /** Coins, items, loadout and achievements, all derived from the player's climbs. */
  async profile(userId: string, db: Executor = this.db): Promise<ClimbProfileView> {
    const [m] = await queryRows<MetricsRow>(
      db as Db,
      sql`
        select
          coalesce(max(best_floor), 0)::int as best_floor,
          (count(*) filter (where status = 'summit'))::int as summits,
          coalesce(max(clean_floor), 0)::int as clean_floor,
          (count(*) filter (where status = 'summit' and time_ms < ${FAST_SUMMIT_MS}))::int as fast,
          coalesce(max(coins), 0)::int as max_run_coins,
          coalesce(sum(coins), 0)::int as coins_total,
          coalesce(max(falls), 0)::int as max_falls
        from climb_runs where user_id = ${userId}
      `,
    );
    // Twists are derived from the seed, so "Twisted" counts the distinct twists of tall daily climbs.
    const twisted = await queryRows<{ seed: string }>(
      db as Db,
      sql`select distinct seed from climb_runs where user_id = ${userId} and mode = 'daily' and best_floor >= ${TWISTED_FLOOR}`,
    );
    const twists = new Set(twisted.map((r) => twistOf(r.seed)).filter((t) => t !== null));
    const stats = await getStats(db as Db, userId, SKY_CLIMB);
    const sg = await getStats(db as Db, userId, "shadow-guess");
    const shadowGuess = { maxStreak: sg.maxStreak, won: sg.won };
    const metrics: ClimbMetrics = {
      bestFloor: m.best_floor,
      summits: m.summits,
      cleanFloor: m.clean_floor,
      fastSummit: m.fast > 0 ? 1 : 0,
      maxRunCoins: m.max_run_coins,
      coinsTotal: m.coins_total,
      maxFalls: m.max_falls,
      maxStreak: stats.maxStreak,
      twists: twists.size,
    };
    const unlocks = await db.select().from(climbUnlocks).where(eq(climbUnlocks.userId, userId)).orderBy(asc(climbUnlocks.createdAt));
    const spent = unlocks.reduce((n, u) => n + u.cost, 0);
    const achievements = evaluateAchievements(metrics);
    const owned = ownedItems(
      unlocks.map((u) => u.itemId),
      achievements,
      shadowGuess,
    );
    const [saved] = await db.select().from(climbLoadouts).where(eq(climbLoadouts.userId, userId));
    // An item that's no longer owned (or no longer exists) falls back to the default.
    const loadout = {
      character: saved && owned.includes(saved.character) ? saved.character : DEFAULT_LOADOUT.character,
      trail: saved && owned.includes(saved.trail) ? saved.trail : DEFAULT_LOADOUT.trail,
    };
    return {
      coins: { earned: metrics.coinsTotal, spent, balance: metrics.coinsTotal - spent },
      owned,
      loadout,
      achievements,
      metrics,
      currentStreak: stats.currentStreak,
      shadowGuess,
    };
  }

  /** Buys a cosmetic with coins, and wears it straight away. */
  async buy(userId: string, itemId: string): Promise<ClimbProfileView> {
    const item = climbItem(itemId);
    if (!item || item.price <= 0 || item.achievement || item.shadowGuess) throw refuse("not_for_sale");
    return this.db.transaction(async (tx) => {
      // Locking the player's loadout row serializes their purchases (no double spending).
      await tx
        .insert(climbLoadouts)
        .values({ userId, ...DEFAULT_LOADOUT })
        .onConflictDoNothing();
      const [loadout] = await tx.select().from(climbLoadouts).where(eq(climbLoadouts.userId, userId)).for("update");
      const before = await this.profile(userId, tx);
      if (before.owned.includes(item.id)) throw refuse("already_owned");
      if (before.coins.balance < item.price) throw refuse("not_enough_coins");
      await tx.insert(climbUnlocks).values({ userId, itemId: item.id, cost: item.price });
      // Climbers and trails are worn at once; hats and eyewear go on in the avatar editor.
      if (item.kind === "character" || item.kind === "trail") {
        await tx
          .update(climbLoadouts)
          .set({ [item.kind]: item.id, updatedAt: new Date() })
          .where(eq(climbLoadouts.userId, loadout.userId));
      }
      return this.profile(userId, tx);
    });
  }

  /** Changes what the player wears; only items they own. */
  async equip(userId: string, choice: { character?: string; trail?: string }): Promise<ClimbProfileView> {
    const current = await this.profile(userId);
    const pick = (id: string | undefined, kind: "character" | "trail") => {
      if (id === undefined) return current.loadout[kind];
      if (climbItem(id)?.kind !== kind || !current.owned.includes(id)) throw refuse("not_owned");
      return id;
    };
    const values = { character: pick(choice.character, "character"), trail: pick(choice.trail, "trail") };
    await this.db
      .insert(climbLoadouts)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: climbLoadouts.userId, set: { ...values, updatedAt: new Date() } });
    return this.profile(userId);
  }
}
