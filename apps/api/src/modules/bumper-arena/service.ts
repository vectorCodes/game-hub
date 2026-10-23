import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  BUMPER_MIN_SECONDS_PER_WAVE,
  bumperDay,
  bumperScore,
  bumperWave,
  type AvatarConfig,
  type BumperDailyView,
  type BumperResultView,
  type BumperRunView,
  type FinishBumperRunBody,
  type LeaderboardPeriod,
  type LeaderboardView,
} from "@shadow/shared";
import type { Db } from "../../db/client";
import { queryRows } from "../../db/rows";
import { bumperRuns } from "../../db/schema";
import { shortName } from "../leaderboard/service";
import { NotFoundError } from "../shadow-guess/service";
import { TooFastError } from "../sky-climb/service";

const BOARD_TOP = 50;
/** A run that clears this many waves counts as a "win" on the leaderboard. */
const STRONG_RUN = 5;

/** A run that can't be scored (more knockouts than there were bots): 422. */
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

/** Bots in waves 1..n. */
const botsThrough = (n: number) => Array.from({ length: n }, (_, i) => bumperWave(i + 1).length).reduce((a, b) => a + b, 0);

/** Each signed-in player's first finished run on each day in the range: only that one counts. */
const firsts = (from: string, to: string) => sql`
  firsts as (
    select distinct on (r.user_id, r.run_date) r.id, r.user_id, r.run_date, r.score, r.waves, r.kos, r.time_ms
    from bumper_runs r
    where r.user_id is not null and r.status = 'finished'
      and r.run_date between ${from}::date and ${to}::date
    order by r.user_id, r.run_date, r.ended_at asc
  )
`;

interface DayRow {
  id: string;
  user_id: string;
  score: number;
  waves: number;
  kos: number;
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

export class BumperService {
  constructor(private db: Db) {}

  /** Starts today's Gauntlet run. Practice runs never reach the server. */
  async start(userId: string | null): Promise<BumperRunView> {
    const day = bumperDay(isoDay());
    const [run] = await this.db.insert(bumperRuns).values({ userId, runDate: day.date, map: day.map, modifier: day.modifier }).returning();
    let replay = false;
    if (userId) {
      const [done] = await this.db
        .select({ id: bumperRuns.id })
        .from(bumperRuns)
        .where(and(eq(bumperRuns.userId, userId), eq(bumperRuns.runDate, day.date), eq(bumperRuns.status, "finished")))
        .limit(1);
      replay = !!done;
    }
    return { runId: run.id, day, replay };
  }

  /** Records how far a run got. Finishing twice returns the first result. */
  async finish(id: string, userId: string | null, body: FinishBumperRunBody): Promise<BumperResultView> {
    const run = await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(bumperRuns).where(eq(bumperRuns.id, id)).for("update");
      // A guest's run can be finished by anyone holding its id; an account's only by its owner.
      if (!row || (row.userId && row.userId !== userId)) throw new NotFoundError();
      if (row.status === "finished") return row;

      // Knockouts can only come from the waves cleared and the one you went out in.
      if (body.kos > botsThrough(body.waves + 1)) throw refuse("invalid_run");
      const elapsed = Date.now() - row.startedAt.getTime();
      const fastest = body.waves * BUMPER_MIN_SECONDS_PER_WAVE * 1000;
      if (elapsed < fastest) throw new TooFastError();
      // The browser's clock, but never longer than the run has existed nor quicker than possible.
      const timeMs = Math.round(Math.min(elapsed, Math.max(fastest, body.timeMs)));
      const [updated] = await tx
        .update(bumperRuns)
        .set({
          userId: row.userId ?? userId,
          waves: body.waves,
          kos: body.kos,
          peakWobble: body.peakWobble,
          score: bumperScore(body.waves, body.kos),
          timeMs,
          status: "finished",
          endedAt: new Date(),
        })
        .where(eq(bumperRuns.id, id))
        .returning();
      return updated;
    });

    const view: BumperResultView = { waves: run.waves, kos: run.kos, score: run.score, seconds: run.timeMs / 1000, counted: true, rank: null, players: 0 };
    if (run.userId) {
      const day = await this.day(run.runDate);
      const mine = day.find((r) => r.user_id === run.userId);
      view.counted = mine?.id === run.id;
      view.rank = mine?.rank ?? null;
      view.players = day[0]?.total ?? 0;
    }
    return view;
  }

  /** A day's counted runs, ranked by score, then by the quicker run. */
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

  async daily(userId: string | null): Promise<BumperDailyView> {
    const date = isoDay();
    const day = await this.day(date);
    const mine = day.find((r) => r.user_id === userId);
    return {
      day: bumperDay(date),
      players: day[0]?.total ?? 0,
      best: day.reduce((m, r) => Math.max(m, r.waves), 0),
      mine: mine ? { waves: mine.waves, kos: mine.kos, score: mine.score, rank: mine.rank } : null,
    };
  }

  /** Total score over the counted runs in the period, ties broken by less time. `wins` counts strong runs. */
  async leaderboard(period: LeaderboardPeriod, userId: string | null): Promise<LeaderboardView> {
    const { from, to } = range(period);
    const rows = await queryRows<BoardRow>(
      this.db,
      sql`
        with ${firsts(from, to)},
        totals as (
          select user_id,
            sum(score)::int as score,
            (count(*) filter (where waves >= ${STRONG_RUN}))::int as wins,
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

  /** Runs played as a guest in this browser move into the account. */
  async claim(userId: string, runIds: string[]): Promise<number> {
    if (!runIds.length) return 0;
    const runs = await this.db
      .update(bumperRuns)
      .set({ userId })
      .where(and(inArray(bumperRuns.id, runIds), isNull(bumperRuns.userId)))
      .returning({ id: bumperRuns.id });
    return runs.length;
  }
}
