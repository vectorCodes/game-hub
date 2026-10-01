import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { StatsView } from "@shadow/shared";
import { GoogleIcon } from "../auth/AuthMenu";
import { useAuth } from "../auth/store";
import { Avatar } from "../components/Avatar";

function StatTile({ label, value, accent = false, delay }: { label: string; value: string | number; accent?: boolean; delay: number }) {
  return (
    <div
      className="animate-rise rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`font-display text-3xl font-bold tabular-nums sm:text-4xl ${accent ? "text-cyan-300 text-glow" : "text-white"}`}>{value}</div>
      <div className="mt-1 text-xs font-medium tracking-wide text-stone-400 uppercase">{label}</div>
    </div>
  );
}

/** Wins by the angle they were solved on (one series, so no legend: the heading names it). */
function Distribution({ stats }: { stats: StatsView }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const max = Math.max(1, ...stats.distribution);
  const best = stats.distribution.indexOf(Math.max(...stats.distribution));

  return (
    <figure className="animate-rise rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10 [animation-delay:320ms] sm:p-6">
      <figcaption className="mb-4 flex items-baseline justify-between">
        <span className="font-display text-lg font-semibold">Solved on angle</span>
        <span className="text-xs text-stone-500">wins per angle</span>
      </figcaption>
      <ol className="space-y-2" aria-label="Wins by angle">
        {stats.distribution.map((count, i) => (
          <li key={i} className="flex items-center gap-3 text-sm" title={`Angle ${i + 1}: ${count} win${count === 1 ? "" : "s"}`}>
            <span className="w-4 text-right text-stone-400 tabular-nums">{i + 1}</span>
            <div className="h-7 flex-1 rounded-lg bg-white/[0.03]">
              <div
                className={`flex h-full items-center justify-end rounded-lg px-2 transition-[width] duration-700 ease-out ${
                  count && i === best ? "bg-gradient-to-r from-violet-500 to-pink-500 shadow-[0_0_18px_-4px_rgba(236,72,153,0.8)]" : count ? "bg-stone-600" : ""
                }`}
                style={{
                  width: grown ? `${count ? Math.max(8, (count / max) * 100) : 0}%` : "0%",
                  transitionDelay: `${i * 70}ms`,
                }}
              >
                {count > 0 && (
                  <span className={`text-xs font-semibold tabular-nums ${"text-white"}`}>
                    {count}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export default function Profile() {
  const { enabled, user, me, synced, signIn, refreshMe } = useAuth();

  useEffect(() => {
    if (synced) void refreshMe();
  }, [synced, refreshMe]);

  if (!enabled) return <p className="text-stone-400">Sign-in isn't configured for this site.</p>;
  if (!synced || (user && !me)) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl bg-white/[0.03]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );
  }
  if (!user || !me) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white/[0.03] p-6 text-center ring-1 ring-white/10 sm:p-8">
        <div className="text-4xl">🔥</div>
        <h1 className="mt-3 font-display text-2xl font-bold">Keep your streak</h1>
        <p className="mt-2 text-sm text-stone-400">Sign in to save your stats, build a daily streak and join the leaderboard.</p>
        <button
          onClick={() => void signIn()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-medium text-stone-900 transition hover:bg-stone-200"
        >
          <GoogleIcon /> Sign in with Google
        </button>
      </div>
    );
  }

  const { stats, profile } = me;
  const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const name = profile.displayName ?? "Player";
  return (
    <div className="space-y-6">
      <div className="relative flex animate-rise items-center gap-4 overflow-hidden rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10 sm:gap-5 sm:p-6">
        <div aria-hidden className="absolute -top-20 -right-10 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl" />
        <Avatar src={profile.avatarUrl} name={name} size="lg" className="ring-4 ring-violet-500/60" />
        <div className="relative min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight break-words sm:text-3xl">{name}</h1>
          <p className="text-sm text-stone-400">
            Shadow Guess ·{" "}
            <Link to="/leaderboard" className="text-cyan-300 hover:underline">
              see the leaderboard
            </Link>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Played" value={stats.played} delay={80} />
        <StatTile label="Win rate" value={`${winRate}%`} delay={140} />
        <StatTile label="Daily streak" value={`${stats.currentStreak}🔥`} accent delay={200} />
        <StatTile label="Best streak" value={stats.maxStreak} delay={260} />
      </div>

      {stats.won > 0 ? (
        <Distribution stats={stats} />
      ) : (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-stone-400">
          Win a round and your solve pattern shows up here.{" "}
          <Link to="/games/shadow-guess" className="text-cyan-300 hover:underline">
            Play now →
          </Link>
        </div>
      )}
    </div>
  );
}
