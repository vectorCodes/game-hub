import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardView } from "@shadow/shared";
import { api } from "../api/client";
import { GoogleIcon } from "../auth/AuthMenu";
import { useAuth } from "../auth/store";
import { AvatarImage } from "../avatar/AvatarImage";
import { Avatar } from "../components/Avatar";
import { Segmented } from "../components/Segmented";
import { formatDuration } from "../lib/format";

type Game = "shadow-guess" | "sky-climb";

const GAMES: { value: Game; label: string }[] = [
  { value: "shadow-guess", label: "Shadow Guess" },
  { value: "sky-climb", label: "Sky Climb" },
];

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "all", label: "All time" },
];

const BLURBS: Record<Game, Record<LeaderboardPeriod, string>> = {
  "shadow-guess": {
    daily: "Today's daily puzzle. Ties go to the faster solver.",
    weekly: "Total over the last 7 dailies. Ties go to the faster solver.",
    all: "Total over every daily. Ties go to the faster solver.",
  },
  "sky-climb": {
    daily: "Highest floor on today's tower. Ties go to the faster climber.",
    weekly: "Floors climbed on the last 7 daily towers (each day's best climb).",
    all: "Floors climbed on every daily tower (each day's best climb).",
  },
};

const MEDALS = [
  { ring: "ring-amber-300", text: "text-amber-300", bg: "from-amber-400/25", height: "h-28 sm:h-32", label: "1st" },
  { ring: "ring-stone-300", text: "text-stone-200", bg: "from-stone-300/15", height: "h-20 sm:h-24", label: "2nd" },
  { ring: "ring-orange-400", text: "text-orange-300", bg: "from-orange-500/20", height: "h-16 sm:h-20", label: "3rd" },
];

function detail(entry: LeaderboardEntry, period: LeaderboardPeriod, game: Game) {
  if (game === "sky-climb") {
    if (period === "daily") return `${entry.wins ? "🏁 " : ""}${formatDuration(entry.seconds)}`;
    return `${entry.played} day${entry.played === 1 ? "" : "s"} · ${entry.wins} 🏁`;
  }
  if (period === "daily") return entry.wins ? formatDuration(entry.seconds) : "missed";
  return `${entry.wins}/${entry.played} won`;
}

/** Top three, ordered 2 · 1 · 3 on wide screens like a podium. */
function Podium({ entries, period, game }: { entries: LeaderboardEntry[]; period: LeaderboardPeriod; game: Game }) {
  const top = entries.slice(0, 3);
  const order = top.length === 3 ? [1, 0, 2] : top.map((_, i) => i);
  return (
    <div className={`grid items-end gap-2 sm:gap-3 ${top.length === 3 ? "grid-cols-3" : top.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {order.map((i, pos) => {
        const e = top[i];
        const m = MEDALS[Math.min(e.rank - 1, 2)];
        return (
          <div key={i} className="flex animate-rise flex-col items-center" style={{ animationDelay: `${pos * 90}ms` }}>
            {e.avatar ? (
              <AvatarImage config={e.avatar} size="lg" className={`ring-4 ${m.ring}`} />
            ) : (
              <Avatar src={e.avatarUrl} name={e.name} size="lg" className={`ring-4 ${m.ring}`} />
            )}
            <div className={`mt-2 max-w-full truncate text-sm font-medium ${e.isMe ? "text-moss-300" : "text-white"}`}>
              {e.name}
              {e.isMe && " (you)"}
            </div>
            <div className="font-display text-lg font-bold tabular-nums sm:text-xl">{e.score}</div>
            <div className="text-xs text-stone-400">{detail(e, period, game)}</div>
            <div
              className={`mt-2 grid w-full place-items-start justify-center rounded-t-2xl bg-gradient-to-b ${m.bg} to-transparent pt-2 ring-1 ring-white/5 ${m.height}`}
            >
              <span className={`font-display text-lg font-bold ${m.text}`}>{m.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ entry, period, game, delay }: { entry: LeaderboardEntry; period: LeaderboardPeriod; game: Game; delay: number }) {
  return (
    <li
      className={`grid animate-rise grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl px-2.5 py-2.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-3 sm:px-3 ${
        entry.isMe ? "bg-lamp-500/15 ring-1 ring-lamp-400/40" : "bg-white/[0.02] ring-1 ring-white/5"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-center font-display font-semibold text-stone-400 tabular-nums">{entry.rank}</span>
      <span className="flex min-w-0 items-center gap-3">
        {entry.avatar ? <AvatarImage config={entry.avatar} size="sm" /> : <Avatar src={entry.avatarUrl} name={entry.name} />}
        <span className={`truncate ${entry.isMe ? "font-medium text-moss-200" : "text-stone-200"}`}>
          {entry.name}
          {entry.isMe && <span className="ml-1.5 text-xs text-stone-400">(you)</span>}
        </span>
      </span>
      <span className="text-right">
        <span className="font-display font-bold tabular-nums">{entry.score}</span>
        <span className="block text-xs text-stone-500">{detail(entry, period, game)}</span>
      </span>
    </li>
  );
}

export default function Leaderboard() {
  const { user, enabled, synced, signIn } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  // ?game=sky-climb opens a game's board directly (the game pages link here).
  const [params, setParams] = useSearchParams();
  const game: Game = params.get("game") === "sky-climb" ? "sky-climb" : "shadow-guess";
  const setGame = (g: Game) => setParams(g === "shadow-guess" ? {} : { game: g }, { replace: true });
  const [board, setBoard] = useState<LeaderboardView | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!synced) return;
    let cancelled = false;
    setBoard(null);
    setError(false);
    api<LeaderboardView>(`/api/leaderboard?game=${game}&period=${period}`).then(
      (b) => !cancelled && setBoard(b),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [game, period, synced, user?.id]);

  const blurb = BLURBS[game][period];
  const rest = board?.entries.slice(3) ?? [];
  const meOutside = board?.me && !board.entries.some((e) => e.isMe);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
          <p className="mt-1 text-sm text-stone-400">{blurb}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <Segmented options={GAMES} value={game} onChange={setGame} label="Game" className="w-full sm:w-auto" />
          <Segmented options={PERIODS} value={period} onChange={setPeriod} label="Period" className="w-full sm:w-auto" />
        </div>
      </div>

      {enabled && synced && !user && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
          <p className="text-sm text-stone-300">Only signed-in players are ranked.</p>
          <button
            onClick={() => void signIn()}
            className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-stone-200"
          >
            <GoogleIcon /> Sign in to join
          </button>
        </div>
      )}

      {error ? (
        <p className="text-sm text-stone-400">Couldn't load the leaderboard.</p>
      ) : !board ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : board.entries.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-white/10 py-16 text-center">
          <div className="text-4xl">🏆</div>
          <p className="mt-3 font-display text-lg font-semibold">No one here yet</p>
          <p className="mt-1 text-sm text-stone-400">
            {game === "sky-climb"
              ? "Climb today's tower to take the top spot."
              : period === "daily"
                ? "Finish today's daily to take the top spot."
                : "Finish a daily to get on the board."}
          </p>
        </div>
      ) : (
        <div key={`${game}-${period}`} className="space-y-6">
          <Podium entries={board.entries} period={period} game={game} />
          {(rest.length > 0 || meOutside) && (
            <ol className="space-y-2">
              {rest.map((e, i) => (
                <Row key={i} entry={e} period={period} game={game} delay={Math.min(i, 12) * 40} />
              ))}
              {meOutside && (
                <>
                  <li className="py-1 text-center text-stone-600">⋯</li>
                  <Row entry={board.me!} period={period} game={game} delay={0} />
                </>
              )}
            </ol>
          )}
          <p className="text-center text-xs text-stone-500">
            {board.totalPlayers} player{board.totalPlayers === 1 ? "" : "s"} ranked
          </p>
        </div>
      )}
    </div>
  );
}
