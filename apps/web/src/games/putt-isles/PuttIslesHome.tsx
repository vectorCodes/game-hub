// /games/putt-isles: the game's landing page. The course itself is on /play.
import { useEffect } from "react";
import { Link } from "react-router";
import { formatToPar, generatePuttCourse, PUTT_HOLES_PER_ROUND, PUTT_ISLANDS, puttDailySeed, puttTotals } from "@shadow/shared";
import { useAuth } from "../../auth/store";
import { Reveal } from "../../components/Reveal";
import { formatCountdown, formatDuration } from "../../lib/format";
import { useNow } from "../shadow-guess/useDaily";
import { PUTT_ISLES_PATH } from "./config";
import { savedDailyResult } from "./guest";
import { PuttIslesCover } from "./HubCard";
import { usePutt } from "./store";

const STEPS = [
  { emoji: "🎯", title: "Drag back, let go", body: "Pull back from anywhere like a slingshot. The further you pull, the harder the putt." },
  { emoji: "🧱", title: "Bank it", body: "The dotted line shows your first bounce. Walls are your friends." },
  { emoji: "⛳", title: "Sink it", body: "Every hole has a par. Beat it for a birdie, or find the line for a hole in one." },
];

const ISLAND_BLURBS: Record<string, string> = {
  meadow: "Gentle bends and soft greens to warm up.",
  grove: "Hills, bumps and twin lanes.",
  dunes: "Gaps to fall through and castles to thread.",
  glacier: "Long switchbacks. Plan two shots ahead.",
  storm: "The finale. Brutal, and worth it.",
};

/** Today's daily as far as it's been played: from the server, or this browser for guests. */
function useMyDaily() {
  const daily = usePutt((s) => s.daily);
  const signedIn = useAuth((s) => !!s.user);
  const strokes = signedIn ? (daily?.myRound?.strokes ?? []) : savedDailyResult();
  const pars = daily ? generatePuttCourse(puttDailySeed(daily.date)).map((h) => h.par) : [];
  return { strokes, totals: pars.length ? puttTotals(strokes, pars) : null };
}

export default function PuttIslesHome() {
  const daily = usePutt((s) => s.daily);
  const loadDaily = usePutt((s) => s.loadDaily);
  const setMode = usePutt((s) => s.setMode);
  const synced = useAuth((s) => s.synced);
  const now = useNow();
  const { strokes, totals } = useMyDaily();
  const finished = strokes.length >= PUTT_HOLES_PER_ROUND;
  const started = strokes.length > 0 && !finished;

  useEffect(() => {
    if (synced) void loadDaily();
  }, [synced, loadDaily]);

  return (
    <div className="pb-24">
      <section className="container-page grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:py-20">
        <div className="text-center md:text-left">
          <p className="eyebrow animate-rise">{daily ? `Course #${daily.number} · next in ${formatCountdown(daily.nextAt, now)}` : "Mini-golf in the sky"}</p>
          <h1 className="mt-4 animate-rise text-display [animation-delay:80ms]">
            Putt{" "}
            <span className="bg-gradient-to-r from-moss-200 via-moss-300 to-moss-500 bg-clip-text text-transparent">Isles</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md animate-rise text-lead [animation-delay:160ms] md:mx-0">
            Nine floating islands, one hole on each. Bank off the walls, ride the hills, and sink it in as few strokes as you can. A new course every day.
          </p>
          {finished && totals && (
            <p className="mt-5 inline-flex animate-rise items-center gap-2 rounded-full bg-moss-400/15 px-4 py-1.5 text-sm font-medium text-moss-100 ring-1 ring-moss-300/30 [animation-delay:200ms]">
              Today: <span className="font-display font-semibold">{formatToPar(totals.toPar)}</span>
              <span className="text-moss-200/70">
                · {totals.strokes} strokes · {totals.points} pts
              </span>
            </p>
          )}
          <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:240ms] sm:flex-row max-md:justify-center">
            <Link to={PUTT_ISLES_PATH} onClick={() => setMode("daily")} className="btn btn-primary">
              {finished ? "See your card" : started ? `Carry on · hole ${strokes.length + 1}` : "Play today's course"} <span aria-hidden>⛳</span>
            </Link>
            <Link to={PUTT_ISLES_PATH} onClick={() => setMode("practice")} className="btn btn-secondary">
              Practice
            </Link>
          </div>
          <p className="mt-4 animate-rise text-sm text-stone-400 [animation-delay:300ms]">
            {daily?.players ? `${daily.players} finished today · ` : ""}Free · No sign-up needed
          </p>
        </div>
        <div className="animate-rise [animation-delay:200ms]">
          <PuttIslesCover />
        </div>
      </section>

      <section className="container-page py-16">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">The islands</p>
          <h2 className="mt-4 text-section">Easy to start. Hard to master.</h2>
          <p className="mt-4 text-lead">Every round climbs through five islands, two holes on each, and the last one alone. The holes get longer and trickier as you go.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PUTT_ISLANDS.map((island, i) => (
            <Reveal key={island.id} delay={i * 70} className="surface p-6">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{island.emoji}</span>
                <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">{i < 4 ? `Holes ${i * 2 + 1}–${i * 2 + 2}` : "Hole 9"}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{island.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{ISLAND_BLURBS[island.id]}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <Reveal>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-4 text-section">Aim. Putt. Sink it.</h2>
            </Reveal>
            <div className="mt-8 space-y-4">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 80} className="flex gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-2xl ring-1 ring-white/10">{s.emoji}</span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 text-stone-400">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={120} className="surface p-6 sm:p-7">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Today&rsquo;s best rounds</p>
            {daily?.top.length ? (
              <ol className="mt-4 space-y-1.5 text-sm">
                {daily.top.slice(0, 8).map((e) => (
                  <li key={`${e.rank}-${e.name}`} className={`flex justify-between rounded-xl px-3 py-2 ${e.isMe ? "bg-lamp-300/15 ring-1 ring-lamp-300/30" : "bg-white/[0.03]"}`}>
                    <span>
                      <span className="mr-2 text-stone-500 tabular-nums">{e.rank}</span>
                      {e.name}
                    </span>
                    <span className="tabular-nums text-stone-300">
                      {formatToPar(e.toPar)} · {e.points} pts <span className="text-stone-500">· {formatDuration(e.seconds)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-stone-400">Nobody&rsquo;s finished today&rsquo;s course yet. Get round first and it&rsquo;s yours.</p>
            )}
            <Link to={PUTT_ISLES_PATH} onClick={() => setMode("daily")} className="btn btn-primary mt-6 w-full">
              Tee off <span aria-hidden>⛳</span>
            </Link>
            <Link to="/leaderboard?game=putt-isles" className="mt-3 block text-center text-sm text-stone-400 hover:text-stone-200">
              This week and all-time leaderboards →
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
