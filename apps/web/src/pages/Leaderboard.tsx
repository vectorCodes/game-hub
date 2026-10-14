// /leaderboard: the standings, set like a printed results sheet. A masthead, an index of the
// games, the top three as ticket cards, the player's own standing, then the full ledger.
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { type LeaderboardEntry, type LeaderboardPeriod, type LeaderboardView } from "@shadow/shared";
import { api } from "../api/client";
import { GoogleIcon } from "../auth/AuthMenu";
import { useAuth } from "../auth/store";
import { AvatarImage } from "../avatar/AvatarImage";
import { Avatar } from "../components/Avatar";
import { games, playPath } from "../games/registry";
import { formatDuration } from "../lib/format";

type Game = "shadow-guess" | "sky-climb" | "pair-pop";

const GAMES: { value: Game; number: string; label: string; ranks: string }[] = [
  { value: "shadow-guess", number: "01", label: "Shadow Guess", ranks: "Fewest angles, fastest solve" },
  { value: "sky-climb", number: "02", label: "Sky Climb", ranks: "Highest floor on the tower" },
  { value: "pair-pop", number: "03", label: "Pair Pop", ranks: "Best score on the board" },
];

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "all", label: "All time" },
];

const BLURBS: Record<Game, Record<LeaderboardPeriod, string>> = {
  "shadow-guess": {
    daily: "Today's daily puzzle. Ties go to the faster solver.",
    weekly: "Total over the last seven dailies. Ties go to the faster solver.",
    all: "Total over every daily. Ties go to the faster solver.",
  },
  "sky-climb": {
    daily: "Highest floor on today's tower. Ties go to the faster climber.",
    weekly: "Floors climbed on the last seven towers, each day's best climb.",
    all: "Floors climbed on every daily tower, each day's best climb.",
  },
  "pair-pop": {
    daily: "Score on today's board, first finish only. Ties go to the faster player.",
    weekly: "Total score over the last seven daily boards.",
    all: "Total score over every daily board.",
  },
};

/** What the score column counts, per game. */
const SCORE_LABEL: Record<Game, string> = { "shadow-guess": "Points", "sky-climb": "Floors", "pair-pop": "Points" };

/** The top three's ticket colours: gold, ink, sun. Fixed colours, as on a printed sheet. */
const PLACES = [
  { label: "Champion", rule: "bg-gold", seal: "bg-gold text-ink", numeral: "text-gold" },
  { label: "Second", rule: "bg-ink", seal: "bg-ink text-rice", numeral: "text-ink/70" },
  { label: "Third", rule: "bg-sun", seal: "bg-sun text-rice", numeral: "text-sun" },
];

const pad = (n: number) => String(n).padStart(2, "0");

interface Shown {
  key: string;
  game: Game;
  period: LeaderboardPeriod;
  board: LeaderboardView;
}

/** Boards already loaded this visit, by user, game and period: switching back is instant. */
const boardCache = new Map<string, LeaderboardView>();

function detail(entry: LeaderboardEntry, period: LeaderboardPeriod, game: Game) {
  if (game === "pair-pop") {
    if (period === "daily") return `${entry.wins ? "★★★ · " : ""}${formatDuration(entry.seconds)}`;
    return `${entry.played} board${entry.played === 1 ? "" : "s"} · ${entry.wins} three-star`;
  }
  if (game === "sky-climb") {
    if (period === "daily") return `${entry.wins ? "Summit · " : ""}${formatDuration(entry.seconds)}`;
    return `${entry.played} day${entry.played === 1 ? "" : "s"} · ${entry.wins} summit${entry.wins === 1 ? "" : "s"}`;
  }
  if (period === "daily") return entry.wins ? formatDuration(entry.seconds) : "Missed";
  return `${entry.wins} of ${entry.played} solved`;
}

/** "Oct 14" or "Oct 8 – Oct 14". */
function dateRange(from: string, to: string) {
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  if (from === to) return fmt(to);
  if (from.startsWith("2000")) return `Since launch · to ${fmt(to)}`;
  return `${fmt(from)} – ${fmt(to)}`;
}

function PlayerAvatar({ entry, size }: { entry: LeaderboardEntry; size: "sm" | "lg" }) {
  return entry.avatar ? <AvatarImage config={entry.avatar} size={size} /> : <Avatar src={entry.avatarUrl} name={entry.name} size={size} />;
}

/** One of the top three, as a ticket: a coloured rule, a big numeral, the player and their score. */
function Ticket({ entry, place, game, period, tall }: { entry: LeaderboardEntry; place: number; game: Game; period: LeaderboardPeriod; tall: boolean }) {
  const p = PLACES[place];
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-xs bg-paper-soft text-ink shadow-[0_24px_60px_-34px_rgba(60,45,20,0.6)] ${entry.isMe ? "ring-2 ring-gold" : "ring-1 ring-ink/12"} ${tall ? "sm:-translate-y-4" : ""}`}
    >
      <span aria-hidden className={`h-1.5 w-full ${p.rule}`} />
      <div className="flex items-start justify-between px-5 pt-4">
        <span className={`font-display text-6xl leading-none font-light tabular-nums sm:text-7xl ${p.numeral}`}>{pad(entry.rank)}</span>
        <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] uppercase ${p.seal}`}>{p.label}</span>
      </div>
      <div className="mt-5 flex items-center gap-3 px-5">
        <PlayerAvatar entry={entry} size="lg" />
        <div className="min-w-0">
          <div className="truncate font-serif text-lg font-semibold">{entry.name}</div>
          {entry.isMe && <div className="font-mono text-[10px] tracking-[0.14em] text-sun uppercase">That's you</div>}
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-dashed border-ink/20 px-5 pt-3 pb-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.14em] text-ink/50 uppercase">{SCORE_LABEL[game]}</div>
          <div className="font-display text-4xl leading-none font-light tabular-nums">{entry.score}</div>
        </div>
        <div className="truncate text-right font-mono text-[11px] text-ink/60">{detail(entry, period, game)}</div>
      </div>
    </article>
  );
}

/** A podium place nobody holds yet. */
function OpenSpot({ place, cta }: { place: number; cta: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xs border border-dashed border-white/25 p-6 text-center">
      <span className="font-display text-5xl font-light text-stone-600 tabular-nums">{pad(place + 1)}</span>
      <span className="label-mono text-stone-500">Open spot</span>
      <Link to={cta} className="font-serif text-sm text-ember-400 underline underline-offset-4 hover:text-ember-300">
        Play to claim it →
      </Link>
    </div>
  );
}

/** The top three, champion in the middle on wide screens. Empty places show as open spots. */
function Podium({ entries, game, period, cta }: { entries: LeaderboardEntry[]; game: Game; period: LeaderboardPeriod; cta: string }) {
  const places = [0, 1, 2];
  return (
    <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
      {places.map((place) => {
        const entry = entries[place];
        // Visual order 2 · 1 · 3 from sm up; natural order on phones.
        const order = place === 0 ? "sm:order-2" : place === 1 ? "sm:order-1" : "sm:order-3";
        return (
          <div key={place} className={order}>
            {entry ? (
              <Ticket entry={entry} place={place} game={game} period={period} tall={place === 0} />
            ) : (
              <OpenSpot place={place} cta={cta} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LedgerRow({ entry, game, period }: { entry: LeaderboardEntry; game: Game; period: LeaderboardPeriod }) {
  return (
    <li
      className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b hairline py-3 pr-2 transition-colors sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,12rem)_6rem] sm:gap-4 ${
        entry.isMe ? "border-l-4 border-l-gold bg-lamp-400/10 pl-2" : "pl-3 hover:bg-white/[0.04]"
      }`}
    >
      <span className="font-display text-2xl font-light text-stone-400 tabular-nums sm:text-3xl">{pad(entry.rank)}</span>
      <span className="flex min-w-0 items-center gap-3">
        <PlayerAvatar entry={entry} size="sm" />
        <span className="min-w-0">
          <span className={`block truncate font-serif ${entry.isMe ? "font-semibold text-stone-50" : "text-stone-200"}`}>
            {entry.name}
            {entry.isMe && <span className="ml-2 label-mono text-ember-400">You</span>}
          </span>
          <span className="block truncate label-mono text-stone-500 sm:hidden">{detail(entry, period, game)}</span>
        </span>
      </span>
      <span className="hidden truncate label-mono text-stone-500 sm:block">{detail(entry, period, game)}</span>
      <span className="text-right font-display text-2xl font-light tabular-nums">{entry.score}</span>
    </li>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`group relative inline-flex min-h-11 items-center px-1 label-mono transition-colors ${active ? "text-stone-50" : "text-stone-500 hover:text-stone-200"}`}
    >
      {children}
      <span
        aria-hidden
        className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      />
    </button>
  );
}

export default function Leaderboard() {
  const { user, enabled, synced, signIn } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  // ?game=sky-climb (or pair-pop) opens a game's board directly (the game pages link here).
  const [params, setParams] = useSearchParams();
  const game: Game = GAMES.find((g) => g.value === params.get("game"))?.value ?? "shadow-guess";
  const setGame = (g: Game) => setParams(g === "shadow-guess" ? {} : { game: g }, { replace: true });
  const userKey = user?.id ?? "guest";
  const key = `${userKey}:${game}:${period}`;
  // The board on screen, and which tab it belongs to. Switching tabs keeps it up (dimmed)
  // until the next one arrives, so the page never empties out and jumps.
  const [shown, setShown] = useState<Shown | null>(() => {
    const cached = boardCache.get(key);
    return cached ? { key, game, period, board: cached } : null;
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!synced) return;
    let cancelled = false;
    setError(false);
    // A board seen earlier this visit shows at once, then refreshes quietly.
    const cached = boardCache.get(key);
    if (cached) setShown({ key, game, period, board: cached });
    api<LeaderboardView>(`/api/leaderboard?game=${game}&period=${period}`).then(
      (b) => {
        boardCache.set(key, b);
        if (!cancelled) setShown({ key, game, period, board: b });
      },
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [key, game, period, synced]);

  const board = shown?.board ?? null;
  const stale = !!shown && shown.key !== key;
  // The board on screen is drawn with its own game and period, even while the next loads.
  const view = { game: shown?.game ?? game, period: shown?.period ?? period };

  const entry = games.find((g) => g.id === game);
  const cta = entry ? playPath(entry) : "/";
  const rest = board?.entries.slice(3) ?? [];
  const me = board?.me ?? null;
  const meOutside = me && !board?.entries.some((e) => e.isMe);

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* ---------- Masthead ---------- */}
      <header className="relative border-b hairline pb-8">
        <p className="eyebrow">The standings{board ? ` · ${dateRange(board.from, board.to)}` : ""}</p>
        <div className="mt-3 flex items-end justify-between gap-6">
          <h1 className="text-display">Leaderboard</h1>
          <span aria-hidden className="mb-2 hidden h-16 w-16 shrink-0 rounded-full bg-sun sm:block lg:h-20 lg:w-20" />
        </div>
        <p className="mt-4 max-w-xl text-lead">{BLURBS[game][period]}</p>
      </header>

      {/* ---------- Game index ---------- */}
      <nav aria-label="Game" role="tablist" className="grid grid-cols-3 border-y hairline">
        {GAMES.map((g, i) => {
          const active = g.value === game;
          return (
            <button
              key={g.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGame(g.value)}
              className={`relative px-2 py-4 text-left transition-colors sm:px-5 sm:py-5 ${i > 0 ? "border-l hairline" : ""} ${active ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"}`}
            >
              <span aria-hidden className={`absolute inset-x-0 -top-px h-1 transition-colors ${active ? "bg-gold" : "bg-transparent"}`} />
              <span className={`label-mono ${active ? "text-ember-400" : "text-stone-500"}`}>{g.number}</span>
              <span className={`mt-1 block font-display text-base leading-tight font-light uppercase sm:text-2xl ${active ? "text-stone-50" : "text-stone-400"}`}>{g.label}</span>
              <span className="mt-1 hidden font-serif text-sm text-stone-500 md:block">{g.ranks}</span>
            </button>
          );
        })}
      </nav>

      {/* ---------- Period, count ---------- */}
      <div className="-mt-4 flex flex-wrap items-center justify-between gap-3 sm:-mt-6">
        <div role="tablist" aria-label="Period" className="flex items-center gap-5">
          {PERIODS.map((p) => (
            <Tab key={p.value} active={p.value === period} onClick={() => setPeriod(p.value)}>
              {p.label}
            </Tab>
          ))}
        </div>
        {board && (
          <span className="label-mono text-stone-500">
            {board.totalPlayers} player{board.totalPlayers === 1 ? "" : "s"} ranked
          </span>
        )}
      </div>

      {enabled && synced && !user && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-y hairline py-4">
          <p className="flex items-center gap-3 font-serif text-stone-300">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-sun" />
            Only signed-in players are ranked. Your scores are waiting to count.
          </p>
          <button onClick={() => void signIn()} className="btn btn-primary">
            <GoogleIcon /> Sign in to join
          </button>
        </div>
      )}

      {error ? (
        <p className="font-serif text-stone-400">Couldn't load the leaderboard. Try again in a moment.</p>
      ) : !board ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xs bg-white/[0.04]" />
            ))}
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse border-b hairline" />
          ))}
        </div>
      ) : board.entries.length === 0 ? (
        <div className="grid place-items-center border-y hairline py-20 text-center">
          <span aria-hidden className="h-14 w-14 rounded-full ring-1 ring-ember-400" />
          <h2 className="mt-6 text-section">Nobody yet</h2>
          <p className="mt-3 max-w-sm text-lead">
            {period === "daily" ? "The board is blank today. Finish first and the top spot is yours." : "No finished dailies in this stretch yet."}
          </p>
          <Link to={cta} className="btn btn-primary mt-8">
            Play {entry?.title} <span aria-hidden>→</span>
          </Link>
        </div>
      ) : (
        // One soft fade when a new board lands; dimmed while the next one is on its way.
        <div
          key={shown?.key}
          aria-busy={stale}
          className={`animate-fade space-y-10 transition-opacity duration-300 sm:space-y-12 ${stale ? "pointer-events-none opacity-50" : "opacity-100"}`}
        >
          <Podium entries={board.entries} game={view.game} period={view.period} cta={cta} />

          {/* Your standing, when you're ranked but not on the podium. */}
          {me && me.rank > 3 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xs bg-paper-soft px-5 py-4 text-ink ring-1 ring-ink/12">
              <div className="flex items-center gap-4">
                <span className="font-display text-4xl font-light text-sun tabular-nums">{pad(me.rank)}</span>
                <div>
                  <div className="font-mono text-[10px] tracking-[0.14em] text-ink/50 uppercase">Your standing</div>
                  <div className="font-serif">
                    {me.score} {SCORE_LABEL[view.game].toLowerCase()} · {me.rank - 1} ahead of you
                  </div>
                </div>
              </div>
              <Link to={cta} className="btn btn-primary">
                Climb the board <span aria-hidden>→</span>
              </Link>
            </div>
          )}

          {(rest.length > 0 || meOutside) && (
            <section>
              <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-3 border-b hairline pb-2 pl-3 label-mono text-stone-500 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,12rem)_6rem] sm:gap-4">
                <span>Rank</span>
                <span>Player</span>
                <span className="hidden sm:block">Detail</span>
                <span className="pr-2 text-right">{SCORE_LABEL[view.game]}</span>
              </div>
              <ol>
                {rest.map((e, i) => (
                  <LedgerRow key={e.rank + e.name + i} entry={e} game={view.game} period={view.period} />
                ))}
                {meOutside && (
                  <>
                    <li aria-hidden className="py-2 text-center label-mono text-stone-600">· · ·</li>
                    <LedgerRow entry={me!} game={view.game} period={view.period} />
                  </>
                )}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
