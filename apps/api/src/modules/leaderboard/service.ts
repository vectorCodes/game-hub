import { sql } from "drizzle-orm";
import { shortName, type AvatarConfig, type LeaderboardEntry, type LeaderboardPeriod, type LeaderboardView } from "@shadow/shared";

// Shortened names ("Ada L.") so the public board doesn't show full names.
export { shortName };
import type { Db } from "../../db/client";
import { queryRows } from "../../db/rows";

const TOP = 50;

interface Row {
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

function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function range(period: LeaderboardPeriod): { from: string; to: string } {
  const to = isoDay();
  if (period === "daily") return { from: to, to };
  if (period === "weekly") return { from: isoDay(-6), to };
  return { from: "2000-01-01", to };
}

/**
 * Ranks signed-in players by total score on finished daily puzzles in the period, ties
 * broken by less time spent solving. Free play is excluded: it can be replayed endlessly.
 */
export async function getLeaderboard(
  db: Db,
  gameType: string,
  period: LeaderboardPeriod,
  userId: string | null,
): Promise<LeaderboardView> {
  const { from, to } = range(period);
  const rows = await queryRows<Row>(
    db,
    sql`
      with totals as (
        select
          s.user_id,
          sum(coalesce(s.score, 0))::int as score,
          (count(*) filter (where s.status = 'won'))::int as wins,
          count(*)::int as played,
          coalesce(sum(extract(epoch from s.ended_at - s.started_at)) filter (where s.status = 'won'), 0)::float8 as seconds
        from game_sessions s
        where s.user_id is not null
          and s.game_type = ${gameType}
          and s.mode = 'daily'
          and s.status <> 'playing'
          and s.puzzle_date between ${from}::date and ${to}::date
        group by s.user_id
      ),
      ranked as (
        select t.*, (rank() over (order by t.score desc, t.seconds asc))::int as rank,
               (count(*) over ())::int as total
        from totals t
      )
      select r.*, p.display_name, p.avatar_url, a.config as avatar
      from ranked r
      left join profiles p on p.id = r.user_id
      left join avatars a on a.user_id = r.user_id
      where r.rank <= ${TOP} or r.user_id = ${userId}::uuid
      order by r.rank, r.seconds
    `,
  );

  const toEntry = (r: Row): LeaderboardEntry => ({
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
    entries: rows.filter((r) => r.rank <= TOP).map(toEntry),
    me: mine ? toEntry(mine) : null,
  };
}
