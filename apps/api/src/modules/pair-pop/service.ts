import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  PAIR_POP_MIN_MS_PER_MOVE,
  dealPairPop,
  pairPopDailyNumber,
  pairPopDailySeed,
  pairPopLevelOf,
  pairPopResult,
  pairsOf,
  replayPairPop,
  type AvatarConfig,
  type FinishPairPopBody,
  type LeaderboardPeriod,
  type LeaderboardView,
  type PairPopDailyView,
  type PairPopGameView,
  type PairPopProgressView,
  type PairPopResultView,
  type StartPairPopBody,
} from "@shadow/shared";
import type { Db } from "../../db/client";
import { queryRows } from "../../db/rows";
import { pairPopGames } from "../../db/schema";
import { shortName } from "../leaderboard/service";
import { NotFoundError } from "../shadow-guess/service";
import { TooFastError } from "../sky-climb/service";

const BOARD_TOP = 50;

type GameRow = typeof pairPopGames.$inferSelect;

/** A game that can't be scored (flips that couldn't happen, or an unfinished board): 422. */
function refuse(code: string): Error {
  return Object.assign(new Error(code), { statusCode: 422 });
}

function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function range(period: LeaderboardPeriod): { from: string; to: string } {
  const to = isoDay();
  if (period === "daily") return { from: to, to };
  if (period === "weekly") return { from: isoDay(-6), to };
  return { from: "2000-01-01", to };
}

/** Postgres dates come back as strings or Dates depending on the driver. */
function dateString(d: string | Date | null): string | null {
  if (d === null) return null;
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * Each signed-in player's first finished daily on each day in the range: only that one
 * counts, since a replay of the same pals is easier.
 */
const firsts = (from: string, to: string) => sql`
  firsts as (
    select distinct on (g.user_id, g.puzzle_date) g.id, g.user_id, g.puzzle_date, g.score, g.stars, g.moves, g.time_ms
    from pair_pop_games g
    where g.user_id is not null and g.mode = 'daily' and g.status = 'finished'
      and g.puzzle_date between ${from}::date and ${to}::date
    order by g.user_id, g.puzzle_date, g.ended_at asc
  )
`;

interface DayRow {
  id: string;
  user_id: string;
  score: number;
  stars: number;
  moves: number;
  time_ms: number;
  rank: number;
  total: number;
}

interface BoardRow {
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

function resultOf(game: GameRow) {
  return { moves: game.moves, seconds: game.timeMs / 1000, score: game.score, stars: game.stars, bestCombo: game.bestCombo };
}

export class PairPopService {
  constructor(private db: Db) {}

  async start(body: StartPairPopBody, userId: string | null): Promise<PairPopGameView> {
    const date = isoDay();
    const daily = body.mode === "daily";
    const level = daily ? null : (body.level ?? 0);
    const [game] = await this.db
      .insert(pairPopGames)
      .values({
        userId,
        mode: body.mode,
        level,
        puzzleDate: daily ? date : null,
        seed: daily ? pairPopDailySeed(date) : `level-${level}:${randomUUID()}`,
        layoutSeed: randomUUID(),
      })
      .returning();
    let replay = false;
    if (daily && userId) {
      const [done] = await this.db
        .select({ id: pairPopGames.id })
        .from(pairPopGames)
        .where(and(eq(pairPopGames.userId, userId), eq(pairPopGames.mode, "daily"), eq(pairPopGames.puzzleDate, date), eq(pairPopGames.status, "finished")))
        .limit(1);
      replay = !!done;
    }
    return { gameId: game.id, mode: game.mode, level: game.level, seed: game.seed, layoutSeed: game.layoutSeed, date: dateString(game.puzzleDate), replay };
  }

  /** Scores a game by replaying its flips over its board. Finishing twice returns the first result. */
  async finish(id: string, userId: string | null, body: FinishPairPopBody): Promise<PairPopResultView> {
    const game = await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(pairPopGames).where(eq(pairPopGames.id, id)).for("update");
      // A guest's game can be finished by anyone holding its id; an account's only by its owner.
      if (!row || (row.userId && row.userId !== userId)) throw new NotFoundError();
      if (row.status === "finished") return row;

      const level = pairPopLevelOf(row.mode, row.level);
      const pairs = pairsOf(level);
      const replay = replayPairPop(dealPairPop(level, row.seed, row.layoutSeed), body.flips);
      if (!replay?.complete) throw refuse("invalid_game");
      const elapsed = Date.now() - row.startedAt.getTime();
      const fastest = replay.moves * PAIR_POP_MIN_MS_PER_MOVE;
      if (elapsed < fastest) throw new TooFastError();
      // The browser's clock, but never longer than the game has existed nor quicker than possible.
      const timeMs = Math.round(Math.min(elapsed, Math.max(fastest, body.timeMs)));
      const result = pairPopResult(replay, pairs, timeMs);
      const [updated] = await tx
        .update(pairPopGames)
        .set({
          userId: row.userId ?? userId,
          moves: result.moves,
          bestCombo: result.bestCombo,
          score: result.score,
          stars: result.stars,
          timeMs,
          status: "finished",
          endedAt: new Date(),
        })
        .where(eq(pairPopGames.id, id))
        .returning();
      return updated;
    });

    const view: PairPopResultView = { ...resultOf(game), counted: game.mode === "daily", rank: null, players: 0 };
    const date = dateString(game.puzzleDate);
    if (game.mode === "daily" && game.userId && date) {
      const day = await this.day(date);
      const mine = day.find((r) => r.user_id === game.userId);
      view.counted = mine?.id === game.id;
      view.rank = mine?.rank ?? null;
      view.players = day[0]?.total ?? 0;
    }
    return view;
  }

  /** A day's counted dailies, ranked by score then time. */
  private day(date: string) {
    return queryRows<DayRow>(
      this.db,
      sql`
        with ${firsts(date, date)}
        select f.*, (rank() over (order by f.score desc, f.time_ms asc))::int as rank, (count(*) over ())::int as total
        from firsts f
      `,
    );
  }

  async daily(userId: string | null): Promise<PairPopDailyView> {
    const date = isoDay();
    const day = await this.day(date);
    const mine = day.find((r) => r.user_id === userId);
    return {
      date,
      number: pairPopDailyNumber(date),
      players: day[0]?.total ?? 0,
      mine: mine ? { moves: mine.moves, seconds: Math.round(mine.time_ms / 1000), score: mine.score, stars: mine.stars, rank: mine.rank } : null,
    };
  }

  async progress(userId: string): Promise<PairPopProgressView> {
    const rows = await queryRows<{ level: number; stars: number }>(
      this.db,
      sql`
        select level, max(stars)::int as stars from pair_pop_games
        where user_id = ${userId} and mode = 'level' and status = 'finished' and level is not null
        group by level
      `,
    );
    const stars: number[] = [];
    for (const r of rows) stars[r.level] = r.stars;
    return { stars: Array.from(stars, (s) => s ?? 0) };
  }

  /**
   * Total score over the counted dailies in the period, ties broken by less time. `wins`
   * counts three-star boards.
   */
  async leaderboard(period: LeaderboardPeriod, userId: string | null): Promise<LeaderboardView> {
    const { from, to } = range(period);
    const rows = await queryRows<BoardRow>(
      this.db,
      sql`
        with ${firsts(from, to)},
        totals as (
          select user_id,
            sum(score)::int as score,
            (count(*) filter (where stars = 3))::int as wins,
            count(*)::int as played,
            (sum(time_ms) / 1000.0)::float8 as seconds
          from firsts group by user_id
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
    const entry = (r: BoardRow) => ({
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

  /** Games played as a guest in this browser move into the account. */
  async claim(userId: string, gameIds: string[]): Promise<number> {
    if (!gameIds.length) return 0;
    const games = await this.db
      .update(pairPopGames)
      .set({ userId })
      .where(and(inArray(pairPopGames.id, gameIds), isNull(pairPopGames.userId)))
      .returning({ id: pairPopGames.id });
    return games.length;
  }
}
