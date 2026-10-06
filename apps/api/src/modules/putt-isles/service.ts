import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  generatePuttCourse,
  puttCourseNumber,
  puttDailySeed,
  puttPracticeSeed,
  puttTotals,
  PUTT_MIN_SECONDS_PER_STROKE,
  type AvatarConfig,
  type LeaderboardPeriod,
  type LeaderboardView,
  type PuttDailyView,
  type PuttLeaderboardEntry,
  type PuttMode,
  type PuttRoundView,
} from "@shadow/shared";
import type { Db, Executor } from "../../db/client";
import { queryRows } from "../../db/rows";
import { puttRounds, userStats } from "../../db/schema";
import { shortName } from "../leaderboard/service";
import { NotFoundError } from "../shadow-guess/service";
import { TooFastError } from "../sky-climb/service";

export const PUTT_ISLES = "putt-isles";
const TOP = 20;
const BOARD_TOP = 50;

type RoundRow = typeof puttRounds.$inferSelect;

function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

const todayUtc = () => isoDay();

function dayBefore(date: string): string {
  return new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);
}

/** A course's pars, from its seed: the server builds the same course the player sees. */
const parsOf = (seed: string) => generatePuttCourse(seed).map((h) => h.par);

function view(r: RoundRow): PuttRoundView {
  return { roundId: r.id, mode: r.mode, seed: r.seed, date: r.puzzleDate, strokes: r.strokes, status: r.status };
}

/**
 * Putt Isles' row in user_stats: `played` counts finished rounds, `won` those under par,
 * and the streak counts consecutive days on which the daily course was finished.
 */
async function recordRound(tx: Executor, userId: string, round: RoundRow) {
  const [row] = await tx
    .select()
    .from(userStats)
    .where(and(eq(userStats.userId, userId), eq(userStats.gameType, PUTT_ISLES)))
    .for("update");
  const values: Partial<typeof userStats.$inferInsert> = {
    played: (row?.played ?? 0) + 1,
    won: (row?.won ?? 0) + (round.toPar < 0 ? 1 : 0),
  };
  const date = round.mode === "daily" ? round.puzzleDate : null;
  if (date && !(row?.lastDailyDate && date <= row.lastDailyDate)) {
    const continues = row?.lastDailyDate === dayBefore(date) && (row?.currentStreak ?? 0) > 0;
    values.currentStreak = continues ? row!.currentStreak + 1 : 1;
    values.maxStreak = Math.max(row?.maxStreak ?? 0, values.currentStreak);
    values.lastDailyDate = date;
  }
  await tx
    .insert(userStats)
    .values({ userId, gameType: PUTT_ISLES, ...values })
    .onConflictDoUpdate({ target: [userStats.userId, userStats.gameType], set: values });
}

interface BoardRow {
  user_id: string;
  rank: number;
  points: number;
  to_par: number;
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

export class PuttIslesService {
  constructor(private db: Db) {}

  /**
   * Starts a round. The daily course counts once: a signed-in player (or a guest, by the id
   * their browser kept) gets their round for today back, to carry on or to look at.
   */
  async start(mode: PuttMode, userId: string | null, resume?: string): Promise<PuttRoundView> {
    if (mode === "daily") {
      const date = todayUtc();
      const mine = userId
        ? await this.db
            .select()
            .from(puttRounds)
            .where(and(eq(puttRounds.userId, userId), eq(puttRounds.mode, "daily"), eq(puttRounds.puzzleDate, date)))
            .orderBy(desc(puttRounds.startedAt))
            .limit(1)
        : resume
          ? await this.db
              .select()
              .from(puttRounds)
              .where(and(eq(puttRounds.id, resume), isNull(puttRounds.userId), eq(puttRounds.mode, "daily"), eq(puttRounds.puzzleDate, date)))
          : [];
      if (mine[0]) return view(mine[0]);
      const [round] = await this.db.insert(puttRounds).values({ userId, mode, seed: puttDailySeed(date), puzzleDate: date }).returning();
      return view(round);
    }
    const [round] = await this.db.insert(puttRounds).values({ userId, mode, seed: puttPracticeSeed(randomUUID()) }).returning();
    return view(round);
  }

  /**
   * Records the strokes on the next hole. Holes come in order, each no sooner than its
   * strokes could be played; the last one finishes the round.
   */
  async hole(id: string, userId: string | null, hole: number, strokes: number): Promise<PuttRoundView> {
    return this.db.transaction(async (tx) => {
      const [round] = await tx.select().from(puttRounds).where(eq(puttRounds.id, id)).for("update");
      // Rounds owned by a user are invisible to everyone else; guest rounds are protected
      // only by their unguessable id.
      if (!round || (round.userId && round.userId !== userId)) throw new NotFoundError("Round not found");
      // A repeat of a hole already in (a retry after a lost response) changes nothing.
      if (round.status !== "playing" || hole !== round.strokes.length) return view(round);

      const now = Date.now();
      if (now - round.lastHoleAt.getTime() < strokes * PUTT_MIN_SECONDS_PER_STROKE * 1000) throw new TooFastError("Putted too fast");
      const pars = parsOf(round.seed);
      const played = [...round.strokes, strokes];
      const t = puttTotals(played, pars);
      const done = played.length >= pars.length;
      const [updated] = await tx
        .update(puttRounds)
        .set({
          strokes: played,
          points: t.points,
          toPar: t.toPar,
          aces: t.aces,
          timeMs: now - round.startedAt.getTime(),
          lastHoleAt: new Date(now),
          ...(done ? { status: "finished" as const, endedAt: new Date(now) } : {}),
        })
        .where(eq(puttRounds.id, id))
        .returning();
      if (done && updated.userId) await recordRound(tx, updated.userId, updated);
      return view(updated);
    });
  }

  /** Moves guest rounds from this browser into the signed-in account, oldest first. */
  async claim(userId: string, roundIds: string[]): Promise<number> {
    if (!roundIds.length) return 0;
    return this.db.transaction(async (tx) => {
      // One daily round per day per player: a guest's daily isn't claimed over one the
      // account already has.
      const owned = await tx
        .select({ date: puttRounds.puzzleDate })
        .from(puttRounds)
        .where(and(eq(puttRounds.userId, userId), eq(puttRounds.mode, "daily")));
      const days = new Set(owned.map((r) => r.date));
      const candidates = await tx
        .select()
        .from(puttRounds)
        .where(and(inArray(puttRounds.id, roundIds), isNull(puttRounds.userId)));
      const take = candidates.filter((r) => r.mode !== "daily" || !days.has(r.puzzleDate));
      if (!take.length) return 0;
      const rounds = await tx
        .update(puttRounds)
        .set({ userId })
        .where(inArray(puttRounds.id, take.map((r) => r.id)))
        .returning();
      rounds.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      for (const r of rounds) if (r.status === "finished") await recordRound(tx, userId, r);
      return rounds.length;
    });
  }

  /** Today's course: the board (each finished daily round, most points first) and my round. */
  async daily(userId: string | null): Promise<PuttDailyView> {
    const date = todayUtc();
    const rows = await queryRows<BoardRow>(
      this.db,
      sql`
        with best as (
          select distinct on (r.user_id) r.user_id, r.points, r.to_par, r.time_ms
          from putt_rounds r
          where r.user_id is not null and r.mode = 'daily' and r.puzzle_date = ${date} and r.status = 'finished'
          order by r.user_id, r.points desc, r.to_par asc, r.time_ms asc
        ),
        ranked as (
          select b.*, (rank() over (order by b.points desc, b.to_par asc, b.time_ms asc))::int as rank, (count(*) over ())::int as total
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
    const entry = (r: BoardRow): PuttLeaderboardEntry => ({
      rank: r.rank,
      name: shortName(r.display_name),
      avatarUrl: r.avatar_url,
      avatar: r.avatar,
      points: r.points,
      toPar: r.to_par,
      seconds: Math.round(r.time_ms / 100) / 10,
      isMe: r.user_id === userId,
    });
    const mineRow = rows.find((r) => r.user_id === userId);
    const [myRound] = userId
      ? await this.db
          .select()
          .from(puttRounds)
          .where(and(eq(puttRounds.userId, userId), eq(puttRounds.mode, "daily"), eq(puttRounds.puzzleDate, date)))
          .orderBy(desc(puttRounds.startedAt))
          .limit(1)
      : [];
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      date,
      number: puttCourseNumber(date),
      players: rows[0]?.total ?? 0,
      myRound: myRound ? view(myRound) : null,
      top: rows.filter((r) => r.rank <= TOP).map(entry),
      me: mineRow ? entry(mineRow) : null,
      nextAt: next.toISOString(),
    };
  }

  /**
   * The /leaderboard view for Putt Isles: Stableford points on daily rounds (summed over
   * the week or all time), ties to fewer strokes over par, then the quicker. `wins` counts
   * holes in one.
   */
  async leaderboard(period: LeaderboardPeriod, userId: string | null): Promise<LeaderboardView> {
    const to = isoDay();
    const from = period === "daily" ? to : period === "weekly" ? isoDay(-6) : "2000-01-01";
    const rows = await queryRows<TotalsRow & { to_par: number }>(
      this.db,
      sql`
        with totals as (
          select user_id,
            sum(points)::int as score,
            sum(aces)::int as wins,
            count(*)::int as played,
            sum(to_par)::int as to_par,
            (sum(time_ms) / 1000.0)::float8 as seconds
          from putt_rounds
          where user_id is not null and mode = 'daily' and status = 'finished'
            and puzzle_date >= ${from} and puzzle_date <= ${to}
          group by user_id
        ),
        ranked as (
          select t.*, (rank() over (order by t.score desc, t.to_par asc, t.seconds asc))::int as rank, (count(*) over ())::int as total
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
    const entry = (r: TotalsRow & { to_par: number }) => ({
      rank: r.rank,
      name: shortName(r.display_name),
      avatarUrl: r.avatar_url,
      score: r.score,
      wins: r.wins,
      played: r.played,
      seconds: Math.round(r.seconds),
      toPar: r.to_par,
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
}
