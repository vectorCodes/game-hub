// /profile: the player's file. A masthead with the avatar and the daily streak, then one
// numbered chapter per game, set like the leaderboard's printed sheet.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { StatsView } from "@shadow/shared";
import { GoogleIcon } from "../auth/AuthMenu";
import { useAuth } from "../auth/store";
import { AvatarImage } from "../avatar/AvatarImage";
import { useAvatar } from "../avatar/store";
import { Avatar } from "../components/Avatar";
import { ChapterHeader, StatStrip } from "../components/Editorial";
import { PairPopProfileSection } from "../games/pair-pop/ProfileSection";
import { SHADOW_GUESS_HOME, SHADOW_GUESS_PATH } from "../games/shadow-guess/useDaily";
import { SkyClimbProfileSection } from "../games/sky-climb/ProfileSection";

/** Wins by the angle they were solved on: one bar per angle, the most common one in gold. */
function Distribution({ stats }: { stats: StatsView }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const max = Math.max(1, ...stats.distribution);
  const best = stats.distribution.indexOf(Math.max(...stats.distribution));

  return (
    <figure className="pt-6">
      <figcaption className="mb-4 flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-light uppercase">Solved on angle</span>
        <span className="label-mono text-stone-500">Wins per angle</span>
      </figcaption>
      <ol className="space-y-2.5" aria-label="Wins by angle">
        {stats.distribution.map((count, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.5rem] items-center gap-3" title={`Angle ${i + 1}: ${count} win${count === 1 ? "" : "s"}`}>
            <span className="font-display text-lg font-light text-stone-400 tabular-nums">{i + 1}</span>
            <div className="h-3 border-b hairline">
              <div
                className={`h-full transition-[width] duration-700 ease-mirai ${count && i === best ? "bg-gold" : "bg-stone-300"}`}
                style={{ width: grown ? `${count ? Math.max(3, (count / max) * 100) : 0}%` : "0%", transitionDelay: `${i * 70}ms` }}
              />
            </div>
            <span className={`text-right font-mono text-sm tabular-nums ${count ? "text-stone-100" : "text-stone-600"}`}>{count}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Skeleton() {
  return (
    <div className="space-y-10">
      <div className="flex items-center gap-5 border-b hairline pb-8">
        <div className="h-24 w-24 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-12 w-64 max-w-[50%] animate-pulse bg-white/[0.06]" />
      </div>
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { enabled, user, me, synced, signIn, refreshMe } = useAuth();
  const avatar = useAvatar((s) => (s.custom ? s.config : null));

  useEffect(() => {
    if (synced) void refreshMe();
  }, [synced, refreshMe]);

  if (!enabled) return <p className="font-serif text-stone-400">Sign-in isn't configured for this site.</p>;
  if (!synced || (user && !me)) return <Skeleton />;
  if (!user || !me) {
    return (
      <div className="mx-auto grid max-w-lg place-items-center border-y hairline py-16 text-center sm:py-20">
        <span aria-hidden className="h-14 w-14 rounded-full bg-sun" />
        <p className="mt-6 eyebrow">Player file</p>
        <h1 className="mt-3 text-section">Keep your streak</h1>
        <p className="mt-4 text-lead">Sign in to save your stats across every game, build a daily streak and join the leaderboard.</p>
        <button onClick={() => void signIn()} className="btn btn-primary mt-8">
          <GoogleIcon /> Sign in with Google
        </button>
      </div>
    );
  }

  const { stats, profile } = me;
  const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const name = profile.displayName ?? "Player";

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* ---------- Masthead ---------- */}
      <header className="flex animate-rise flex-col gap-6 border-b hairline pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link to="/avatar" className="group relative shrink-0" aria-label="Edit your avatar">
            {avatar ? (
              <AvatarImage config={avatar} size="xl" className="h-20! w-20! ring-1 ring-white/20 sm:h-28! sm:w-28!" />
            ) : (
              <Avatar src={profile.avatarUrl} name={name} size="lg" className="h-20! w-20! text-3xl sm:h-28! sm:w-28!" />
            )}
            <span className="absolute -right-1 -bottom-1 grid h-8 w-8 place-items-center rounded-full bg-gold text-sm text-ink ring-4 ring-stone-950 transition-transform group-hover:scale-110">
              ✎
            </span>
          </Link>
          <div className="min-w-0">
            <p className="eyebrow">Player file</p>
            <h1 className="mt-2 font-display text-4xl leading-[0.95] font-light break-words uppercase sm:text-6xl">{name}</h1>
            <Link to="/avatar" className="mt-2 inline-block label-mono text-stone-400 underline decoration-stone-600 underline-offset-4 hover:text-stone-100">
              Edit avatar
            </Link>
          </div>
        </div>
        {/* The streak, as a seal. */}
        <div className="flex items-center gap-4 self-start sm:self-auto">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-sun text-rice sm:h-28 sm:w-28">
            <div className="text-center">
              <div className="font-display text-4xl leading-none font-light tabular-nums sm:text-5xl">{stats.currentStreak}</div>
              <div className="mt-1 font-mono text-[9px] font-semibold tracking-[0.16em] uppercase">Day streak</div>
            </div>
          </div>
          <p className="max-w-40 font-serif text-sm text-stone-400">
            {stats.currentStreak ? "Solve today's shadow to keep it going." : "Solve today's shadow to start a streak."}
          </p>
        </div>
      </header>

      {/* ---------- 01 Shadow Guess ---------- */}
      <section className="animate-rise [animation-delay:120ms]">
        <ChapterHeader number="01" title="Shadow Guess" note="Name the object from its shadow." link={{ to: SHADOW_GUESS_HOME, label: "Today's shadow" }} />
        <StatStrip
          stats={[
            { label: "Played", value: stats.played },
            { label: "Win rate", value: `${winRate}%` },
            { label: "Daily streak", value: stats.currentStreak, accent: true },
            { label: "Best streak", value: stats.maxStreak },
          ]}
        />
        {stats.won > 0 ? (
          <Distribution stats={stats} />
        ) : (
          <p className="pt-6 font-serif text-stone-400">
            Win a round and your solve pattern shows up here.{" "}
            <Link to={SHADOW_GUESS_PATH} className="text-ember-400 underline underline-offset-4">
              Play now →
            </Link>
          </p>
        )}
      </section>

      <SkyClimbProfileSection />
      <PairPopProfileSection />
    </div>
  );
}
